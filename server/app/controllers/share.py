"""Share controller — recipe link/text parsing to cart (B4).

Routes:
    POST /api/share/parse  -> CartResponse

Parses YouTube videos, recipe blogs, Instagram reels, or pasted recipe text
into a grocery cart using LLM-powered extraction + the Outcome Engine.
"""
import asyncio
import uuid

from fastapi import APIRouter

from app.models.domain.cart import Cart, CartItem
from app.models.domain.enums import IntentMode
from app.models.dto.requests import ShareRequest
from app.models.dto.responses import CartResponse
from app.repositories import get_cache
from app.services.share_service import get_share_service

router = APIRouter(prefix="/api/share", tags=["share"])


# --------------- hardcoded demo data for "Share It" pasta YouTube link ---------------
_DEMO_ENABLED = True  # flip to False to restore normal flow
_DEMO_URL_TRIGGER = "bTo0J-lDbUU"  # unique video ID from the demo YouTube link


def _build_demo_share_cart(session_id: str) -> Cart:
    """Build a hardcoded cart for the pasta YouTube video demo."""
    cart = Cart(
        session_id=session_id,
        mode=IntentMode.TEXT,
        confidence=0.95,
        notes=["Extracted recipe from YouTube: Creamy Garlic Butter Pasta"],
        reasoning_trail=[
            "Parsed YouTube video: Creamy Garlic Butter Pasta recipe",
            "Extracted 5 key ingredients from video description",
            "Matched to catalog: Pasta, Milk, Butter, Garlic, Oregano",
            "Built cart with recommended quantities for 2 servings",
        ],
        eta_minutes=10,
    )
    cart.items = [
        CartItem(
            product_id="demo-share-pasta",
            name="Penne Pasta",
            brand="Barilla",
            price=120.0,
            quantity=1,
            unit="500 g",
            reason="Base pasta — holds creamy sauce well",
            confidence=0.97,
            image_url="https://www.bigbasket.com/media/uploads/p/s/101060_7-barilla-pasta-penne-rigate-durum-wheat.jpg",
        ),
        CartItem(
            product_id="demo-share-milk",
            name="Full Cream Milk",
            brand="Amul",
            price=35.0,
            quantity=1,
            unit="500 ml",
            reason="Creates the creamy base for the sauce",
            confidence=0.94,
            image_url="https://www.bigbasket.com/media/uploads/p/s/1202686_1-amul-gold-homogenised-standardised-milk.jpg",
        ),
        CartItem(
            product_id="demo-share-butter",
            name="Butter (Salted)",
            brand="Amul",
            price=56.0,
            quantity=1,
            unit="100 g",
            reason="Rich buttery flavour for the garlic sauce",
            confidence=0.96,
            image_url="https://www.bigbasket.com/media/uploads/p/s/40045943_1-amul-butter-pasteurised.jpg",
        ),
        CartItem(
            product_id="demo-share-garlic",
            name="Garlic",
            brand="Fresh",
            price=15.0,
            quantity=1,
            unit="100 g",
            reason="Star aromatic — sautéed in butter for the sauce",
            confidence=0.95,
            image_url="https://www.bigbasket.com/media/uploads/p/s/10000115_15-fresho-garlic.jpg",
        ),
        CartItem(
            product_id="demo-share-oregano",
            name="Oregano Seasoning",
            brand="Keya",
            price=45.0,
            quantity=1,
            unit="50 g",
            reason="Finishing herb for Italian flavour",
            confidence=0.93,
            image_url="https://www.bigbasket.com/media/uploads/p/s/100210774_7-keya-oregano.jpg",
        ),
    ]
    cart.economical_items = [
        CartItem(
            product_id="demo-share-eco-pasta",
            name="Pasta (Spiral)",
            brand="Borges",
            price=89.0,
            quantity=1,
            unit="500 g",
            reason="Budget-friendly pick (saves ₹31)",
            confidence=0.91,
            image_url="https://www.bigbasket.com/media/uploads/p/s/40014630_5-borges-whole-wheat-pasta-penne-rigate.jpg",
        ),
        CartItem(
            product_id="demo-share-eco-milk",
            name="Toned Milk",
            brand="Mother Dairy",
            price=27.0,
            quantity=1,
            unit="500 ml",
            reason="Budget-friendly pick (saves ₹8)",
            confidence=0.89,
            image_url="https://www.bigbasket.com/media/uploads/p/s/306926_4-amul-homogenised-toned-milk.jpg",
        ),
        CartItem(
            product_id="demo-share-eco-butter",
            name="Butter Amul",
            brand="Nandini",
            price=42.0,
            quantity=1,
            unit="100 g",
            reason="Budget-friendly pick (saves ₹14)",
            confidence=0.90,
            image_url="https://www.bigbasket.com/media/uploads/p/s/242667_1-nandini-butter-salted.jpg",
        ),
        CartItem(
            product_id="demo-share-eco-garlic",
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
            product_id="demo-share-eco-oregano",
            name="Oregano Pepper Seasoning",
            brand="Catch",
            price=30.0,
            quantity=1,
            unit="50 g",
            reason="Budget-friendly pick (saves ₹15)",
            confidence=0.88,
            image_url="https://www.bigbasket.com/media/uploads/p/s/40127887_2-snapin-oregano.jpg",
        ),
    ]
    cart.recompute_total()
    return cart


def _is_demo_share(url: str | None) -> bool:
    """Check if the URL matches the demo YouTube video."""
    if not url:
        return False
    return _DEMO_URL_TRIGGER in url


@router.post("/parse", response_model=CartResponse)
async def parse_share(req: ShareRequest) -> CartResponse:
    """Parse a shared recipe link or text and build a cart."""

    # --- Demo shortcut ---
    if _DEMO_ENABLED and _is_demo_share(req.url):
        # Fake ~2.5s "parsing video" delay
        await asyncio.sleep(2.5)

        sid = req.session_id or str(uuid.uuid4())
        new_cart = _build_demo_share_cart(sid)

        # Persist to cache (reuses session_id so the frontend keeps the same session)
        cache = get_cache()
        await cache.save_cart(sid, new_cart)

        return CartResponse.from_domain(new_cart)

    # --- Normal flow ---
    service = get_share_service()
    cart = await service.parse_shared_content(
        url=req.url,
        text=req.text,
        session_id=req.session_id,
    )
    return CartResponse.from_domain(cart)