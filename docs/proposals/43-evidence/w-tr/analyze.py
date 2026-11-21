import json,re,pathlib,datetime,collections
from command_lib import commands
raw=json.load(open('scan.json'))
# Deduplicate resumed transcripts by call id, retaining longest session context.
raw.sort(key=lambda e:len(e['events']),reverse=True);seen=set();eps=[]
def dt(t):return datetime.datetime.fromisoformat(t.replace('Z','+00:00'))
def sec(a,b):return round((dt(b)-dt(a)).total_seconds(),3) if a and b else None
def ref(e):return {k:e.get(k) for k in ('ts','line','kind','text','sourcefile')}
def shorten(s,n=2000):return s[:n]
for ep in raw:
 calls=[c for c in ep['calls'] if c['id'] not in seen and not ('wc -l merge-queue.sh' in c['command'])]
 if not calls:continue
 seen.update(c['id'] for c in calls)
 # omit repeated context messages with absent timestamp
 es=[e for e in ep['events'] if e['ts']]; results=collections.defaultdict(list)
 for e in es:
  if e['kind']=='result':results[e.get('id')].append(e)
 parent_notifications=[]
 if '/subagents/' in ep['file']:
  parent=pathlib.Path(ep['file'].split('/subagents/')[0]+'.jsonl')
  if parent.exists():
   from transcript_lib import events
   parent_notifications=[{**e,'sourcefile':str(parent)} for e in events(parent) if e['ts'] and e['kind']=='user' and '<task-notification>' in e['text']]
 out=[]
 for idx,c in enumerate(calls):
  nextts=calls[idx+1]['ts'] if idx+1<len(calls) else '9999'
  initial=next(iter(results[c['id']]),None);task=None
  if initial:
   m=re.search(r'(?:background with ID:|background \(ID:|task ID:|session ID:?|session_id["\s:]+)\s*([\w-]+)',initial['text'],re.I)
   if m:task=m[1]
  notifications=[e for e in es+parent_notifications if e['ts']>=c['ts'] and e['kind']=='user' and '<task-notification>' in e['text'] and (c['id'] in e['text'] or task and f'<task-id>{task}</task-id>' in e['text'])]
  taskcalls=[e for e in es if e['kind']=='call' and e.get('name')=='TaskOutput' and task and task in e['text'] and e['ts']>=c['ts']]
  taskresults=[r for t in taskcalls for r in results[t['id']] if not re.search(r'<status>running</status>',r['text'])]
  ends=notifications+taskresults
  if ends:end=min(ends,key=lambda e:e['ts']);endkind='notificación/TaskOutput'
  elif initial and not task and not re.search(r'(?<![>&])&(?![&>])|nohup',c['command']):end=initial;endkind='tool_result'
  else:end=None;endkind='sin fin observable'
  # related log read results before next queue invocation
  logs=set(re.findall(r'([\w.-]+\.log)\b',c['command']))
  related=[]
  for e in es:
   if not c['ts']<=e['ts']<nextts or e['kind']!='call' or e['id']==c['id']:continue
   if any(log in e['text'] for log in logs) or (task and task in e['text']):related.extend(results[e['id']])
  # Follow detached shell monitors and subsequent reads of their task output transitively.
  known=set([task] if task else [])
  for _ in range(3):
   for r in related:
    m=re.search(r'(?:background with ID:|background \(ID:)\s*([\w-]+)',r['text'])
    if m:known.add(m[1])
   for e in es:
    if e['kind']=='call' and c['ts']<=e['ts']<nextts and any(t in e['text'] for t in known):
     for r in results[e['id']]:
      if all(x['line']!=r['line'] for x in related):related.append(r)
  direct=([initial] if initial else [])+taskresults+related
  # Unique evidence includes subsequent extracted log views, but never unrelated full test logs.
  direct=list({e['line']:e for e in direct}.values())
  # A terminal log read is a measured upper bound if the notification is absent.
  if re.search(r'(?<![>&])&(?![&>])',c['command']):end=None
  if end is None:
   terminal=[e for e in related if re.search(r'merge-queue: (?:merged|integration gate RED)|^\s*(?:rc|exit|EXIT|merge_queue_exit)\s*[=:]\s*\d|QUEUE-DONE',e['text'],re.M)]
   if terminal:end=min(terminal,key=lambda e:e['ts']);endkind='lectura terminal (cota superior)'
   elif any(re.search(r'FAIL |[✘]|Error: expect',r['text']) for r in related):
    # Failure excerpt proves failure observed, but not end of whole queue: leave end unmeasured.
    pass
  logtext='\n'.join(e['text'] for e in direct if 'Command running in background' not in e['text'])
  explicit=[]
  for e in direct:
   for m in re.finditer(r'(?:^|\n)(?:\d+:)?\s*(?:rc|RC|exit|EXIT|mq|merge_queue_exit|MQ_EXIT)(?:[ _-]code)?\s*[=: ]\s*(\d+)\b|<exit_code>(\d+)|\[exited with code (\d+)\]',e['text']):explicit.append((e,int(next(g for g in m.groups() if g))))
  rc=explicit[0][1] if explicit else None
  if re.search(r'merge-queue: merged |merge-queue: pushed main to origin',logtext):outcome='aterrizó'
  elif re.search(r'integration gate RED',logtext):outcome='rojo del gate';rc=11
  elif re.search(r'CONFLICT|could not apply|rebase.*(?:failed|conflict)',logtext):outcome='conflicto de rebase';rc=10
  elif re.search(r'(?:main|checkout).*(?:dirty|busy|ocupad)|main.*uncommitted',logtext,re.I):outcome='main ocupado'
  elif re.search(r'merge lock held',logtext):outcome='main ocupado / lock timeout'
  elif re.search(r'main is production',logtext):outcome='bloqueo aprobación producción';rc=21
  elif re.search(r'main.*(?:advanced|moved)|exit.?21',logtext,re.I):outcome='main avanzó / exit 21'
  elif re.search(r'(?:timed out|exit.?124)',logtext,re.I):outcome='timeout / revisar etapa'
  elif re.search(r'(?:FAIL|✘|BLOCKED|merge-queue:.*(?:error|refus|abort))',logtext):outcome='rojo / bloqueo'
  elif rc==11:outcome='rojo del gate (mensaje recortado)'
  elif rc==0:outcome='exit 0 sin prueba de aterrizaje'
  else:outcome='indeterminado'
  if not explicit and end:
   m=re.search(r'exit code (\d+)',end['text']);rc=int(m[1]) if m else rc
  relevant=[]
  patt=r'merge-queue:|\[certified-tree\]|\[full-gate\]|FAIL |Error:|✘|failed|expected|AssertionError|Timeout|<exit_code>|\b(?:EXIT|exit|rc)\s*[=: ]\s*\d|CONFLICT|could not apply'
  for e in direct:
   lines=e['text'].splitlines();selected=[l for l in lines if re.search(patt,l,re.I)]
   if selected:relevant.append({**ref(e),'text':'\n'.join(selected)[:8000]})
  prev=calls[idx-1]['ts'] if idx else '0000'
  between=[e for e in es if prev<e['ts']<c['ts']]
  gates=[];edits=[];says=[]
  for e in between:
   if e['kind']=='call':
    cs=commands(e)
    for cmd in cs:
     if re.search(r'(?:bash\s+\S*verify\.sh|pnpm.*(?:vitest|playwright|test)|npm.*test|npx.*(?:vitest|playwright)|node --test)',cmd) and not re.search(r'^(?:cat|rg|grep|tail|head)\b',cmd):
      rs=results[e['id']];gates.append({**ref(e),'text':cmd[:2000],'results':[ref(r) for r in rs]})
    if e.get('name') in ('Edit','Write','MultiEdit'):edits.append({**ref(e),'text':str(e.get('input',{}).get('file_path',e['text'][:150]))})
    elif any(re.search(r'git (?:add|commit)|apply_patch|write_text|sed -i',s) for s in cs):edits.append({**ref(e),'text':shorten(e['text'],1800)})
   elif e['kind']=='assistant' and re.search(r'listo|todo verde|all green|done|ready|passed|complet|rojo|fall|corrig|timeout|baseline|flak|seed|orden|main',e['text'],re.I):says.append(ref(e))
  out.append(dict(call=ref(c),id=c['id'],command=c['command'],initial=ref(initial) if initial else None,task=task,end=ref(end) if end else None,endkind=endkind,duration_s=sec(c['ts'],end['ts']) if end else None,rc=rc,outcome=outcome,certified='[certified-tree]' in logtext,full_gate='[full-gate]' in logtext,evidence=relevant,gates=gates,edits=edits,says=says[-12:],raw_results=[ref(e) for e in direct]))
 eps.append(dict(file=ep['file'],attempts=out))
eps.sort(key=lambda e:e['attempts'][0]['call']['ts'])
for i,e in enumerate(eps,1):e['id']=f'E{i:02d}'
pathlib.Path('analysis.json').write_text(json.dumps(eps,ensure_ascii=False))
with open('review.txt','w') as f:
 for ep in eps:
  f.write(f'\n{ep["id"]} {ep["file"]}\n')
  for j,a in enumerate(ep['attempts'],1):
   f.write(f'ATT {j} {a["call"]["ts"]} {a["duration_s"]}s rc={a["rc"]} {a["outcome"]} task={a["task"]} end={a["end"]["ts"] if a["end"] else None}\n')
   for ev in a['evidence']:f.write(f'L{ev["line"]} '+ev['text'][:3500]+'\n')
print('episodes',len(eps),'attempts',sum(len(e['attempts']) for e in eps))
