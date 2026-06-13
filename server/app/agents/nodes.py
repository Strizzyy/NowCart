"""Pipeline nodes for the LangGraph Outcome Engine (Requirement 1.6).

Each node is an async function: state → partial state update dict.
Nodes are composed into a StateGraph in the graph module.
"""
from __future__ import annotations

import re
import uuid

from app.core.config import settings
from app.llm.factory import get_text_provider
from app.models.domain.enums import IntentMode, NeedStatus
from app.models.domain.need import Need
from app.models.domain.cart import Cart, CartItem, Substitution
from app.services.catalog_service import get_catalog_service

from app.agents.state import AgentState


# ---------------------------------------------------------------------------
# Quantity normalization — LLM returns raw amounts (500g, 200ml) but products
# are sold in packs. Convert to "how many packs to buy".
# ---------------------------------------------------------------------------

_WEIGHT_UNITS = {"g", "gm", "gram", "grams", "kg", "kilogram", "kilograms"}
_VOLUME_UNITS = {"ml", "milliliter", "milliliters", "l", "ltr", "litre", "liter", "liters", "litres"}
_PACK_UNITS = {"pack", "packet", "box", "bottle", "jar", "can", "pouch", "bag",
               "piece", "pieces", "unit", "units", "dozen", "bunch"}
_SPOON_UNITS = {"tablespoon", "tablespoons", "tbsp", "teaspoon", "teaspoons", "tsp",
                "cup", "cups", "pinch"}


def _normalize_quantity_to_packs(quantity: float, unit: str) -> float:
    """Convert raw LLM quantities to number of product packs to buy.

    Examples:
        500 grams → 1 pack
        2 kg → 2 packs
        200 ml → 1 pack
        3 pieces → 3
        2 tablespoons → 1 (buy 1 bottle of the spice)
        6 eggs → 1 (buy 1 carton)
    """
    unit_lower = unit.lower().strip()

    # Spoon/cooking measures → always 1 pack (you buy 1 jar/bottle)
    if unit_lower in _SPOON_UNITS:
        return 1.0

    # Grams → normalize to packs (most products are 200g-1kg packs)
    if unit_lower in _WEIGHT_UNITS:
        if unit_lower in ("kg", "kilogram", "kilograms"):
            # kg → round up to nearest whole number
            return max(1.0, round(quantity))
        else:
            # grams → 1 pack for anything under 1kg, 2 for more
            if quantity <= 1000:
                return 1.0
            return max(1.0, round(quantity / 1000))

    # Milliliters → normalize to packs
    if unit_lower in _VOLUME_UNITS:
        if unit_lower in ("l", "ltr", "litre", "liter", "liters", "litres"):
            return max(1.0, round(quantity))
        else:
            # ml → 1 pack for anything under 1L
            if quantity <= 1000:
                return 1.0
            return max(1.0, round(quantity / 1000))

    # Pack/piece/unit → use as-is but cap reasonably
    if unit_lower in _PACK_UNITS:
        return max(1.0, quantity)

    # Medium/large/small (e.g. "2 medium onions") → use as-is
    if unit_lower in ("medium", "large", "small"):
        return max(1.0, quantity)

    # Default: if quantity is > 10 and unit is unknown, probably raw weight
    if quantity > 10:
        return 1.0

    return max(1.0, quantity)


# ---------------------------------------------------------------------------
# Intent node
# ---------------------------------------------------------------------------

_SERVING_PATTERN = re.compile(
    r"(?:for\s+)?(\d+)\s*(?:people|persons|servings|pax|guests)",
    re.IGNORECASE,
)

_MODE_KEYWORDS: dict[IntentMode, list[str]] = {
    IntentMode.BUDGET: ["budget", "₹", "rs", "rupees", "under", "within"],
    IntentMode.SOS: ["sos", "emergency", "urgent", "fever", "guests in"],
    IntentMode.CART_OP: ["add", "remove", "delete", "update", "total", "what's in my cart"],
    IntentMode.PHOTO: ["photo", "image", "picture", "snap"],
    IntentMode.LINK: ["http", "https", "recipe link", "shared"],
    IntentMode.GOAL: [
        "i want to", "my goal", "help me", "i need to",
        "lose weight", "gain muscle", "build muscle", "eat healthy",
        "get fit", "stay healthy", "improve", "boost energy",
        "reduce cholesterol", "manage diabetes", "high protein diet",
        "low carb", "keto", "vegan lifestyle",
    ],
    IntentMode.RECIPE: ["making", "cook", "prepare", "recipe", "bake", "fry"],
}


