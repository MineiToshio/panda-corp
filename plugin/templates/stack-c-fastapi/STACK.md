# Stack C — Backend API/service (Python + FastAPI)

Installation guide for `/pandacorp:blueprint`. Use case: Python APIs, ML-adjacent services, data pipelines.

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

```bash
#!/bin/bash
set -e
uv run ruff check .
uv run ruff format --check .
uv run mypy .
uv run pytest -q
```

## CI / Deploy

GitHub Actions: ruff + mypy + pytest on PR. Deploy: Docker on Railway or Fly.io.
