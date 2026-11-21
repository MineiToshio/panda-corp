from pathlib import Path
import json,sys,re
home=Path.home()
possible=[p for p in (home/'.claude/projects').glob('*/*.jsonl') if p.name.startswith(sys.argv[1])]
pat=re.compile(sys.argv[2],re.I)
lo=int(sys.argv[3]) if len(sys.argv)>3 else 0
hi=int(sys.argv[4]) if len(sys.argv)>4 else 9999999
lim=int(sys.argv[5]) if len(sys.argv)>5 else 430
for p in possible:
 print(p)
 for i,l in enumerate(p.open(),1):
  if not lo<=i<=hi:continue
  r=json.loads(l);m=r.get('message',{});content=m.get('content',[])
  if isinstance(content,str):content=[{'type':'text','text':content}]
  for c in content:
   typ=c.get('type'); rt=r.get('type','')[0:1]
   if typ=='text':s=c.get('text',''); tag=rt
   elif typ=='tool_use':s=str(c.get('input'));tag=c.get('name','')
   elif typ=='tool_result':
    a=c.get('content','');s=str(a);tag='Result'
   else:continue
   if pat.search(s) or pat.search(tag):
    trim=re.sub(r'\s+',' ',s).strip()
    if len(trim)>lim:
     mm=pat.search(trim)
     if mm and mm.start()>lim-100 and not pat.search(tag):
      trim='…'+trim[max(mm.start()-75,0):]
    print(i,r.get('timestamp','')[:19],tag,trim[:lim])
