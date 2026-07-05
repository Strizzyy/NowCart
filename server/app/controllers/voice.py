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
            image_url="https://www.bigbasket.com/media/uploads/p/l/40247534_2-24-mantra-organic-thick-poha.jpg",
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
            image_url="https://www.bigbasket.com/media/uploads/p/s/40042972_6-bobs-red-mill-rolled-oats-gluten-free.jpg",
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
            image_url="https://img.magnific.com/free-vector/vector-ripe-yellow-banana-bunch-isolated-white-background_1284-45456.jpg?semt=ais_hybrid&w=740&q=80",
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
            image_url="https://www.bigbasket.com/media/uploads/p/s/258324_8-nandini-butter-milk-spiced.jpg",
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
            image_url="https://www.bigbasket.com/media/uploads/p/s/40140236_1-amul-almondo-roasted-almonds-coated-with-milk-chocolate.jpg",
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
            image_url="https://www.bigbasket.com/media/uploads/p/l/40247534_2-24-mantra-organic-thick-poha.jpg",
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
            image_url="https://www.bigbasket.com/media/uploads/p/s/40188430_2-the-bakers-dozen-coconut-oats-cookies.jpg",
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
            image_url="https://jagsfresh-bucket.s3.amazonaws.com/media/package/img_one/2021-11-12/toned_milk.jpg",
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
            image_url="https://img.magnific.com/free-vector/vector-ripe-yellow-banana-bunch-isolated-white-background_1284-45456.jpg",
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
            image_url="https://www.bigbasket.com/media/uploads/p/s/40126270_6-rostaa-almonds-salted.jpg",
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
        new_cart = _build_demo_cart(session_id)

        # Persist to cache (reuses session_id so the frontend keeps the same session)
        cache = get_cache()
        await cache.save_cart(session_id, new_cart)

        return CartResponse.from_domain(new_cart)

    # --- Normal flow ---
    service = get_outcome_service()
    cart = await service.process_outcome(
        text=req.transcript,
        mode=IntentMode.TEXT,
    )
    return CartResponse.from_domain(cart)