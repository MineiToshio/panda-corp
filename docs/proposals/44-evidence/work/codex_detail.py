import os,glob,json,re,sys
eps=json.load(open('codex_eps2.json'))
cand=[e for e in eps if e['src'] and e['pre'] and not e['env']]
seen=set(); cand2=[]
for e in cand:
    k=(e['sess'],tuple(e['fails']))
    if k in seen: continue
    seen.add(k); cand2.append(e)
print(len(cand),len(cand2))
paths={os.path.basename(f):f for f in glob.glob(os.path.expanduser('~/.codex/sessions/**/*.jsonl'),recursive=True)}
a,b=int(sys.argv[1]),int(sys.argv[2])
for e in cand2[a:b]:
    f=paths[e['sess']]
    lines=open(f,errors='ignore').read().split('\n')
    # find first failure output mentioning first failing file, then next assistant message
    tgt=e['fails'][0]; snip=''; msg=''
    for i,l in enumerate(lines):
        if ('custom_tool_call_output' in l or 'function_call_output' in l) and tgt in l and re.search(r'failed',l):
            s=l.replace('\\n','\n')
            m=[x.strip()[:170] for x in s.split('\n') if re.search(r'AssertionError|Expected|Received|expected|Error:|FAIL',x)]
            snip='\n      '.join(m[:5])
            for l2 in lines[i+1:i+80]:
                if '"agent_message"' in l2 or ('"role": "assistant"' in l2 and '"output_text"' in l2):
                    try:
                        d=json.loads(l2); t=json.dumps(d['payload'])
                        mm=re.search(r'"(?:message|text)": "([^"]{20,})',t)
                        if mm: msg=mm.group(1)[:400]; break
                    except: pass
            break
    print('###',e['proj'],e['sess'][8:27],'fails',e['fails'][:4],'src',[x.split('/')[-1] for x in e['src']][:5],'tests',[x.split('/')[-1] for x in e['tests']][:3])
    print('      '+snip); print('   >',msg)
