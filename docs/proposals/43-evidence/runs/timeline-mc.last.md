ESTADO: hecho
RESUMEN: Informe generado con inventario, tiempos, historial y una corrida de cola acreditada. Esa corrida consumió aproximadamente 23 minutos solo en Vitest y Playwright. No hay evidencia suficiente para contar los ciclos rojos ni los usos históricos del árbol certificado.
ARCHIVOS:
timeline-mc.md
build_timeline.py
validate_timeline.py
worktrees-evidence.txt
git-log-mc.txt
main-reflog.txt
report-sums.json
gate-report-snapshot-1.json
gate-report-snapshot-2.json
VERIFICACIÓN:
python3 build_timeline.py → 587 archivos inventariados, 20 filas de etapas, 9 tiempos de logs.
python3 validate_timeline.py → PASS: 807 filas citadas, sumas de ambos reportes y 3 intervalos hasta main comprobados.
ps aux | rg -i 'verify.sh|merge-queue|playwright|vitest|pandacorp-build' → bloqueado por el entorno.
PENDIENTES / RIESGOS: No se pudo corroborar procesos vivos. Los reportes carecen de duración total; se explican las diferencias y los huecos de medición. Ningún proyecto fue modificado.