---
title: "Integrar trabajo verificado"
group: guides
order: 14
---

# Integrar trabajo verificado

El CLI reúne el trabajo del run en `lane/<run_id>/integration`. Cada trabajador escribe en
su checkout; los documentos, estados duraderos y commits del run se reúnen en integración.
`.pandacorp/merge-queue.sh` ejecuta el gate G3 y es el único camino a main.

Un gate rojo atribuye el fallo y abre un parche sobre ese alcance. El trabajo sano se conserva;
no se reconstruye todo el FRD por un fallo localizado. Solo build y patch gastan el presupuesto
de tres ejecuciones por unidad. Una verificación individual no sustituye el gate combinado.

En proyectos lanzados, integrar en producción requiere la orden del propietario. El motor
espera en `waiting_gate` y no se concede permiso por agrupar trabajo. Mientras tanto puede
continuar trabajo independiente. Una rama verificada no equivale a un snapshot entregado.

## Ramas y limpieza

Las ramas de unidades usan `lane/<run_id>/<unit>` y sufijos `-a2` o `-a3` para intentos
posteriores; las suposiciones usan `lane/<run_id>/assume-<doubt>`. Las referencias pueden
seguir existiendo después de retirar sus worktrees: una carpeta ausente no demuestra un merge.

El cierre solicita la limpieza de worktrees elegibles y conserva ramas. Comprueba el inventario
real antes de afirmar que se retiraron. Los árboles sucios, bloqueados, vivos o usados por un
proceso se protegen; una espera de producción conserva la integración necesaria. Para revisar
restos, copia `/pandacorp:worktrees` en una sesión. Mission Control no elimina carpetas.
