# Stack D — Data collection / scraping / notifications (Python)

Installation guide for `/pandacorp:architecture`. Use case: scrapers, real-time trackers, monitors with alerts (e.g.: Funko catalog).

## Installation

```bash
uv init --python 3.12 .
uv add fastapi uvicorn pydantic sqlalchemy alembic psycopg[binary]
uv add httpx parsel arq redis apscheduler
uv add playwright   # ONLY if there are pages with JS rendering — httpx+parsel is 10-50x faster
uv add --dev pytest pytest-asyncio mypy ruff
uv run playwright install chromium   # if applicable
```

## Standard Pandacorp configuration

1. Same base as Stack C (ruff + mypy strict + 3-layer structure).
2. **Architecture**: FastAPI (jobs/query API) + ARQ workers (queue in Redis) + ARQ cron or APScheduler (scheduling). Results in Postgres (JSONB for semi-structured data).
3. **Responsible scraping** (constitution + audit): review robots.txt and the site's terms BEFORE scraping (document in the blueprint); own rate limiting per domain; identifiable user-agent; exponential backoff; never aggressively bypass anti-bot mechanisms.
4. **Resilience**: idempotent jobs; dead-letter for repeated failures; success-rate tracking per source (alert if it drops below 95%); broken selectors are THE NORM — contract tests against an HTML fixture + an alert when parsing fails in production.
5. **Notifications**: email via Resend / Telegram bot per the blueprint. Alert dedup (don't notify the same thing twice).

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

GitHub Actions: ruff + mypy + pytest on PR. Deploy: Docker (API + worker as separate services) on Railway/Fly.io + Redis (Upstash) + Postgres (Neon/Supabase).
