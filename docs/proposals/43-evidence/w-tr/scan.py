from transcript_lib import *
from command_lib import commands,actual
paths=pathlib.Path('candidate-files.txt').read_text().splitlines();selected=[];audit=[];excluded=[]
for f in paths:
 hit=False;selfsession=False
 for n,l in enumerate(open(f),1):
  if MARKER in l:selfsession=True;break
  if 'merge-queue.sh' not in l:continue
  try:x=json.loads(l)
  except:continue
  if not START<=x.get('timestamp','')<END:continue
  m=x.get('message',{});p=x.get('payload',{});cs=[]
  if isinstance(m,dict):
   c=m.get('content',[])
   if isinstance(c,list):
    for z in c:
     if isinstance(z,dict) and z.get('type')=='tool_use':cs.append(dict(kind='call',name=z.get('name'),id=z.get('id'),text=z.get('input',{}).get('command',json.dumps(z.get('input',{})))))
  if p.get('type') in ('function_call','custom_tool_call'):cs.append(dict(kind='call',name=p.get('name'),id=p.get('call_id'),text=p.get('arguments',p.get('input',''))))
  for e in cs:
   for s in commands(e):
    if 'merge-queue.sh' in s and '--help' not in s:
     ok=actual(s); audit.append(dict(file=f,line=n,ts=x['timestamp'],id=e['id'],actual=ok,command=s));hit|=ok
 if selfsession:excluded.append(f);continue
 if hit:selected.append(f)
eps=[]
for f in selected:
 es=list(events(f));calls=[]
 for e in es:
  if e['kind']=='call' and START<=e['ts']<END:
   cs=[s for s in commands(e) if actual(s)]
   if cs:e['command']='\n'.join(cs);calls.append(e)
 eps.append(dict(file=f,events=es,calls=calls))
pathlib.Path('scan.json').write_text(json.dumps(eps,ensure_ascii=False));pathlib.Path('search-audit.json').write_text(json.dumps(audit,ensure_ascii=False));pathlib.Path('excluded.json').write_text(json.dumps(excluded,indent=2))
print('files',len(selected),'calls before dedup',sum(len(e['calls']) for e in eps),'literal shell mentions',len(audit),'excluded',len(excluded))
