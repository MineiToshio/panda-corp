from pathlib import Path
import re,json,sys
key=re.compile('funko-tracker|mission-control|personal-page-v2')
wanted=re.compile('launch-implement|pandacorp-build(?:-[^/ ]*)?\\.js|/pandacorp:implement')
for s in Path('work/implement_audit_oldfiles.txt').read_text().splitlines():
 p=Path(s)
 if '/subagents/' in s:continue
 matches=[]
 for i,l in enumerate(p.open(),1):
  if '"name":"Workflow"' not in l and 'launch-implement.sh' not in l and '/pandacorp:implement</command-name>' not in l: continue
  r=json.loads(l);t=r.get('timestamp','')
  if not '2026-10-10'<=t[:10]<='2026-11-21': continue
  if not key.search(s+' '+r.get('cwd','')) and not key.search(l):continue
  m=r.get('message') or {};cs=m.get('content') or []
  if isinstance(cs,str): cs=[{'type':'text','text':cs}]
  for c in cs:
   name=c.get('name','');inp=c.get('input',{})
   if name=='Workflow' and wanted.search(str(inp)):
    a=inp.get('args',{});a=a if isinstance(a,dict) else {}
    print(p.name,i,t,'workflow', {k:a.get(k) for k in ('project','mode','maxAgents','change','resume','frd','projectDir')},str(inp.get('scriptPath',''))[-120:])
   elif name=='Bash' and 'launch-implement.sh' in inp.get('command','') and not re.search(r'^ *(rg|grep|cat |sed|ls|git log)',inp.get('command','')):
    print(p.name,i,t,'launch',re.sub(r'\s+',' ',inp.get('command',''))[:300])
   elif c.get('type')=='text' and r.get('type')=='user' and not r.get('isMeta') and re.match(r'(?:<command-message>[^<]*</command-message>\s*)?<command-name>/pandacorp:implement</command-name>',c.get('text','')):
    print(p.name,i,t,'invoke',c.get('text','')[:200].replace('\n',' '))
