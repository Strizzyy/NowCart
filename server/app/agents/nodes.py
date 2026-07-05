"""Pipeline nodes for the LangGraph Outcome Engine.

Streamlined pipeline:
    intent → decompose (region-aware) → match → confidence_check → counterfactual → END

Re-planning loop:
    confidence_check → [if feedback] → replan → match (max 2 iterations)

Removed: pantry_filter, optimize, preference_boost, substitute nodes.
"""
from __future__ import annotations

import re
import uuid

from app.core.config import settings
from app.llm.factory import get_text_provider
from app.models.domain.enums import IntentMode, NeedStatus
from app.models.domain.need import Need
from app.models.domain.cart import Cart, CartItem
from app.services.catalog_service import get_catalog_service

from app.agents.state import AgentState


# ---------------------------------------------------------------------------
# Quantity normalization helpers
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
        return 1.0 if quantity <= 1000 else max(1.0, round(quantity / 1000))
    if unit_lower in _VOLUME_UNITS:
        if unit_lower in ("l", "ltr", "litre", "liter", "liters", "litres"):
            return max(1.0, round(quantity))
        return 1.0 if quantity <= 1000 else max(1.0, round(quantity / 1000))
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
        trail: list[str] = state.get("reasoning_trail", [])
        return {
            "mode": existing_mode,
            "servings": servings,
            "reasoning_trail": trail + [f"Intent pre-set as '{existing_mode.value}' with servings={servings}"],
        }

    mode = IntentMode.TEXT
    for intent_mode, keywords in _MODE_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            mode = intent_mode
            break

    trail = state.get("reasoning_trail", [])
    return {
        "mode": mode,
        "servings": servings,
        "reasoning_trail": trail + [f"Intent classified as '{mode.value}' with servings={servings}"],
    }


# ---------------------------------------------------------------------------
# Decompose node — region-aware
# ---------------------------------------------------------------------------

_REGION_HINTS: dict[str, str] = {
    "south": "idli, dosa, sambar, rasam, coconut rice, tamarind",
    "north": "poha, paratha, rajma, chole, aloo sabzi, mustard oil",
    "east": "luchi, dal, posto, mustard, panch phoron",
    "west": "thepla, dhokla, poha, vada pav ingredients, peanuts",
    "central": "dal bafla, poha, jalebi, soya",
}


