import pathlib,json,re,datetime,statistics,subprocess
from investigate import table,stamp
p=pathlib.Path('timeline-ext.md');s=p.read_text();d=json.load(open('evidence.json'))
for name,project in d.items():
 files=set()
 for w in project['worktrees']:
  root=pathlib.Path(w)/'.pandacorp/run'
  import os
  for a,ds,fs in os.walk(root):
   ds[:]=[x for x in ds if x not in ['wt','integration','node_modules','logos-tools','.git','site-packages','__pycache__']]
   for f in fs:
    q=pathlib.Path(a)/f
    if q.suffix in ['.jsonl','.log','.txt']: files.add(q)
 rows=[];jr=[];logrows=[]
 for q in sorted(files):
  if q.name in ['journal.jsonl','build-journal.jsonl']:
   events=[]
   for i,line in enumerate(q.read_text(errors='replace').splitlines(),1):
    try:o=json.loads(line)
    except:continue
    if o.get('data',{}).get('kind')=='land' or o.get('type')=='patch' and o.get('data',{}).get('reason')=='g3_red':events.append((i,o))
   for i,o in events:
    if o.get('type')!='job_started':continue
    jid=o['data']['id'];finish=next(((j,e) for j,e in events if e.get('type')=='job_finished' and e['data']['id']==jid),None)
    a=o['data'].get('started_at',o['at']);b=finish[1]['at'] if finish else None
    dur=(datetime.datetime.fromisoformat(b.replace('Z','+00:00'))-datetime.datetime.fromisoformat(a.replace('Z','+00:00'))).total_seconds() if b else None
    log=q.parent/'jobs'/jid/'out.log'
    text=log.read_text(errors='replace') if log.exists() else ''
    branch=re.search(r'fix on (\S+) and re-run',text)
    fail='vitest' if 'Test Files ' in text and 'failed' in text else 'desconocida'
    rows.append((jid,a,b or 'desconocido',dur,branch[1] if branch else o['data'].get('cwd'),finish[1]['data'].get('exit') if finish else '?',fail,'full-gate' if '[full-gate]' in text else 'certified-tree' if '[certified-tree]' in text else 'sin marca',f'{q}:{i}'+(f',{finish[0]}' if finish else '')+f'; {log}:2'))
   jr += [(f'{q}:{i}',o['at'],o.get('type'),str(o.get('data'))) for i,o in events if o.get('type')=='patch']
  if q.suffix in ['.log','.txt'] and q.stat().st_size<3000000 and q.name not in ['codex.log']:
   ls=q.read_text(errors='replace').splitlines()
   if not any('verify' in str(q).lower() or '[full-gate]' in l for l in ls):continue
   for i,l in enumerate(ls,1):
    if re.search(r'Duration\s+\d|FAIL\s|Test Files |All checks|all gates|gate.*(GREEN|RED)|--only|--light',l):logrows.append((str(q),stamp(q)+' (mtime; fecha corrida no garantizada)',i,l[:400]))
 extra='### Evidencia ampliada de cola y logs\n'+table(['ID','Inicio UTC','Fin UTC','Duración s (medida)','Rama/cwd','Exit','Etapa roja','Marca','Fuente'],rows)
 extra+=f'Corridas identificadas por job id: **medida** {len(rows)}; árbol certificado aprovechado {sum(r[7]=="certified-tree" for r in rows)}; full-gate {sum(r[7]=="full-gate" for r in rows)} (fuentes en tabla). No se observó exit 21, conflicto de rebase o main ocupado en estas corridas; no significa que nunca ocurrieran.\n'
 extra+=table(['Fuente','Hora','Evento','Detalle'],jr)
 extra+='Los duplicados de mensajes en briefs/prompts/cat no son corridas adicionales; exit caller de cat no es exit de merge-queue. Las marcas contadas antes son apariciones, el conteo por ID aquí es el de ejecuciones recuperadas.\n'
 extra+='#### Logs con tiempos y fallos adicionales\nLos Duration de Vitest son tiempos internos de esa herramienta, no cronometraje de toda verify.sh. No se suman a reportes sin identidad común ni se inventan tiempos de etapas que el log no mide. Modo exacto desconocido si no aparece argv; sufijo light/tests de nombre es solo indicio.\n'
 extra+=table(['Log fuente','Fecha disponible','Línea','Métrica / resultado'],logrows)
 if name=='funko-tracker':
  extra+='Secuencia **medida** rojo→patch→rojo: journal seq 17/20/33 (fuentes arriba). Primer rojo catalogScale.test.ts, segundo reviewReceipts.test.ts (out.log:377 y :260 respectivamente). Esto sí prueba una vuelta de reparación que vuelve a rojo; no permite afirmar una declaración humana de “terminado”.\n'
 marker='### 4. Historial git'
 start=s.index('## '+name);at=s.index(marker,start);s=s[:at]+extra+'\n'+s[at:]
# correct missing process error snapshot
s=s.replace('Incluye procesos de esta investigación si contienen esos nombres; no se mató ninguno.','`ps aux` fue rechazado con PermissionError [Errno 1] Operation not permitted. No se verificó actividad de procesos. No se mató ninguno.')
p.write_text(s)
print('Ampliación: journal de cola y métricas de logs añadidos')
