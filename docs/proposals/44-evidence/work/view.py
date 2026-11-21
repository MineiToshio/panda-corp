import json,re,sys
g=json.load(open('distinct.json'))
a,b=int(sys.argv[1]),int(sys.argv[2])
pat=re.compile(r'error TS|AssertionError|Expected|Received|expected|FAIL|failed|Error:|×|✗|Unused|Circular|toHave|Timeout|timed out|not found|ENOENT|EADDRINUSE|ECONNREFUSED|Cannot|›|status\.yaml|undescribed',re.I)
for i,x in enumerate(g[a:b],a):
    t=re.sub(r'\x1b\[[0-9;]*m','',x['sample'])
    lines=[l.strip()[:170] for l in t.split('\n') if pat.search(l)]
    print(f"### {i} {x['proj']} {x['first'][:10]} ev={x['events']} sess={x['sessions']} st={x['stages']} edits={x['edits']} foreign={x['foreign']}")
    lines=[l for l in lines if "carries key" not in l]
    for l in lines[:4]: print('   |',l)
    for tx in x['texts'][:2]: print('   >',tx[:200].replace('\n',' '))
