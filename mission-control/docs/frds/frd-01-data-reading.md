# FRD-01 — Capa de lectura de datos

Pandacorp lee de disco la información de la fábrica y de cada proyecto, sin escribir (salvo la excepción de descartar, FRD-02) y sin llamar a Claude.

## Criterios de aceptación (EARS)
- CUANDO Pandacorp carga y NO encuentra `fabrica/perfil.md` (la fábrica aún no está personalizada), EL sistema DEBERÁ mostrar —ANTES que cualquier otra vista— un **gate de onboarding** que explique que falta configurar la fábrica y presente el comando `/pandacorp:onboarding` con botón de copiar; el resto de la app queda en segundo plano hasta que el perfil exista.
- CUANDO existe `fabrica/perfil.md`, EL sistema DEBERÁ leerlo (nombre, objetivos, intereses, activos, tipos de proyecto) para personalizar saludos y vistas.
- CUANDO Pandacorp carga, EL sistema DEBERÁ leer todas las fichas de `fabrica/ideas/*.md` (ignorando `_plantilla-ficha.md` y `bitacora.md`) con su frontmatter (título, estado, `tipo_proyecto`, `retorno`, score).
- EL sistema DEBERÁ leer `panda-corp/fabrica/portfolio.md` para obtener la lista de proyectos y sus rutas.
- CUANDO un proyecto tiene `docs/estado.yaml`, EL sistema DEBERÁ leer fase, version, running, progreso, conteo de work orders y `decisiones_pendientes`.
- EL sistema DEBERÁ leer, por proyecto, los documentos de `docs/` (PRD, FRDs, blueprint, work orders, `progreso.md`, `decisiones.md`).
- SI la ruta de un proyecto no existe, ENTONCES EL sistema DEBERÁ marcarla como no encontrada y NO romper el resto de la vista.
- EL sistema NUNCA DEBERÁ llamar a Claude ni a ninguna API de IA, ni escribir archivos (excepto el caso de FRD-02).

## Casos límite
- `fabrica/perfil.md` ausente → gate de onboarding (no se asume un perfil vacío ni se inventa).
- Carpeta de ideas vacía → estados vacíos con gracia.
- `estado.yaml` ausente o malformado → mostrar el proyecto con datos parciales, sin romper.
