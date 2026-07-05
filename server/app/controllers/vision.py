"""Vision controller — photo/image analysis to cart (B2 "Show It").

Routes:
    POST /api/vision/analyze  -> CartResponse

Uses Gemini Vision to identify dishes from photos and build a cart
with all the ingredients needed to recreate the dish at home.
"""
import asyncio
import uuid

from fastapi import APIRouter, UploadFile, File, Form

from app.models.domain.cart import Cart, CartItem
from app.models.domain.enums import IntentMode
from app.models.dto.responses import CartResponse
from app.repositories import get_cache
from app.services.vision_service import get_vision_service

router = APIRouter(prefix="/api/vision", tags=["vision"])


# --------------- hardcoded demo data for "Show It" paneer curry image ---------------
_DEMO_ENABLED = True  # flip to False to restore normal flow for all images


def _build_demo_vision_cart(session_id: str) -> Cart:
    """Build a hardcoded cart for the paneer curry demo image."""
    cart = Cart(
        session_id=session_id,
        mode=IntentMode.TEXT,
        confidence=0.96,
        notes=["Identified dish: Paneer Masala Curry"],
        reasoning_trail=[
            "Detected paneer cubes in rich tomato-based gravy",
            "Identified spices: garam masala, red chilli, coriander",
            "Matched ingredients for home recreation",
            "Selected Paneer, Onion, Garlic, Garam Masala, Tomato",
        ],
        eta_minutes=12,
    )
    cart.items = [
        CartItem(
            product_id="demo-vis-paneer",
            name="Paneer (Fresh)",
            brand="Amul",
            price=90.0,
            quantity=1,
            unit="200 g",
            reason="Main protein — the star of this curry",
            confidence=0.97,
            image_url="https://www.bigbasket.com/media/uploads/p/s/40005958_2-gowardhan-fresh-paneer-classic-block.jpg",
        ),
        CartItem(
            product_id="demo-vis-onion",
            name="Onions",
            brand="Fresh",
            price=35.0,
            quantity=3,
            unit="pcs",
            reason="Base for gravy — sautéed until golden",
            confidence=0.95,
            image_url="https://www.bigbasket.com/media/uploads/p/s/40075537_5-fresho-onion.jpg",
        ),
        CartItem(
            product_id="demo-vis-garlic",
            name="Garlic",
            brand="Fresh",
            price=15.0,
            quantity=1,
            unit="100 g",
            reason="Essential aromatic for the curry paste",
            confidence=0.94,
            image_url="https://www.bigbasket.com/media/uploads/p/s/10000115_15-fresho-garlic.jpg",
        ),
        CartItem(
            product_id="demo-vis-garam-masala",
            name="Garam Masala",
            brand="MDH",
            price=56.0,
            quantity=1,
            unit="50 g",
            reason="Key spice blend for that rich curry flavour",
            confidence=0.96,
            image_url="https://www.bigbasket.com/media/uploads/p/s/100004473_4-mdh-masala-garam.jpg",
        ),
        CartItem(
            product_id="demo-vis-tomato",
            name="Tomato (Hybrid)",
            brand="Fresh",
            price=30.0,
            quantity=4,
            unit="pcs",
            reason="Forms the base of the tangy red gravy",
            confidence=0.95,
            image_url="https://www.bigbasket.com/media/uploads/p/s/10000201_15-fresho-tomato-hybrid.jpg",
        ),
    ]
    cart.economical_items = [
        CartItem(
            product_id="demo-vis-eco-paneer",
            name="Paneer (Fresh)",
            brand="Mother Dairy",
            price=75.0,
            quantity=1,
            unit="200 g",
            reason="Budget-friendly pick (saves ₹15)",
            confidence=0.91,
            image_url="https://www.bigbasket.com/media/uploads/p/s/40005958_2-gowardhan-fresh-paneer-classic-block.jpg",
        ),
        CartItem(
            product_id="demo-vis-eco-onion",
            name="Onions (Local)",
            brand="Fresh",
            price=28.0,
            quantity=3,
            unit="pcs",
            reason="Budget-friendly pick (saves ₹7)",
            confidence=0.90,
            image_url="https://www.bigbasket.com/media/uploads/p/s/40075537_5-fresho-onion.jpg",
        ),
        CartItem(
            product_id="demo-vis-eco-garlic",
            name="Garlic (Loose)",
            brand="Fresh",
            price=12.0,
            quantity=1,
            unit="100 g",
            reason="Budget-friendly pick (saves ₹3)",
            confidence=0.89,
            image_url="https://www.bigbasket.com/media/uploads/p/s/50000507_5-fresho-garlic-organically-grown.jpg",
        ),
        CartItem(
            product_id="demo-vis-eco-garam-masala",
            name="Garam Masala",
            brand="Everest",
            price=42.0,
            quantity=1,
            unit="50 g",
            reason="Budget-friendly pick (saves ₹14)",
            confidence=0.90,
            image_url="https://www.bigbasket.com/media/uploads/p/s/268943_3-everest-garam-masala.jpg",
        ),
        CartItem(
            product_id="demo-vis-eco-tomato",
            name="Tomato (Local)",
            brand="Fresh",
            price=22.0,
            quantity=4,
            unit="pcs",
            reason="Budget-friendly pick (saves ₹8)",
            confidence=0.90,
            image_url="https://www.bigbasket.com/media/uploads/p/s/40022638_4-fresho-tomato-local-organically-grown.jpg",
        ),
    ]
    cart.recompute_total()
    return cart


@router.post("/analyze", response_model=CartResponse)
async def analyze_image(
    file: UploadFile | None = File(default=None),
    text: str | None = Form(default=None),
    session_id: str | None = Form(default=None),
) -> CartResponse:
    """Analyze an uploaded food/dish image and build a cart to recreate it."""

    # --- Demo shortcut (for any image when demo is enabled) ---
    if _DEMO_ENABLED and file:
        # Fake a ~2.5s "AI processing" delay
        await asyncio.sleep(2.5)

        sid = session_id or str(uuid.uuid4())
        new_cart = _build_demo_vision_cart(sid)

        # Persist to cache (reuses session_id so the frontend keeps the same session)
        cache = get_cache()
        await cache.save_cart(sid, new_cart)

        return CartResponse.from_domain(new_cart)

    # --- Normal flow ---
    service = get_vision_service()

    image_bytes = b""
    if file:
        image_bytes = await file.read()

    cart = await service.analyze_image(
        image_bytes=image_bytes,
        text_hint=text,
        session_id=session_id,
    )
    return CartResponse.from_domain(cart)