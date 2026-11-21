import json,re,pathlib,collections
ROOTS=[pathlib.Path.home()/'.claude/projects',pathlib.Path.home()/'.codex/sessions']
START='2026-11-01'; END='2026-11-21'
MARKER='Tarea: reconstruir, desde las transcripciones de sesiones'
def txt(c):
 if isinstance(c,str):return c
 if isinstance(c,list):return '\n'.join(txt(v) for v in c)
 if isinstance(c,dict):return c.get('text',c.get('output',''))
 return str(c)
def events(f):
 for n,line in enumerate(open(f),1):
  try:x=json.loads(line)
  except:continue
  ts=x.get('timestamp','');typ=x.get('type');m=x.get('message',{});p=x.get('payload',{})
  if typ=='session_meta':yield dict(kind='meta',text=str(p),cwd=p.get('cwd'),ts=ts,line=n)
  if isinstance(m,dict):
   c=m.get('content',[])
   if isinstance(c,str):yield dict(kind=m.get('role',typ),text=c,ts=ts,line=n,cwd=x.get('cwd'))
   elif isinstance(c,list):
    for b in c:
     if not isinstance(b,dict):continue
     t=b.get('type')
     if t=='tool_use':
      inp=b.get('input',{});yield dict(kind='call',name=b.get('name'),id=b.get('id'),text=inp.get('command',json.dumps(inp,ensure_ascii=False)),input=inp,ts=ts,line=n,cwd=x.get('cwd'))
     elif t=='tool_result':yield dict(kind='result',id=b.get('tool_use_id'),text=txt(b.get('content')),error=b.get('is_error'),ts=ts,line=n)
     elif t=='text':yield dict(kind=m.get('role',typ),text=b.get('text',''),ts=ts,line=n)
  if typ=='response_item':
   t=p.get('type')
   if t in ('function_call','custom_tool_call'):yield dict(kind='call',name=p.get('name'),id=p.get('call_id'),text=p.get('arguments',p.get('input','')),ts=ts,line=n)
   elif t in ('function_call_output','custom_tool_call_output'):yield dict(kind='result',id=p.get('call_id'),text=txt(p.get('output')),ts=ts,line=n)
   elif t=='message':yield dict(kind=p.get('role','message'),text=txt(p.get('content')),ts=ts,line=n)
def isqueue(e):
 s=e['text']
 # An executed shell invocation, excluding reads/searches, documentation, help, embedded transcript probes.
 return e['kind']=='call' and re.search(r'(?:^|[\s;|&"\'])\S*merge-queue\.sh(?:\s|["\']|$)',s) and '--help' not in s and not re.search(r'\b(?:grep|rg|cat|sed|head|tail|wc|read_text|open\(|python3)\b[^\n;]*merge-queue',s)

if __name__=='__main__':
 import runpy
 ns=runpy.run_path('normalize.py',run_name='library') if False else None
