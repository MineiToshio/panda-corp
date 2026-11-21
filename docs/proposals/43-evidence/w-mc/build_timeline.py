from pathlib import Path
import subprocess,json,datetime,statistics,re,gzip,hashlib
BASE=Path('/Users/Shared/Proyectos/panda-corp'); MC=BASE/'mission-control'; RUN=MC/'.pandacorp/run'
def git(*args):return subprocess.check_output(['git','-C',str(BASE),*args],text=True)
def utc(t):return datetime.datetime.fromtimestamp(t,datetime.timezone.utc).isoformat()
def table(headers,rows):return '\n'.join(['| '+' | '.join(headers)+' |','| '+' | '.join(['---']*len(headers))+' |']+['| '+' | '.join(str(c).replace('|',' / ').replace('\n',' ') for c in row)+' |' for row in rows])+'\n'
def src(p,n=1):return f'`{p}:{n}`'
now=utc(datetime.datetime.now().timestamp()); out=['# Mission Control: línea de tiempo real de merges\n',f'Corte de investigación: {now}. Solo lectura; no se ejecutaron gates, tests, builds ni colas. Las cifras de artefactos son **medidas**; las inferencias se indican. Fechas Git conservan su zona; metadatos en UTC.\n']
wt=git('worktree','list','--porcelain');Path('worktrees-evidence.txt').write_text(wt)
out+=['## 1. Inventario de fuentes\n','Inventario exhaustivo de archivos de run (incluye material auxiliar para que las ausencias sean auditables). Tamaño en bytes y modificación son **medidos** con Python Path.stat; no son inicio/fin de corrida.\n']
roots=[]; inventory=[]
for line in wt.splitlines():
 if not line.startswith('worktree '):continue
 w=Path(line[9:]);p=w/'mission-control/.pandacorp/run'; roots.append(p)
 out.append(f'- `{p}`: '+('existe.' if p.exists() else 'NO existe; comprobado con Path.exists().')+' Fuente: `worktrees-evidence.txt` (git worktree list --porcelain), corte '+now+'.\n')
 for f in sorted(p.rglob('*')) if p.exists() else []:
  if f.is_file():
   s=f.stat();inventory.append((str(f),s.st_size,utc(s.st_mtime),src(f)+'; stat al '+now))
out.append(table(['Archivo','Bytes (medida)','mtime UTC (medida)','Fuente'],inventory))
out+=['### Dónde se dejan rastros\n',f'La cola no abre un log persistente: emite a stdout/stderr (lectura completa y búsqueda de tee/.log/redirecciones en `{MC}/.pandacorp/merge-queue.sh`). Lock compartido: `.git/pandacorp-merge.lock`, líneas 59–77; host H: `~/.pandacorp/host/h-slots/slot-*/owner.json`, líneas 108–150. `[certified-tree]` y `[full-gate]`: líneas 228/230; gate rojo exit 11: 249–250; exit 21: 258–267; main ocupado exit 12: 274. Estos códigos describen posibilidades, no ocurrencias observadas.\n',f'`{MC}/.pandacorp/verify.sh:127` fija gate-report.json; líneas 128–129 borran el anterior; líneas 427–428 eliminan fragmentos/logs temporales al salir; líneas 546–555 miden cada subgate; líneas 580–617 escriben JSON sin duración total. El sello green-stamp no existe en ninguno de los cuatro run examinados (inventario).\n']
reports=[]; stages=[];sums=[]
for root in roots:
 for f in sorted(root.rglob('*gate-report*.json')) if root.exists() else []:
  try:j=json.loads(f.read_text())
  except:continue
  if 'subgates' not in j:continue
  reports.append((f,j));text=f.read_text().splitlines();bad=','.join(g['name'] for g in j['subgates'] if g.get('exit')) or 'ninguna'
  for g in j['subgates']:
   n=next(i+1 for i,l in enumerate(text) if '"name": "'+g['name']+'"' in l)
   stages.append((j['at'],j['scope'],'verde' if j['green'] else 'rojo',bad,g['name'],g['duration_ms'],src(f,n)))
  sums.append((j['at'],sum(g['duration_ms'] for g in j['subgates']),'no almacenado','no calculable: falta total wall-clock',src(f,2)))
out+=['## 2. Duración por etapa\n','Todas las duraciones siguientes son **medidas**, en ms. `partial` no identifica por sí solo --light frente a --only/--files/--tests; el reporte reciente contiene solo los gates baratos, compatible con --light pero argv no conservado. El histórico es `since`, no full ni light; conserva since=5c594bde. No hay reporte full completo conservado de MC; provenance afirma full rojo de otro SHA, pero carece de etapas y no coincide con el reporte actual.\n',table(['Fecha reporte','Scope','Veredicto','Falló','Etapa','ms','Fuente'],stages)]
agg=[]
for name in sorted({r[4] for r in stages}):
 rows=[r for r in stages if r[4]==name];vs=[r[5] for r in rows];agg.append((name,len(vs),min(vs),statistics.median(vs),max(vs),'; '.join(r[6] for r in rows)))
