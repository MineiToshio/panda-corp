# Stack C — Backend API/service (Python + FastAPI)

> **PROVISIONAL STACK — no canonical gate harness yet (audit-20, owner decision 2026-07-01).** Unlike stack A, this guide ships no canonical `verify.sh`/lint config/e2e set, so the DR-059/DR-076 conformance ("installed byte-for-byte, upgrade diffs against the template") CANNOT protect a project born from it — its gates would be hand-rolled, the exact failure mode DR-059 closes. Before building the first real project on this stack, build its canonical gate harness first (tracked as a factory-backlog item). The browser gates (smoke/visual/responsive/shell) are N/A for a headless stack — that opt-out is DECLARED here (DR-059: an opt-out is a decision, not an omission).

Installation guide for `/pandacorp:architecture`. Use case: Python APIs, ML-adjacent services, data pipelines.

## Installation

```bash
uv init --python 3.12 .
uv add fastapi uvicorn pydantic sqlalchemy alembic psycopg[binary]
uv add --dev pytest pytest-asyncio httpx mypy ruff
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

1. **Validation**: all input/output with Pydantic v2 models. No raw dicts in contracts.
2. **3-layer structure**: `app/routers/` → `app/services/` → `app/repositories/`. Models in `app/models/`, schemas in `app/schemas/`.
3. **DB**: SQLAlchemy 2.x + Alembic (migrations always with downgrade). Postgres.
4. **Tests**: httpx.AsyncClient against the in-process app; fixtures with an isolated test DB.

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

**The primary quality gate is LOCAL** (`.pandacorp/verify.sh`); the solo operator pushes to `main` directly. GitHub Actions (ruff + mypy + pytest) is an **optional** layer for projects with an external remote/collaborators — it re-runs the same gate, never replaces it. Deploy: Docker on Railway or Fly.io.
