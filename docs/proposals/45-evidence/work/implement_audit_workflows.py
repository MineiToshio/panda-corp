import re,json,collections,datetime as dt
from pathlib import Path
for short in ('d812059e','4dac9675','62d4cf83'):
 p=next(Path.home().glob(f'.claude/projects/*/{short}*.jsonl'))
 runs={}; notices=collections.defaultdict(list); calls={}
 for i,l in enumerate(p.open(),1):
  r=json.loads(l); t=r.get('timestamp')
  if not t:continue
  m=r.get('message') or {}; cs=m.get('content') or []
  if isinstance(cs,str):cs=[{'type':'text','text':cs}]
  for c in cs:
   if c.get('name')=='Workflow' and 'pandacorp-build' in str(c.get('input')):
    calls[c['id']]=i,t
   if c.get('type')=='tool_result' and c.get('tool_use_id') in calls:
    s=str(c.get('content','')); rm=re.search(r'Task ID: (\w+)',s); wm=re.search(r'wf_[\w-]+',s)
    print(short,'result',calls[c['tool_use_id']],i,t,rm.group(1) if rm else '',wm.group(0) if wm else '',s[:140])
    if rm:runs[rm.group(1)]=(calls[c['tool_use_id']],i,t,wm.group(0) if wm else '')
   if r.get('type')=='user' and c.get('type')=='text':
    s=c.get('text','')
    if not s.startswith('<task-notification>'): continue
    match=re.search('<task-id>(.*?)</task-id>',s)
    if not match:continue
    notices[match.group(1)].append((i,t,re.findall(r'<(status|agent_count|agents_done|agents_failed|summary|result)>([\s\S]*?)</\1>',s)))
 for task,((i,t),j,u,w) in runs.items():
  print(short,'WORKFLOW',i,t,'task',task,w)
  for n,end,rows in notices.get(task,[]):
   print('  ',n,end,'minutes',round((dt.datetime.fromisoformat(end)-dt.datetime.fromisoformat(t)).total_seconds()/60,3),[(k,' '.join(v.split())[:410]) for k,v in rows])
 for n in (p.parent/p.stem/'subagents/workflows').glob('wf_*'):
  print(short,'local files',n.name,len(list(n.glob('*.jsonl'))),len(list(n.rglob('*.jsonl'))))
