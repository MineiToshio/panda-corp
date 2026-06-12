# Stack C — API/servicio backend (Python + FastAPI)

Guía de instalación para `/pandacorp:blueprint`. Caso de uso: APIs Python, servicios ML-adyacentes, pipelines de datos.

## Instalación

```bash
uv init --python 3.12 .
uv add fastapi uvicorn pydantic sqlalchemy alembic psycopg[binary]
uv add --dev pytest pytest-asyncio httpx mypy ruff
```

## Configuración estándar Pandacorp (`pyproject.toml`)

```toml
[tool.ruff]
target-version = "py312"
line-length = 100
lint.select = ["E", "F", "I", "N", "UP", "S", "B", "A", "C4", "PT"]

[tool.mypy]
strict = true
python_version = "3.12"
```

1. **Validación**: todo input/output con modelos Pydantic v2. Sin dicts crudos en contratos.
2. **Estructura 3 capas**: `app/routers/` → `app/services/` → `app/repositories/`. Modelos en `app/models/`, schemas en `app/schemas/`.
3. **BD**: SQLAlchemy 2.x + Alembic (migraciones siempre con downgrade). Postgres.
4. **Tests**: httpx.AsyncClient contra la app en proceso; fixtures con BD de prueba aislada.

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

GitHub Actions: ruff + mypy + pytest en PR. Deploy: Docker en Railway o Fly.io.
