# NowCart Backend — FastAPI + uv
# Multi-stage build: install deps first (cached), then copy app source.
# Build context is the project root (set in docker-compose.yml).

# ------- Builder stage -------
FROM python:3.11-slim AS builder

WORKDIR /app

# Install uv (fast Python package manager)
RUN pip install --no-cache-dir uv==0.6.14

# Copy dependency manifests first for layer caching
COPY server/pyproject.toml server/uv.lock ./

# Install production dependencies into a virtual env
# Use -r pyproject.toml to install deps only (no source needed for caching layer)
RUN uv venv /app/.venv && \
    . /app/.venv/bin/activate && \
    uv pip install --no-cache -r pyproject.toml

# ------- Runtime stage -------
FROM python:3.11-slim AS runtime

WORKDIR /app

# Copy virtual env from builder
COPY --from=builder /app/.venv /app/.venv

# Put venv on PATH
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

# Copy application source
COPY server/app/ ./app/

# Copy catalog dataset — seed script resolves Path(__file__).parents[3] which
# maps to "/" inside the container (/app/app/seed/catalog.py → parents[3] = /)
COPY BigBasket.xlsx /BigBasket.xlsx

# Non-root user for security
RUN adduser --disabled-password --no-create-home nowcart && \
    chown -R nowcart:nowcart /app
USER nowcart

# Expose the FastAPI port
EXPOSE 8000

# Health check — matches GET /health
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Run with uvicorn (single worker for free-tier; scale via Nginx upstream)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
