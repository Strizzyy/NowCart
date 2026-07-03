"""Pipeline nodes for the LangGraph Outcome Engine.

Each node is an async function: state → partial state update dict.
Nodes are composed into a StateGraph in the graph module.

Node pipeline:
    intent → decompose → pantry_filter → match → optimize → preference_boost
    → substitute → confidence_check → counterfactual → END

With re-planning loop:
    confidence_check → [if feedback] → replan → match → ... (max 2 iterations)
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
    """Convert raw LLM quantities to number of product packs to buy."""
    unit_lower = unit.lower().strip()

    if unit_lower in _SPOON_UNITS:
        return 1.0

    if unit_lower in _WEIGHT_UNITS:
        if unit_lower in ("kg", "kilogram", "kilograms"):
            return max(1.0, round(quantity))
        else:
            if quantity <= 1000:
                return 1.0
            return max(1.0, round(quantity / 1000))

    if unit_lower in _VOLUME_UNITS:
        if unit_lower in ("l", "ltr", "litre", "liter", "liters", "litres"):
            return max(1.0, round(quantity))
        else:
            if quantity <= 1000:
                return 1.0
            return max(1.0, round(quantity / 1000))

    if unit_lower in _PACK_UNITS:
        return max(1.0, quantity)

    if unit_lower in ("medium", "large", "small"):
        return max(1.0, quantity)

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
    """Classify the user's intent mode from raw_input and extract servings."""
    raw = state.get("raw_input", "")
    text_lower = raw.lower()

    servings = state.get("servings", 1)
    match = _SERVING_PATTERN.search(raw)
    if match:
        servings = int(match.group(1))

    if servings == 1:
        short_match = re.search(r"for\s+(\d+)$", text_lower.strip())
        if short_match:
            servings = int(short_match.group(1))

    existing_mode = state.get("mode")
    if existing_mode is not None:
        reasoning = f"Intent pre-set as '{existing_mode.value}' with servings={servings}"
        trail: list[str] = state.get("reasoning_trail", [])
        return {
            "mode": existing_mode,
            "servings": servings,
            "reasoning_trail": trail + [reasoning],
        }

    mode = IntentMode.TEXT
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
    constraints = state.get("constraints", {})

    llm = get_text_provider()

    # Build constraint context for re-planning
    constraint_context = ""
    if constraints:
        parts = []
        if constraints.get("dietary"):
            parts.append(f"Dietary requirements: {', '.join(constraints['dietary'])}")
        if constraints.get("max_price"):
            parts.append(f"Max budget: ₹{constraints['max_price']}")
        if constraints.get("swap"):
            swaps = [f"replace {k} with {v}" for k, v in constraints["swap"].items()]
            parts.append(f"Swaps: {', '.join(swaps)}")
        if parts:
            constraint_context = "\nAdditional constraints: " + "; ".join(parts)

    if mode == IntentMode.GOAL:
        system_prompt = (
            "You are a smart grocery wellness assistant. Given a user's health/lifestyle goal, "
            "recommend a curated grocery shopping list of products that help achieve that goal. "
            "Think holistically: include staples, snacks, beverages, and fresh produce. "
            "Return quantities as number of packs/units to buy (e.g. 1 pack, 2 bottles). "
            "Return JSON with \"goal\" (string) and \"needs\" (array of "
            '{name, quantity, unit, category_hint}). quantity should be how many packs to buy (1, 2, 3...).'
            + constraint_context
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
            + constraint_context
        )
        schema_hint = '{"dish": "string", "needs": [{"name": "str", "quantity": "number", "unit": "str", "category_hint": "str"}]}'
    else:
        system_prompt = (
            "You are a grocery assistant for an Indian grocery delivery app. Given a user's food/cooking "
            f"outcome, decompose it into a shopping list of ingredients. The user is cooking for {servings} people. "
            "Return quantities as number of packs/units to buy from a store "
            "(e.g. 1 kg rice, 2 onions, 1 pack paneer, 1 bottle oil). "
            "For category_hint, use one of these exact values: rice, grains, pulses, flour, oil, ghee, spices, "
            "masala, vegetables, fruits, meat, chicken, fish, eggs, dairy, milk, cheese, paneer, "
            "bakery, beverages, tea, coffee, snacks, dry fruits, nuts, herbs. "
            "Return JSON with \"dish\" (string or null) and \"needs\" (array of "
            '{name, quantity, unit, category_hint}). quantity = how many to buy, unit = pack/kg/piece/bottle etc.'
            + constraint_context
        )
        schema_hint = '{"dish": "string|null", "needs": [{"name": "str", "quantity": "number", "unit": "str", "category_hint": "str"}]}'

    result = await llm.complete_json(system_prompt, raw, schema_hint)

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
# Pantry Filter node — subtracts items user already has
# ---------------------------------------------------------------------------


