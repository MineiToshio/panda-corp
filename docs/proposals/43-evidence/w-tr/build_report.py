import json,re,statistics,pathlib,datetime,collections,shlex
from annotations import MAP,LABELS
from command_lib import commands
from gates import gates
from analyze import sec
# analyze refreshes analysis.json deterministically from the frozen scan.json.
sessions=json.load(open('analysis.json'));raw=json.load(open('scan.json'));lookup={e['file']:e for e in raw}
def cite(file,e):
 f=e.get('sourcefile') or file
 return f'[{pathlib.Path(f).name}:L{e["line"]}]({f}:{e["line"]}) · `{e["ts"]}`'
def duration(s):
 if s is None:return 'n/d'
 return f'{s/60:.2f} min'
def one(s,n=220):return re.sub(r'\s+',' ',s).strip()[:n].replace('|','\\|')
def terminal_summary(rs):
 text='\n'.join(r['text'] for r in rs)
 if 'BLOCKED' in text or '<tool_use_error>' in text:return 'bloqueado por herramienta/hook'
 vals=[]
 for pat in [r'Test Files\s+[^\n]+',r'Tests\s+\d+[^\n]+',r'\b\d+ passed(?: \([^\n]+\))?',r'(?:^|\n)\s*(?:EXIT|exit|rc|verify)\s*[=: ]\s*\d+']:
  m=re.search(pat,text)
  if m:vals.append(one(m[0],100))
 if vals:return '; '.join(vals)
 if re.search(r'background|running|in progress',text,re.I):return 'iniciado en background; fin no enlazado a este gate'
 if re.search(r'FAIL|error TS|ELIFECYCLE|failed',text):return 'salida roja (véase cita)'
 return 'sin resultado concluyente visible'
def choose_quote(a):
 priorities=[r'(^|\d+:)\s*FAIL ',r'error TS\d+',r'Error: The ',r'Unused exports',r'Unused exported',r'Formatter would',r'Command .*not found',r'ERR_PNPM_',r'CONFLICT',r'merge-queue: (?:rebase onto|the main|merge lock|.*is rebased|main is production)',r'AssertionError:',r'Error: expect',r'✘',r'merge-queue: integration gate RED']
 out=[]
 for p in priorities:
  for e in a['raw_results']:
   for l in e['text'].splitlines():
    if re.search(p,l) and l not in [x[0] for x in out]:out.append((l,e));break
   if len(out)>=2:break
  if len(out)>=2:break
 if not out:
  for e in a['raw_results']:
   if re.search(r'BLOCKED|interrupted|verify=|mq=',e['text']):out.append((next((l for l in e['text'].splitlines() if re.search(r'BLOCKED|interrupted|verify=|mq=',l)),''),e));break
 return out[:2]
# Correct uncertainty/success using explicit corroborating transcript evidence, never notification rc alone.
for s in sessions:
 for i,a in enumerate(s['attempts'],1):
  key=(s['id'],i)
  if key==('E27',21):a['outcome']='interrumpido; no aterrizaje observado'
  if key==('E27',36):a['outcome']='aterrizó (exit 0 + SHA/main corroborado en salida)'
  if key==('E24',3):a['outcome']='verify previo rojo; if no ejecutó cola';a['rc']=None;a['queue_rc_note']='verify=1, no RC de cola'
  if key in [('E27',27),('E27',39)]:a['outcome']='hook bloqueó antes de ejecutar cola';a['rc']=None
  if a['outcome'].startswith('aterrizó') and a['rc'] not in (None,0):a['queue_rc_note']=f'wrapper/otra línea rc={a["rc"]}; aterrizaje probado por merged';a['rc']=None
  a['attempt_key']=f'{s["id"]}.A{i:02d}'
  info=MAP.get(s['id'],{}).get(i)
  a['cause']=info[0] if info else ('h' if not a['outcome'].startswith('aterrizó') else None)
  a['diagnosis']=info[1] if info else ('causa no establecida' if a['cause'] else '')
  a['quote']=choose_quote(a)
