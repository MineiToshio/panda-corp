ESTADO: hecho
RESUMEN: 62 episodios en 29 sesiones; 138 intentos. El 43,55 % aterrizó al primero.
Mediana hasta aterrizaje: 28,97 min; mediana por corrida en funko-tracker: 11,51 min. Dos episodios mostraron `[certified-tree]`.
ARCHIVOS:
[episodes.md](/private/tmp/claude-501/-Users-sergio--claude-spares-spare-TJqzMF/d175f413-182a-404b-bc80-1f5840e42eb6/scratchpad/w-tr/episodes.md)
episodes.json
aggregates.json
verification.txt
candidate-files.txt
excluded.json
search-audit.json
scan.json
analysis.json
scan.py
transcript_lib.py
command_lib.py
analyze.py
gates.py
annotations.py
build_report.py
count.py
VERIFICACIÓN:
python3 scan.py → 31 archivos candidatos; 142 llamadas antes de depuración.
python3 build_report.py → 62 episodios, 138 intentos únicos.
python3 -m py_compile transcript_lib.py command_lib.py scan.py analyze.py gates.py annotations.py build_report.py count.py → PASS.
python3 count.py --check → PASS: tabla y agregados coinciden; 393 referencias fuente con timestamps válidos.
PENDIENTES / RIESGOS: 4 episodios sin aterrizaje observado; 13 duraciones son cotas superiores y una carece de fin medible. Causas inferidas y límites documentados. Ningún proyecto modificado ni ejecutado.