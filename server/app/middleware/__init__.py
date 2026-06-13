"""Middleware — cross-cutting concerns (Requirement 9.5).

Planned modules (task 6.2):
- pii_redaction  strip names/addresses/phone/email before any LLM call
- rate_limit     simple token-bucket per client
- request_id     attach a correlation id to every request/response
"""
