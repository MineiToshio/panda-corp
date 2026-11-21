import collections, datetime as dt, json, os, re, sys
from pathlib import Path
home=Path.home()
begin='2026-10-10'
end='2026-11-22'
targets=re.compile(r'mission-control|funko-tracker|personal-page-v2',re.I)
skill=re.compile(r'(?<![a-z-])(?:/pandacorp:implement|\$pandacorp:implement)(?![-\w])',re.I)
cli=re.compile(r'pandacorp-build\.mjs|(?:orch|build-engine)[-a-z]*\.mjs')
direct=re.compile(r'(?:sin|without|no uses?|omit|skip|olvida|deja|cancela|abandona).{0,60}(?:implement|motor|engine)|(?:haz|hacer|implement|build).{0,35}(?:directamente|por tu cuenta|a mano|directly|vanilla)',re.I)
talk=re.compile(r'build|implement|direct|motor|engine|WO-\d|vanilla|orquest',re.I)
cmdact=re.compile(r'(?:^|\s)(start|resume|drive|next|init|land|begin|stop|handoff|step|commit-wo|apply-gate|relock|precheck|status|detect)(?:\s|[\\"\x27;|)]|$)')
def body(raw):
 if isinstance(raw,str): return raw
 return ' '.join(x.get('text','') for x in raw or [] if isinstance(x,dict) and x.get('type') in ('text','input_text','output_text'))
def norm(s,lim=450): return re.sub(r'\s+',' ',s).strip()[:lim]
def scan(runtime, files):
 count=collections.Counter(); out=[]
 for p in files:
  if runtime=='X' and not begin<=('-'.join(p.parts[-4:-1]))<end: continue
  count['allfiles']+=1
  events=[]; dirs=set(); runtimeid=''; start=''; stop=''; users=[]; calls={}; tail=[]
  try: fh=p.open(errors='replace')
  except OSError: count['unreadable']+=1;continue
  with fh:
   for i,l in enumerate(fh,1):
    try:r=json.loads(l)
    except ValueError:count['bad_rows']+=1;continue
    t=r.get('timestamp','')
    if not isinstance(t,str):continue
    if t and not begin<=t[:10]<end:continue
    if t:
     start=start or t; stop=t
    typ=r.get('type'); m=r.get('message') or {}; d=r.get('payload') or {}
    if runtime=='C':
     if r.get('cwd'): dirs.add(r['cwd'])
     if r.get('sessionId'):runtimeid=r['sessionId']
     content=m.get('content')
     if typ=='user' and not r.get('isMeta') and not r.get('toolUseResult') and not r.get('isSidechain'):
      s=body(content)
      if s and ('<local-command-caveat>' not in s or '<command-name>' in s):
       users.append((i,t,norm(s))); 
       if skill.search(s):events.append((i,t,'U',norm(s,750)))
       elif direct.search(s):events.append((i,t,'D',norm(s,750)))
     if typ=='assistant' and isinstance(content,list):
      for c in content:
       if c.get('type')!='tool_use':continue
       name=c.get('name',''); a=c.get('input') or {}; cid=c.get('id')
       s=a.get('command','') or a.get('cmd','')
       if name.split('__')[-1]=='Skill' and a.get('skill','').rstrip() in ('pandacorp:implement','implement'):
        events.append((i,t,'S',norm(json.dumps(a),500)));calls[cid]=i
       if isinstance(s,str) and cli.search(s):
        kind='A' if any(cmdact.search(s[max(0,x.start()):x.start()+135]) for x in cli.finditer(s)) else 'Q'
        events.append((i,t,kind,norm(s,1100)));calls[cid]=i
       if name.split('__')[-1] in ('Agent','Task') and (a.get('description') or a.get('subagent_type')):
        tail.append((i,t,'W',norm(str(a.get('description',''))+' '+str(a.get('subagent_type','')),180)))
     if typ=='user' and isinstance(content,list):
      for c in content:
       if c.get('type')=='tool_result' and c.get('tool_use_id') in calls:
        s=c.get('content','');s=body(s) if not isinstance(s,str) else s
        events.append((i,t,'R'+str(calls[c['tool_use_id']]),norm(s,400)))
    else:
     if typ in ('session_meta','turn_context'):
      if d.get('cwd'): dirs.add(d['cwd'])
      if typ=='session_meta':runtimeid=d.get('id','')
     if typ=='event_msg' and d.get('type')=='user_message':
      s=d.get('message','');users.append((i,t,norm(s)))
      if skill.search(s):events.append((i,t,'U',norm(s,750)))
      elif direct.search(s):events.append((i,t,'D',norm(s,750)))
     if typ=='response_item' and d.get('type') in ('function_call','custom_tool_call'):
      s=d.get('arguments','') or d.get('input',''); name=d.get('name','')
      if not isinstance(s,str):s=json.dumps(s)
      if cli.search(s) and ('exec' in name or 'shell' in name or 'bash' in name):
       kind='A' if any(cmdact.search(s[max(0,x.start()):x.start()+135]) for x in cli.finditer(s)) else 'Q'
       events.append((i,t,kind,norm(s,1100)));calls[d.get('call_id')]=i
      if name.endswith('spawn_agent'):tail.append((i,t,'W',norm(s,350)))
     if typ=='response_item' and d.get('type') in ('function_call_output','custom_tool_call_output') and d.get('call_id') in calls:
      s=d.get('output','');s=str(s)
      events.append((i,t,'R'+str(calls[d['call_id']]),norm(s,400)))
   if not start:continue
   count['dated']+=1
   if not events:continue
   pathmatch=bool(targets.search(str(p)) or any(targets.search(d) for d in dirs))
   eventmatch=any(targets.search(e[3]) for e in events)
   if not pathmatch and not eventmatch and 'panda-corp' not in str(p) and not any('/panda-corp' in d for d in dirs):continue
   count['candidate']+=1
   out.append((str(p),runtimeid,sorted(dirs),start,stop,users,sorted(events+tail),pathmatch))
 print(runtime,count,file=sys.stderr)
 return out
result=scan('C',(home/'.claude/projects').rglob('*.jsonl'))+scan('X',(home/'.codex/sessions/2026').rglob('*.jsonl'))
with open('work/implement_audit_scan.json','w') as f:json.dump(result,f)
for p,id,dirs,a,b,users,ev,pathmatch in sorted(result,key=lambda s:s[3]):
 ground=[e for e in ev if e[2] in ('S','U','A')]
 if not ground: continue
 print(a[:19],b[:19],p)
 if dirs:print('  CWD:', '; '.join(dirs)[:600])
 if users: print('  FIRST:',users[0][0],users[0][2][:180])
 for i,t,k,s in ev:
  if k not in ('A','S','U','D') and not k.startswith('R'):continue
  if k.startswith('R') and int(k[1:]) not in [x[0] for x in ground]:continue
  print(f'  {i} {t[:19]} {k} {s[:340]}')
