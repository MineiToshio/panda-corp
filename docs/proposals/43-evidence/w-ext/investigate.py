import os,pathlib,subprocess,json,datetime,re,statistics
OUT=pathlib.Path.cwd(); now=datetime.datetime.now(datetime.timezone.utc).isoformat()
def cmd(*a):
 r=subprocess.run(a,text=True,capture_output=True);return r.stdout or r.stderr
def esc(x):return str(x).replace('|','\\|').replace('\n',' ')
def table(headers,rows):return '\n'+' | '.join(headers)+'\n'+' | '.join(['---']*len(headers))+'\n'+'\n'.join(' | '.join(map(esc,r)) for r in rows)+'\n'
def stamp(p):return datetime.datetime.fromtimestamp(p.stat().st_mtime,datetime.timezone.utc).isoformat()
report=['# Línea de tiempo de merges','Captura medida: '+now+'. Investigación de solo lectura; no se ejecutaron gates ni se modificaron proyectos. Fechas de archivos en UTC; git conserva offset. `at` de gate-report es inicio, no final. Cada tabla de datos es **medida** salvo inferencias explícitas.','Fuente de localización: `/Users/Shared/Proyectos/panda-corp/factory/portfolio.md:9,12`. Rutas relativas resueltas desde la fábrica.']
data={}
for name in ['funko-tracker','personal-page-v2']:
 p=pathlib.Path('/Users/Shared/Proyectos')/name
 wt=[l[9:] for l in cmd('git','-C',str(p),'worktree','list','--porcelain').splitlines() if l.startswith('worktree ')]
 section=['## '+name]
 status=p/'.pandacorp/status.yaml'
 section += ['### Estado y topología', '\n'.join(f'- **medida** `{status}:{i}`: `{l}`' for i,l in enumerate(status.read_text().splitlines(),1) if re.match(r'^(phase|deploy_target|overlay_version|running):',l))]
 section += ['Lanzado externo según phase release y regla de merge-queue.sh:255–267 (ausencia de deploy_target internal se trata como producción externa). No se verificó despliegue por red.']
 section += [table(['Checkout / worktree','Fuente'],[(w,f'git -C {p} worktree list --porcelain @ {now}') for w in wt])]
 files=set(); inventory=[]
 for w in wt:
  r=pathlib.Path(w)/'.pandacorp/run'
  if not r.exists():inventory.append((str(r),'no existe','—',f'os.path.exists @ {now}'));continue
  for root,ds,fs in os.walk(r):
   ds[:]=[d for d in ds if d not in ['wt','integration','node_modules','logos-tools','.git','site-packages','__pycache__']]
   for f in fs:
    q=pathlib.Path(root)/f
    if q.is_file(): files.add(q)
  for q in sorted(r.iterdir()):
   inventory.append((str(q),str(q.stat().st_size)+(' (directorio)' if q.is_dir() else ''),stamp(q),f'stat @ {now}'))
 section += ['### 1. Inventario de fuentes','Tamaño de directorios es metadato del directorio, no suma recursiva. Se inventaría el primer nivel de cada run y los artefactos relevantes recursivos. Se omiten dependencias y assets binarios; worktrees anidados se recorren por separado.']
 relevant=[q for q in sorted(files) if re.search(r'gate-report|green-stamp|merge.*\.(log|txt)$|(^|/)(build|verify)\.lock$|lease',str(q)) and q.suffix not in ['.py','.pyc','.png','.svg']]
 inventory += [(str(q),q.stat().st_size,stamp(q),f'stat @ {now}') for q in relevant if q.parent.name!='run']
 section += [table(['Ruta','Bytes','mtime UTC','Fuente'],inventory)]
 reports=[]; logs=[]; matches=[]
 for q in sorted(files):
  if 'gate-report' in q.name and q.suffix=='.json':
   try:
    d=json.loads(q.read_text())
    if 'subgates' in d:reports.append((q,d))
   except Exception:pass
  if q.suffix in ['.log','.txt','.jsonl','.md']:
   try:
    with q.open(errors='replace') as f:
     for i,line in enumerate(f,1):
      if not any(s in line for s in ['merge-queue:','[certified-tree]','[full-gate]']):continue
      # Parse transcript command output rather than quoted source/prompt contents.
      try:
       obj=json.loads(line); item=obj.get('item',{}); text=item.get('aggregated_output','')
       if not text:continue
       for ln in text.splitlines():
        if ln.startswith('merge-queue:'): matches.append((str(q),i,ln[:600],item.get('exit_code','?'),item.get('command','')[:300]))
      except ValueError:
       if line.lstrip().startswith('merge-queue:'):matches.append((str(q),i,line.strip()[:600],'?',''))
   except OSError:pass
 section += ['### 2. Tiempo por etapa de verify.sh','`scope: partial` no distingue --light, --only, --files o --affected: modo exacto desconocido salvo log explícito. `since` es incremental. No se convierte partial en full.']
 rows=[]; agg={}; totals=[]
 for q,d in reports:
  total=sum(g.get('duration_ms',0) for g in d['subgates']);fail=','.join(g['name'] for g in d['subgates'] if g.get('exit',0)!=0) or 'ninguna'
  src=f'{q} @ {d.get("at","sin at")}'
  for g in d['subgates']:
   rows.append((d.get('at'),d.get('scope'), 'verde' if d.get('green') else 'rojo',fail,g['name'],g.get('duration_ms'),src));agg.setdefault(g['name'],[]).append((g.get('duration_ms',0),src))
  totals.append((str(q),d.get('at'),total,d.get('duration_ms','no existe'), 'sin total wall-clock; suma de etapas, excluye preflight/esperas/overhead'))
 section += [table(['Fecha','Modo reportado','Veredicto','Etapa fallida','Etapa','ms','Fuente'],rows)]
 section += [table(['Etapa','n','mín ms','mediana ms','máx ms','Fuente'],[(k,len(v),min(x[0] for x in v),statistics.median(x[0] for x in v),max(x[0] for x in v),' ; '.join(x[1] for x in v)) for k,v in agg.items()])]
 section += ['#### Comprobación de sumas',table(['Reporte fuente','at','Suma ms','Total reportado ms','Diferencia'],totals)]
 section += ['### 3. Corridas de la cola','El script no crea un log persistente de ejecución: emite stdout/stderr; solo se recuperan capturas conservadas por callers. Regla fuente: `.pandacorp/merge-queue.sh:29–145,218–277`; `[certified-tree]`:228, `[full-gate]`:230, rojo gate:249, exit 21:267, main ocupado:275. Lock común en git-common-dir/pandacorp-merge.lock; semáforo en ~/.pandacorp/host/h-slots.']
 section += [table(['Fuente ruta:línea','Rastro real de salida','exit caller','Comando caller'],matches)]
 section += [f'Conteo **medido de marcas observadas**, no ejecuciones únicas: certified-tree={sum("[certified-tree]" in x[2] for x in matches)}, full-gate={sum("[full-gate]" in x[2] for x in matches)}. Fuente: filas anteriores. No se deduplican capturas sin identidad de corrida. Inicio/fin/duración/rama no registrados en estas líneas: desconocidos; no usar mtime como inicio. Si no hay filas, no existe log de cola identificable en los run enumerados y sus capturas de texto. El reflog prueba aterrizajes, pero no que los hiciera merge-queue.']
 # preserve complete git evidence, cited by line
 log=cmd('git','-C',str(p),'log','--all','--since=3 weeks ago','--date=iso','--format=%H|%ad|%cd|%s')
 reflog=cmd('git','-C',str(p),'reflog','show','main','--date=iso','--format=%H|%gD|%gs')
 (OUT/(name+'-git-log.txt')).write_text(log);(OUT/(name+'-main-reflog.txt')).write_text(reflog)
 section += ['### 4. Historial git','Fuentes completas locales: `'+name+'-git-log.txt` (git log --all --since=\'3 weeks ago\' --date=iso; fecha autor y committer) y `'+name+'-main-reflog.txt` (git reflog show main --date=iso). Ventana relativa a captura, no a fecha nominal del entorno. Mensajes son indicios, no prueba de rojo o trabajo declarado terminado.']
 selected=[(i,l) for i,l in enumerate(log.splitlines(),1) if re.search(r'fix|gate|flaky|baseline|snapshot|complete|verified|done',l,re.I)]
 section += [table(['Fuente','Hash | fecha autor | fecha committer | mensaje'],[(f'{name}-git-log.txt:{i}',l) for i,l in selected])]
 landing=[]
 for i,l in enumerate(reflog.splitlines(),1):
  parts=l.split('|',2)
  if len(parts)!=3 or not parts[2].startswith('merge '):continue
  h,when,msg=parts
  m=re.search(r'\{(.+)\}',when)
  if not m:continue
  at=datetime.datetime.fromisoformat(m[1]);ct=cmd('git','-C',str(p),'show','-s','--format=%cI',h).strip()
  try:delta=(at-datetime.datetime.fromisoformat(ct)).total_seconds()
  except:continue
  landing.append((h,ct,m[1],delta,msg,f'{name}-main-reflog.txt:{i}; git show -s --format=%cI {h}'))
 section += [table(['Hash final','Committer','Llegada main','Δ segundos','Rama / resultado','Fuente'],landing),'Δ es **medida** entre timestamp committer del tip y movimiento de main; **estimada** como espera después del último trabajo: rebase puede renovar committer y el tip puede ser documentación/arreglo. No equivale a duración de cola ni a tiempo desde “listo”.']
 section += ['### 5. Estado vivo ahora']
 live=[]
 for q in relevant:
  if re.search(r'lease|\.lock$|green-stamp',q.name) and q.stat().st_size<12000:
   try:live.append((str(q),stamp(q),q.read_text(errors='replace')[:1800],f'{q}:1 / stat @ {now}'))
   except:pass
 common=pathlib.Path(cmd('git','-C',str(p),'rev-parse','--git-common-dir').strip());common=common if common.is_absolute() else p/common
 lock=common/'pandacorp-merge.lock'
 live.append((str(lock),stamp(lock) if lock.exists() else 'no existe',cmd('cat',str(lock/'owner')) if lock.exists() else 'ausente',f'os.path.exists @ {now}'))
 section += [table(['Archivo','mtime','Contenido (extracto)','Fuente'],live),'Archivo existente no demuestra proceso vivo. verify.lock puede ser archivo de flock persistente; running:false tampoco demuestra ausencia de procesos.']
 section += ['### 6. Huecos','No hay ledger durable de todas las invocaciones, tiempos de espera por merge lock/host slot, petición y aprobación de exit 21, ni inicio/fin uniforme. gate-report.json se sobrescribe; históricos son copias puntuales, no población completa. Scope partial pierde argv exacto. No se puede contabilizar con rigor vueltas rojo→arreglo→rojo solo con mensajes fix; falta enlace entre declaración “terminado”, SHA y corrida. Reportes sin total wall-clock impiden validar suma contra duración completa: las sumas se recalculan, no se presentan como total reportado.']
 report+=section
 data[name]={'reports':[{'path':str(q),'data':d} for q,d in reports],'matches':matches,'totals':totals,'worktrees':wt}
try: ps=cmd('ps','aux')
except PermissionError as e: ps='ps aux BLOQUEADO por sandbox: '+str(e)
lines=[l for l in ps.splitlines() if re.search(r'verify.sh|merge-queue|playwright|vitest|pandacorp-build',l,re.I)]
(OUT/'process-snapshot.txt').write_text('\n'.join(lines) if lines else 'Sin coincidencias o ps no accesible: '+ps[:1000])
report+=['## Snapshot común de procesos',f'**medida** `ps aux` filtrado con regex verify.sh|merge-queue|playwright|vitest|pandacorp-build @ {now}; fuente `process-snapshot.txt:1` en adelante. Incluye procesos de esta investigación si contienen esos nombres; no se mató ninguno.',table(['Fuente','Proceso'],[(f'process-snapshot.txt:{i}',l[:1800]) for i,l in enumerate(lines,1)])]
(OUT/'evidence.json').write_text(json.dumps(data,indent=2));(OUT/'timeline-ext.md').write_text('\n\n'.join(report)+'\n')
print({k:{'reports':len(v['reports']),'queue_lines':len(v['matches']),'worktrees':len(v['worktrees'])} for k,v in data.items()})