async def pantry_filter_node(state: AgentState) -> dict:
    """Filter out needs the user likely already has at home.

    Uses the PantryService to check if decomposed needs overlap with
    items in the user's inferred pantry. Skipped needs are logged in
    the reasoning trail and surfaced in the cart notes.
    """
    needs: list[Need] = state.get("needs", [])
    trail: list[str] = state.get("reasoning_trail", [])
    user_id = state.get("user_id")
    pantry_items = state.get("pantry_items", [])

    if not user_id or not pantry_items:
        # No user context — pass through unchanged
        return {
            "needs": needs,
            "pantry_filtered": [],
            "reasoning_trail": trail + ["Pantry filter: no user context, all needs pass through"],
        }

    from app.services.pantry_service import get_pantry_service
    pantry_service = get_pantry_service()

    # Convert pantry dicts back to items for filtering
    from app.services.pantry_service import PantryItem
    pantry = [PantryItem(**item) for item in pantry_items]

    need_names = [n.name for n in needs]
    needs_to_buy, already_have = pantry_service.filter_needs_by_pantry(
        need_names=need_names,
        pantry=pantry,
        threshold=0.5,
    )

    if already_have:
        # Remove filtered needs
        filtered_needs = [n for n in needs if n.name not in already_have]
        reasoning = f"Pantry filter: removed {len(already_have)} items you likely have ({', '.join(already_have[:3])})"
    else:
        filtered_needs = needs
        reasoning = "Pantry filter: no overlap with pantry, all needs kept"

    return {
        "needs": filtered_needs,
        "pantry_filtered": already_have,
        "reasoning_trail": trail + [reasoning],
    }


# ---------------------------------------------------------------------------
# Match node — now with semantic search integration (RAG pipeline)
# ---------------------------------------------------------------------------