# Partition the same session after each landing: a fresh subsequent work is a fresh episode.
episodes=[]
for s in sessions:
 es=[e for e in lookup[s['file']]['events'] if e['ts']];prev='0000';group=[];groups=[]
 for a in s['attempts']:
  group.append(a)
  if a['outcome'].startswith('aterrizó'):groups.append(group);group=[]
 if group:groups.append(group)
 for group in groups:
  first,last=group[0],group[-1];fromts=first['call']['ts'];until=last['end']['ts'] if last['end'] else None
  landed=last['outcome'].startswith('aterrizó')
  # Include the last explicit pre-queue ready declaration, without inferring it from plans/future tense.
  ready=[]
  for e in es:
   if e['kind']=='assistant' and prev<e['ts']<fromts:
    if re.search(r'(?:todo (?:está )?(?:en )?verde|all (?:tests )?(?:are )?green|list[oa] (?:para (?:fusionar|merge|producción)|y verificad)|gate completo (?:en verde|pas[óo])|full (?:verify|gate).*passed)',e['text'],re.I) and not re.search(r'si .*verde',e['text'][:100],re.I):ready.append(e)
  # Manual same-work disambiguation: most regex hits described already-landed work,
  # future conditional plans, or the baseline before implementation. The selected timestamps
  # refer to the work entering this queue episode.
  allowed_ready={
   ('E05','2026-11-04T03:06:03.058Z'):'2026-11-04T02:49:24.158Z',
   ('E06','2026-11-04T03:06:51.968Z'):'2026-11-04T02:43:45.810Z',
   ('E15','2026-11-06T17:29:08.957Z'):'2026-11-06T13:12:21.211Z',
   ('E14','2026-11-07T08:41:50.113Z'):'2026-11-07T07:42:30.104Z',
   ('E14','2026-11-08T07:20:44.973Z'):'2026-11-08T05:26:54.402Z',
   ('E17','2026-11-07T18:37:57.326Z'):'2026-11-07T18:00:35.598Z',
   ('E18','2026-11-08T07:57:23.624Z'):'2026-11-08T07:55:14.500Z',
   ('E19','2026-11-08T23:16:50.387Z'):'2026-11-08T19:33:42.956Z',
   ('E22','2026-11-11T16:22:30.726Z'):'2026-11-11T15:52:41.581Z',
   ('E22','2026-11-12T15:31:42.337Z'):'2026-11-12T14:11:00.566Z',
   ('E24','2026-11-13T19:57:08.664Z'):'2026-11-13T19:20:31.680Z',
   ('E26','2026-11-18T06:10:17.698Z'):'2026-11-18T05:43:05.098Z',
   ('E27','2026-11-18T21:57:43.079Z'):'2026-11-18T20:23:37.634Z',
   ('E28','2026-11-19T02:23:08.975Z'):'2026-11-19T01:53:02.451Z',
   ('E27','2026-11-19T14:27:08.640Z'):'2026-11-19T13:17:56.661Z'
  }
  wanted=allowed_ready.get((s['id'],fromts))
  ready=next((v for v in es if v['kind']=='assistant' and v['ts']==wanted),None)
  start=ready['ts'] if ready else fromts
  if until is None:
   until=max(e['ts'] for e in es if e['ts']>=fromts);censored=True
  else:censored=not landed
  # Gates actually invoked prior to the first tool call of this episode; inline verify commands are separately noted.
  observed=[]
  for e in es:
   if e['kind']!='call' or not prev<e['ts']<fromts:continue
   for cmd in commands(e):
    for mode,gcmd in gates(cmd):
     rs=[r for r in es if r['kind']=='result' and r.get('id')==e.get('id') and r['ts']<fromts]
     observed.append(dict(mode=mode,command=gcmd,event=e,results=rs,summary=terminal_summary(rs)))
  inline=[(m,g) for m,g in gates(first['command'].split('merge-queue.sh')[0]) if 'verify' in m]
  ep=dict(id=f'EP{len(episodes)+1:03d}',session=s['id'],file=s['file'],project='mission-control / panda-corp' if 'panda-corp' in s['file'] else 'funko-tracker',attempts=group,start=start,queue_start=fromts,end=until,wall_s=sec(start,until),wall_queue_s=sec(fromts,until),censored=censored,landed=landed,ready=ready,gates=observed,inline_gates=inline,certified=any(a['certified'] for a in group),full_gate=any(a['full_gate'] for a in group))
  episodes.append(ep);prev=last['end']['ts'] if last['end'] else last['call']['ts']
