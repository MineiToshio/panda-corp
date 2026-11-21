import os,glob,json,re,collections
fs=sorted(glob.glob(os.path.expanduser('~/.codex/sessions/**/*.jsonl'),recursive=True))
failre=re.compile(r'(?:FAIL|✗|×)\s+\|?\w*\|?\s*([\w./()\[\]@-]+\.(?:test|spec)\.tsx?)')
pwre=re.compile(r'›\s+([\w./()\[\]@-]+\.spec\.ts):\d+')
editre=re.compile(r'\*\*\* (?:Update|Add) File: (\S+)')
eps=[]; nsess=0; projc=collections.Counter()
for f in fs:
    cwd=None; edited=[]; events=[]
    try:
        for l in open(f,errors='ignore'):
            if '"session_meta"' in l and cwd is None:
                try: cwd=json.loads(l)['payload'].get('cwd','')
                except: pass
            if '"custom_tool_call"' in l or '"function_call"' in l:
                for m in editre.finditer(l.replace('\\n','\n')): edited.append((len(events),m.group(1)))
            if 'custom_tool_call_output' in l or 'function_call_output' in l:
                s=l.replace('\\n','\n').replace('\\u203a','›').replace('\\u00d7','×').replace('\\u2717','✗')
                if re.search(r'Test Files\s+\d+ failed|\d+ failed\b',s):
                    fl=set(x.split('/')[-1] for x in failre.findall(s))|set(x.split('/')[-1] for x in pwre.findall(s))
                    if fl: events.append(dict(idx=len(events),fails=fl,edits_before=set(p.split('/')[-1] for _,p in edited),nedits=len(edited)))
                    else: events.append(dict(idx=len(events),fails=set(),edits_before=set(),nedits=len(edited)))
    except Exception as e: continue
    p='funko' if cwd and 'funko' in cwd else 'ppv2' if cwd and 'personal-page' in cwd else 'mc' if cwd and 'mission-control' in cwd else 'factory' if cwd and 'panda-corp' in cwd else 'other'
    nsess+=1; projc[p]+=1
    allpaths=[p2 for _,p2 in edited]
    for i,e in enumerate(events):
        if not e['fails']: continue
        later=[p2 for (k,p2) in edited if k>=0][e['nedits']:]
        pre=[x for x in e['fails'] if x not in e['edits_before']]
        eps.append(dict(sess=os.path.basename(f),proj=p,fails=sorted(e['fails']),preexisting=sorted(pre),
                        later_src=[x for x in later if '/src/' in x or x.startswith('src/') ] , later_test=[x for x in later if re.search(r'\.(test|spec)\.',x)]))
json.dump(eps,open('codex_eps.json','w'))
print('sessions',nsess,projc)
c=collections.Counter((e['proj'], bool(e['preexisting']), bool(e['later_src'] and not any(re.search(r'\.(test|spec)\.',x) for x in e['later_src'])) ) for e in eps)
print(len(eps)); 
for k,v in sorted(c.items()): print(k,v)