async def decompose_node(state: AgentState) -> dict:
    """Decompose the outcome into structured needs using the LLM. Region-aware + age/gender-aware."""
    raw = state.get("raw_input", "")
    servings = state.get("servings", 1)
    mode = state.get("mode", IntentMode.TEXT)
    trail: list[str] = state.get("reasoning_trail", [])
    constraints = state.get("constraints", {})
    user_region = state.get("user_region")
    user_age = state.get("user_age")
    user_gender = state.get("user_gender")

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

    # Region-aware hint
    region_context = ""
    if user_region and user_region in _REGION_HINTS:
        region_context = (
            f"\nUser is from {user_region} India. "
            f"Prefer regional items like: {_REGION_HINTS[user_region]}."
        )

    # Age + gender hint for personalised ingredient suggestions
    demographic_context = ""
    if user_age or user_gender:
        parts = []
        if user_age:
            if user_age < 18:
                parts.append(f"teenager ({user_age} years old) — prefer lighter, snack-friendly options")
            elif user_age < 30:
                parts.append(f"young adult ({user_age} years old) — active lifestyle, open to variety")
            elif user_age < 50:
                parts.append(f"adult ({user_age} years old) — practical, family-oriented choices")
            else:
                parts.append(f"senior ({user_age} years old) — prefer easy-to-cook, health-conscious options")
        if user_gender == "female":
            parts.append("female user — may prefer iron-rich and calcium-rich options")
        elif user_gender == "male":
            parts.append("male user — may prefer higher-protein options")
        if parts:
            demographic_context = f"\nUser profile: {'; '.join(parts)}."

    if mode == IntentMode.GOAL:
        system_prompt = (
            "You are a smart grocery wellness assistant. Given a user's health/lifestyle goal, "
            "recommend a curated grocery shopping list of products that help achieve that goal. "
            "Think holistically: include staples, snacks, beverages, and fresh produce. "
            "Return quantities as number of packs/units to buy (e.g. 1 pack, 2 bottles). "
            "Return JSON with \"goal\" (string) and \"needs\" (array of "
            '{name, quantity, unit, category_hint}). quantity = how many packs to buy.'
            + constraint_context + region_context + demographic_context
        )
        schema_hint = '{"goal": "string", "needs": [{"name": "str", "quantity": "number", "unit": "str", "category_hint": "str"}]}'
    elif mode == IntentMode.BUDGET:
        system_prompt = (
            "You are a grocery meal planner for an Indian grocery app. The user wants to plan a meal "
            "within a budget constraint. Suggest a complete, practical Indian meal with all necessary "
            "ingredients. Return quantities as number of packs/units to buy from a grocery store. "
            "Return JSON with \"dish\" (string) and \"needs\" (array of "
            '{name, quantity, unit, category_hint}). quantity = number of packs to buy.'
            + constraint_context + region_context + demographic_context
        )
        schema_hint = '{"dish": "string", "needs": [{"name": "str", "quantity": "number", "unit": "str", "category_hint": "str"}]}'
    else:
        system_prompt = (
            "You are a grocery assistant for an Indian grocery delivery app. Given a user's food/cooking "
            f"outcome, decompose it into a shopping list of ingredients. The user is cooking for {servings} people. "
            "Return quantities as number of packs/units to buy from a store. "
            "For category_hint, use one of these exact values: rice, grains, pulses, flour, oil, ghee, spices, "
            "masala, vegetables, fruits, meat, chicken, fish, eggs, dairy, milk, cheese, paneer, "
            "bakery, beverages, tea, coffee, snacks, dry fruits, nuts, herbs. "
            "Return JSON with \"dish\" (string or null) and \"needs\" (array of "
            '{name, quantity, unit, category_hint}). quantity = how many to buy, unit = pack/kg/piece/bottle etc.'
            + constraint_context + region_context + demographic_context
        )
        schema_hint = '{"dish": "string|null", "needs": [{"name": "str", "quantity": "number", "unit": "str", "category_hint": "str"}]}'

    result = await llm.complete_json(system_prompt, raw, schema_hint)

    raw_needs = result.get("needs", [])
    needs: list[Need] = []
    for item in raw_needs:
        quantity = float(item.get("quantity", 1))
        unit = item.get("unit", "unit")
        needs.append(Need(
            name=item.get("name", "unknown"),
            quantity=quantity,
            unit=unit,
            category_hint=item.get("category_hint", ""),
            status=NeedStatus.PENDING,
        ))

    label = result.get("goal") or result.get("dish") or "unknown"
    region_note = f", region={user_region}" if user_region else ""
    reasoning = f"Decomposed into {len(needs)} needs (label={label}, mode={mode.value}, servings={servings}{region_note})"

    return {
        "needs": needs,
        "reasoning_trail": trail + [reasoning],
    }


# ---------------------------------------------------------------------------
# Match node — hybrid retrieval + optimize (merged) + OOS suggestion metadata
# ---------------------------------------------------------------------------


