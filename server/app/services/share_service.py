"""Share service — parse recipe URLs, YouTube videos, or pasted text into cart.

Uses httpx to fetch URL content (HTML/text), then Groq LLM to extract
ingredients from the fetched content. Falls back to treating the URL/text
as a plain outcome if fetching fails.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid

import httpx
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import CouldNotRetrieveTranscript

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


def _is_youtube_url(url: str) -> bool:
    return any(p.search(url) for p in _YT_PATTERNS)


def _youtube_video_id(url: str) -> str | None:
    for pattern in _YT_PATTERNS:
        match = pattern.search(url)
        if match:
            return match.group(1)
    return None


def _fetch_youtube_transcript_sync(video_id: str, max_chars: int = 6000) -> str | None:
    """Fetch the actual spoken transcript (manual or auto-generated captions).

    This is what makes recipe extraction *semantic* rather than a guess from
    title/description alone — cooking videos narrate ingredients, quantities,
    and steps out loud, which the transcript captures verbatim.
    """
    try:
        api = YouTubeTranscriptApi()
        transcript = api.fetch(video_id)
    except CouldNotRetrieveTranscript:
        return None
    except Exception:  # noqa: BLE001 — any other transcript-fetch failure
        return None

    full_text = " ".join(snippet.text for snippet in transcript).strip()
    if not full_text:
        return None
    return full_text[:max_chars]


async def _extract_youtube_details(html: str, video_id: str | None) -> str | None:
    """Pull the real video title + description out of YouTube's embedded
    ytInitialPlayerResponse JSON blob, plus the spoken transcript when available.

    YouTube watch pages are client-rendered — the visible/stripped HTML text
    is just nav/footer boilerplate. The actual title and description live
    inside a <script>ytInitialPlayerResponse = {...};</script> blob, which a
    naive "strip all tags/scripts" text extractor discards entirely.
    """
    match = re.search(r"ytInitialPlayerResponse\s*=\s*(\{.*?\});", html, re.S)
    if not match:
        return None
    try:
        data = json.loads(match.group(1))
    except json.JSONDecodeError:
        return None

    playability = data.get("playabilityStatus", {})
    if playability.get("status") not in (None, "OK"):
        return None  # video unavailable, private, age-restricted, etc.

    video_details = data.get("videoDetails", {})
    title = video_details.get("title", "")
    if not title:
        return None
    description = video_details.get("shortDescription", "")

    parts = [f"Video title: {title}", f"Video description: {description[:2000]}"]

    if video_id:
        transcript = await asyncio.to_thread(_fetch_youtube_transcript_sync, video_id)
        if transcript:
            parts.append(f"Video transcript (spoken narration): {transcript}")
            logger.info("Fetched YouTube transcript for %s (%d chars)", video_id, len(transcript))
        else:
            logger.info("No transcript available for %s — using title/description only", video_id)

    return "\n".join(parts)


async def _fetch_url_content(url: str) -> str | None:
    """Fetch a URL and return its text content (truncated for LLM context).

    YouTube watch pages are client-rendered, so the generic tag-stripping
    extraction below yields only nav/footer boilerplate. For YouTube URLs,
    pull the title/description straight out of the embedded player JSON.
    """
    try:
        async with httpx.AsyncClient(
            timeout=15.0,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NowCart/1.0"},
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")

            if "text/html" not in content_type and "text/plain" not in content_type:
                return None  # Binary content — can't parse

            if _is_youtube_url(url):
                yt_details = await _extract_youtube_details(resp.text, _youtube_video_id(url))
                if yt_details:
                    return yt_details
                # Video unavailable/private or JSON blob not found — fall
                # through to generic extraction as a last resort.

            return _extract_text_from_html(resp.text)
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
                    "(could be a YouTube title/description/spoken transcript, recipe blog, Instagram caption, etc.), "
                    "extract the recipe name and all grocery ingredients needed.\n\n"
                    "If a 'Video transcript' section is present, it is the host's actual spoken narration — "
                    "prioritize it over the title/description, since hosts usually name every ingredient and "
                    "often state exact quantities out loud (e.g. '200 grams of paneer', 'two onions'). "
                    "Prefer ingredients and quantities mentioned in the transcript; use the title/description "
                    "only to fill gaps or confirm the dish name.\n\n"
                    "Return a concise summary in the format: "
                    "'Making [dish name]: [ingredient1] ([qty if stated]), [ingredient2] ([qty if stated]), ...'\n"
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
