import glob,sys,re
for name in sys.argv[1:]:
    fs=glob.glob('/Users/Shared/Proyectos/**/.pandacorp/inbox/changes/**/'+name,recursive=True)
    for f in fs[:1]:
        s=open(f).read()
        body=s.split('---',2)[-1]
        body=re.sub(r'\n+','\n',body)
        print('#####',f.split('Proyectos/')[1]); print(body[:1100])
