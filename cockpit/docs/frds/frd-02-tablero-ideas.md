# FRD-02 — Tablero de ideas

Kanban de solo-lectura de la base de ideas, con captura de ideas, detalle navegable y descarte.

## Criterios de aceptación (EARS)
- EL tablero DEBERÁ agrupar las ideas en columnas por `estado`: descubierta → documentada → diseño → arquitectura → en-construcción → lanzada, más una columna `descartada`.
- EL tablero NO DEBERÁ permitir mover tarjetas a mano (drag ni flechas): las transiciones las escriben los skills. Las columnas DEBERÁN tener el mismo ancho, ser **amplias** (no chiquitas) y con **scroll horizontal** cuando no quepan; el texto DEBERÁ ajustarse en varias líneas si no cabe.
- CUANDO el dueño abre "Capturar ideas", EL sistema DEBERÁ mostrar los comandos `/pandacorp:new-idea`, `:discover` y `:recommend`, cada uno con una descripción y un botón de copiar.
- CUANDO el dueño hace clic en una tarjeta, EL sistema DEBERÁ mostrar la ficha: resumen, puntos clave, navegador de los documentos de la idea, y el comando del siguiente paso (con botón de copiar).
- CADA tarjeta DEBERÁ mostrar dos etiquetas además del score: **categoría** (`tipo_proyecto`: web, mobile, desktop, ia, claude-code, prompt-system, automatización, cli, rework…) y **retorno** (`retorno`: monetario, oportunidad, personal o mixto). EL tablero DEBERÁ permitir **filtrar por categoría**.
- MIENTRAS una idea esté en `en-construccion`, EL sistema DEBERÁ mostrar un indicador de que se está construyendo.
- CUANDO el dueño pulsa "Descartar idea", EL sistema DEBERÁ reescribir `estado: descartada` en el frontmatter del `.md`, preservando el resto del archivo (única escritura de Pandacorp).

## Casos límite
- Idea sin documentos → mostrar solo el resumen.
- Categoría (web/mobile/desktop/IA/…), retorno (monetario/oportunidad/personal/mixto) y score se muestran con una leyenda que los explica.
