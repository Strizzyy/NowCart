"""Subscribe Service — the "Subscribe" front door.

Two modes:
1. Predicted restock: Analyzes order history to predict product depletion.
   Returns suggestions (not auto-added) with confidence scores.
2. Recurring schedules: User sets per-product frequencies (daily/weekly/monthly).
   Items due today are pre-populated into the cart at load time.

Predictive algorithm:
- For each product ordered 2+ times, compute inter-purchase intervals
- Project depletion via coefficient of variation scoring
- Rank by confidence (low std dev = high confidence)
- Only include predictions where depletion is within next 7 days or overdue
- Confidence threshold: settings.restock_confidence_threshold (default 0.6)

No ML training, no cold start — pure statistics.
"""
from __future__ import annotations

import json
import logging
import uuid
from collections import defaultdict
from datetime import datetime, timedelta

from app.core.config import settings
from app.models.domain.cart import Cart, CartItem
from app.models.domain.enums import IntentMode
from app.models.domain.order import Order
from app.repositories import get_repository, get_cache
from app.services.catalog_service import get_catalog_service

logger = logging.getLogger(__name__)

# DynamoDB table name for subscriptions (used when backend is dynamodb)
SUBSCRIPTIONS_TABLE = "NowCart_Subscriptions"

# Cache key prefix for subscriptions (memory/Redis backend)
_SUB_CACHE_PREFIX = "subscriptions:"


class PredictedNeed:
    """A single predicted restock need."""

    def __init__(
        self,
        product_id: str,
        product_name: str,
        avg_interval_days: float,
        days_since_last: float,
        predicted_depletion_days: float,
        confidence: float,
        purchase_count: int,
        reason: str,
    ):
        self.product_id = product_id
        self.product_name = product_name
        self.avg_interval_days = avg_interval_days
        self.days_since_last = days_since_last
        self.predicted_depletion_days = predicted_depletion_days
        self.confidence = confidence
        self.purchase_count = purchase_count
        self.reason = reason


