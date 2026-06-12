# Stack D — Recolección de datos / scraping / notificaciones (Python)

Guía de instalación para `/pandacorp:blueprint`. Caso de uso: scrapers, trackers en tiempo real, monitores con alertas (ej: catálogo de Funkos).

## Instalación

```bash
uv init --python 3.12 .
uv add fastapi uvicorn pydantic sqlalchemy alembic psycopg[binary]
uv add httpx parsel arq redis apscheduler
uv add playwright   # SOLO si hay páginas con render JS — httpx+parsel es 10-50x más rápido
uv add --dev pytest pytest-asyncio mypy ruff
uv run playwright install chromium   # si aplica
```

## Configuración estándar Pandacorp

1. Misma base que Stack C (ruff + mypy strict + estructura 3 capas).
2. **Arquitectura**: FastAPI (API de jobs/consulta) + workers ARQ (cola en Redis) + ARQ cron o APScheduler (programación). Resultados en Postgres (JSONB para datos semiestructurados).
3. **Scraping responsable** (constitución + auditoría): revisar robots.txt y términos del sitio ANTES de scrapear (documentar en blueprint); rate limiting propio por dominio; user-agent identificable; backoff exponencial; jamás eludir mecanismos anti-bot de forma agresiva.
4. **Resiliencia**: jobs idempotentes; dead-letter para fallos repetidos; tracking de tasa de éxito por fuente (alertar si cae <95%); los selectores rotos son LO NORMAL — tests de contrato contra HTML fixture + alerta cuando el parseo falla en producción.
5. **Notificaciones**: email vía Resend / Telegram bot según blueprint. Dedup de alertas (no notificar lo mismo dos veces).

## `.pandacorp/verify.sh`

```bash
#!/bin/bash
set -e
uv run ruff check .
uv run ruff format --check .
uv run mypy .
uv run pytest -q
```

## CI / Deploy

GitHub Actions: ruff + mypy + pytest en PR. Deploy: Docker (API + worker como servicios separados) en Railway/Fly.io + Redis (Upstash) + Postgres (Neon/Supabase).
