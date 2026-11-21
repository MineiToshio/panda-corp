# Red-team mecánico de una propuesta (solo lectura)

Eres un revisor adversarial independiente. NO eres el autor. No edites nada en la fábrica ni en los proyectos, no hagas
commit ni push, y NO ejecutes `verify.sh`, `merge-queue.sh` (salvo `--help`), tests, builds ni servidores. Solo puedes
escribir en tu directorio de trabajo actual: deja ahí `redteam-mech.md`.

## Qué revisar
Una propuesta para la fábrica Pandacorp (`/Users/Shared/Proyectos/panda-corp`) que quiere que el merge a main tarde
≤ 2 minutos certificando una sola vez al declarar "listo". Está en
`/private/tmp/claude-501/-Users-sergio--claude-spares-spare-TJqzMF/d175f413-182a-404b-bc80-1f5840e42eb6/scratchpad/out/memo-draft.md`
(léela entera). Evidencia de apoyo en la misma carpeta: `rules.md`, `measure.md`, `episodes-audit.md`.

Tu foco es la MECÁNICA: ¿lo que el memo dice que harán los scripts es posible y seguro con el código real?
Código real (léelo lo necesario):
- `/Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/merge-queue.sh`, `verify.sh`, `green-stamp.sh`,
  `worktree-bootstrap.sh`, `change-reconcile.mjs`
- `/Users/Shared/Proyectos/panda-corp/plugin/runtime/build/` (motor de build; aterrizaje y gates por unidad / por FRD)
- `/Users/Shared/Proyectos/panda-corp/plugin/scripts/verify-before-stop.sh` (hook Stop)
- `/Users/Shared/Proyectos/panda-corp/mission-control/playwright.config.ts`, `e2e/` (qué escribe durante la corrida)
- funko-tracker y personal-page-v2 (rutas en `/Users/Shared/Proyectos/panda-corp/factory/portfolio.md`): sus
  `playwright.config.ts`, scripts de base de datos de test (`db:test:*`), y `.pandacorp/`.

## Comprobaciones obligatorias (añade las tuyas)
Para cada pieza mecánica del memo (modo de certificación de la cola, identidad del sello, entorno de variables
declaradas, copia temporal de fixtures e2e, candado por proyecto, recertificación en segundo plano, comprobación previa
de entorno, repetición diagnóstica, cuarentena, log persistente, cambios en el motor de build y en el hook Stop):
1. ¿Encaja con el código actual? Cita archivo:línea de lo que habría que cambiar y de lo que lo impide o complica.
   Señala cualquier afirmación del memo sobre el comportamiento actual que el código contradiga.
2. Construye un escenario concreto que la rompa (paso a paso → resultado), en especial:
   - dos sesiones certificando y aterrizando a la vez (candados, sello por worktree, base de datos de test compartida,
     puertos, tope de gates pesados en la máquina);
   - main avanza entre certificar y aterrizar (rebase limpio sin archivos comunes, conflicto, solapamiento real);
     ¿hay algún camino en el que un árbol NO certificado completo llegue a main?;
   - sello reutilizado indebidamente: copiado entre worktrees, tras cambiar dependencias instaladas, PATH o navegadores,
     tras editar un archivo ignorado por git que los tests leen, tras cambiar `verify.sh`;
   - Mission Control dentro del repo de la fábrica: tests que leen fuera de `mission-control/` (búscalos:
     `rg -n "\.\./(plugin|docs|factory)" mission-control/src mission-control/e2e` y variantes con `process.cwd()`,
     `PANDACORP_FACTORY_ROOT`); ¿la identidad propuesta falla cerrado si aparece una lectura nueva?;
   - proyecto lanzado: orden del dueño (código de salida 21) antes/después del gate y caducidad del sello;
   - test inestable durante la certificación; ¿la repetición diagnóstica puede dar verde a un defecto real?
3. Cifras: verifica contra los archivos de evidencia al menos 8 cifras del memo (¿medida de verdad?, ¿n?, ¿fuente
   correcta?). Recalcula el presupuesto de ≤ 2 min del merge por proyecto: ¿qué pasos reales de `merge-queue.sh`
   quedan en el camino (candado, fetch, rebase, bootstrap, comprobación de sello, comprobación de puerto, reconcile,
   push, limpieza) y cuánto pueden tardar en el peor caso razonable? ¿Hay esperas sin tope que rompan el presupuesto?

## Formato
`redteam-mech.md`: lista de hallazgos, cada uno con id, severidad (BLOQUEANTE / IMPORTANTE / MENOR), escenario,
evidencia archivo:línea, corrección mínima. Al final: afirmaciones del memo verificadas como correctas (lista corta)
y un veredicto de 5 líneas. No reescribas el memo.
Tu mensaje final: ≤ 40 líneas con bloqueantes e importantes (una línea cada uno) y el veredicto.
