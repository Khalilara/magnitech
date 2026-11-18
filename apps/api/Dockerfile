# syntax=docker/dockerfile:1.7
# =============================================================================
#  Maghitech API — FastAPI / Celery (même image pour api, worker, beat, migrate)
#  Build depuis la racine du monorepo :
#    docker build -f apps/api/Dockerfile -t maghitech/api .
# =============================================================================
ARG PYTHON_VERSION=3.12

# --- Stage 0 : binaire uv (gestionnaire de dépendances ultra-rapide) ---------
FROM ghcr.io/astral-sh/uv:0.5 AS uv

# --- Stage 1 : résolution & installation des dépendances dans un venv ---------
FROM python:${PYTHON_VERSION}-slim AS builder
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv
WORKDIR /src

# Couche de dépendances seule : invalidée uniquement si pyproject/uv.lock changent
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=apps/api/pyproject.toml,target=pyproject.toml \
    --mount=type=bind,source=apps/api/uv.lock,target=uv.lock \
    uv sync --frozen --no-dev --no-install-project

# --- Stage 2 : tests (optionnel, utilisé en CI : --target test) ---------------
FROM builder AS test
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=apps/api/pyproject.toml,target=pyproject.toml \
    --mount=type=bind,source=apps/api/uv.lock,target=uv.lock \
    uv sync --frozen --no-install-project
COPY apps/api/ .
ENV PATH="/opt/venv/bin:$PATH"
RUN pytest -q

# --- Stage 3 : image de production minimale ----------------------------------
FROM python:${PYTHON_VERSION}-slim AS runtime
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1

RUN groupadd --system --gid 10001 app \
 && useradd --system --uid 10001 --gid app --no-create-home --shell /usr/sbin/nologin app

WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY --chown=app:app apps/api/alembic.ini ./
COPY --chown=app:app apps/api/alembic ./alembic
COPY --chown=app:app apps/api/db ./db
COPY --chown=app:app apps/api/app ./app

USER app
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).status == 200 else 1)"]

# Derrière Traefik : on fait confiance aux en-têtes X-Forwarded-*
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "4", "--proxy-headers", "--forwarded-allow-ips", "*", \
     "--no-server-header", "--timeout-graceful-shutdown", "30"]