async def intent_node(state: AgentState) -> dict:
    """Classify the user's intent mode from raw_input and extract servings.

    If mode is already set (e.g. by the budget/SOS/vision service), skip
    classification and only extract servings.
    """
    raw = state.get("raw_input", "")
    text_lower = raw.lower()

    # Extract servings
    servings = state.get("servings", 1)
    match = _SERVING_PATTERN.search(raw)
    if match:
        servings = int(match.group(1))

    # Also handle "for N" at end (e.g. "Biryani for 4")
    if servings == 1:
        short_match = re.search(r"for\s+(\d+)$", text_lower.strip())
        if short_match:
            servings = int(short_match.group(1))

    # If mode was already set by the calling service, preserve it
    existing_mode = state.get("mode")
    if existing_mode is not None:
        reasoning = f"Intent pre-set as '{existing_mode.value}' with servings={servings}"
        trail: list[str] = state.get("reasoning_trail", [])
        return {
            "mode": existing_mode,
            "servings": servings,
            "reasoning_trail": trail + [reasoning],
        }

    # Classify mode by keyword matching
    mode = IntentMode.TEXT  # default fallback
    for intent_mode, keywords in _MODE_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            mode = intent_mode
            break

    reasoning = f"Intent classified as '{mode.value}' with servings={servings}"
    trail: list[str] = state.get("reasoning_trail", [])

    return {
        "mode": mode,
        "servings": servings,
        "reasoning_trail": trail + [reasoning],
    }


# ---------------------------------------------------------------------------
# Decompose node
# ---------------------------------------------------------------------------


async def decompose_node(state: AgentState) -> dict:
    """Decompose the outcome into structured needs using the LLM provider."""
    raw = state.get("raw_input", "")
    servings = state.get("servings", 1)
    mode = state.get("mode", IntentMode.TEXT)
    trail: list[str] = state.get("reasoning_trail", [])

    llm = get_text_provider()

    # Use a goal-aware prompt when the intent is GOAL mode
    if mode == IntentMode.GOAL:
        system_prompt = (
            "You are a smart grocery wellness assistant. Given a user's health/lifestyle goal, "
            "recommend a curated grocery shopping list of products that help achieve that goal. "
            "Think holistically: include staples, snacks, beverages, and fresh produce. "
            "Return quantities as number of packs/units to buy (e.g. 1 pack, 2 bottles). "
            "Return JSON with \"goal\" (string) and \"needs\" (array of "
            '{name, quantity, unit, category_hint}). quantity should be how many packs to buy (1, 2, 3...).'
        )
        schema_hint = '{"goal": "string", "needs": [{"name": "str", "quantity": "number", "unit": "str", "category_hint": "str"}]}'
    elif mode == IntentMode.BUDGET:
        system_prompt = (
            "You are a grocery meal planner for an Indian grocery app. The user wants to plan a meal "
            "within a budget constraint. Suggest a complete, practical Indian meal with all necessary "
            "ingredients. Return quantities as number of packs/units to buy from a grocery store "
            "(e.g. 1 pack rice, 2 onions, 1 pack masala). "
            "Return JSON with \"dish\" (string — the meal you suggest) and \"needs\" (array of "
            '{name, quantity, unit, category_hint}). quantity = number of packs to buy.'
        )
        schema_hint = '{"dish": "string", "needs": [{"name": "str", "quantity": "number", "unit": "str", "category_hint": "str"}]}'
    else:
        system_prompt = (
            "You are a grocery assistant for an Indian grocery delivery app. Given a user's food/cooking "
            f"outcome, decompose it into a shopping list of ingredients. The user is cooking for {servings} people. "
            "Return quantities as number of packs/units to buy from a store "
            "(e.g. 1 kg rice, 2 onions, 1 pack paneer, 1 bottle oil). "
            "Return JSON with \"dish\" (string or null) and \"needs\" (array of "
            '{name, quantity, unit, category_hint}). quantity = how many to buy, unit = pack/kg/piece/bottle etc.'
        )
        schema_hint = '{"dish": "string|null", "needs": [{"name": "str", "quantity": "number", "unit": "str", "category_hint": "str"}]}'

    result = await llm.complete_json(system_prompt, raw, schema_hint)

    # Parse needs from LLM response
    raw_needs = result.get("needs", [])
    needs: list[Need] = []
    for item in raw_needs:
        quantity = float(item.get("quantity", 1))
        unit = item.get("unit", "unit")
        needs.append(
            Need(
                name=item.get("name", "unknown"),
                quantity=quantity,
                unit=unit,
                category_hint=item.get("category_hint", ""),
                status=NeedStatus.PENDING,
            )
        )

    dish = result.get("dish")
    goal = result.get("goal")
    label = goal or dish or "unknown"
    reasoning = f"Decomposed into {len(needs)} needs (label={label}, mode={mode.value}, servings={servings})"

    return {
        "needs": needs,
        "reasoning_trail": trail + [reasoning],
    }


