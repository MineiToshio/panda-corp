import os,glob,json,re,collections
fs=sorted(glob.glob(os.path.expanduser('~/.codex/sessions/**/*.jsonl'),recursive=True))
failre=re.compile(r'(?:FAIL|✗|×)\s+\|?\w*\|?\s*([\w./()\[\]@-]+\.(?:test|spec)\.tsx?)')
pwre=re.compile(r'›\s+([\w./()\[\]@-]+\.spec\.ts):\d+')
editre=re.compile(r'\*\*\* (?:Update|Add) File: (\S+)')
istest=lambda p: bool(re.search(r'\.(test|spec)\.|/_tests/|/e2e/|\.png$',p))
out=[]
for f in fs:
    cwd=''; seq=[]
    for l in open(f,errors='ignore'):
        if '"session_meta"' in l and not cwd:
            try: cwd=json.loads(l)['payload'].get('cwd','')
            except: pass
        if '"custom_tool_call"' in l or '"function_call"' in l:
            for m in editre.finditer(l.replace('\\n','\n')): seq.append(('E',m.group(1)))
            if 'vitest' in l or 'playwright' in l or 'verify.sh' in l: seq.append(('C',re.search(r'(verify\.sh[^"\\]{0,40}|vitest[^"\\]{0,60}|playwright[^"\\]{0,60})',l).group(1)))
        if 'custom_tool_call_output' in l or 'function_call_output' in l:
            s=l.replace('\\n','\n').replace('\\u203a','›').replace('\\u00d7','×').replace('\\u2717','✗')
            if re.search(r'Test Files\s+\d+ failed|\b\d+ failed\b',s):
                fl=set(x.split('/')[-1] for x in failre.findall(s))|set(x.split('/')[-1] for x in pwre.findall(s))
                to=bool(re.search(r'timed out|Timeout|EADDRINUSE|ECONNREFUSED|DATABASE_URL|EPERM',s))
                seq.append(('F',(fl,to,s[:0])))
    p='funko' if 'funko' in cwd else 'ppv2' if 'personal-page' in cwd else 'mc' if 'mission-control' in cwd else 'factory' if 'panda-corp' in cwd else 'other:'+cwd[:60]
    edited=set()
    for i,(k,v) in enumerate(seq):
        if k=='E': edited.add(v.split('/')[-1]); continue
        if k!='F' or not v[0]: continue
        nxt=[]
        for k2,v2 in seq[i+1:]:
            if k2=='F': break
            if k2=='E': nxt.append(v2)
        pre=sorted(x for x in v[0] if x not in edited)
        out.append(dict(sess=os.path.basename(f),proj=p,fails=sorted(v[0]),pre=pre,env=v[1],src=[x for x in nxt if not istest(x) and ('src/' in x or 'scripts/' in x)],tests=[x for x in nxt if istest(x)],other=[x for x in nxt if not istest(x) and not ('src/' in x or 'scripts/' in x)]))
json.dump(out,open('codex_eps2.json','w'))
c=collections.Counter()
for e in out:
    shape='src' if e['src'] and not e['tests'] else 'src+tests' if e['src'] else 'tests-only' if e['tests'] else 'other' if e['other'] else 'none'
    c[(e['proj'][:6],'pre' if e['pre'] else 'own-new','env' if e['env'] else '-',shape)]+=1
print(len(out))
for k,v in sorted(c.items()): print(k,v)