async def match_node(state: AgentState) -> dict:
    """For each need, find the best candidate products via hybrid retrieval.

    Pipeline (three stages, all handled inside HybridRetrievalService):
    1. Bi-encoder (all-MiniLM-L6-v2): encode need + context, cosine top-20
    2. Cross-encoder (ms-marco-MiniLM-L-6-v2): pairwise re-rank of the 20
    3. Rapidfuzz fallback: catches typos ("panner" → "paneer") when
       cross-encoder confidence is low or models are unavailable

    Scores from search_with_context() are normalised to [0, 1].
    """
    needs: list[Need] = state.get("needs", [])
    trail: list[str] = state.get("reasoning_trail", [])

    catalog = get_catalog_service()

    # Load hybrid retrieval service
    hybrid_service = None
    try:
        from app.services.semantic_search_service import get_semantic_search_service
        svc = get_semantic_search_service()
        if svc.is_ready:
            hybrid_service = svc
    except Exception:
        pass

    from app.repositories import get_repository
    repo = get_repository()

    candidates: dict[str, list[tuple[str, str, float, float, str | None]]] = {}

    for need in needs:
        # --- Stage A: Hybrid retrieval (bi-encoder → cross-encoder → rapidfuzz) ---
        # Returns (product_id, score) with scores in [0, 1]
        hybrid_results: list[tuple[str, float]] = []
        if hybrid_service:
            context = need.category_hint or ""
            hybrid_results = await hybrid_service.search_with_context(
                query=need.name,
                context=context,
                top_k=20,   # fetch 20 from hybrid pipeline, then intersect with catalog fuzzy
                min_score=0.1,
            )

        # --- Stage B: Catalog fuzzy match (always runs for category filtering + availability) ---
        # Returns (Product, score) with scores in [0, 100]
        fuzzy_matches = await catalog.fuzzy_match_need(
            need_name=need.name,
            category_hint=need.category_hint or None,
            top_k=10,
        )

        # --- Merge: build a unified product_id → score map ---
        # Normalise fuzzy scores from [0, 100] → [0, 1] to unify with hybrid scores
        score_map: dict[str, float] = {}

        # Start with fuzzy scores (normalised)
        for product, fscore in fuzzy_matches:
            score_map[product.product_id] = fscore / 100.0

        # Blend in hybrid scores — take the maximum of both signals
        for pid, hscore in hybrid_results:
            score_map[pid] = max(score_map.get(pid, 0.0), hscore)

        # Retrieve product objects for any hybrid-only candidates
        for pid, _score in hybrid_results:
            if pid not in {p.product_id for p, _ in fuzzy_matches}:
                product = await repo.get_product(pid)
                if product:
                    fuzzy_matches.append((product, score_map[pid] * 100.0))

        # --- Sort by merged score and take top 5 ---
        fuzzy_matches.sort(key=lambda x: score_map.get(x[0].product_id, 0.0), reverse=True)
        top_matches = fuzzy_matches[:5]

        # Store as serializable tuples; scores stay in [0, 1] throughout the pipeline
        candidate_list: list[tuple[str, str, float, float, str | None]] = [
            (
                product.product_id,
                product.name,
                score_map.get(product.product_id, fscore / 100.0),  # unified [0, 1] score
                product.sale_price,
                product.image_url,
            )
            for product, fscore in top_matches
        ]
        candidates[need.name] = candidate_list

        # Threshold: 0.4 (≥ 40% confidence) to call a match successful
        if candidate_list and candidate_list[0][2] >= 0.4:
            need.matched_product_id = candidate_list[0][0]
            need.status = NeedStatus.MATCHED
        else:
            need.status = NeedStatus.UNMATCHED

    matched_count = sum(1 for n in needs if n.status == NeedStatus.MATCHED)
    retrieval_mode = "hybrid (bi-encoder + cross-encoder + rapidfuzz)" if hybrid_service else "rapidfuzz only"
    if hybrid_service:
        retrieval_mode += f" [neural={hybrid_service.using_neural_models}]"
    reasoning = f"Matched {matched_count}/{len(needs)} needs — {retrieval_mode}"

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
    candidates: dict[str, list[tuple[str, str, float, float, str | None]]] = state.get("candidates", {})
    trail: list[str] = state.get("reasoning_trail", [])
    mode = state.get("mode", IntentMode.TEXT)

    catalog = get_catalog_service()
    items: list[CartItem] = []
    economical_items: list[CartItem] = []
    notes: list[str] = []

    for need in needs:
        need_candidates = candidates.get(need.name, [])

        if not need_candidates:
            need.status = NeedStatus.UNMATCHED
            notes.append(f"No match found for: {need.name}")
            continue

        best = None
        available_candidates: list[tuple[str, str, float, float, str | None]] = []
        for product_id, name, score, price, image_url in need_candidates:
            is_available = await catalog.check_availability(product_id)
            if is_available:
                available_candidates.append((product_id, name, score, price, image_url))
                if best is None:
                    best = (product_id, name, score, price, image_url)

        if best is None:
            best = need_candidates[0]
            need.status = NeedStatus.PENDING

        product_id, name, score, price, image_url = best
        confidence = min(score, 1.0)  # score already in [0, 1] from match_node
        cart_quantity = _normalize_quantity_to_packs(need.quantity, need.unit)

        items.append(
            CartItem(
                product_id=product_id,
                name=name,
                price=price,
                quantity=cart_quantity,
                unit=need.unit,
                reason=f"Best match (score={score*100:.0f})",  # display as percentage
                confidence=confidence,
                image_url=image_url,
            )
        )
        if need.status == NeedStatus.MATCHED:
            need.matched_product_id = product_id

        # Economical pick
        if available_candidates:
            sorted_by_price = sorted(available_candidates, key=lambda c: c[3])
            cheapest = sorted_by_price[0]

            if cheapest[0] == best[0] and len(sorted_by_price) > 1:
                cheapest = sorted_by_price[1]

            if cheapest[0] != best[0]:
                eco_product_id, eco_name, eco_score, eco_price, eco_image_url = cheapest
                eco_confidence = min(eco_score, 1.0)  # score already in [0, 1]
                saving = round(price - eco_price, 2) if price > eco_price else 0
                reason = f"Budget-friendly pick (saves ₹{saving:.0f})" if saving > 0 else "Economical alternative"
                economical_items.append(
                    CartItem(
                        product_id=eco_product_id,
                        name=eco_name,
                        price=eco_price,
                        quantity=cart_quantity,
                        unit=need.unit,
                        reason=reason,
                        confidence=eco_confidence,
                        image_url=eco_image_url,
                    )
                )
            else:
                economical_items.append(
                    CartItem(
                        product_id=product_id,
                        name=name,
                        price=price,
                        quantity=cart_quantity,
                        unit=need.unit,
                        reason="Same as recommended (no cheaper option)",
                        confidence=confidence,
                        image_url=image_url,
                    )
                )
        else:
            economical_items.append(
                CartItem(
                    product_id=best[0],
                    name=best[1],
                    price=best[3],
                    quantity=cart_quantity,
                    unit=need.unit,
                    reason="Same as recommended (no cheaper option)",
                    confidence=min(best[2], 1.0),  # score already in [0, 1]
                    image_url=best[4],
                )
            )

    cart = Cart(
        session_id=str(uuid.uuid4()),
        items=items,
        economical_items=economical_items,
        mode=mode,
        notes=notes,
    )
    cart.recompute_total()

    eco_saving = round(cart.total - cart.economical_total, 2)
    reasoning = f"Optimized cart: {len(items)} items, total=₹{cart.total}, economical total=₹{cart.economical_total} (save ₹{eco_saving})"

    return {
        "needs": needs,
        "cart": cart,
        "reasoning_trail": trail + [reasoning],
    }


