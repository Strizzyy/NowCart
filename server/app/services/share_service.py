"""Share service — parse recipe URLs, YouTube videos, or pasted text into cart.

Uses httpx to fetch URL content (HTML/text), then Groq LLM to extract
ingredients from the fetched content. Falls back to treating the URL/text
as a plain outcome if fetching fails.
"""
from __future__ import annotations

import logging
import re
import uuid

import httpx

from app.llm.factory import get_text_provider
from app.models.domain.cart import Cart
from app.models.domain.enums import IntentMode
from app.services.outcome_service import get_outcome_service

logger = logging.getLogger(__name__)

# YouTube URL patterns
_YT_PATTERNS = [
    re.compile(r"(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([\w-]+)"),
    re.compile(r"(?:https?://)?youtu\.be/([\w-]+)"),
    re.compile(r"(?:https?://)?(?:www\.)?youtube\.com/shorts/([\w-]+)"),
]

# Instagram reel pattern
_INSTA_PATTERN = re.compile(r"(?:https?://)?(?:www\.)?instagram\.com/reel/([\w-]+)")


def _is_url(text: str) -> bool:
    """Check if the text looks like a URL."""
    return text.strip().startswith(("http://", "https://", "www."))


def _extract_text_from_html(html: str, max_chars: int = 8000) -> str:
    """Crude HTML → text extraction (no BeautifulSoup dep needed).

    Strips tags, scripts, styles, and collapses whitespace.
    """
    # Remove script/style blocks
    html = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<style[^>]*>.*?</style>", " ", html, flags=re.S | re.I)
    # Remove HTML comments
    html = re.sub(r"<!--.*?-->", " ", html, flags=re.S)
    # Remove tags
    html = re.sub(r"<[^>]+>", " ", html)
    # Decode common entities
    html = html.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    html = html.replace("&nbsp;", " ").replace("&#39;", "'").replace("&quot;", '"')
    # Collapse whitespace
    text = re.sub(r"\s+", " ", html).strip()
    return text[:max_chars]


async def _fetch_url_content(url: str) -> str | None:
    """Fetch a URL and return its text content (truncated for LLM context)."""
    try:
        async with httpx.AsyncClient(
            timeout=15.0,
            follow_redirects=True,
            headers={"User-Agent": "NowCart/1.0 (recipe-parser)"},
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")

            if "text/html" in content_type or "text/plain" in content_type:
                return _extract_text_from_html(resp.text)
            else:
                # Binary content — can't parse
                return None
    except Exception as exc:
        logger.warning("Failed to fetch URL %s: %s", url, exc)
        return None


class ShareService:
    """Parse shared recipe content (URLs, YouTube links, pasted text) into a cart."""

    async def parse_shared_content(
        self,
        url: str | None = None,
        text: str | None = None,
        session_id: str | None = None,
    ) -> Cart:
        """Parse a shared recipe link or pasted text and build a grocery cart.

        Strategy:
        1. If URL provided → fetch page content → extract recipe/ingredients via LLM
        2. If text provided → extract recipe/ingredients directly via LLM
        3. Pass extracted ingredients to the outcome engine for catalog matching

        Args:
            url: Recipe URL (YouTube, Instagram reel, blog, etc.)
            text: Pasted recipe text
            session_id: Optional existing session ID

        Returns:
            Cart with matched products from the parsed recipe.
        """
        llm = get_text_provider()
        extracted_text = ""

        if url and _is_url(url):
            # Fetch URL content
            page_content = await _fetch_url_content(url)

            if page_content:
                # Use LLM to extract recipe/ingredients from page content
                system_prompt = (
                    "You are a recipe extraction assistant. Given web page content from a recipe URL "
                    "(could be YouTube description, recipe blog, Instagram caption, etc.), "
                    "extract the recipe name and all grocery ingredients needed.\n\n"
                    "If it's a YouTube video about cooking, extract the dish name and ingredients "
                    "mentioned in the title/description.\n\n"
                    "Return a concise summary in the format: "
                    "'Making [dish name]: [ingredient1], [ingredient2], ...'\n"
                    "If you can't identify a recipe, return the most relevant food/grocery items mentioned."
                )
                extracted_text = await llm.complete_text(system_prompt, page_content)
            else:
                # Couldn't fetch — use the URL itself as context for the LLM
                system_prompt = (
                    "You are a recipe extraction assistant. The user shared a URL that I couldn't fetch. "
                    "Based on the URL pattern, try to infer what recipe or food items they might need. "
                    "Return a concise outcome like: 'Making [dish]: [ingredients list]'"
                )
                extracted_text = await llm.complete_text(system_prompt, f"URL: {url}")

        elif text:
            # Direct text — could be a pasted recipe, ingredient list, etc.
            system_prompt = (
                "You are a recipe extraction assistant. The user pasted recipe text or a description. "
                "Summarize what they want to make and the key ingredients needed.\n"
                "Return a concise outcome like: 'Making [dish name] for [servings]: needs [ingredients]'"
            )
            extracted_text = await llm.complete_text(system_prompt, text)

        # If LLM extraction produced something, route through the outcome engine
        if not extracted_text:
            extracted_text = text or url or "shared recipe"

        # Route through outcome engine with LINK mode
        outcome_service = get_outcome_service()
        cart = await outcome_service.process_outcome(
            text=extracted_text,
            mode=IntentMode.LINK,
        )

        # Override session_id if provided
        if session_id:
            cart.session_id = session_id

        return cart


_share_service: ShareService | None = None


def get_share_service() -> ShareService:
    """Return the singleton ShareService."""
    global _share_service
    if _share_service is None:
        _share_service = ShareService()
    return _share_service
