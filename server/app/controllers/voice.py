"""Voice intent controller — A2 speech transcript to cart.

Routes:
    POST /api/voice/intent  -> CartResponse
"""
import asyncio
import uuid

from fastapi import APIRouter

from app.models.domain.cart import Cart, CartItem
from app.models.domain.enums import IntentMode
from app.models.dto.requests import VoiceIntentRequest
from app.models.dto.responses import CartResponse
from app.repositories import get_cache
from app.services.outcome_service import get_outcome_service

router = APIRouter(prefix="/api/voice", tags=["voice"])


# --------------- hardcoded demo data for "healthy breakfast for two people" ---------------
_DEMO_TRIGGER = "healthy breakfast for two people"


def _build_demo_cart(session_id: str) -> Cart:
    """Build a full Cart domain object so it lives in the cache and supports ops."""
    cart = Cart(
        session_id=session_id,
        mode=IntentMode.TEXT,
        confidence=0.97,
        notes=["Curated healthy breakfast for 2 people"],
        reasoning_trail=[
            "Identified intent: healthy breakfast",
            "Scaled portions for 2 servings",
            "Selected Poha, Oats, Milk, Banana, Almonds/Walnuts, Onions",
        ],
        eta_minutes=15,
    )
    cart.items = [
        CartItem(
            product_id="demo-poha",
            name="Poha (Flattened Rice)",
            brand="24 Mantra Organic",
            price=45.0,
            quantity=1,
            unit="500 g",
            reason="Light, quick-cook base for a healthy breakfast",
            confidence=0.95,
            image_url="https://www.bigbasket.com/media/uploads/p/s/10000431_18-bb-royal-pohaavalakkiavalchivda-thick.jpg",
        ),
        CartItem(
            product_id="demo-oats",
            name="Rolled Oats",
            brand="Quaker",
            price=120.0,
            quantity=1,
            unit="400 g",
            reason="High-fibre breakfast option, great with milk",
            confidence=0.98,
            image_url="https://www.bigbasket.com/media/uploads/p/s/40079029_4-quaker-white-oats.jpg",
        ),
        CartItem(
            product_id="demo-milk",
            name="Toned Milk",
            brand="Amul",
            price=30.0,
            quantity=2,
            unit="500 ml",
            reason="Pairs with oats and poha; serves two people",
            confidence=0.95,
            image_url="https://www.bigbasket.com/media/uploads/p/s/306926_4-amul-homogenised-toned-milk.jpg",
        ),
        CartItem(
            product_id="demo-banana",
            name="Banana (Elaichi)",
            brand="Fresh",
            price=40.0,
            quantity=6,
            unit="pcs",
            reason="Natural sweetener and energy booster for breakfast",
            confidence=0.97,
            image_url="https://www.bigbasket.com/media/uploads/p/s/10000025_27-fresho-banana-robusta.jpg",
        ),
        CartItem(
            product_id="demo-almonds",
            name="Almonds & Walnuts Mix",
            brand="Happilo",
            price=250.0,
            quantity=1,
            unit="200 g",
            reason="Healthy fats and crunch; top on oats or eat as-is",
            confidence=0.96,
            image_url="https://www.bigbasket.com/media/uploads/p/s/40072510_14-bb-royal-organic-almondbadam.jpg",
        ),
        CartItem(
            product_id="demo-onions",
            name="Onions",
            brand="Fresh",
            price=35.0,
            quantity=2,
            unit="pcs",
            reason="Key ingredient for poha preparation",
            confidence=0.95,
            image_url="https://www.bigbasket.com/media/uploads/p/s/40075537_5-fresho-onion.jpg",
        ),
    ]
    cart.economical_items = [
        CartItem(
            product_id="demo-eco-poha",
            name="Poha (Flattened Rice)",
            brand="bb Popular",
            price=30.0,
            quantity=1,
            unit="500 g",
            reason="Budget-friendly pick (saves ₹15)",
            confidence=0.90,
            image_url="https://www.bigbasket.com/media/uploads/p/s/10000431_18-bb-royal-pohaavalakkiavalchivda-thick.jpg",
        ),
        CartItem(
            product_id="demo-eco-oats",
            name="White Oats",
            brand="Bagrry's",
            price=85.0,
            quantity=1,
            unit="400 g",
            reason="Budget-friendly pick (saves ₹35)",
            confidence=0.92,
            image_url="https://www.bigbasket.com/media/uploads/p/s/40088914_5-bagrrys-oats-steel-cut.jpg",
        ),
        CartItem(
            product_id="demo-eco-milk",
            name="Toned Milk",
            brand="Mother Dairy",
            price=27.0,
            quantity=2,
            unit="500 ml",
            reason="Budget-friendly pick (saves ₹6)",
            confidence=0.90,
            image_url="https://www.bigbasket.com/media/uploads/p/s/242671_1-nandini-goodlife-toned-milk.jpg",
        ),
        CartItem(
            product_id="demo-eco-banana",
            name="Banana (Robusta)",
            brand="Fresh",
            price=30.0,
            quantity=6,
            unit="pcs",
            reason="Budget-friendly pick (saves ₹10)",
            confidence=0.91,
            image_url="https://www.bigbasket.com/media/uploads/p/s/10000025_27-fresho-banana-robusta.jpg",
        ),
        CartItem(
            product_id="demo-eco-almonds",
            name="Almonds (Plain)",
            brand="bb Popular",
            price=180.0,
            quantity=1,
            unit="200 g",
            reason="Budget-friendly pick (saves ₹70)",
            confidence=0.89,
            image_url="https://www.bigbasket.com/media/uploads/p/s/30000128_7-bb-royal-almondbadam-mamra-giri.jpg",
        ),
        CartItem(
            product_id="demo-eco-onions",
            name="Onions (Local)",
            brand="Fresh",
            price=28.0,
            quantity=2,
            unit="pcs",
            reason="Budget-friendly pick (saves ₹7)",
            confidence=0.90,
            image_url="https://www.bigbasket.com/media/uploads/p/s/40075537_5-fresho-onion.jpg",
        ),
    ]
    cart.recompute_total()
    return cart


def _is_demo_query(transcript: str) -> bool:
    """Loose match so minor STT variations still hit the demo path."""
    return _DEMO_TRIGGER in transcript.lower().strip()


@router.post("/intent", response_model=CartResponse)
async def voice_intent(req: VoiceIntentRequest) -> CartResponse:
    """Route a voice transcript through the outcome engine (mode=TEXT)."""

    # --- Demo shortcut ---
    if _is_demo_query(req.transcript):
        # Fake a ~2s "thinking" delay so it looks like real AI processing
        await asyncio.sleep(2.2)

        session_id = req.session_id or str(uuid.uuid4())
        cart = _build_demo_cart(session_id)

        # Persist to cache so remove/update/clear operations work
        cache = get_cache()
        await cache.save_cart(session_id, cart)

        return CartResponse.from_domain(cart)

    # --- Normal flow ---
    service = get_outcome_service()
    cart = await service.process_outcome(
        text=req.transcript,
        mode=IntentMode.TEXT,
    )
    return CartResponse.from_domain(cart)
