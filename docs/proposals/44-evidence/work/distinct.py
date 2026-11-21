import json,re,collections
exec(open('classify.py').read().split("eps=[]")[0])  # reuse stages/fcat/sig
def sig2(t):
    t=re.sub(r'\x1b\[[0-9;]*m','',t)
    ids=set(re.findall(r'([\w./()\[\]-]+\.(?:test|spec)\.tsx?)',t))
    ids|=set(m for m in re.findall(r'([\w./()\[\]-]+\.(?:tsx?|mjs|css|json))\(\d+,\d+\): error',t))
    ids|=set(re.findall(r'^([\w./()\[\]-]+\.(?:tsx?|css|json|mjs)) (?:format|lint|organizeImports|assist)',t,re.M))
    ids={i.split('/')[-1] for i in ids}
    return tuple(sorted(ids))
groups=collections.OrderedDict()
for x in sorted(o,key=lambda x:x['ts'] or ''):
    s=sig2(x['tail'])
    key=(x['proj'],s if s else ('nosig:'+re.sub(r'\s+',' ',x['tail'][40:200])[:80],))
    g=groups.setdefault(key,dict(proj=x['proj'],sig=key[1],events=0,sessions=set(),first=x['ts'],last=x['ts'],stages=set(),edits=collections.Counter(),foreign=0,sample=x['tail'][:3000],texts=[]))
    g['events']+=1; g['sessions'].add(x['file']); g['last']=x['ts']; g['stages']|=set(stages(x['tail'])); g['foreign']+=x['foreign']
    for e in x['edits']: g['edits'][fcat(e)]+=1
    g['texts']+=x['text'][:3]
res=[]
for k,g in groups.items():
    g['sessions']=len(g['sessions']); g['stages']=sorted(g['stages']); g['edits']=dict(g['edits']); res.append(g)
json.dump(res,open('distinct.json','w'))
print(len(res),collections.Counter(g['proj'] for g in res))
for g in res: print(g['proj'],g['first'][:10],g['events'],g['sessions'],g['stages'],g['edits'],g['foreign'],str(g['sig'])[:120])