out+=['Estadísticas **medidas** de los JSON; mezcla scopes y fechas, no es comparación controlada de rendimiento.\n',table(['Etapa','n','mín ms','mediana ms','máx ms','Fuentes'],agg),'### Logs adicionales\n']
logrows=[]
for f in sorted(RUN.rglob('*')):
 if not f.is_file() or f.suffix not in ['.log','.gz'] or 'codex-workers' in f.parts:continue
 try:t=gzip.open(f,'rt',errors='replace').read() if f.suffix=='.gz' else f.read_text(errors='replace')
 except:continue
 for n,l in enumerate(t.splitlines(),1):
  if re.search(r'Duration\s+\d|\d+ passed \([\d.]+[ms]',l):logrows.append((f.name,'Vitest' if 'Duration' in l else 'Playwright (solo suite)',l.strip()[:230],src(f,n)))
out.append(table(['Log','Etapa','Duración/resumen medido','Fuente (gz: línea descomprimida)'],logrows))
out+=['Los tiempos internos transform/setup/tests/environment de Vitest se solapan entre workers: no deben sumarse como tiempo de pared. Los logs sueltos sin argv/fecha no permiten atribuir modo full/light/only ni declarar verde el verify entero. `fix-forward-frd25-verify.log:2168–2172` termina rojo en visual (logros/documentación); `wo25-self-verify.log:919–923` solo acredita Vitest verde.\n','### Comprobación de sumas\n',table(['Fecha','Σ etapas ms (medida)','Total reportado','Diferencia','Fuente'],sums),'No se inventa total: los JSON no incluyen start/end ni total. Las sumas se recalculan en validate_timeline.py. En queue-next, Vitest 80.31 s + Playwright 21.6 min = 1376.31 s (22 min 56.31 s), suma derivada de tiempos medidos pero Playwright redondea a décimas de minuto. No incluye gates baratos, rebase, admisión, limpieza ni ff.\n','## 3. Corridas de merge-queue\n']
f=RUN/'archive/queue-next-16-4-3.log.gz'
out.append(table(['Rama','Inicio','Fin','Duración','Resultado','Ruta gate','Fuente'],[('fin/next-land','desconocido; rebase al inicio; Vitest 07:28:53 sin fecha','2026-11-03 07:51:54 -0500 (ff main)','no medible completa; suites ≈22m56.31s','aterrizó; worktree retenido','full inferido por suites; anterior a DR-146, sin marcador',src(f,1)+'; '+src(f,953)+'; '+src(f,222430)+'; '+src(f,222440)+'; `.git/logs/refs/heads/main` @2026-11-03 07:51:54 -0500')]))
out+=['Conteo **medido** de corridas con captura directa encontrada: 1. Marcadores literales `[certified-tree]`: 0; `[full-gate]`: 0 en capturas directas (no contar código citado en transcripciones). Full inferido: 1. Aprovechamientos reales del sello posteriores a DR-146: desconocidos; cero marcadores conservados NO significa cero usos. No se encontraron capturas directas de exit 21, conflicto rebase, main ocupado o cola roja. Reflog prueba aterrizajes pero no prueba que se invocara merge-queue.\n','## 4. Historial Git, últimas tres semanas\n']
log=git('log',"--since=3 weeks ago",'--date=iso','--format=%H|%ad|%cd|%s','--','mission-control');Path('git-log-mc.txt').write_text(log)
reflog=git('reflog','show','main','--since=3 weeks ago','--date=iso');Path('main-reflog.txt').write_text(reflog)
out+=['Fuentes brutas acotadas conservadas en git-log-mc.txt y main-reflog.txt. Incluye cambios al Manual/fábrica que tocan MC; no todos son producto. Autor y committer se distinguen: rebase puede preservar autor y cambiar committer.\n',table(['Hash','Autor','Committer','Mensaje','Fuente'],[(a[:12],b,c,d,f'`git-log-mc.txt:{i}`; `{BASE}/.git` commit {a}') for i,l in enumerate(log.splitlines(),1) for a,b,c,d in [l.split('|',3)]])]
examples=[('ea3a87a8','06bbeefc','2026-11-12','day-1 v2 → runtime schema/client split/e2e; 2h34m33s entre commits. No prueba dos gates rojos.'),('14e5b10c','3d124d67','2026-11-12','faster quality gate → env fingerprint/SSE; 30m04s. Después baseline 15273e15 (2026-11-13 00:38:29). Señal de reparación, no contador de rojos.'),('fa9b6462','19823cdf','2026-11-14/15','light design → tres fixes; hasta 1h08m22s; aterriza 00:28:33 (main-reflog).'),('c7c6785d','08fee772','2026-10-31/11-01','Next upgrade → revert 1b0c4f91 → live-refresh oracle fix → reapply cf9ec1f5 (autor original, committer Nov 3). No atribuir todo a gate.')]
out.append(table(['Primer commit','Reparación','Fecha','Lectura prudente','Fuente'],[(a,b,c,d,f'`git-log-mc.txt` hash {a}/{b}; `{BASE}/.git` commit {a}/{b}') for a,b,c,d in examples]))
landing=[('56fcd1f9','2026-11-17 16:10:58 -0500','2026-11-17 16:23:58 -0500',780,'chore/mc-next-16.4.6'),('fa9b6462','2026-11-14 23:20:10 -0500','2026-11-15 00:28:33 -0500',4103,'feat/incremental-design-routing'),('cf9ec1f5','2026-10-31 22:54:13 -0500','2026-11-03 07:51:54 -0500',204461,'fin/next-land')]
out.append(table(['Trabajo (primer commit identificable)','Hora autor','Llegada main','Δ segundos (medida derivada)','Rama','Fuente'],[(a,b,c,d,e,f'`git-log-mc.txt` hash {a}; `{BASE}/.git/logs/refs/heads/main` @{c}') for a,b,c,d,e in landing]))
out+=['Estas latencias incluyen esperas e interrupciones; no equivalen a tiempo de cola. En Next, el reloj autor abarca retirada y reaplicación; desde committer de cf9ec1f5 (Nov 3 07:28:24) al ff son 1410 s. No hay declaración fiable «terminado» unida a cada captura; mensajes feat/closeout/verified son indicios, no certificación. No puede medirse cuántos ciclos rojo→arreglo→rojo ocurrieron.\n','## 5. Estado vivo\n',f'Corte: {now}. `ps aux | rg -i \'verify.sh|merge-queue|playwright|vitest|pandacorp-build\'` falló: `operation not permitted: ps`. No se afirma ausencia de procesos.\n']
for p in [RUN/'build.lock',RUN/'verify.lock',RUN/'build.lease',RUN/'lease-epoch',BASE/'.git/pandacorp-merge.lock',Path('/Users/sergio/.pandacorp/host/h-slots/slot-0/owner.json')]:
 out.append(f'- `{p}`: '+(f'existe; mtime {utc(p.stat().st_mtime)}; contenido `{p.read_text()[:450].strip()}`' if p.is_file() else ('directorio presente' if p.exists() else 'NO existe'))+f'. Fuente: Path.stat/read_text al {now}.\n')
