# syntax=docker/dockerfile:1
# Imagen única de Códigos (D-20, D-36). Puerto en el servidor: 8053.

FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json* frontend/.npmrc ./
ARG CEREIPO_KIT_TOKEN=""
RUN --mount=type=secret,id=kit_token \
    --mount=type=secret,id=CEREIPO_KIT_TOKEN \
    TOKEN="$(cat /run/secrets/kit_token 2>/dev/null || cat /run/secrets/CEREIPO_KIT_TOKEN 2>/dev/null || printf '%s' "$CEREIPO_KIT_TOKEN")" \
 && if [ -n "$TOKEN" ]; then printf '//npm.pkg.github.com/:_authToken=%s\n' "$TOKEN" >> ~/.npmrc; fi \
 && if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi \
 && rm -f ~/.npmrc
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app
RUN useradd --system --uid 10001 --home-dir /app --shell /usr/sbin/nologin cereipo

COPY requirements.txt ./
RUN --mount=type=secret,id=kit_token \
    apt-get update && apt-get install -y --no-install-recommends git \
 && TOKEN="$(cat /run/secrets/kit_token 2>/dev/null || true)" \
 && if [ -n "$TOKEN" ]; then git config --global url."https://x-access-token:${TOKEN}@github.com/Paldaca/Cereipo-Kit".insteadOf "https://github.com/Paldaca/Cereipo-Kit"; fi \
 && pip install -r requirements.txt \
 && rm -f /root/.gitconfig \
 && apt-get purge -y git && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

COPY backend/ ./
COPY --from=web /web/dist ./spa

RUN DJANGO_DEBUG=false DJANGO_SECRET_KEY=solo-para-collectstatic \
    python manage.py collectstatic --noinput \
 && mkdir -p /app/archivos \
 && chown -R cereipo:cereipo /app/archivos

ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION} \
    RUNNING_IN_DOCKER=1 \
    CEREIPO_ARCHIVOS_DIR=/app/archivos \
    PORT=8053 \
    GUNICORN_WORKERS=2

USER cereipo
EXPOSE 8053

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["python", "healthcheck.py"]

CMD ["sh", "-c", "exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT} --workers ${GUNICORN_WORKERS} --access-logfile - --graceful-timeout 30 --timeout 60"]
