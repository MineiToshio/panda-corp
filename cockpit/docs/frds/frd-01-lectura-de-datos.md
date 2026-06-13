# FRD-01 — Capa de lectura de datos

Pandacorp lee de disco la información de la fábrica y de cada proyecto, sin escribir (salvo la excepción de descartar, FRD-02) y sin llamar a Claude.

## Criterios de aceptación (EARS)
- CUANDO Pandacorp carga, EL sistema DEBERÁ leer todas las fichas de `panda-corp/fabrica/ideas/*.md` (ignorando `_plantilla-ficha.md`) con su frontmatter (título, estado, tipo, score).
- EL sistema DEBERÁ leer `panda-corp/fabrica/portfolio.md` para obtener la lista de proyectos y sus rutas.
- CUANDO un proyecto tiene `docs/estado.yaml`, EL sistema DEBERÁ leer fase, version, running, progreso, conteo de work orders y `decisiones_pendientes`.
- EL sistema DEBERÁ leer, por proyecto, los documentos de `docs/` (PRD, FRDs, blueprint, work orders, `progreso.md`, `decisiones.md`).
- SI la ruta de un proyecto no existe, ENTONCES EL sistema DEBERÁ marcarla como no encontrada y NO romper el resto de la vista.
- EL sistema NUNCA DEBERÁ llamar a Claude ni a ninguna API de IA, ni escribir archivos (excepto el caso de FRD-02).

## Casos límite
- Carpeta de ideas vacía → estados vacíos con gracia.
- `estado.yaml` ausente o malformado → mostrar el proyecto con datos parciales, sin romper.