episodes.sort(key=lambda e:e['queue_start'])
for i,e in enumerate(episodes,1):e['id']=f'EP{i:03d}'
# Files changed locally or reported by workers between attempts, including git add in the next queue wrapper.
path_pattern=r'(?:\.?\.?/)*(?:src|scripts|docs|e2e|prisma|plugin|factory|mission-control|\.claude|\.pandacorp)/[^\s`\"\'<>;,|(){}]+'
for ep in episodes:
 for a in ep['attempts']:
  ses=next(s for s in sessions if s['id']==ep['session']);ix=ses['attempts'].index(a)
  if ix==0:a['repair_files']=[];continue
  old=ses['attempts'][ix-1];edits=a['edits'];fs=[]
  for e in edits:
   for m in re.finditer(path_pattern,e['text']):fs.append((m[0].rstrip(':.]'),e))
  # Explicit staging in the next invocation is valid repair evidence too.
  for m in re.finditer(r'git add\s+([^;\n]+?)(?=\s*&&|;|\n|$)',a['command']):
   for p in re.findall(path_pattern,m[1]):fs.append((p,a['call']))
  # Worker handoff sections provide reported file changes, distinct from direct edits.
  for e in lookup[ep['file']]['events']:
   if e['kind']=='result' and old['call']['ts']<e['ts']<a['call']['ts'] and 'ARCHIVOS:' in e['text']:
    chunk=e['text'].split('ARCHIVOS:',1)[1].split('VERIFICACI',1)[0]
    for p in re.findall(path_pattern,chunk):fs.append((p,e))
  a['repair_files']=list({p:(p,e) for p,e in fs}.values())
pathlib.Path('episodes.json').write_text(json.dumps(episodes,ensure_ascii=False,indent=2))
# Machine-readable aggregates, independently recomputable by count.py.
def stats(eps):
 ats=[a for e in eps for a in e['attempts']];done=[e for e in eps if e['landed']]
 wall=[e['wall_s'] for e in done];obs=[e['wall_s'] for e in eps]
 reds=[a for a in ats if a['outcome'].startswith(('rojo','timeout')) and a['cause']]
 return dict(episodes=len(eps),sessions=len({e['file'] for e in eps}),attempts=len(ats),landed=len(done),first_attempt_landed=sum(e['landed'] and len(e['attempts'])==1 for e in eps),first_attempt_pct=round(100*sum(e['landed'] and len(e['attempts'])==1 for e in eps)/len(eps),3),wall_landed_median_s=statistics.median(wall),wall_landed_max_s=max(wall),wall_observed_median_s=statistics.median(obs),wall_observed_max_s=max(obs),censored=sum(e['censored'] for e in eps),certified_episodes=sum(e['certified'] for e in eps),certified_calls=sum(a['certified'] for a in ats),full_gate_calls=sum(a['full_gate'] for a in ats),red_causes=dict(sorted(collections.Counter(a['cause'] for a in reds).items())),reds=len(reds),all_nonlanding_causes=dict(sorted(collections.Counter(a['cause'] for a in ats if a['cause']).items())),queue_median_s={p:statistics.median([a['duration_s'] for e in eps if e['project']==p for a in e['attempts'] if a['duration_s'] is not None and a['endkind']!='lectura terminal (cota superior)']) for p in sorted({e['project'] for e in eps})},queue_measured=sum(a['duration_s'] is not None for a in ats),queue_upper_bounds=sum(a['endkind']=='lectura terminal (cota superior)' for a in ats),queue_unknown=sum(a['duration_s'] is None for a in ats))
