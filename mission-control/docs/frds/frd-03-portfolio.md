# FRD-03 — Portfolio y navegación de proyectos

Vista de los proyectos activos con navegación vertical e indicador de actividad.

## Criterios de aceptación (EARS)
- EL portfolio DEBERÁ listar, en un panel vertical a la izquierda, los proyectos en `arquitectura`, `en-construccion` y `lanzada`.
- CADA proyecto en la lista DEBERÁ mostrar su título, su etapa y un indicador: "construyendo" si `running`, "parado" si no.
- CUANDO el dueño selecciona un proyecto en la lista, EL sistema DEBERÁ mostrar su workspace (FRD-04) en el panel de la derecha.
- CUANDO no hay ningún proyecto seleccionado, EL sistema DEBERÁ seleccionar el primero por defecto.
- SI no hay proyectos activos, ENTONCES EL sistema DEBERÁ mostrar un estado vacío con gracia.
