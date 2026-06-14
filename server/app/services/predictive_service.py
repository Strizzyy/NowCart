"""Predictive Service — the "Zero Door" that pre-stages a restock cart.

Analyzes user order history to predict product depletion and pre-build
a confident "your usual restock" cart before the user even asks.

Algorithm:
1. For each product a user has ordered 2+ times, compute inter-purchase interval
2. Project when the product will likely be depleted (last purchase + avg interval)
3. If projected depletion is within the next 3 days, include in prediction
4. Score confidence based on regularity (low std dev = high confidence)
5. Build a pre-staged cart with substitution intelligence for OOS items

This runs as a lightweight computation — no ML training, just statistics.
At scale, this would be a scheduled Lambda (nightly) writing predictions
to DynamoDB. For the demo, it runs on-demand per user.
"""
from __future__ import annotations

import logging
import uuid
from collections import defaultdict
from datetime import datetime, timedelta

from app.core.config import settings
from app.models.domain.cart import Cart, CartItem
from app.models.domain.enums import IntentMode
from app.models.domain.order import Order
from app.models.domain.product import Product
from app.repositories import get_repository, get_cache
from app.services.catalog_service import get_catalog_service

logger = logging.getLogger(__name__)


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


class PredictiveService:
    """Predicts what users need before they ask — the Zero Door."""

    async def predict_restock(self, user_id: str) -> Cart | None:
        """Analyze order history and build a predicted restock cart.

        Returns None if the user has insufficient history or no predictions
        exceed the confidence threshold.

        Returns:
            A pre-staged Cart with mode=PREDICT, or None.
        """
        if not settings.prediction_enabled:
            return None

        repo = get_repository()
        orders = await repo.get_orders(user_id)

        if len(orders) < 2:
            return None  # Need at least 2 orders for interval analysis

        # Analyze purchase patterns
        predictions = self._analyze_patterns(orders)

        if not predictions:
            return None

        # Build cart from predictions
        cart = await self._build_predicted_cart(predictions)

        # Save to cache so cart operations (remove, update qty) work
        if cart is not None:
            cache = get_cache()
            await cache.save_cart(cart.session_id, cart)

        return cart

    def _analyze_patterns(self, orders: list[Order]) -> list[PredictedNeed]:
        """Compute inter-purchase intervals and predict depletion.

        For each product bought 2+ times:
        1. Compute dates of each purchase
        2. Calculate average interval between purchases
        3. Project when user will need it next
        4. Score confidence based on regularity
        """
        # Track purchase dates per product
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

            # Sort dates chronologically
            dates.sort()

            # Compute intervals between consecutive purchases
            intervals: list[float] = []
            for i in range(1, len(dates)):
                delta = (dates[i] - dates[i - 1]).days
                if delta > 0:  # skip same-day purchases
                    intervals.append(delta)

            if not intervals:
                continue

            avg_interval = sum(intervals) / len(intervals)
            last_purchase = dates[-1]
            days_since_last = (now - last_purchase).days

            # Predicted days until depletion (negative = already overdue)
            predicted_depletion = avg_interval - days_since_last

            # Only predict if depletion is within next 7 days or overdue
            if predicted_depletion > 7:
                continue

            # Confidence based on regularity (low variance = high confidence)
            if len(intervals) >= 2:
                mean = avg_interval
                variance = sum((x - mean) ** 2 for x in intervals) / len(intervals)
                std_dev = variance ** 0.5
                # coefficient of variation: lower = more regular
                cv = std_dev / mean if mean > 0 else 1.0
                # Map CV to confidence: CV=0 → conf=0.95, CV=1 → conf=0.3
                regularity_conf = max(0.3, min(0.95, 1.0 - cv * 0.65))
            else:
                regularity_conf = 0.5  # only 2 purchases — moderate confidence

            # Boost confidence if overdue (negative depletion days)
            if predicted_depletion < 0:
                overdue_boost = min(0.1, abs(predicted_depletion) * 0.02)
                regularity_conf = min(0.98, regularity_conf + overdue_boost)

            # Frequency boost: more purchases = more confident
            freq_boost = min(0.1, (len(dates) - 2) * 0.02)
            final_confidence = min(0.98, regularity_conf + freq_boost)

            if final_confidence < settings.restock_confidence_threshold:
                continue

            # Build reason
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

        # Sort by confidence (highest first), then by urgency (most overdue first)
        predictions.sort(key=lambda p: (-p.confidence, p.predicted_depletion_days))

        # Cap at 12 items (a reasonable restock cart)
        return predictions[:12]

    async def _build_predicted_cart(self, predictions: list[PredictedNeed]) -> Cart:
        """Build a cart from predictions, handling out-of-stock via substitution."""
        catalog = get_catalog_service()
        items: list[CartItem] = []
        notes: list[str] = ["🔮 Predicted restock — based on your purchase patterns"]

        for pred in predictions:
            # Check if the product is still available
            is_available = await catalog.check_availability(pred.product_id)

            if is_available:
                # Get full product details
                repo = get_repository()
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
                # Find substitute via fuzzy matching
                matches = await catalog.fuzzy_match_need(
                    need_name=pred.product_name,
                    category_hint=None,
                    top_k=5,
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
                    notes.append(f"Could not find: {pred.product_name} (out of stock, no substitute)")

        if not items:
            return None

        cart = Cart(
            session_id=str(uuid.uuid4()),
            items=items,
            mode=IntentMode.TEXT,  # We'll add PREDICT mode
            confidence=round(sum(i.confidence for i in items) / len(items), 3),
            notes=notes,
            reasoning_trail=[
                f"Zero Door prediction: analyzed {len(predictions)} purchase patterns",
                f"Built restock cart with {len(items)} items",
            ],
        )
        cart.recompute_total()
        return cart

    async def get_prediction_insights(self, user_id: str) -> list[dict]:
        """Return raw prediction data for the frontend (without building a cart).

        Useful for showing "you might need soon" suggestions.
        """
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


_predictive_service: PredictiveService | None = None


def get_predictive_service() -> PredictiveService:
    """Return the singleton PredictiveService."""
    global _predictive_service
    if _predictive_service is None:
        _predictive_service = PredictiveService()
    return _predictive_service
