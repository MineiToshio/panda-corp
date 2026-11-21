ESTADO: hecho
RESUMEN: Informe independiente: 4 bloqueantes, 13 importantes y 1 menor; 22 cifras contrastadas.
ARCHIVOS:
[redteam-mech.md](/private/tmp/claude-501/-Users-sergio--claude-spares-spare-TJqzMF/d175f413-182a-404b-bc80-1f5840e42eb6/scratchpad/w-rt/redteam-mech.md)
VERIFICACIÓN: python3, validación documental → OK: estructura, 83 citas, aritmética y veredicto de 5 líneas.
PENDIENTES / RIESGOS:

- M01 BLOQUEANTE: el contendiente que agota su espera borra el candado del propietario.
- M02 BLOQUEANTE: verify verde puede no certificar; el fallback permite ff sin sello válido.
- M03 BLOQUEANTE: sparse no detecta lecturas omitidas con fallback y contradice la prohibición de skip-worktree.
- M04 BLOQUEANTE: background puede mover la rama entre comprobar el sello y fusionarla.
- M05 IMPORTANTE: rebootstrap invalida inmediatamente el check exigido para declarar «listo».
- M06 IMPORTANTE: PATH/HOME alteran comportamiento; falta un entorno común para todos los lectores.
- M07 IMPORTANTE: ignorados y dependencias modificadas permiten reutilizar evidencia de otro checkout.
- M08 IMPORTANTE: globalSetup llega después del build; los specs siguen escribiendo rutas originales.
- M09 IMPORTANTE: preflight puede reseedear antes del lock y prepara dependencias antes del rebase.
- M10 IMPORTANTE: faltan tipos, estados y harvest de certify; el fan-out puede no converger.
- M11 IMPORTANTE: esperas acumulables y operaciones sin deadline rompen los 120 segundos.
- M12 IMPORTANTE: namespaces, fail-open y procesos huérfanos debilitan el límite de gates pesados.
- M13 IMPORTANTE: no-bail también cambia Playwright; report-all no ejecuta Vitest tras static rojo.
- M14 IMPORTANTE: cuarentena puede ocultar carreras reales y sobrevivir a su expiración mediante sellos.
- M15 IMPORTANTE: filas por invocación no equivalen a ff; faltan identidad y publicación durable.
- M16 IMPORTANTE: el memo contradice el orden de autorización y ofrece una excepción de producción incompatible.
- M17 IMPORTANTE: sumas de etapas y muestras pequeñas se presentan como cotas de pared.

Veredicto: no adoptar la propuesta tal como está.
Certificar anticipadamente es viable corrigiendo exclusión e identidad.
Mantener la identidad completa de fábrica para Mission Control.
Tratar ≤2 minutos como objetivo condicional.
No ejecuté gates, tests, builds ni servidores; queda pendiente validar dinámicamente una implementación.