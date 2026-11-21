import os,sys,glob
root=os.path.expanduser('~/.claude/projects')
pats=sys.argv[1:]
res={p:[0,0] for p in pats}
for d in os.listdir(root):
    if not any(k in d for k in ('funko-tracker','personal-page-v2','panda-corp')): continue
    for f in glob.glob(os.path.join(root,d,'*.jsonl')):
        try: s=open(f,errors='ignore').read()
        except: continue
        for p in pats:
            c=s.count(p)
            if c: res[p][0]+=1; res[p][1]+=c
for p,v in res.items(): print(repr(p),'files',v[0],'hits',v[1])