# ---------------------------------------------------------------------------
# Preference Boost node — personalizes confidence using user memory
# ---------------------------------------------------------------------------


async def preference_boost_node(state: AgentState) -> dict:
    """Boost confidence scores for items matching user preferences.

    Uses the PreferenceService to:
    1. Increase confidence for frequently purchased brands/products
    2. Enrich "reason" strings with personalized context
    3. Make the "why this one" explanations truthful and personal
    """
    cart: Cart = state.get("cart", Cart(session_id=""))
    trail: list[str] = state.get("reasoning_trail", [])
    user_preferences = state.get("user_preferences")

    if not user_preferences or not cart.items:
        return {
            "cart": cart,
            "reasoning_trail": trail + ["Preference boost: no user context, skipped"],
        }

    from app.services.preference_service import UserPreference, get_preference_service
    from app.repositories import get_repository

    try:
        preference = UserPreference(**user_preferences)
    except Exception:
        return {
            "cart": cart,
            "reasoning_trail": trail + ["Preference boost: invalid preference data, skipped"],
        }

    pref_service = get_preference_service()
    repo = get_repository()
    boosted_count = 0

    for item in cart.items:
        product = await repo.get_product(item.product_id)
        if not product:
            continue

        boost, reason = pref_service.compute_preference_boost(product, preference)
        if boost > 0:
            item.confidence = min(0.99, item.confidence + boost)
            item.reason = pref_service.get_personalized_reason(product, preference, item.reason)
            boosted_count += 1

    # Recompute overall confidence
    if cart.items:
        cart.confidence = round(sum(i.confidence for i in cart.items) / len(cart.items), 3)

    reasoning = f"Preference boost: {boosted_count}/{len(cart.items)} items boosted by user history"
    return {
        "cart": cart,
        "reasoning_trail": trail + [reasoning],
    }


# ---------------------------------------------------------------------------
# Substitute node
# ---------------------------------------------------------------------------


