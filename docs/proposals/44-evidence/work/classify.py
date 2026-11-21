import json,re,collections
o=json.load(open('reds.json'))
o.sort(key=lambda x:(x['file'],x['ts'] or ''))
def stages(t):
    s=set()
    if re.search(r'error TS\d+',t): s.add('tsc')
    if re.search(r'Formatter would have printed|lint/|biome|Some errors were emitted while running checks',t): s.add('biome')
    if re.search(r'\bknip\b|Unused (files|exports|dependencies|types)',t): s.add('knip')
    if re.search(r'madge|Circular',t,re.I): s.add('madge')
    if re.search(r'Test Files .*failed|FAIL\s+\S+\.test\.|AssertionError|vitest',t): s.add('vitest')
    if re.search(r'toHaveScreenshot|matches baseline|snapshot|visual',t,re.I): s.add('pw-visual')
    if re.search(r'responsive|target-size|overflow',t,re.I) and re.search(r'\.spec\.ts',t): s.add('pw-responsive')
    if re.search(r'\.spec\.ts|playwright|\[desktop\]|\[mobile\]|\[chromium\]',t,re.I): s.add('playwright')
    if re.search(r'doc-lint|undescribed|\.env\.example',t): s.add('doc-lint')
    if re.search(r'NEEDS CLARIFICATION|residual-ambiguity',t): s.add('residual-ambiguity')
    if re.search(r'structure-guard|data-layer|api-error-contract|live-data-asserts',t): s.add('structure/data-guards')
    if re.search(r'EADDRINUSE|port .* in use|Cannot find module \'[^.]|ENOENT|ECONNREFUSED|Executable doesn\'t exist|lock|already running|webServer',t): s.add('env-signal')
    return s
def fcat(p):
    if not p: return 'none'
    if re.search(r'\.png$|-snapshots/',p): return 'baseline'
    if re.search(r'(^|/)(_tests|__tests__|tests?)/|\.test\.|\.spec\.|/e2e/',p): return 'test'
    if re.search(r'/\.pandacorp/|/docs/|\.md$',p): return 'docs/state'
    if '/src/' in p: return 'src'
    if '/.claude/' in p or '/scratchpad/' in p or '/tmp/' in p: return 'scratch'
    return 'config'
def sig(t):
    ids=re.findall(r'(\S+\.(?:test|spec)\.tsx?)',t)+re.findall(r'(\S+\.tsx?)\(\d+,\d+\): error',t)
    return tuple(sorted(set(ids)))[:6]
eps=[]
for x in o:
    st=stages(x['tail']); sg=sig(x['tail'])
    x['stages']=sorted(st); x['sig']=sg
    ec=collections.Counter(fcat(e) for e in x['edits'])
    x['ecats']=dict(ec)
    if eps and eps[-1]['file']==x['file'] and (eps[-1]['sig']==sg or not eps[-1]['ecats_total']):
        e=eps[-1]; e['n']+=1; e['ecats_total'].update(ec); e['edits']+=x['edits']; e['bash']+=x['bash']; e['text']+=x['text']; e['stages']=sorted(set(e['stages'])|st); e['last_ts']=x['ts']
        if x.get('human_after'): e['human_after']=x['human_after']
    else:
        e=dict(x); e['n']=1; e['ecats_total']=collections.Counter(ec); e['last_ts']=x['ts']; eps.append(e)
for e in eps: e['ecats_total']=dict(e['ecats_total'])
json.dump(eps,open('episodes.json','w'))
print('events',len(o),'episodes',len(eps), collections.Counter(e['proj'] for e in eps))
sc=collections.Counter()
for e in eps:
    for s in e['stages'] or ['unknown']: sc[(e['proj'],s)]+=1
for k,v in sorted(sc.items()): print(k,v)
shape=collections.Counter()
for e in eps:
    t=e['ecats_total']
    shape[('src' if t.get('src') else 'test/baseline-only' if (t.get('test') or t.get('baseline')) and not t.get('src') else 'other-edits' if t else 'no-edits')]+=1
print(shape)
print('foreign',sum(e['foreign'] for e in eps))
