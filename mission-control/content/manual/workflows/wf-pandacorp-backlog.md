---
title: "pandacorp-backlog"
group: workflows
order: 2
---

# pandacorp-backlog — el motor de drenado del backlog

Drena el backlog de la fábrica de forma determinista: un subagente por ítem en paralelo, cada uno en su propio worktree, mergeados a main de uno en uno con un validador entre cada merge.

> El cuerpo se compone en React (`WorkflowBacklog`); este markdown respalda el índice del Manual.
