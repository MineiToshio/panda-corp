# FRD-07 — Configuración

Vista de solo-lectura de lo que hay configurado en la fábrica, con identidad y progresión de los agentes.

## Criterios de aceptación (EARS)
- LA Configuración DEBERÁ ofrecer secciones: **Skills · Agentes · Reglas de decisión · Estándares**.
- CADA sección DEBERÁ listar sus elementos con nombre y una **descripción** de qué hace cada uno.
- CUANDO Sergio hace clic en un elemento, DEBERÁ mostrar su **detalle** (lectura del contenido / explicación).
- LA sección **Agentes** DEBERÁ mostrar, por agente: un **avatar pixel-art** (estilo Final Fantasy), su **nivel** y su **título** (Aprendiz → Ingeniero → Senior → Arquitecto).
- CUANDO se abre el detalle de un agente, DEBERÁ mostrar una **barra de XP al siguiente nivel** y la explicación de que **sube de nivel completando work orders** (cada work order cerrado suma XP).
- EL contenido se lee del plugin de la fábrica (`plugin/skills`, `plugin/agents`, `fabrica/decisiones/registro.yaml`, `fabrica/estandares/`); es de **solo-lectura** — para editar se hace en los archivos / Claude Code.

## Nota
El nivel/XP de los agentes es una representación honesta de trabajo real (work orders completados), parte de la capa de gamificación ([FRD-09](frd-09-gamificacion.md)).