out+=['El build.lock vacío no demuestra un proceso vivo. verify.lock conserva pid=57991, no demuestra posesión actual de flock (verify.sh:62–73 conserva inode). lease-epoch=7 es contador, no lease activo. lanes/state.json:32,50,68,86,105,124 registra parked. El host slot observado declara funko-tracker, no MC; su vida no pudo corroborarse con ps. No se tocaron locks ni leases.\n','## 6. Huecos y límites\n','- No hay archivo append-only automático de la cola ni de reportes: stdout se pierde si el llamador no captura; gate-report se sobreescribe y los logs temporales se eliminan. Worktrees eliminados pierden run local.\n- Falta inicio/fin de verify y cola, espera del lock/H-slot, argv y exit persistentes; mtime no sustituye wall-clock. No pueden reconstruirse percentiles fiables ni justificar «30–60 minutos» globalmente.\n- El único histórico JSON localizado es gate-evidence/frd-25; no hay green-stamp conservado. Se revisaron los cuatro run MC y también run raíz de los cuatro checkouts para posibles logs mal ubicados; el gate-report de raíz pertenece a fábrica y se excluye de tiempos MC.\n- Los logs grandes de codex-workers se inspeccionaron como JSONL para salidas efectivas de comandos: no se encontró salida `merge-queue:`; textos de prompts/código no cuentan como ejecuciones. El gzip queue-next sí conserva rebase, suites y aterrizaje.\n- Procesos no verificables por restricción de ps; locks persistentes no son prueba de actividad.\n']
Path('timeline-mc.md').write_text('\n'.join(out));Path('report-sums.json').write_text(json.dumps([{'path':str(f),'at':j['at'],'sum_ms':sum(g['duration_ms'] for g in j['subgates'])} for f,j in reports],indent=2))
print('wrote timeline-mc.md',len(inventory),'inventory files',len(stages),'stage rows',len(logrows),'log duration rows')