st=stats(episodes);pathlib.Path('aggregates.json').write_text(json.dumps(st,indent=2,ensure_ascii=False))
lines=[]
def w(s=''):lines.append(s)
w('# Episodios reales de merge a main — transcripciones 1–20 de noviembre de 2026')
w('\n**Solo lectura.** No se ejecutó ningún gate, test, build, merge ni push de los proyectos. Se leen JSONL de Claude Code (incluidos subagentes) y Codex. Horas UTC, conservando milisegundos. Informe y scripts se guardan únicamente en este scratch.')
w('\n## Alcance y unidad de conteo')
w(f'**Medida:** {st["sessions"]} archivos de sesión con {st["attempts"]} llamadas únicas que intentan ejecutar la cola; {st["episodes"]} episodios de trabajo. Una sesión larga puede aterrizar varios trabajos: se cierra un episodio en cada aterrizaje y el intento posterior abre otro. Un subagente que ejecuta la cola tiene episodio propio; no se cuenta la delegación del padre como otra ejecución. Los IDs S son sesiones (S01 corresponde a E01 en analysis.json); A es la invocación dentro de esa sesión. No se amplió a octubre porque noviembre aporta suficientes casos.')
w('\nLa búsqueda literal solicitada también recoge lecturas, búsquedas, escrituras de scripts, instrucciones a agentes y fixtures sintéticos. `search-audit.json` conserva esas coincidencias y su comando; no son intentos reales de aterrizaje. `scan.py` separa esos casos mediante tokens de ejecución; se descartó además un falso positivo de `wc/grep` (una expresión regular contenía `|LOCK=`). Las reanudaciones repiten tool_use: se deduplican por ID, no por parecido textual. Todas las ejecuciones reales encontradas son Claude Code; no se halló ejecución real de cola en los rollouts Codex de esta ventana. Esto no prueba ausencia de otros mecanismos de merge.')
w('\nSe excluyeron las dos transcripciones que contienen literalmente el encargo actual (hilo de investigación y padre):')
for f in json.load(open('excluded.json')):w(f'- `{f}`')
w('\n**Medición:** duración = timestamp de tool_use → notificación/TaskOutput final o tool_result síncrono. Cuando solo aparece una lectura posterior del log terminal, se muestra **≤**: intervalo medido hasta observar el final, cota superior de ejecución. Las esperas, comandos previos y verify dentro del mismo wrapper se incluyen en ese intervalo; no se inventa un inicio interno de proceso. Sin fin observable: n/d. Los casos sin aterrizaje son censurados; no se afirma que abandonaron definitivamente.')
w('\n**Causalidad:** las letras a–h son una clasificación **inferida** a partir de salidas y diagnósticos citados; la duración y la presencia de marcadores son **medidas**. Una explicación de un asistente es evidencia de su atribución, no prueba independiente. `RED on the rebased result` por sí solo no demuestra que main causó el rojo. Las declaraciones de listo con salvedades se citan tal cual, y no se interpretan como gate completo verde. Un test que pasa aislado no demuestra c: esa categoría exige mismo árbol sin cambios. No se fuerza esa atribución cuando faltan SHAs/árboles.')
w('\nSi se toma «episodio» literalmente como archivo de sesión, sin separar trabajos sucesivos, el total alternativo es **'+str(st['sessions'])+' sesiones**. Se conserva ese agrupamiento en `analysis.json` y cada fila lleva su S-ID; la tabla principal separa aterrizajes para que un éxito temprano no oculte rondas posteriores de otro trabajo.')
w('\n## Tabla de episodios')
w('\nCada fila enlaza su detalle, que cita archivo, línea, tool_use y fin para **cada** invocación. `≥` indica seguimiento censurado hasta el último fin/registro observado, no tiempo definitivo de abandono. Pared arranca en la declaración explícita de listo del mismo trabajo si se encontró; si no, en el primer tool_use.')
w('\n| Episodio | Proyecto / sesión | Fecha UTC | Gate(s) previo(s) observado(s) | Listo previo | Vueltas | Desenlace | Pared medida | certified |')
w('|---|---|---|---|---|---|---:|---|---|')
for e in episodes:
 cats=sorted({g['mode'] for g in e['gates']});gt=', '.join(cats) or 'ninguno ejecutado visible'
 if e['inline_gates']:gt+='; verify en mismo wrapper'
 w(f'| [{e["id"]}](#{e["id"].lower()}) | {e["project"]} / S{e["session"][1:]} | {e["queue_start"][:10]} | {gt} | {"sí" if e["ready"] else "no explícito"} | {len(e["attempts"])} | {"aterrizó" if e["landed"] else "sin aterrizaje observado"} | {"≥ " if e["censored"] else ""}{duration(e["wall_s"])} | {"sí" if e["certified"] else "no visto"} |')