async def match_node(state: AgentState) -> dict:
    """For each need, find and pick the best product via hybrid retrieval.

    This node merges the old match + optimize nodes into one step:
    1. Hybrid retrieval: bi-encoder → cross-encoder → rapidfuzz
    2. Pick best available candidate (in-stock first)
    3. Build CartItems with economical alternatives
    4. If best candidate is OOS, attach out_of_stock_suggestion metadata
       so frontend can show "Original out of stock — you may also add X"
    """
    needs: list[Need] = state.get("needs", [])
    trail: list[str] = state.get("reasoning_trail", [])
    mode = state.get("mode", IntentMode.TEXT)

    catalog = get_catalog_service()

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
    items: list[CartItem] = []
    economical_items: list[CartItem] = []
    notes: list[str] = []

    for need in needs:
        # --- Hybrid retrieval ---
        hybrid_results: list[tuple[str, float]] = []
        if hybrid_service:
            hybrid_results = await hybrid_service.search_with_context(
                query=need.name,
                context=need.category_hint or "",
                top_k=20,
                min_score=0.1,
            )

        fuzzy_matches = await catalog.fuzzy_match_need(
            need_name=need.name,
            category_hint=need.category_hint or None,
            top_k=10,
        )

        # Merge scores
        score_map: dict[str, float] = {}
        for product, fscore in fuzzy_matches:
            score_map[product.product_id] = fscore / 100.0
        for pid, hscore in hybrid_results:
            score_map[pid] = max(score_map.get(pid, 0.0), hscore)

        for pid, _score in hybrid_results:
            if pid not in {p.product_id for p, _ in fuzzy_matches}:
                product = await repo.get_product(pid)
                if product:
                    fuzzy_matches.append((product, score_map[pid] * 100.0))

        fuzzy_matches.sort(key=lambda x: score_map.get(x[0].product_id, 0.0), reverse=True)
        top_matches = fuzzy_matches[:5]

        candidate_list: list[tuple[str, str, float, float, str | None]] = [
            (
                product.product_id,
                product.name,
                score_map.get(product.product_id, fscore / 100.0),
                product.sale_price,
                product.image_url,
            )
            for product, fscore in top_matches
        ]
        candidates[need.name] = candidate_list

        if not candidate_list:
            need.status = NeedStatus.UNMATCHED
            notes.append(f"No match found for: {need.name}")
            continue

        # --- Pick best available candidate ---
        best = None
        oos_best = None  # best candidate even if OOS (for OOS suggestion)
        available_candidates: list[tuple[str, str, float, float, str | None]] = []

        for product_id, name, score, price, image_url in candidate_list:
            is_available = await catalog.check_availability(product_id)
            if is_available:
                available_candidates.append((product_id, name, score, price, image_url))
                if best is None:
                    best = (product_id, name, score, price, image_url)
            elif oos_best is None:
                oos_best = (product_id, name, score, price, image_url)

        # OOS suggestion: if top candidate was OOS, find next in-stock from shortlist
        oos_suggestion: dict | None = None
        if oos_best is not None and best is not None and oos_best[0] != best[0]:
            # The top match was OOS and we found an in-stock alternative
            oos_suggestion = {
                "product_id": best[0],
                "name": best[1],
                "price": best[3],
                "image_url": best[4],
            }

        if best is None:
            # All candidates OOS — use first candidate anyway (will show OOS state)
            best = candidate_list[0]
            need.status = NeedStatus.PENDING
        elif candidate_list[0][0] != best[0]:
            # Top match was OOS; we swapped to first in-stock
            pass

        product_id, name, score, price, image_url = best
        confidence = min(score, 1.0)
        cart_quantity = _normalize_quantity_to_packs(need.quantity, need.unit)

        # Threshold for considering it a match
        if score >= 0.4:
            need.matched_product_id = product_id
            need.status = NeedStatus.MATCHED
        else:
            need.status = NeedStatus.UNMATCHED

        # Build a human-readable reason — no raw scores exposed to the frontend
        if score >= 0.9:
            human_reason = "Top-rated pick — highest match confidence for this ingredient"
        elif score >= 0.75:
            human_reason = "Strong match — verified against catalog name and category"
        elif score >= 0.55:
            human_reason = "Good match — closest available product for this ingredient"
        else:
            human_reason = "Best available option — added based on catalog similarity"

        items.append(CartItem(
            product_id=product_id,
            name=name,
            price=price,
            quantity=cart_quantity,
            unit=need.unit,
            reason=human_reason,
            confidence=confidence,
            image_url=image_url,
            out_of_stock_suggestion=oos_suggestion,
        ))

        # Economical pick
        if available_candidates:
            sorted_by_price = sorted(available_candidates, key=lambda c: c[3])
            cheapest = sorted_by_price[0]
            if cheapest[0] == best[0] and len(sorted_by_price) > 1:
                cheapest = sorted_by_price[1]
            if cheapest[0] != best[0]:
                eco_pid, eco_name, eco_score, eco_price, eco_img = cheapest
                saving = round(price - eco_price, 2) if price > eco_price else 0
                reason = f"Budget-friendly pick (saves ₹{saving:.0f})" if saving > 0 else "Economical alternative"
                economical_items.append(CartItem(
                    product_id=eco_pid, name=eco_name, price=eco_price,
                    quantity=cart_quantity, unit=need.unit, reason=reason,
                    confidence=min(eco_score, 1.0), image_url=eco_img,
                ))
            else:
                economical_items.append(CartItem(
                    product_id=product_id, name=name, price=price,
                    quantity=cart_quantity, unit=need.unit,
                    reason="Same as recommended (no cheaper option)",
                    confidence=confidence, image_url=image_url,
                ))
        else:
            economical_items.append(CartItem(
                product_id=best[0], name=best[1], price=best[3],
                quantity=cart_quantity, unit=need.unit,
                reason="Same as recommended (no cheaper option)",
                confidence=min(best[2], 1.0), image_url=best[4],
            ))

    cart = Cart(
        session_id=str(uuid.uuid4()),
        items=items,
        economical_items=economical_items,
        mode=mode,
        notes=notes,
    )
    cart.recompute_total()

    matched_count = sum(1 for n in needs if n.status == NeedStatus.MATCHED)
    retrieval_mode = "hybrid (bi-encoder + cross-encoder + rapidfuzz)" if hybrid_service else "rapidfuzz only"
    eco_saving = round(cart.total - cart.economical_total, 2)
    reasoning = (
        f"Matched {matched_count}/{len(needs)} needs — {retrieval_mode} | "
        f"total=₹{cart.total}, economical=₹{cart.economical_total} (save ₹{eco_saving})"
    )

    return {
        "needs": needs,
        "candidates": candidates,
        "cart": cart,
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
        name_factor = min(1.0, 0.7 + len(item.name.split()) * 0.1)
        price_factor = 0.7 if item.price < 5 else (0.8 if item.price > 2000 else 1.0)
        final_confidence = max(0.1, min(0.99, base_score * substitution_factor * name_factor * price_factor))
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
# Counterfactual node
# ---------------------------------------------------------------------------


async def counterfactual_node(state: AgentState) -> dict:
    """Generate 'why NOT this one' explanations for rejected alternatives."""
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
        selected_pid = need.matched_product_id
        if not selected_pid:
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
    return {
        "counterfactuals": counterfactuals,
        "reasoning_trail": trail + [
            f"Counterfactuals: generated {total_cfs} 'why not' explanations for {len(counterfactuals)} items"
        ],
    }


# ---------------------------------------------------------------------------
# Replan node — applies user feedback and re-enters the pipeline
# ---------------------------------------------------------------------------


async def replan_node(state: AgentState) -> dict:
    """Process user feedback and prepare state for re-planning."""
    feedback = state.get("feedback", "")
    trail: list[str] = state.get("reasoning_trail", [])
    constraints = state.get("constraints", {})
    needs: list[Need] = state.get("needs", [])
    replan_count = state.get("replan_count", 0)

    if not feedback:
        return {"reasoning_trail": trail + ["Replan: no feedback, skipped"]}

    feedback_lower = feedback.lower()
    new_constraints = dict(constraints)

    # Budget constraints — when user says cheaper, cap each item's price and
    # also inject a budget cap into raw_input so decompose/match knows
    if any(k in feedback_lower for k in ("cheaper", "budget", "less expensive", "reduce cost", "save money")):
        cart: Cart = state.get("cart", Cart(session_id=""))
        if cart.total > 0:
            # Set max per-item price well below current average
            avg_price = cart.total / max(len(cart.items), 1)
            new_constraints["max_item_price"] = round(avg_price * 0.6, 0)
            new_constraints["max_price"] = round(cart.total * 0.65, 0)
        new_constraints.setdefault("prefer_economical", True)
        new_constraints["prefer_budget_brands"] = True

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

    # Swap requests
    swap_pattern = re.search(
        r"(?:swap|replace|change)\s+(\w+)\s+(?:for|with|to)\s+(\w+)",
        feedback_lower,
    )
    if swap_pattern:
        new_constraints.setdefault("swap", {})
        new_constraints["swap"][swap_pattern.group(1)] = swap_pattern.group(2)

    # Remove requests
    for item_name in re.findall(r"(?:remove|drop|no)\s+(\w+)", feedback_lower):
        needs = [n for n in needs if item_name not in n.name.lower()]

    # Reset needs status for re-matching
    for need in needs:
        need.status = NeedStatus.PENDING
        need.matched_product_id = None

    reasoning = (
        f"Replan #{replan_count + 1}: applied feedback '{feedback[:50]}' → "
        f"constraints={new_constraints}"
    )

    # Build updated raw_input with budget constraint hint for decompose node
    raw_input = state.get("raw_input", "")
    if new_constraints.get("max_price"):
        budget_cap = new_constraints["max_price"]
        if f"budget under ₹{budget_cap}" not in raw_input:
            raw_input = f"{raw_input} | budget under ₹{budget_cap}, prefer cheaper alternatives"

    return {
        "needs": needs,
        "raw_input": raw_input,
        "constraints": new_constraints,
        "feedback": None,
        "replan_count": replan_count + 1,
        "reasoning_trail": trail + [reasoning],
    }
