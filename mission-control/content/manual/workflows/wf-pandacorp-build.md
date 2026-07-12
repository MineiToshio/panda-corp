---
title: "pandacorp-build"
group: workflows
order: 1
---

# pandacorp-build — el motor de construcción

Construye un proyecto entero leyendo las FRDs y sus work orders, en oleadas globales que paralelizan las features independientes, con un gate de revisión por feature.

Los gates concurrentes reutilizan `.pandacorp/run/gate-worktree` únicamente si Git registra la ruta exacta y el árbol está limpio. Cualquier residuo sucio, huérfano o ambiguo se conserva como evidencia y activa el gate síncrono; el motor nunca lo borra por fuerza.

> El cuerpo se compone en React (`WorkflowBuild`); este markdown respalda el índice del Manual.
