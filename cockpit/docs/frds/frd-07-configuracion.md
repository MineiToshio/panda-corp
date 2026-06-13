# FRD-07 — Configuración

Vista de solo-lectura de lo que hay configurado en la fábrica.

## Criterios de aceptación (EARS)
- LA Configuración DEBERÁ ofrecer secciones: **Skills · Agentes · Reglas de decisión · Estándares**.
- CADA sección DEBERÁ listar sus elementos con nombre y una **descripción** de qué hace cada uno (no solo nombres de archivo).
- CUANDO Sergio hace clic en un elemento, EL sistema DEBERÁ mostrar su **detalle** (lectura del contenido / explicación).
- LA sección **Agentes** DEBERÁ mostrar un **avatar** por agente (pixelart estilo Final Fantasy cuando estén las imágenes; placeholder mientras tanto).
- EL contenido se lee del plugin de la fábrica (`plugin/skills`, `plugin/agents`, `fabrica/decisiones/registro.yaml`, `fabrica/estandares/`); es de **solo-lectura** — para editar se hace en los archivos / Claude Code.
