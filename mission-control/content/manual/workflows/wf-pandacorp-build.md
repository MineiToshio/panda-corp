---
title: "pandacorp-build"
group: workflows
order: 1
---

# pandacorp-build — el motor de construcción

Construye un proyecto entero leyendo las FRDs y sus work orders, en oleadas globales que paralelizan las features independientes, con un gate de revisión por feature.

Los gates concurrentes reutilizan `.pandacorp/run/gate-worktree` únicamente si Git registra la ruta exacta y el árbol está limpio. Cualquier residuo sucio, huérfano o ambiguo se conserva como evidencia y activa el gate síncrono; el motor nunca lo borra por fuerza.

En cada safe point, el motor consulta la señal de parada mediante un recibo cercado de `stateCli inspect-stop`. Ese recibo usa `lstat` de Node y se valida antes de procesar la cola o las decisiones: un alias de shell no puede inventar una parada y un recibo ausente o inválido detiene el run de forma segura, sin asumir que todo está bien.

> El cuerpo se compone en React (`WorkflowBuild`); este markdown respalda el índice del Manual.