async def substitute_node(state: AgentState) -> dict:
    """For needs with out-of-stock best match, find an in-stock alternative."""
    needs: list[Need] = state.get("needs", [])
    candidates: dict[str, list[tuple[str, str, float, float, str | None]]] = state.get("candidates", {})
    cart: Cart = state.get("cart", Cart(session_id=""))
    trail: list[str] = state.get("reasoning_trail", [])

    catalog = get_catalog_service()
    substitutions: list[Substitution] = []
    sub_details: list[str] = []

    for i, item in enumerate(cart.items):
        is_available = await catalog.check_availability(item.product_id)
        if is_available:
            continue

        corresponding_need = None
        for need in needs:
            if need.matched_product_id == item.product_id or need.name in candidates:
                need_candidates = candidates.get(need.name, [])
                if any(c[0] == item.product_id for c in need_candidates):
                    corresponding_need = need
                    break

        if corresponding_need is None:
            continue

        need_candidates = candidates.get(corresponding_need.name, [])
        substitute_found = False
        candidates_checked = 0

        for product_id, name, score, price, image_url in need_candidates:
            if product_id == item.product_id:
                continue
            candidates_checked += 1
            if await catalog.check_availability(product_id):
                price_diff = abs(price - item.price)
                price_pct = round(price_diff / max(item.price, 1) * 100)

                reason_parts = []
                reason_parts.append(f"Original '{item.name}' out of stock")
                reason_parts.append(f"Match score: {score*100:.0f}/100")  # display as percentage
                if price_pct < 10:
                    reason_parts.append("Similar price point")
                elif price > item.price:
                    reason_parts.append(f"₹{price_diff:.0f} more expensive")
                else:
                    reason_parts.append(f"₹{price_diff:.0f} cheaper")

                substitution_reason = "; ".join(reason_parts)

                substitutions.append(
                    Substitution(
                        original_product_id=item.product_id,
                        original_name=item.name,
                        substitute_product_id=product_id,
                        substitute_name=name,
                        reason=substitution_reason,
                    )
                )
                cart.items[i] = CartItem(
                    product_id=product_id,
                    name=name,
                    price=price,
                    quantity=item.quantity,
                    unit=item.unit,
                    reason=f"Substituted (original '{item.name}' out of stock)",
                    confidence=min(score, 1.0),  # score already in [0, 1]
                    substituted_for=item.product_id,
                    image_url=image_url,
                )
                corresponding_need.status = NeedStatus.SUBSTITUTED
                substitute_found = True
                sub_details.append(f"'{item.name}' → '{name}'")
                break

        if not substitute_found:
            corresponding_need.status = NeedStatus.UNMATCHED
            corresponding_need.note = "Out of stock, no substitute available"
            cart.notes.append(f"No substitute for: {corresponding_need.name}")

    cart.substitutions = substitutions
    cart.recompute_total()

    if sub_details:
        reasoning = f"Substitution: {len(substitutions)} swaps — " + "; ".join(sub_details)
    else:
        reasoning = "Substitution: all items in stock, no swaps needed"

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
    needs: list[Need] = state.get("needs", [])
    trail: list[str] = state.get("reasoning_trail", [])
    threshold = settings.confidence_threshold

    if not cart.items:
        return {
            "confidence": 0.0,
            "cart": cart,
            "clarification": "Could not build a cart from your request. Could you be more specific?",
            "reasoning_trail": trail + ["No items in cart — confidence=0, HITL triggered"],
        }

    total_confidence = 0.0
    low_confidence_items: list[str] = []

    for item in cart.items:
        base_score = item.confidence
        substitution_factor = 0.85 if item.substituted_for else 1.0
        name_words = len(item.name.split())
        name_factor = min(1.0, 0.7 + name_words * 0.1)
        if item.price < 5:
            price_factor = 0.7
        elif item.price > 2000:
            price_factor = 0.8
        else:
            price_factor = 1.0

        final_confidence = base_score * substitution_factor * name_factor * price_factor
        final_confidence = max(0.1, min(0.99, final_confidence))

        item.confidence = round(final_confidence, 3)
        total_confidence += final_confidence

        if final_confidence < threshold:
            low_confidence_items.append(item.name)

    overall_confidence = total_confidence / len(cart.items)
    cart.confidence = round(overall_confidence, 3)

    clarification: str | None = None
    if overall_confidence < threshold:
        if low_confidence_items:
            items_str = ", ".join(low_confidence_items[:3])
            clarification = (
                f"I'm not fully confident about: {items_str}. "
                "Would you like me to show alternatives, or should I proceed?"
            )
        else:
            clarification = "The overall match confidence is low. Would you like me to refine?"
        cart.clarification = clarification

    reasoning = (
        f"Confidence={overall_confidence:.2f} (threshold={threshold}); "
        f"low-conf={len(low_confidence_items)}/{len(cart.items)}; "
        f"HITL={'yes' if clarification else 'no'}"
    )

    return {
        "confidence": round(overall_confidence, 3),
        "cart": cart,
        "clarification": clarification,
        "reasoning_trail": trail + [reasoning],
    }


# ---------------------------------------------------------------------------
# Counterfactual node — generates "why NOT this one" for each cart item
# ---------------------------------------------------------------------------


