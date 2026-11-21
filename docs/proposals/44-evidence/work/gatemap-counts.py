import collections, hashlib, json, pathlib, re, statistics, subprocess
base=pathlib.Path('/Users/Shared/Proyectos')
factory=base/'panda-corp'
projects=[factory/'mission-control',base/'funko-tracker',base/'personal-page-v2']
def read(p): return p.read_text(errors='replace')
def lines(p): return len(p.read_bytes().splitlines())
def fields(files, pat): return sum(len(re.findall(pat, read(p))) for p in files)
scripts={'verify.sh':'stack-a-nextjs/verify.sh', **{n:'shared/.pandacorp/'+n for n in ('merge-queue.sh','with-merge-lock.sh','green-stamp.sh','change-reconcile.mjs','session-cleanup.sh','doc-lint.sh','test-gate-policy.mjs')}}
scripts.update({n:'stack-a-nextjs/'+n for n in ('canary.sh','vitest-policy.ts')})

for name, rel in scripts.items():
    paths=[factory/'plugin/templates'/rel]+[p/'.pandacorp'/name for p in projects]
    print(name, [(lines(p),hashlib.sha256(p.read_bytes()).hexdigest()[:12]) if p.exists() else '-' for p in paths])
v=read(projects[0]/'.pandacorp/verify.sh')
known=re.search(r'^KNOWN_GATES="(.*?)"',v,re.M).group(1).split()
calls=re.findall(r'^\s*(?:run_cheap_gate|run_gate) ([a-z][a-z-]+) ',v,re.M)
print('Stage selection',len(known), 'fixed calls',len(calls),'unique',len(set(calls)),sorted(set(calls)), 'runtime policy rows vitest-policy/playwright-policy via record_gate_result')
rulefiles=sorted((projects[0]/'docs/rules').glob('*.md'))
for p in rulefiles:
    print('rule',p.name,fields([p],r'\bMUST\b'),fields([p],r'\bNEVER\b'),sum(bool(re.search(r'\b(?:MUST|NEVER)\b',l)) for l in read(p).splitlines()))
print('rule totals',len(rulefiles),fields(rulefiles,r'\bMUST\b'),fields(rulefiles,r'\bNEVER\b'),sum(bool(re.search(r'\b(?:MUST|NEVER)\b',l)) for p in rulefiles for l in read(p).splitlines()))
ids='003 004 006 015 016 017 019 023 027 028 038 040 046 048 050 051 052 054 055 056 059 062 063 065 067 070 071 072 073 074 075 076 077 079 080 085 088 090 091 093 094 096 097 099 100 102 104 105 106 107 108 112 116 117 118 122 124 125 130 131 138 140 141 143 144 146 152 158 159 161 162 164 165'.split()
dr=re.findall(r'^  - id: DR-(\d+)',read(factory/'factory/decisions/registry.yaml'),re.M)
assert set(ids)<=set(dr)
print('DR selected',len(ids),'registry',len(dr),' '.join('DR-'+x for x in ids))
spec=re.compile(r'\.(test|spec)\.[cm]?[jt]sx?$')
src_ext={'.ts','.tsx','.js','.jsx','.mts','.cts','.mjs','.cjs','.css','.scss','.sass','.less','.json','.md','.mdx','.html','.sql','.graphql','.gql','.py','.yaml','.yml'}
for p in projects:
    listing=subprocess.check_output(['git','-C',str(p),'ls-files','--cached','--others','--exclude-standard','-z','--','.'])
    files=sorted({p/x.decode() for x in listing.split(b'\x00') if x and (p/x.decode()).is_file()})
    src=[f for f in files if f.relative_to(p).parts[0]=='src' and f.suffix in src_ext]
    tests=[f for f in files if spec.search(f.name) and f.relative_to(p).parts[0] not in {'e2e','.claude','.pandacorp','.ops'} and (p.name!='funko-tracker' or f.relative_to(p).parts[0]!='docs') and (p.name!='mission-control' or (f.suffix in {'.ts','.tsx'} and f.relative_to(p).parts[0]!='prototype'))]
    pw=[f for f in files if spec.search(f.name) and f.relative_to(p).parts[0]=='e2e']
    baselines=[f for f in files if f.relative_to(p).parts[0]=='e2e' and f.suffix.lower() in {'.png','.jpg','.jpeg','.webp'} and any(a.endswith('-snapshots') for a in f.parts)]
    count_pat=r'\b(?:it|test)\s*\('
    non_test=[f for f in src if f not in tests and not any(a in {'_tests','__tests__','test','tests','__fixtures__'} for a in f.relative_to(p).parts[:-1])]
    print(p.name,'vitest',len(tests),fields(tests,count_pat),'with modifiers', fields(tests,r'\b(?:it|test)(?:\.(?:each|skip|todo|only|concurrent|sequential|fails|extend|skipIf|runIf))*\s*\('),'PW',len(pw),'baselines',len(baselines),'visual.spec baselines',sum('visual.spec.ts-snapshots' in f.parts for f in baselines),'unitLOC',sum(map(lines,tests)),'pwLOC',sum(map(lines,pw)),'srcLOC',sum(map(lines,src)),'non-test srcLOC',sum(map(lines,non_test)))
    print('suite paths',collections.Counter(f.relative_to(p).parts[0] for f in tests),'baseline dirs',collections.Counter(f.parent.name for f in baselines))
    run=p/'.pandacorp/run'
    for n in ('queue-log.jsonl','test-outcomes.jsonl'):
        rows=[json.loads(l) for l in read(run/n).splitlines() if l.strip()]
        print(n,len(rows),collections.Counter(x.get('event',x.get('status')) for x in rows),'samples',[(x.get('event'),x.get('result'),x.get('duration_s'),x.get('ts',x.get('at'))) for x in rows[-2:]])
    for group, fs in [('archive',sorted((run/'gate-reports').glob('*.json'))),('latest',[run/'gate-report.json'])]:
        rs=[]
        for f in fs:
            try: rs.append((f,json.loads(read(f))))
            except (OSError, ValueError) as e: print(group, f.name, 'unavailable:', type(e).__name__)
        print(group,[(f.name,x.get('scope'),x.get('exit'),len(x.get('subgates',[]))) for f,x in rs])
        g=collections.defaultdict(list)
        for f,x in rs:
            for a in x.get('subgates',[]):
                if a.get('exit')==0: g[a['name']].append(a['duration_ms'])
        print('subgate success n,median,min,max ms', {k:(len(v),statistics.median(v),min(v),max(v)) for k,v in g.items()})
events=pathlib.Path.home()/'.claude/dashboard-events.ndjson'
if events.exists():
    g=collections.defaultdict(list)
    for line in events.open():
        if '"StopGate"' not in line:continue
        try: x=json.loads(line)
        except ValueError:continue
        if x.get('event')=='StopGate' and isinstance(x.get('duration_ms'),int) and x.get('project') in {p.name for p in projects}:
            g[(x['project'],x.get('scope'),x.get('green'))].append(x['duration_ms'])
    print('StopGate n,median,min,max ms', {str(k):(len(v),statistics.median(v),min(v),max(v)) for k,v in g.items()})
