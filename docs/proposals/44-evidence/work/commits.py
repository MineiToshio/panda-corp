import subprocess,json,re,sys
def cat(path):
    p=path
    if re.search(r'(^|/)(_tests|__tests__|test|tests)/|\.test\.|\.spec\.|(^|/)e2e/',p): 
        if re.search(r'\.png$|-snapshots/',p): return 'baseline'
        return 'test'
    if re.search(r'\.png$|-snapshots/',p): return 'baseline'
    if p.startswith('src/'): return 'src'
    if re.search(r'^docs/|\.md$',p): return 'docs'
    if p.startswith('.pandacorp/'): return 'pandacorp'
    if re.search(r'^(content|public|data|messages)/',p): return 'content'
    return 'config'
def run(repo,prefix,out):
    args=['git','-C',repo,'log','--no-merges','--format=@@@%H|%ad|%s','--date=iso-strict','--name-only']
    if prefix: args+=['--',prefix]
    txt=subprocess.run(args,capture_output=True,text=True).stdout
    res=[]
    for blk in txt.split('@@@')[1:]:
        lines=blk.strip().split('\n'); h,d,s=lines[0].split('|',2)
        files=[l for l in lines[1:] if l.strip()]
        if prefix: files=[f[len(prefix)+1:] if f.startswith(prefix+'/') else '../'+f for f in files]
        cats={}
        for f in files: c=cat(f) if not f.startswith('../') else 'outside'; cats[c]=cats.get(c,0)+1
        res.append(dict(h=h[:10],d=d[:19],s=s,cats=cats,files=files[:40]))
    json.dump(res,open(out,'w'))
    print(repo,len(res))
run('/Users/Shared/Proyectos/funko-tracker',None,'funko.json')
run('/Users/Shared/Proyectos/personal-page-v2',None,'ppv2.json')
run('/Users/Shared/Proyectos/panda-corp','mission-control','mc.json')