w('\n## Agregados reproducibles')
w(f'\nTodas las cifras de esta sección son **medidas** desde `episodes.json`; comando: `python3 count.py --check`. Sus operandos y referencias están en cada intento de la tabla/detalle. No son estimaciones de duración.')
w(f'\n- Episodios: **{st["episodes"]}**; sesiones únicas: **{st["sessions"]}**; invocaciones: **{st["attempts"]}**; aterrizajes observados: **{st["landed"]}**.')
w(f'- Aterrizan al primer intento: **{st["first_attempt_landed"]}/{st["episodes"]} = {st["first_attempt_pct"]:.3f}%** (denominador incluye censurados).')
w(f'- Pared hasta aterrizaje, solo episodios completados: mediana **{duration(st["wall_landed_median_s"])}**; máximo **{duration(st["wall_landed_max_s"])}**. Los **{st["censored"]}** censurados quedan fuera de esta estimación de tiempo final.')
w(f'- Seguimiento observado de todos los episodios, incluidos censurados: mediana **{duration(st["wall_observed_median_s"])}**, máximo **{duration(st["wall_observed_max_s"])}**. Son intervalos observados, no mediana/máximo poblacional de tiempo hasta abandono.')
for p,v in st['queue_median_s'].items():w(f'- Duración de UNA invocación de cola en **{p}**: mediana **{duration(v)}**, usando notificaciones/TaskOutput/resultados síncronos; se excluyen cotas superiores y finales desconocidos.')
w(f'- Finales medibles: **{st["queue_measured"]}**, de ellos **{st["queue_upper_bounds"]}** son cotas superiores; sin fin medible: **{st["queue_unknown"]}**. Los wrappers con verify previo o espera impiden aislar CPU/proceso de cola.')
w(f'- Episodios que vieron literalmente `[certified-tree]`: **{st["certified_episodes"]}**; invocaciones: **{st["certified_calls"]}**. `[full-gate]` observado en **{st["full_gate_calls"]}** invocaciones. Ausencia en un tail truncado significa «no visto», no «no usado».')
w(f'- Rojos del gate/timeouts con salida identificable: **{st["reds"]}**. Un intento con varios fallos cuenta una vez por causa primaria; bloqueos de aprobación, conflictos, hooks y resultados desconocidos se contabilizan aparte.')
w('\n| Causa primaria inferida | Rojos | % de rojos |')
w('|---|---:|---:|')
for k,v in LABELS.items():
 n=st['red_causes'].get(k,0);w(f'| {k} — {v} | {n} | {100*n/st["reds"]:.2f}% |')
