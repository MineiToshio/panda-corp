---
title: "URLs persistentes"
group: concepts
order: 30
---

# URLs persistentes

Cada proyecto, pestaña y detalle de lectura tiene una dirección que puedes copiar. Al refrescar o usar Atrás y Adelante vuelves al mismo lugar: por ejemplo, Arquitectura de un proyecto, un Work Order o una referencia del Manual.

Los nombres de las rutas siguen en inglés (`/board`, `/portfolio`, `/manual`); los títulos de la interfaz siguen en español. Los enlaces antiguos con `?project=...&tab=...` continúan funcionando y se normalizan conservando su contexto. Un proyecto desconocido no abre otro proyecto.

## Identidad y cambios de nombre

Cada idea y proyecto registrado tiene una identidad permanente y un nombre de URL reservado. Cambiar el título visible no cambia su dirección. Si se cambia deliberadamente el nombre público de la URL, el anterior queda como alias; nunca se asigna a otro proyecto.

La fábrica registra identidades al capturar/adoptar/crear proyectos y al sincronizar el portafolio. El catálogo privado `factory/navigation-identities.json` es la fuente única. El archivo `.pandacorp/navigation-identity.json` de cada proyecto y `navigation_id` de las ideas son referencias; no son estado de construcción. Los respaldos y el vault incluyen el catálogo. Mission Control solo lo lee.

Antes de reconciliar registros, se ejecuta `bash plugin/scripts/navigation-identities.sh --dry-run` desde la fábrica. Después de revisar el resultado se usa `--apply`. Una ambigüedad necesita resolverse; no se elige un proyecto por el orden de la lista. Al mover un proyecto conserva su archivo de identidad y actualiza su referencia en el portafolio antes de reconciliar.

## Qué se restaura

Las direcciones conservan pestañas, documentos, Work Orders, referencias, filtros y selecciones del modelo de datos. La búsqueda actualiza la dirección sin crear un paso del historial por cada letra. La cámara del diagrama, el hover y formularios sin guardar siguen siendo temporales.

El modelo ampliado puede restaurar su ventana dentro del navegador. Entrar de nuevo en fullscreen nativo requiere un clic por la regla del navegador. Abrir una URL nunca ejecuta comandos ni confirma acciones destructivas.
