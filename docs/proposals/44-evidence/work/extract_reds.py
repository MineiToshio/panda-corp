import os,glob,json,re,collections
root=os.path.expanduser('~/.claude/projects')
out=[]
def proj_of(d):
    if 'funko-tracker' in d: return 'funko'
    if 'personal-page-v2' in d: return 'ppv2'
    if 'mission-control' in d: return 'mc'
    if 'panda-corp' in d: return 'factory'
    return None
def text_of(msg):
    c=msg.get('content')
    if isinstance(c,str): return c
    t=[]
    for x in c or []:
        if isinstance(x,dict):
            if x.get('type')=='text': t.append(x.get('text',''))
            elif x.get('type')=='tool_result':
                cc=x.get('content')
                if isinstance(cc,str): t.append(cc)
                elif isinstance(cc,list): t+= [y.get('text','') for y in cc if isinstance(y,dict)]
    return '\n'.join(t)
for d in sorted(os.listdir(root)):
    p=proj_of(d)
    if not p: continue
    for f in glob.glob(os.path.join(root,d,'*.jsonl')):
        recs=[]
        for line in open(f,errors='ignore'):
            try: recs.append(json.loads(line))
            except: pass
        cur=None
        for r in recs:
            if r.get('type')=='user' and isinstance(r.get('message'),dict):
                t=text_of(r['message'])
                if t.startswith('Stop hook feedback') and 'verify gate FAILED' in t:
                    if cur: out.append(cur)
                    i=t.find('--- verify.sh output')
                    cur=dict(proj=p,dir=d,file=os.path.basename(f),ts=r.get('timestamp'),cwd=r.get('cwd'),branch=r.get('gitBranch'),
                             head=t[:400],tail=t[i:i+6000] if i>=0 else t[:6000],edits=[],bash=[],text=[],foreign=('foreign' in t.lower()))
                    continue
                elif t.startswith('Stop hook feedback') and cur:
                    out.append(cur); cur=None; continue
                elif cur and r.get('type')=='user' and not r.get('isMeta') and isinstance(r['message'].get('content'),str) and not t.startswith('<'):
                    # human prompt ends episode
                    cur['human_after']=t[:300]; out.append(cur); cur=None; continue
            if cur and r.get('type')=='assistant':
                for x in r['message'].get('content') or []:
                    if not isinstance(x,dict): continue
                    if x.get('type')=='tool_use':
                        inp=x.get('input',{})
                        if x['name'] in ('Edit','Write','MultiEdit','NotebookEdit'): cur['edits'].append(inp.get('file_path'))
                        elif x['name']=='Bash': cur['bash'].append(inp.get('command','')[:300])
                    elif x.get('type')=='text' and len(cur['text'])<12:
                        cur['text'].append(x['text'][:600])
        if cur: out.append(cur)
json.dump(out,open('reds.json','w'))
c=collections.Counter(o['proj'] for o in out); print(len(out),c)