w('\nCausas de todas las invocaciones sin aterrizaje (incluye bloqueos, conflictos y desconocidos): `'+json.dumps(st['all_nonlanding_causes'],ensure_ascii=False)+'`. Se conserva h cuando la evidencia no permite decidir; no se convierte automáticamente un timeout en flake.')
w('\n## Los tres episodios con mayor pared observada')
for e in sorted(episodes,key=lambda e:e['wall_s'],reverse=True)[:3]:
 w(f'\n### {e["id"]} — S{e["session"][1:]} — {duration(e["wall_s"])}'+(' (censurado)' if e['censored'] else ''))
 w(f'{len(e["attempts"])} vueltas, desde `{e["start"]}` hasta `{e["end"]}`; '+('aterrizaje observado.' if e['landed'] else 'sin aterrizaje al cierre de la evidencia.'))
 w('La pared incluye los intervalos entre intentos y, cuando corresponde, espera humana o de otra sesión; no equivale a tiempo gastado ejecutando tests.')
 for a in [x for x in e['attempts'] if x['cause']][:3]:
  qs=a['quote'];q=qs[0] if qs else None
  if q:w(f'- {a["attempt_key"]}: {a["diagnosis"]}. «{one(q[0],210)}» ({cite(e["file"],q[1])}).')
 w(f'La reconstrucción completa y los arreglos entre vueltas están en [{e["id"]}](#{e["id"].lower()}).')
w('\n## Los que sí aterrizaron rápido')
w('\n«Rápido» se define aquí, de forma explícita, como pared observada ≤ 20 minutos. No se atribuye causalidad solo por correlación. Los casos con sello reutilizable se distinguen de los que simplemente completaron un gate sin fallos.')
fast=[e for e in episodes if e['landed'] and e['wall_s']<=1200]
for e in fast:
 a=e['attempts'][-1];w(f'- [{e["id"]}](#{e["id"].lower()}), S{e["session"][1:]}, **{duration(e["wall_s"])}**, {len(e["attempts"])} vuelta(s): '+('observó `[certified-tree]`, omitiendo el gate sobre árbol certificado idéntico.' if e['certified'] else 'no hubo rojo dentro de este episodio.' if len(e['attempts'])==1 else 'se superó el bloqueo o fallo dentro de este intervalo.')+f' Inicio {cite(e["file"],e["attempts"][0]["call"])}; fin '+(cite(e['file'],a['end']) if a['end'] else 'n/d')+'.')