class SubscribeService:
    """Predicted restock + recurring schedules — the Subscribe front door."""

    # -----------------------------------------------------------------------
    # Mode 1: Predicted restock
    # -----------------------------------------------------------------------

    async def predict_restock(self, user_id: str) -> Cart | None:
        """Analyze order history and build a predicted restock cart.

        Returns None if the user has insufficient history or no predictions
        exceed the confidence threshold. Output is suggestions, not auto-added.
        """
        if not settings.prediction_enabled:
            return None

        repo = get_repository()
        orders = await repo.get_orders(user_id)

        if len(orders) < 2:
            return None

        predictions = self._analyze_patterns(orders)
        if not predictions:
            return None

        cart = await self._build_predicted_cart(predictions)
        if cart is not None:
            cache = get_cache()
            await cache.save_cart(cart.session_id, cart)
        return cart

    def _analyze_patterns(self, orders: list[Order]) -> list[PredictedNeed]:
        """Compute inter-purchase intervals and predict depletion."""
        product_purchases: dict[str, list[datetime]] = defaultdict(list)
        product_names: dict[str, str] = {}

        for order in orders:
            try:
                order_date = datetime.fromisoformat(order.order_date)
            except (ValueError, TypeError):
                continue
            for item in order.items:
                pid = item.get("product_id", "")
                if pid:
                    product_purchases[pid].append(order_date)
                    product_names[pid] = item.get("name", pid)

        now = datetime.now()
        predictions: list[PredictedNeed] = []

        for pid, dates in product_purchases.items():
            if len(dates) < 2:
                continue
            dates.sort()
            intervals: list[float] = [
                (dates[i] - dates[i - 1]).days
                for i in range(1, len(dates))
                if (dates[i] - dates[i - 1]).days > 0
            ]
            if not intervals:
                continue

            avg_interval = sum(intervals) / len(intervals)
            days_since_last = (now - dates[-1]).days
            predicted_depletion = avg_interval - days_since_last

            if predicted_depletion > 7:
                continue

            if len(intervals) >= 2:
                mean = avg_interval
                variance = sum((x - mean) ** 2 for x in intervals) / len(intervals)
                cv = (variance ** 0.5) / mean if mean > 0 else 1.0
                regularity_conf = max(0.3, min(0.95, 1.0 - cv * 0.65))
            else:
                regularity_conf = 0.5

            if predicted_depletion < 0:
                regularity_conf = min(0.98, regularity_conf + min(0.1, abs(predicted_depletion) * 0.02))

            final_confidence = min(0.98, regularity_conf + min(0.1, (len(dates) - 2) * 0.02))

            if final_confidence < settings.restock_confidence_threshold:
                continue

            if predicted_depletion < 0:
                reason = f"You're likely out — last bought {days_since_last} days ago (usually every {avg_interval:.0f} days)"
            else:
                reason = f"Running low — you buy this every ~{avg_interval:.0f} days, due in {predicted_depletion:.0f} days"

            predictions.append(PredictedNeed(
                product_id=pid,
                product_name=product_names.get(pid, pid),
                avg_interval_days=avg_interval,
                days_since_last=days_since_last,
                predicted_depletion_days=predicted_depletion,
                confidence=round(final_confidence, 3),
                purchase_count=len(dates),
                reason=reason,
            ))

        predictions.sort(key=lambda p: (-p.confidence, p.predicted_depletion_days))
        return predictions[:12]

    async def _build_predicted_cart(self, predictions: list[PredictedNeed]) -> Cart | None:
        """Build a cart from predictions (suggestions only — not auto-added)."""
        catalog = get_catalog_service()
        repo = get_repository()
        items: list[CartItem] = []
        notes: list[str] = ["🔮 Predicted restock — based on your purchase patterns"]

        for pred in predictions:
            if await catalog.check_availability(pred.product_id):
                product = await repo.get_product(pred.product_id)
                if product:
                    items.append(CartItem(
                        product_id=product.product_id,
                        name=product.name,
                        brand=product.brand,
                        price=product.sale_price,
                        quantity=1.0,
                        unit="unit",
                        reason=pred.reason,
                        confidence=pred.confidence,
                        image_url=product.image_url,
                    ))
            else:
                matches = await catalog.fuzzy_match_need(
                    need_name=pred.product_name, category_hint=None, top_k=5
                )
                for product, score in matches:
                    if product.product_id != pred.product_id:
                        if await catalog.check_availability(product.product_id):
                            items.append(CartItem(
                                product_id=product.product_id,
                                name=product.name,
                                brand=product.brand,
                                price=product.sale_price,
                                quantity=1.0,
                                unit="unit",
                                reason=f"{pred.reason} (substituted — original out of stock)",
                                confidence=pred.confidence * 0.85,
                                substituted_for=pred.product_id,
                                image_url=product.image_url,
                            ))
                            break
                else:
                    notes.append(f"Could not find: {pred.product_name} (out of stock)")

        if not items:
            return None

        cart = Cart(
            session_id=str(uuid.uuid4()),
            items=items,
            mode=IntentMode.SUBSCRIBE,
            confidence=round(sum(i.confidence for i in items) / len(items), 3),
            notes=notes,
            reasoning_trail=[
                f"Subscribe prediction: analyzed {len(predictions)} purchase patterns",
                f"Built restock cart with {len(items)} items",
            ],
        )
        cart.recompute_total()
        return cart

    async def get_prediction_insights(self, user_id: str) -> list[dict]:
        """Return raw prediction data for the frontend (without building a cart)."""
        repo = get_repository()
        orders = await repo.get_orders(user_id)
        if len(orders) < 2:
            return []
        predictions = self._analyze_patterns(orders)
        return [
            {
                "product_id": p.product_id,
                "product_name": p.product_name,
                "avg_interval_days": round(p.avg_interval_days, 1),
                "days_since_last": round(p.days_since_last, 1),
                "predicted_depletion_days": round(p.predicted_depletion_days, 1),
                "confidence": p.confidence,
                "purchase_count": p.purchase_count,
                "reason": p.reason,
            }
            for p in predictions
        ]


    # -----------------------------------------------------------------------
    # Mode 2: Recurring schedules
    # -----------------------------------------------------------------------

    async def _get_subscriptions_key(self, user_id: str) -> str:
        return f"{_SUB_CACHE_PREFIX}{user_id}"

    async def _load_subscriptions(self, user_id: str) -> list[dict]:
        """Load all subscriptions for a user from cache/storage."""
        cache = get_cache()
        raw = await cache._get(await self._get_subscriptions_key(user_id))
        if raw:
            try:
                return json.loads(raw)
            except Exception:
                pass
        return []

    async def _save_subscriptions(self, user_id: str, subs: list[dict]) -> None:
        """Persist subscriptions to cache (no TTL — permanent until deleted)."""
        cache = get_cache()
        await cache._set(
            await self._get_subscriptions_key(user_id),
            json.dumps(subs),
        )

    async def add_subscription(
        self,
        user_id: str,
        product_id: str,
        product_name: str,
        frequency: str,
    ) -> dict:
        """Add or update a recurring subscription for a product.

        Args:
            user_id: The user.
            product_id: Product to subscribe to.
            product_name: Human-readable name.
            frequency: "daily" | "weekly" | "monthly"

        Returns:
            The created/updated subscription dict.
        """
        subs = await self._load_subscriptions(user_id)

        # Compute next due date
        today = datetime.now().date()
        freq_days = {"daily": 1, "weekly": 7, "monthly": 30}.get(frequency, 7)
        next_due = (today + timedelta(days=freq_days)).isoformat()

        # Replace if already subscribed to this product
        existing_idx = next((i for i, s in enumerate(subs) if s["product_id"] == product_id), None)
        sub = {
            "user_id": user_id,
            "product_id": product_id,
            "product_name": product_name,
            "frequency": frequency,
            "next_due_date": next_due,
        }

        if existing_idx is not None:
            subs[existing_idx] = sub
        else:
            subs.append(sub)

        await self._save_subscriptions(user_id, subs)
        return sub

    async def remove_subscription(self, user_id: str, product_id: str) -> bool:
        """Remove a subscription. Returns True if it existed."""
        subs = await self._load_subscriptions(user_id)
        original_len = len(subs)
        subs = [s for s in subs if s["product_id"] != product_id]
        if len(subs) == original_len:
            return False
        await self._save_subscriptions(user_id, subs)
        return True

    async def get_subscriptions(self, user_id: str) -> list[dict]:
        """Get all subscriptions for a user."""
        return await self._load_subscriptions(user_id)

    async def get_due_subscriptions(self, user_id: str) -> list[dict]:
        """Get subscriptions due today (next_due_date <= today).

        Used at cart load time to pre-populate recurring items.
        """
        subs = await self._load_subscriptions(user_id)
        today = datetime.now().date().isoformat()
        due = []
        updated_subs = []

        for sub in subs:
            if sub.get("next_due_date", "") <= today:
                due.append(sub)
                # Advance next_due_date
                freq_days = {"daily": 1, "weekly": 7, "monthly": 30}.get(sub["frequency"], 7)
                next_due = (datetime.now().date() + timedelta(days=freq_days)).isoformat()
                updated_sub = dict(sub, next_due_date=next_due)
                updated_subs.append(updated_sub)
            else:
                updated_subs.append(sub)

        if due:
            await self._save_subscriptions(user_id, updated_subs)

        return due

    async def build_due_cart(self, user_id: str) -> Cart | None:
        """Build a cart from subscriptions due today.

        Returns None if no subscriptions are due.
        """
        due = await self.get_due_subscriptions(user_id)
        if not due:
            return None

        catalog = get_catalog_service()
        repo = get_repository()
        items: list[CartItem] = []

        for sub in due:
            product = await repo.get_product(sub["product_id"])
            if product and await catalog.check_availability(product.product_id):
                items.append(CartItem(
                    product_id=product.product_id,
                    name=product.name,
                    brand=product.brand,
                    price=product.sale_price,
                    quantity=1.0,
                    unit="unit",
                    reason=f"Recurring {sub['frequency']} subscription",
                    confidence=0.99,
                    image_url=product.image_url,
                ))
            else:
                # Product unavailable — try fuzzy fallback
                matches = await catalog.fuzzy_match_need(
                    need_name=sub["product_name"], category_hint=None, top_k=3
                )
                for fp, _score in matches:
                    if await catalog.check_availability(fp.product_id):
                        items.append(CartItem(
                            product_id=fp.product_id,
                            name=fp.name,
                            brand=fp.brand,
                            price=fp.sale_price,
                            quantity=1.0,
                            unit="unit",
                            reason=f"Recurring {sub['frequency']} subscription (substituted)",
                            confidence=0.85,
                            image_url=fp.image_url,
                        ))
                        break

        if not items:
            return None

        cart = Cart(
            session_id=str(uuid.uuid4()),
            items=items,
            mode=IntentMode.SUBSCRIBE,
            confidence=0.99,
            notes=["📅 Your recurring subscriptions due today"],
            reasoning_trail=[f"Subscribe: {len(items)} recurring items due today"],
        )
        cart.recompute_total()
        cache = get_cache()
        await cache.save_cart(cart.session_id, cart)
        return cart


_subscribe_service: SubscribeService | None = None


def get_subscribe_service() -> SubscribeService:
    """Return the singleton SubscribeService."""
    global _subscribe_service
    if _subscribe_service is None:
        _subscribe_service = SubscribeService()
    return _subscribe_service


# Backward-compat alias (old code that imports get_predictive_service)
def get_predictive_service() -> SubscribeService:
    return get_subscribe_service()
