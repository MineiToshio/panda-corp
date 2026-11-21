"""Independent acceptance/count audit. Reads only snapshot evidence and source JSONL lines."""
import json,re,pathlib,statistics,collections,datetime,sys
P=pathlib.Path;eps=json.load(open('episodes.json'));ats=[a for e in eps for a in e['attempts']]
def secs(a,b):return round((datetime.datetime.fromisoformat(b.replace('Z','+00:00'))-datetime.datetime.fromisoformat(a.replace('Z','+00:00'))).total_seconds(),3)
done=[e for e in eps if e['landed']];reds=[a for a in ats if a['outcome'].startswith(('rojo','timeout')) and a['cause']]
calc=dict(episodes=len(eps),sessions=len(set(e['file'] for e in eps)),attempts=len(ats),landed=len(done),first_attempt_landed=sum(e['landed'] and len(e['attempts'])==1 for e in eps),first_attempt_pct=round(100*sum(e['landed'] and len(e['attempts'])==1 for e in eps)/len(eps),3),wall_landed_median_s=statistics.median(secs(e['start'],e['end']) for e in done),wall_landed_max_s=max(secs(e['start'],e['end']) for e in done),wall_observed_median_s=statistics.median(secs(e['start'],e['end']) for e in eps),wall_observed_max_s=max(secs(e['start'],e['end']) for e in eps),censored=sum(e['censored'] for e in eps),certified_episodes=sum(any(a['certified'] for a in e['attempts']) for e in eps),certified_calls=sum(a['certified'] for a in ats),full_gate_calls=sum(a['full_gate'] for a in ats),red_causes=dict(sorted(collections.Counter(a['cause'] for a in reds).items())),reds=len(reds),all_nonlanding_causes=dict(sorted(collections.Counter(a['cause'] for a in ats if a['cause']).items())),queue_median_s={p:statistics.median(secs(a['call']['ts'],a['end']['ts']) for e in eps if e['project']==p for a in e['attempts'] if a['end'] and a['endkind']!='lectura terminal (cota superior)') for p in sorted(set(e['project'] for e in eps))},queue_measured=sum(a['end'] is not None for a in ats),queue_upper_bounds=sum(a['endkind']=='lectura terminal (cota superior)' for a in ats),queue_unknown=sum(a['end'] is None for a in ats))
if '--check' in sys.argv:
 expected=json.load(open('aggregates.json'));assert expected==calc,(expected,calc)
 md=P('episodes.md').read_text();table=md.split('## Tabla de episodios')[1].split('## Agregados')[0]
 rows=[l for l in table.splitlines() if re.match(r'\| \[EP\d+',l)]
 assert len(rows)==len(eps),(len(rows),len(eps))
 for e,row in zip(eps,rows):
  assert e['id'] in row and f'| {len(e["attempts"])} |' in row
  assert f'{e["wall_s"]/60:.2f} min' in row and secs(e['start'],e['end'])==e['wall_s']
  assert ('| aterrizó |' in row)==e['landed']
  assert row.rstrip().endswith('| sí |')==e['certified']
  detail=md.split('### '+e['id']+'\n',1)[1].split('\n### EP',1)[0]
  assert str(e['file']) in detail
  for a in e['attempts']:
   assert '#### '+a['attempt_key'] in detail and a['call']['ts'] in detail and a['id'] in detail
   if a['end']:assert secs(a['call']['ts'],a['end']['ts'])==a['duration_s'] and a['duration_s']>=0 and a['end']['ts'] in detail
 # Verify every human-readable aggregate printed in the Markdown, not only JSON/table.
 aggregate_section=md.split('## Agregados reproducibles',1)[1].split('## Los tres',1)[0]
 assert f'Episodios: **{calc["episodes"]}**' in aggregate_section
 assert f'invocaciones: **{calc["attempts"]}**' in aggregate_section
 assert f'aterrizajes observados: **{calc["landed"]}**' in aggregate_section
 assert f'{calc["first_attempt_landed"]}/{calc["episodes"]} = {calc["first_attempt_pct"]:.3f}%' in aggregate_section
 for k in ('wall_landed_median_s','wall_landed_max_s','wall_observed_median_s','wall_observed_max_s'):
  assert f'{calc[k]/60:.2f} min' in aggregate_section
 for proj,v in calc['queue_median_s'].items():assert f'**{proj}**: mediana **{v/60:.2f} min**' in aggregate_section
 assert f'`[certified-tree]`: **{calc["certified_episodes"]}**' in aggregate_section
 for k,v in calc['red_causes'].items():assert re.search(r'\| '+k+r' — [^|]+\| '+str(v)+r' \|',aggregate_section)
 assert len({a['id'] for a in ats})==len(ats),'duplicate tool ids'
 excluded=set(json.load(open('excluded.json')));assert not excluded & {e['file'] for e in eps}
 # Validate source-file + line + timestamp evidence independently against the JSONL.
 refs=collections.defaultdict(dict)
 for e in eps:
  for a in e['attempts']:
   for ev in [a['call'],a['end']]+[r for _,r in a['quote']]:
    if ev:refs[ev.get('sourcefile') or e['file']][ev['line']]=ev
 checked=0
 for f,wants in refs.items():
  for n,l in enumerate(open(f),1):
   if n not in wants:continue
   x=json.loads(l);ev=wants[n];assert x.get('timestamp')==ev['ts'],(f,n,x.get('timestamp'),ev['ts']);checked+=1
  assert max(wants)<=n
 # Recount unique actual candidates from the extraction before report annotations.
 scan=json.load(open('scan.json'));ids=set()
 for e in scan:
  for c in e['calls']:
   if 'wc -l merge-queue.sh' not in c['command']:ids.add(c['id'])
 assert ids=={a['id'] for a in ats},(len(ids),len(ats))
 print(f'PASS: {len(rows)} filas = {calc["episodes"]} episodios; {len(ats)} tool IDs únicos; {checked} referencias fuente con timestamps válidos.')
 print('PASS: todos los agregados recalculados coinciden con aggregates.json y la tabla (vueltas/desenlace/pared).')
 print(f'PASS: exclusión de {len(excluded)} transcripciones investigadoras; ningún proyecto ejecutado ni modificado por estos scripts.')
print(json.dumps(calc,ensure_ascii=False,indent=2))
