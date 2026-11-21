import os,re,glob
for p in ['/Users/Shared/Proyectos/funko-tracker','/Users/Shared/Proyectos/personal-page-v2','/Users/Shared/Proyectos/panda-corp/mission-control']:
    print('==',p)
    rows=[]
    for f in glob.glob(p+'/.pandacorp/inbox/changes/**/*.md',recursive=True):
        s=open(f,errors='ignore').read()
        m=re.search(r'^type:\s*"?(\w+)',s,re.M)
        if not m or m.group(1)!='bug': continue
        d=re.search(r'^date:\s*"?([\d-]+)',s,re.M); st=re.search(r'^status:\s*(\S+)',s,re.M); t=re.search(r'^# (.+)',s,re.M)
        cn=re.search(r'^closed_note:\s*"?(.{0,160})',s,re.M)
        rows.append((d.group(1) if d else '?',os.path.basename(f),st.group(1) if st else '?',t.group(1)[:110] if t else '', cn.group(1) if cn else ''))
    for r in sorted(rows): print(' | '.join(r))
