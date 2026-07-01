# Stack D — Data collection / scraping / notifications (Python)

> **PROVISIONAL STACK — no canonical gate harness yet (audit-20, owner decision 2026-07-01).** Unlike stack A, this guide ships no canonical `verify.sh`/lint config/e2e set, so the DR-059/DR-076 conformance ("installed byte-for-byte, upgrade diffs against the template") CANNOT protect a project born from it — its gates would be hand-rolled, the exact failure mode DR-059 closes. Before building the first real project on this stack, build its canonical gate harness first (tracked as a factory-backlog item). The browser gates (smoke/visual/responsive/shell) are N/A for a headless stack — that opt-out is DECLARED here (DR-059: an opt-out is a decision, not an omission).

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

Interim snippet (until the canonical harness exists — see the banner above):

```bash
#!/bin/bash
set -euo pipefail
uv run ruff check .
uv run ruff format --check .
uv run mypy .
uv run pytest -q
```

## CI / Deploy (CI is an optional external-governance layer — DR-040)

**The primary quality gate is LOCAL** (`.pandacorp/verify.sh`); the solo operator pushes to `main` directly. GitHub Actions (ruff + mypy + pytest) is an **optional** layer for projects with an external remote/collaborators — it re-runs the same gate, never replaces it. Deploy: Docker (API + worker as separate services) on Railway/Fly.io + Redis (Upstash) + Postgres (Neon — Supabase was evaluated and rejected, see `external-services.md`).