# ---------------------------------------------------------------------------
# Match node
# ---------------------------------------------------------------------------


async def match_node(state: AgentState) -> dict:
    """For each need, find candidate products via fuzzy matching."""
    needs: list[Need] = state.get("needs", [])
    trail: list[str] = state.get("reasoning_trail", [])

    catalog = get_catalog_service()
    candidates: dict[str, list[tuple[str, str, float, float]]] = {}

    for need in needs:
        matches = await catalog.fuzzy_match_need(
            need_name=need.name,
            category_hint=need.category_hint or None,
            top_k=5,
        )
        # Store serializable tuples: (product_id, name, score, price)
        candidate_list: list[tuple[str, str, float, float]] = [
            (product.product_id, product.name, score, product.sale_price)
            for product, score in matches
        ]
        candidates[need.name] = candidate_list

        # Update need status based on match quality
        if candidate_list and candidate_list[0][2] >= 40.0:
            need.matched_product_id = candidate_list[0][0]
            need.status = NeedStatus.MATCHED
        else:
            need.status = NeedStatus.UNMATCHED

    matched_count = sum(1 for n in needs if n.status == NeedStatus.MATCHED)
    reasoning = f"Matched {matched_count}/{len(needs)} needs to catalog products"

    return {
        "needs": needs,
        "candidates": candidates,
        "reasoning_trail": trail + [reasoning],
    }


# ---------------------------------------------------------------------------
# Optimize node
# ---------------------------------------------------------------------------


async def optimize_node(state: AgentState) -> dict:
    """Pick the best candidate per need and build CartItems."""
    needs: list[Need] = state.get("needs", [])
    candidates: dict[str, list[tuple[str, str, float, float]]] = state.get("candidates", {})
    trail: list[str] = state.get("reasoning_trail", [])
    mode = state.get("mode", IntentMode.TEXT)

    catalog = get_catalog_service()
    items: list[CartItem] = []
    notes: list[str] = []

    for need in needs:
        need_candidates = candidates.get(need.name, [])

        if not need_candidates:
            need.status = NeedStatus.UNMATCHED
            notes.append(f"No match found for: {need.name}")
            continue

        # Pick best: highest score, prefer in-stock, check availability
        best = None
        for product_id, name, score, price in need_candidates:
            is_available = await catalog.check_availability(product_id)
            if is_available:
                best = (product_id, name, score, price)
                break  # First available with highest score wins

        if best is None:
            # All candidates out of stock — keep first as placeholder for substitution
            best = need_candidates[0]
            need.status = NeedStatus.PENDING  # Will be handled by substitute_node

        product_id, name, score, price = best
        confidence = min(score / 100.0, 1.0)

        # Normalize quantity: LLM may return raw weights (500 grams, 200 ml)
        # but products are sold as packs. Normalize to "number of packs to buy".
        cart_quantity = _normalize_quantity_to_packs(need.quantity, need.unit)

        items.append(
            CartItem(
                product_id=product_id,
                name=name,
                price=price,
                quantity=cart_quantity,
                unit=need.unit,
                reason=f"Best match (score={score:.0f})",
                confidence=confidence,
            )
        )
        if need.status == NeedStatus.MATCHED:
            need.matched_product_id = product_id

    # Build cart
    cart = Cart(
        session_id=str(uuid.uuid4()),
        items=items,
        mode=mode,
        notes=notes,
    )
    cart.recompute_total()

    reasoning = f"Optimized cart: {len(items)} items, total={cart.total}"

    return {
        "needs": needs,
        "cart": cart,
        "reasoning_trail": trail + [reasoning],
    }


