"""SSRF guard — validates and safely fetches user-supplied URLs.

The Share feature (`services/share_service.py`) lets a user submit an
arbitrary "recipe URL" that this server fetches server-side. Without
validation, that URL could point at internal infrastructure instead of a
public recipe site:

    POST /api/share/parse
    {"url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/nowcart-dev"}

...and the server would dutifully fetch the EC2 instance metadata service —
handing an attacker temporary IAM credentials, or letting them port-scan
and probe whatever else lives in this instance's VPC (Redis, DynamoDB
Local, other internal hosts) using this server as a proxy.

Defenses implemented here:
- Scheme allowlist (http/https only — blocks file://, gopher://, etc.)
- Rejects URLs with embedded credentials (http://user:pass@host), a
  classic trick for smuggling a different host past naive parsers
- Resolves the hostname and rejects it if ANY resolved address is
  private, loopback, link-local (this is what covers the
  169.254.169.254 cloud metadata endpoint), multicast, reserved, or
  unspecified — checked for IPv4 and IPv6 both, including IPv4-mapped
  IPv6 addresses (::ffff:169.254.169.254)
- Pins the connection to the validated IP (via the SNI extension +
  explicit Host header) instead of letting the HTTP client re-resolve
  DNS at connect time — this closes the DNS-rebinding TOCTOU window
  where a hostname resolves to a public IP during validation but a
  private one moments later during the actual connection
- Restricts to default web ports (80/443) so a validated public IP
  can't be used to reach an unusual internal service port
- Follows redirects manually (max 5 hops), re-validating every hop
  through the same checks — httpx's built-in `follow_redirects` would
  connect straight to a redirect's target without ever revalidating it
- Caps the response body size while streaming, so a huge or malicious
  response can't exhaust memory/bandwidth
"""
from __future__ import annotations

import asyncio
import ipaddress
import logging
import socket
from urllib.parse import urlsplit, urlunsplit

import httpx

logger = logging.getLogger(__name__)

_ALLOWED_SCHEMES = {"http", "https"}
_ALLOWED_PORTS = {80, 443, None}
_MAX_REDIRECTS = 5
_MAX_BODY_BYTES = 2 * 1024 * 1024  # 2 MB — plenty for HTML/text; blocks abuse
_BLOCKED_HOSTNAMES = {"localhost", "metadata.google.internal"}


class SSRFBlocked(Exception):
    """Raised when a URL fails SSRF validation. Callers should treat this
    the same as any other "couldn't fetch" failure — never surface the
    internal reason to the end user, just log it and degrade gracefully.
    """


def _is_unsafe_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local  # covers 169.254.169.254 (AWS/GCP/Azure metadata)
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


async def _resolve_safe(hostname: str) -> str:
    """Resolve hostname, return one safe public IP, or raise SSRFBlocked."""
    try:
        infos = await asyncio.to_thread(socket.getaddrinfo, hostname, None)
    except socket.gaierror as exc:
        raise SSRFBlocked(f"Could not resolve host: {hostname}") from exc

    resolved_ips: list[str] = []
    for info in infos:
        raw_ip = info[4][0].split("%", 1)[0]  # strip IPv6 zone id if present
        try:
            ip = ipaddress.ip_address(raw_ip)
        except ValueError:
            continue
        if _is_unsafe_ip(ip):
            raise SSRFBlocked(f"{hostname} resolves to a non-public address ({ip})")
        resolved_ips.append(str(ip))

    if not resolved_ips:
        raise SSRFBlocked(f"No usable addresses for host: {hostname}")

    return resolved_ips[0]


def _validate_url(url: str) -> tuple[str, str, int | None, str]:
    """Parse + validate scheme/host/port/credentials.

    Returns (scheme, hostname, port, url_without_userinfo).
    """
    parts = urlsplit(url)

    if parts.scheme not in _ALLOWED_SCHEMES:
        raise SSRFBlocked(f"Scheme not allowed: {parts.scheme!r}")

    if not parts.hostname:
        raise SSRFBlocked("URL has no hostname")

    if parts.username or parts.password:
        raise SSRFBlocked("URLs with embedded credentials are not allowed")

    if parts.port not in _ALLOWED_PORTS:
        raise SSRFBlocked(f"Port not allowed: {parts.port}")

    hostname = parts.hostname.lower()
    if hostname in _BLOCKED_HOSTNAMES:
        raise SSRFBlocked(f"Hostname not allowed: {hostname}")

    netloc = hostname if parts.port is None else f"{hostname}:{parts.port}"
    clean_url = urlunsplit((parts.scheme, netloc, parts.path or "/", parts.query, ""))
    return parts.scheme, hostname, parts.port, clean_url


async def safe_get(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 15.0,
    _redirects_left: int = _MAX_REDIRECTS,
) -> httpx.Response:
    """SSRF-safe GET: validates the URL/host/IP, pins DNS, and caps
    redirects and body size. Raises SSRFBlocked or an httpx exception on
    failure — callers should catch broadly, same as any fetch failure.
    """
    scheme, hostname, port, clean_url = _validate_url(url)
    ip = await _resolve_safe(hostname)

    # Connect to the *validated* IP directly instead of letting httpx
    # re-resolve the hostname — this is the DNS-pinning step that closes
    # the rebinding TOCTOU gap. We still present the original hostname via
    # SNI (for TLS cert validation) and the Host header (for vhost routing).
    pinned_netloc = ip if port is None else f"{ip}:{port}"
    parts = urlsplit(clean_url)
    pinned_url = urlunsplit((parts.scheme, pinned_netloc, parts.path or "/", parts.query, ""))

    req_headers = dict(headers or {})
    req_headers["Host"] = hostname
    extensions = {"sni_hostname": hostname} if scheme == "https" else {}

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False, verify=True) as client:
        async with client.stream("GET", pinned_url, headers=req_headers, extensions=extensions) as resp:
            if resp.is_redirect:
                if _redirects_left <= 0:
                    raise SSRFBlocked("Too many redirects")
                location = resp.headers.get("location")
                if not location:
                    raise SSRFBlocked("Redirect with no Location header")
                next_url = str(httpx.URL(clean_url).join(location))
                return await safe_get(
                    next_url, headers=headers, timeout=timeout, _redirects_left=_redirects_left - 1
                )

            resp.raise_for_status()

            # Cap on the *decoded* size (aiter_bytes, not aiter_raw) so a
            # small gzip/br bomb that expands to hundreds of MB is caught
            # here rather than after fully inflating in memory.
            body = bytearray()
            async for chunk in resp.aiter_bytes():
                body.extend(chunk)
                if len(body) > _MAX_BODY_BYTES:
                    raise SSRFBlocked("Response body exceeded size limit")

            # Drop Content-Encoding/Content-Length from the original
            # headers: `body` is already decoded, so passing the original
            # Content-Encoding through would make httpx.Response() try to
            # decompress it a second time (and Content-Length no longer
            # matches the decoded size either).
            passthrough_headers = [
                (k, v)
                for k, v in resp.headers.raw
                if k.lower() not in (b"content-encoding", b"content-length")
            ]

            return httpx.Response(
                status_code=resp.status_code,
                headers=passthrough_headers,
                content=bytes(body),
                request=resp.request,
            )