w('\nEl contraste más limpio es el intento certificado de S26: cola de unos segundos después de un verify completo sobre el mismo árbol. En muchos otros casos rápidos la cola sí paga el gate completo, pero no necesita arreglo ni repetición. En los lentos aparecen gates parciales previos, bootstrap/cachés/fixtures compartidos, conflictos, fallos descubiertos de uno en uno y pausas entre rondas. La tabla no permite estimar el efecto causal de cada factor por separado.')
w('\n## Detalle por episodio e intento')
for e in episodes:
 w(f'\n### {e["id"]}')
 w(f'\nProyecto: **{e["project"]}**. Sesión S{e["session"][1:]}: `{e["file"]}`. Inicio cola `{e["queue_start"]}`; inicio pared `{e["start"]}`; fin observado `{e["end"]}`. **Pared medida: '+('≥ ' if e['censored'] else '')+duration(e['wall_s'])+f'**; {len(e["attempts"])} vueltas.')
 first=e['attempts'][0]
 # cwd evidence on the source event; command's cd is retained verbatim in JSON.
 source=next((v for v in lookup[e['file']]['events'] if v.get('id')==first['id'] and v.get('cwd')),None)
 if source:w(f'Cwd registrado: `{source["cwd"]}`.')
 if e['ready']:w(f'Listo previo explícito: «{one(e["ready"]["text"],400)}» ({cite(e["file"],e["ready"])}).')
 else:w('Listo previo: no se encontró una declaración afirmativa explícita de listo/todo verde en el segmento previo; las promesas de pasar un gate no se cuentan como verde.')
 if e['gates']:
  w('Gates/tests invocados antes del primer intento (resultado observable, sin suponer que una llamada background terminó):')
  for g in e['gates']:
   w(f'- **{g["mode"]}**: `{one(g["command"],500)}` → {g["summary"]}. {cite(e["file"],g["event"])}'+(' → '+', '.join(cite(e['file'],r) for r in g['results'][:2]) if g['results'] else ''))
 else:w('Gate previo ejecutado por esta sesión en el segmento: **ninguno visible**. Esto no excluye una verificación delegada o externa no enlazada; sus afirmaciones se conservan en `analysis.json`.')
 if e['inline_gates']:w('En el mismo comando del primer intento también hay un **verify previo**: '+', '.join('`'+one(g,400)+'`' for _,g in e['inline_gates'])+'. No tiene tool_use separado; la duración del wrapper incluye ese verify.')
 for ix,a in enumerate(e['attempts']):
  w(f'\n#### {a["attempt_key"]}')
  w(f'Inicio **{cite(e["file"],a["call"])}**. Fin '+(cite(e['file'],a['end']) if a['end'] else '**no observado**')+f'. Duración **'+('≤ ' if a['endkind']=='lectura terminal (cota superior)' else '')+duration(a['duration_s'])+f'** ({a["endkind"]}).')
  w(f'Desenlace: **{a["outcome"]}**; RC de cola: **{a["rc"] if a["rc"] is not None else "n/d"}**'+('; '+a['queue_rc_note'] if a.get('queue_rc_note') else '')+f'. Marcadores: `[certified-tree]` {"visto" if a["certified"] else "no visto"}; `[full-gate]` {"visto" if a["full_gate"] else "no visto"}. Tool ID `{a["id"]}`'+(f'; task `{a["task"]}`' if a['task'] else '')+'.')
  if a['cause']:
   w(f'Causa primaria **inferida ({a["cause"]}) — {LABELS[a["cause"]]}**. Etapa/diagnóstico: {a["diagnosis"]}.')
   for q,ev in a['quote']:w(f'> {one(q,550)}\n\n{cite(e["file"],ev)}')
   # Add one short diagnostic sentence from the following interval when it explicitly supports the cause.
   ses=next(s for s in sessions if s['id']==e['session']);ai=ses['attempts'].index(a)
   if ai+1<len(ses['attempts']):
    ss=ses['attempts'][ai+1]['says'];words=set(re.findall(r'\w{5,}',a['diagnosis'].lower()))
    best=max(ss,key=lambda v:len(words & set(re.findall(r'\w{5,}',v['text'].lower()))),default=None)
    if best and len(words & set(re.findall(r'\w{5,}',best['text'].lower())))>=2:
     sentences=re.split(r'(?<=[.!?])\s+|\n',best['text']);sentence=max(sentences,key=lambda v:len(words & set(re.findall(r'\w{5,}',v.lower()))))
     w(f'Atribución de la sesión: «{one(sentence,650)}» ({cite(e["file"],best)}).')
  else:
   ev=next((ev for ev in a['raw_results'] if re.search(r'merge-queue: merged |merge-queue: pushed main',ev['text'])),None)
   if ev:w('Prueba de aterrizaje: «'+one(next(l for l in ev['text'].splitlines() if re.search(r'merge-queue: (merged|pushed)',l)),300)+'» ('+cite(e['file'],ev)+').')
  # Between red and next attempt, explicitly enumerate visible files and verification.
  if ix+1<len(e['attempts']):
   nxt=e['attempts'][ix+1]
   if nxt['repair_files']:
    w('Entre este resultado y el siguiente intento, archivos tocados/staged/reportados por el trabajador (no equivale a diff exhaustivo del árbol rebased):')
    for p,ev in nxt['repair_files']:w(f'- `{p}` — {cite(e["file"],ev)}')
   else:w('Entre este resultado y el siguiente intento: **sin cambios de archivos demostrables en las herramientas locales extraídas**. Puede haber cambios delegados o de entorno; no se concluye igualdad del árbol.')
   # Real invoked gate list between the two calls, including next wrapper inline gate.
   nextg=[]
   for v in lookup[e['file']]['events']:
    if v['kind']=='call' and a['call']['ts']<v['ts']<nxt['call']['ts']:
     for cmd in commands(v):
      for mode,gcmd in gates(cmd):
       rs=[r for r in lookup[e['file']]['events'] if r['kind']=='result' and r.get('id')==v.get('id') and r['ts'] and r['ts']<nxt['call']['ts']]
       nextg.append((mode,gcmd,v,rs))
   if nextg:
    w('Verificación del arreglo antes de volver a cola:')
    for mode,cmd,ev,rs in nextg:w(f'- {mode}: `{one(cmd,500)}` → {terminal_summary(rs)}. {cite(e["file"],ev)}'+(' → '+cite(e['file'],rs[0]) if rs else ''))
   else:w('Verificación del arreglo antes del siguiente intento: **ningún gate/test ejecutado localmente visible**; los informes delegados no se convierten en un gate completo demostrado.')
