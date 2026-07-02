# Stack C — Python service (FastAPI) + scraping/worker extension

> **PROVISIONAL STACK — no canonical gate harness yet (audit-20, owner decision 2026-07-01).** Unlike stack A, this guide ships no canonical `verify.sh`/lint config, so the DR-059/DR-076 conformance ("installed byte-for-byte, upgrade diffs against the template") CANNOT yet protect a project born from it. This guide describes the **gate contract in prose**; the canonical files are listed under *Pending template machinery* below and MUST be built before/with the first real project on this stack. The browser gates (smoke/visual/responsive/shell) are N/A for a headless stack — that opt-out is DECLARED here (DR-059: an opt-out is a decision, not an omission).

Installation guide for `/pandacorp:architecture`. Use cases: Python APIs, ML-adjacent services, data pipelines — **and** data collection / scraping / monitors with alerts (the old stack D, folded here: same base + the *Scraping/worker extension* below). Why FastAPI: Pydantic-v2 validation at the boundary, OpenAPI generated natively, async-first; **uv** manages Python + deps (the pip/poetry replacement), **ruff** is the single lint+format tool.

## Installation (pin at the install point — DR-102 + SEC-4 cooldown)

Latest stable for a new project (DR-052), **pinned at install, never in prose** (DR-102): before each add, check the version's publish date (`uv pip show` after resolve, or the PyPI release page) and **never install one published < ~7 days ago** (new-release cooldown, `web-security.md` SEC-4 — take the previous stable). `uv.lock` is committed; installs are from the lockfile.

```bash
uv init --python 3.12 .
uv add fastapi uvicorn pydantic sqlalchemy alembic psycopg[binary]
uv add --dev pytest pytest-asyncio httpx mypy ruff
```

**Scraping/worker extension** (only for a collection/monitor project — see that section below):

```bash
uv add httpx parsel arq redis apscheduler
uv add playwright   # ONLY if there are JS-rendered pages — httpx+parsel is 10-50x cheaper
uv run playwright install chromium   # if applicable
```

## Standard Pandacorp configuration (`pyproject.toml`)

```toml
[tool.ruff]
target-version = "py312"
line-length = 100
lint.select = ["E", "F", "I", "N", "UP", "S", "B", "A", "C4", "PT"]

[tool.mypy]
strict = true
python_version = "3.12"
```

1. **Validation at the boundary**: all input/output with **Pydantic v2** models. No raw dicts in contracts.
2. **3-layer structure**: `app/routers/` → `app/services/` → `app/repositories/` — the **isolated data layer**: SQLAlchemy is called ONLY from `app/repositories/`; repositories take the session by dependency injection (FastAPI `Depends`) so they are testable. Models in `app/models/`, schemas in `app/schemas/`.
3. **Error contract (`api-design.md`, RFC 9457)**: every 4xx/5xx returns `application/problem+json` with `type/title/status/detail/instance` (+ `errors[]` `{detail, pointer}` for validation) — via a shared `problem()` helper + app-level exception handlers (`RequestValidationError`, `HTTPException`) so FastAPI's default `{"detail": …}` shape never leaks. Never ad-hoc error dicts per endpoint.
4. **OpenAPI**: FastAPI generates it from the Pydantic models (`/openapi.json`) — keep `response_model`/status codes explicit on every route so the generated spec is the real contract.
5. **DB**: SQLAlchemy 2.x + Alembic (migrations always with downgrade — `quality.md`). Postgres (Neon — Supabase was evaluated and rejected, see `external-services.md`); dev DB in Docker per `infra.md`.
6. **Tests**: pytest + httpx `AsyncClient` against the **in-process** app (no running server); fixtures with an isolated test DB; repositories against the real (test) DB, services with injected fakes.
7. **Observability**: structured logging (stdlib `logging` with JSON formatter or structlog) + Sentry — capture only unexpected errors, through one helper that redacts PII.

## Scraping/worker extension (the old stack D — apply only for collection/monitor projects)

1. **Architecture**: FastAPI (jobs/query API) + **ARQ workers** (queue in Redis) + ARQ cron or APScheduler (scheduling). Results in Postgres (JSONB for semi-structured data). *Honesty note:* ARQ is stable and asyncio-native but upstream is in **maintenance-only mode** (v0.28.0, 2026-04) — fine as the boring default; the architect may propose SAQ/Taskiq via ADR.
2. **Fetch discipline**: httpx + parsel first; Playwright ONLY for pages that require JS rendering.
3. **Responsible scraping (MUST — constitution + audit)**: review robots.txt and the site's terms BEFORE scraping (document in the blueprint); own rate limiting per domain; identifiable user-agent; exponential backoff; never aggressively bypass anti-bot mechanisms.
4. **Resilience**: idempotent jobs; dead-letter for repeated failures; success-rate tracking per source (alert if it drops below 95%); broken selectors are THE NORM — **contract tests against an HTML fixture** + an alert when parsing fails in production. Fail-loud read boundaries (DR-078): a parser that can't interpret a page returns an explicit error, never a silent `[]`.
5. **Notifications**: email via Resend / Telegram bot per the blueprint. Alert dedup (don't notify the same thing twice).

## The gate contract — what `verify.sh` MUST cover (fail-closed, DR-059)

Until the canonical harness ships, the architect hand-writes `.pandacorp/verify.sh` to this contract — `set -euo pipefail`, every step blocking, a missing tool is RED not a skip:

1. **Lint**: `uv run ruff check .` (select set above; `S` = bandit-style security rules).
2. **Format**: `uv run ruff format --check .`.
3. **Types**: `uv run mypy .` (strict).
4. **Tests**: `uv run pytest -q` (incl. the HTML-fixture contract tests for scrapers).
5. **Dead code**: ruff's `F401`/`F841` catch unused imports/vars; a whole-module dead-code gate (`vulture`, knip's analogue) is pending machinery.
6. **Data-layer isolation** (STRUCT-2): grep gate — SQLAlchemy session/engine imports outside `app/repositories/` are RED.
7. **API error contract** (API-1, `api-design.md`): grep gate — a router raising/returning 4xx/5xx without the shared `problem()` helper/handlers is RED.

Browser gates: N/A (headless — declared opt-out above). Interim minimal script = steps 1-4; steps 5-7 become real the moment the canonical harness lands.

## CI / Deploy (CI is an optional external-governance layer — DR-040)

**The primary quality gate is LOCAL** (`.pandacorp/verify.sh`); the solo operator pushes to `main` directly. GitHub Actions (ruff + mypy + pytest) is an **optional** layer for projects with an external remote/collaborators — it re-runs the same gate, never replaces it. Deploy: Docker on Railway or Fly.io — for a scraper/worker project, **API + worker as separate services** + Redis (Upstash) + Postgres (Neon).

## Pending template machinery (honest TODO — factory backlog)

Canonical, conformance-checked files this stack does NOT ship yet (each is a gap, not a silent default):

- [ ] `verify.sh` implementing the full gate contract above (incl. STRUCT-2 + API-1 grep gates, vulture dead-code step) + `canary.sh` (DR-079)
- [ ] canonical `pyproject.toml` tool sections as an installable/diffable fragment (today: copy the block above)
- [ ] `app/lib/problem.py` canonical helper + exception-handler snippet file (RFC 9457)
- [ ] scraper contract-test fixture skeleton (HTML fixture + parse-failure alert wiring)
- [ ] `/pandacorp:upgrade` conformance wiring for this stack's set (DR-059/DR-076)
