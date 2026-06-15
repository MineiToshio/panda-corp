# FRD-07 — Configuración

Vista de solo-lectura de lo que hay configurado en la fábrica, con identidad y progresión de los agentes.

## Criterios de aceptación (EARS)
- LA Configuración DEBERÁ ofrecer secciones: **Skills · Agentes · Reglas de decisión · Estándares**.
- CADA sección DEBERÁ listar sus elementos con nombre y una **descripción** real de qué hace cada uno.
- CUANDO el dueño hace clic en un elemento, DEBERÁ mostrar su **detalle** (lectura del contenido / explicación).
- EL detalle de un **skill** DEBERÁ mostrar para qué sirve, dónde corre (fábrica/proyecto), qué produce, y un **mini-flujo a alto nivel** (chips con los agentes que usa, coloreados por agente, con flechas) — el "gráfico de cómo funciona el skill".
- LA sección **Reglas de decisión** DEBERÁ explicar qué ES una regla de decisión, mostrar TODAS las DR con un indicador **auto-aprueba (●) / te pregunta (●)**, su detalle (default pre-aprobado), y un botón **"Nueva regla de decisión"** que copia `/pandacorp:teach`.
- LA sección **Estándares** DEBERÁ estar **categorizada por dominio** (Programación, Arquitectura, Diseño, Tecnología, Calidad, Seguridad, Operación, Datos/Privacidad, Producto/Docs), con badges de **severidad** (MUST/SHOULD/MAY) y **enforcement** (lint/CI/checklist/gate humano); cada estándar con dos vistas **Resumen** (puntos clave reales) y **Detalle** (markdown), y un botón **"Nuevo estándar"** que copia `/pandacorp:teach`.
- LA sección **Agentes** DEBERÁ mostrar, por agente: un **avatar pixel-art** (estilo Final Fantasy), su **nivel** y su **título** (Aprendiz → Ingeniero → Senior → Arquitecto).
- CUANDO se abre el detalle de un agente, DEBERÁ mostrar una **barra de XP al siguiente nivel** y la explicación de que **sube de nivel completando work orders** (cada work order cerrado suma XP).
- EL contenido se lee del plugin de la fábrica (`plugin/skills`, `plugin/agents`, `fabrica/decisiones/registro.yaml`, `fabrica/estandares/`); es de **solo-lectura** — para editar se hace en los archivos / Claude Code.

## Nota
El nivel/XP de los agentes es una representación honesta de trabajo real (work orders completados), parte de la capa de gamificación ([FRD-09](frd-09-gamificacion.md)).