w('\n## Limitaciones y controles del método')
w('\n- El corpus es una foto de la extracción (`scan.json`); la lectura final incorporó el tercer intento de S29, terminado a las 2026-11-20T23:53:02.947Z. No se deduce ningún aterrizaje posterior a los registros leídos. Las fechas de carpeta no sustituyen los timestamps JSONL.')
w('- Una llamada cuyo comando contiene cola puede quedar bloqueada por hook, fallar antes del `&&`, o no entrar en un `if`. Se conserva como intento solicitado por la definición del encargo, señalando que la cola no llegó a ejecutarse. No se confunde con una corrida real verde/roja.')
w('- Los bloques `echo EXIT=$?`, `tail`, `grep` y los wrappers en background pueden salir 0 después de un gate rojo. Se priorizan códigos explícitos de cola y sus mensajes; cuando el único código no es atribuible se muestra n/d. Exit 21 se interpreta por su texto histórico, no por una tabla de códigos de la versión actual.')
w('- No se consultaron commits ni se ejecutó software de los proyectos para comprobar atribución. Archivos editados por subagentes sin resultado/handoff visible, arreglos externos, mutaciones de DB/caché, cambios omitidos por truncado y SHAs ausentes impiden reconstruir siempre el diff exacto. Se listan los archivos demostrables y se mantiene h en lo indeterminado.')
w('- “Ninguno visible” distingue ausencia de llamada local de ausencia absoluta de pruebas. Los tests citados en una explicación de agente pueden haberse ejecutado en otra sesión; los resultados background de gates previos no se suponen verdes sin terminal enlazado. Las llamadas verify dentro del wrapper de cola impiden medir por separado sus dos duraciones.')
w('- Los marcadores solo se cuentan cuando aparecen entre los resultados enlazados al intento. Muchos logs se leen con tail: no observar un marcador no prueba que no existiera. Los tres relatos peores usan pared observada, y pueden incluir noche, pausas o aprobación humana.')
w('- No se encontró artefacto de fin enlazable para todos los intentos; se marca n/d y se excluye de la mediana de una corrida. Las lecturas terminales tardías son cotas superiores. El método no convierte una espera humana ni la latencia de notificación en tiempo de CPU.')
w('- La búsqueda principal fue `rg -l \'merge-queue\\.sh\' ~/.claude/projects ~/.codex/sessions -g \'*.jsonl\' > candidate-files.txt`, seguida de análisis estructural JSONL y filtro de herramientas. `search-audit.json` permite revisar cada coincidencia literal, incluidos falsos positivos; `excluded.json` documenta la autoexclusión. Scripts de entrada: scan.py, transcript_lib.py, command_lib.py; reconstrucción: analyze.py, gates.py, annotations.py, build_report.py.')
w('\n## Verificación final de aceptación')
w('\n`python3 count.py --check` recalcula todos los agregados desde los timestamps e intentos de `episodes.json`, los compara con `aggregates.json` y verifica que las filas de la tabla de este documento contienen exactamente los mismos episodios, vueltas, finales y duraciones. También valida tool IDs únicos, referencias fuente, fin ≥ inicio y exclusión de la sesión investigadora. La salida reproducible se guarda en `verification.txt`.')
pathlib.Path('episodes.md').write_text('\n'.join(lines)+'\n')
print(json.dumps(st,ensure_ascii=False,indent=2))
