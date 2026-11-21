ESTADO: hecho
RESUMEN: Informe con ramas, modos del gate, DR-158/159, backlog y configuraciones de los tres proyectos. CI ya está en main; `--affected` también existe en el gate actual aunque su rama conserva commits propios.
ARCHIVOS:
[branches.md](branches.md)
collect.py
finish.py
validate.py
VERIFICACIÓN:
python3 collect.py → evidencia y conteos recopilados.
python3 finish.py → síntesis y referencias incorporadas.
python3 validate.py → primer intento falló; corregido, segundo intento: 6 controles PASS y 3640 citas comprobadas.
PENDIENTES / RIESGOS: No se ejecutaron suites ni builds, conforme a common.md. Los tests e2e son estimados; los archivos Vitest son candidatos, no discovery del runner.