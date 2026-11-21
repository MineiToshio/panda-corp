import json,sys
f,lo,hi=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]); w=int(sys.argv[4]) if len(sys.argv)>4 else 400
for i,l in enumerate(open(f),1):
  if i<lo: continue
  if i>hi: break
  try: o=json.loads(l)
  except: continue
  m=o.get('message') or {}; c=m.get('content')
  if isinstance(c,str): c=[{'type':'text','text':c}]
  for b in c or []:
    t=b.get('type')
    if t=='text': s='TXT '+b['text']
    elif t=='tool_use': s='USE '+json.dumps(b.get('input'))[:w]
    elif t=='tool_result':
      x=b.get('content'); x=x if isinstance(x,str) else ' '.join(y.get('text','') for y in x or [] if isinstance(y,dict))
      s='RES '+x
    else: continue
    print(i,o.get('timestamp','')[:19],s.replace('\n',' | ')[:w])