async def counterfactual_node(state: AgentState) -> dict:
    """Generate counterfactual explanations for rejected alternatives.

    For each cart item, explains why competing candidates were not selected.
    This data powers the "Why this one?" UI expansion panel.
    """
    cart: Cart = state.get("cart", Cart(session_id=""))
    candidates: dict[str, list[tuple[str, str, float, float, str | None]]] = state.get("candidates", {})
    needs: list[Need] = state.get("needs", [])
    trail: list[str] = state.get("reasoning_trail", [])
    user_id = state.get("user_id")

    if not cart.items or not candidates:
        return {
            "counterfactuals": {},
            "reasoning_trail": trail + ["Counterfactuals: no cart items or candidates"],
        }

    from app.services.counterfactual_service import get_counterfactual_service
    cf_service = get_counterfactual_service()

    counterfactuals: dict[str, list[dict]] = {}

    for need in needs:
        need_candidates = candidates.get(need.name, [])
        if len(need_candidates) <= 1:
            continue

        # Find which product was selected for this need
        selected_pid = need.matched_product_id
        if not selected_pid:
            # Try to find from cart items
            for item in cart.items:
                if any(c[0] == item.product_id for c in need_candidates):
                    selected_pid = item.product_id
                    break

        if not selected_pid:
            continue

        cf_data = await cf_service.get_counterfactuals_for_cart_item(
            need_name=need.name,
            selected_product_id=selected_pid,
            candidates=need_candidates,
            user_id=user_id,
        )
        counterfactuals[need.name] = cf_data.get("rejected", [])

    total_cfs = sum(len(v) for v in counterfactuals.values())
    reasoning = f"Counterfactuals: generated {total_cfs} 'why not' explanations for {len(counterfactuals)} items"

    return {
        "counterfactuals": counterfactuals,
        "reasoning_trail": trail + [reasoning],
    }


# ---------------------------------------------------------------------------
# Replan node — applies user feedback and re-enters the pipeline
# ---------------------------------------------------------------------------


async def replan_node(state: AgentState) -> dict:
    """Process user feedback and prepare state for re-planning.

    Handles commands like:
    - "make it cheaper" → adds max_price constraint
    - "I'm vegan" / "no dairy" → adds dietary constraint
    - "swap paneer for tofu" → adds swap constraint
    - "remove the oil" → removes specific need

    This node modifies constraints and resets match/optimize state
    so the pipeline re-runs from match onward.
    """
    feedback = state.get("feedback", "")
    trail: list[str] = state.get("reasoning_trail", [])
    constraints = state.get("constraints", {})
    needs: list[Need] = state.get("needs", [])
    replan_count = state.get("replan_count", 0)

    if not feedback:
        return {"reasoning_trail": trail + ["Replan: no feedback, skipped"]}

    feedback_lower = feedback.lower()

    # Parse feedback into constraints
    new_constraints = dict(constraints)

    # Budget constraints
    if "cheaper" in feedback_lower or "budget" in feedback_lower or "less" in feedback_lower:
        cart: Cart = state.get("cart", Cart(session_id=""))
        if cart.total > 0:
            new_constraints["max_price"] = cart.total * 0.7  # aim for 30% cheaper
        new_constraints.setdefault("prefer_economical", True)

    # Dietary constraints
    dietary_keywords = {
        "vegan": "vegan", "vegetarian": "vegetarian", "veg": "vegetarian",
        "no dairy": "dairy-free", "no meat": "vegetarian",
        "no egg": "egg-free", "no gluten": "gluten-free",
        "jain": "jain", "no onion": "jain",
        "keto": "keto", "low carb": "low-carb",
    }
    for keyword, tag in dietary_keywords.items():
        if keyword in feedback_lower:
            new_constraints.setdefault("dietary", [])
            if tag not in new_constraints["dietary"]:
                new_constraints["dietary"].append(tag)

    # Swap requests: "swap X for Y" or "replace X with Y"
    swap_pattern = re.search(
        r"(?:swap|replace|change)\s+(\w+)\s+(?:for|with|to)\s+(\w+)",
        feedback_lower,
    )
    if swap_pattern:
        original = swap_pattern.group(1)
        replacement = swap_pattern.group(2)
        new_constraints.setdefault("swap", {})
        new_constraints["swap"][original] = replacement

    # Remove requests: "remove X" or "no X"
    remove_pattern = re.findall(r"(?:remove|drop|no)\s+(\w+)", feedback_lower)
    if remove_pattern:
        for item_name in remove_pattern:
            needs = [n for n in needs if item_name not in n.name.lower()]

    # Reset needs status for re-matching
    for need in needs:
        need.status = NeedStatus.PENDING
        need.matched_product_id = None

    reasoning = (
        f"Replan #{replan_count + 1}: applied feedback '{feedback[:50]}' → "
        f"constraints={new_constraints}"
    )

    return {
        "needs": needs,
        "constraints": new_constraints,
        "feedback": None,  # consumed
        "replan_count": replan_count + 1,
        "reasoning_trail": trail + [reasoning],
    }