# ---------------------------------------------------------------------------
# Substitute node
# ---------------------------------------------------------------------------


async def substitute_node(state: AgentState) -> dict:
    """For needs with out-of-stock best match, find an in-stock alternative."""
    needs: list[Need] = state.get("needs", [])
    candidates: dict[str, list[tuple[str, str, float, float]]] = state.get("candidates", {})
    cart: Cart = state.get("cart", Cart(session_id=""))
    trail: list[str] = state.get("reasoning_trail", [])

    catalog = get_catalog_service()
    substitutions: list[Substitution] = []

    for i, item in enumerate(cart.items):
        is_available = await catalog.check_availability(item.product_id)
        if is_available:
            continue

        # Find the need this item corresponds to
        corresponding_need = None
        for need in needs:
            if need.matched_product_id == item.product_id or need.name in candidates:
                # Check candidates for this need
                need_candidates = candidates.get(need.name, [])
                if any(c[0] == item.product_id for c in need_candidates):
                    corresponding_need = need
                    break

        if corresponding_need is None:
            continue

        # Search for in-stock alternative from candidates
        need_candidates = candidates.get(corresponding_need.name, [])
        substitute_found = False

        for product_id, name, score, price in need_candidates:
            if product_id == item.product_id:
                continue
            if await catalog.check_availability(product_id):
                # Record substitution
                substitutions.append(
                    Substitution(
                        original_product_id=item.product_id,
                        original_name=item.name,
                        substitute_product_id=product_id,
                        substitute_name=name,
                        reason=f"Original out of stock; substitute score={score:.0f}",
                    )
                )
                # Update cart item
                cart.items[i] = CartItem(
                    product_id=product_id,
                    name=name,
                    price=price,
                    quantity=item.quantity,
                    unit=item.unit,
                    reason=f"Substituted (original '{item.name}' out of stock)",
                    confidence=min(score / 100.0, 1.0),
                    substituted_for=item.product_id,
                )
                corresponding_need.status = NeedStatus.SUBSTITUTED
                substitute_found = True
                break

        if not substitute_found:
            corresponding_need.status = NeedStatus.UNMATCHED
            corresponding_need.note = "Out of stock, no substitute available"
            cart.notes.append(f"No substitute for: {corresponding_need.name}")

    cart.substitutions = substitutions
    cart.recompute_total()

    reasoning = f"Substitutions: {len(substitutions)} items swapped"

    return {
        "needs": needs,
        "cart": cart,
        "substitutions": substitutions,
        "reasoning_trail": trail + [reasoning],
    }


# ---------------------------------------------------------------------------
# Confidence node
# ---------------------------------------------------------------------------


async def confidence_node(state: AgentState) -> dict:
    """Score overall cart confidence; raise HITL clarification if below threshold."""
    cart: Cart = state.get("cart", Cart(session_id=""))
    trail: list[str] = state.get("reasoning_trail", [])
    threshold = settings.confidence_threshold

    if not cart.items:
        return {
            "confidence": 0.0,
            "cart": cart,
            "clarification": "Could not build a cart from your request. Could you be more specific?",
            "reasoning_trail": trail + ["No items in cart — confidence=0, HITL triggered"],
        }

    # Compute per-item confidence and overall average
    total_confidence = 0.0
    low_confidence_items: list[str] = []

    for item in cart.items:
        total_confidence += item.confidence
        if item.confidence < threshold:
            low_confidence_items.append(item.name)

    overall_confidence = total_confidence / len(cart.items)
    cart.confidence = round(overall_confidence, 3)

    # HITL gate: if overall confidence or any item is below threshold
    clarification: str | None = None
    if overall_confidence < threshold:
        if low_confidence_items:
            items_str = ", ".join(low_confidence_items[:3])
            clarification = (
                f"I'm not fully confident about: {items_str}. "
                "Would you like me to show alternatives, or should I proceed with these picks?"
            )
        else:
            clarification = (
                "The overall match confidence is low. "
                "Would you like me to refine the selections?"
            )
        cart.clarification = clarification

    reasoning = f"Confidence={overall_confidence:.2f} (threshold={threshold}); HITL={'yes' if clarification else 'no'}"

    return {
        "confidence": round(overall_confidence, 3),
        "cart": cart,
        "clarification": clarification,
        "reasoning_trail": trail + [reasoning],
    }
