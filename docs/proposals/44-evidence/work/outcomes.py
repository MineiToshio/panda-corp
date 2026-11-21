import json,collections,sys
for p in sys.argv[1:]:
    f=p+'/.pandacorp/run/test-outcomes.jsonl'
    st=collections.Counter(); runners=collections.Counter(); fails=[]; trees=collections.defaultdict(lambda: collections.defaultdict(set)); attempts=set(); ts=[]
    for l in open(f):
        d=json.loads(l); st[(d['runner'],d['status'])]+=1; attempts.add(d['attempt']); ts.append(d['ts'])
        trees[(d['tree'],d['test_id'])][d['status']].add(d['attempt'])
        if d['status'] not in ('passed','skipped','pending','todo'):
            fails.append(d)
    print('==',p, 'rows',sum(st.values()),'attempts',len(attempts),'range',min(ts),max(ts))
    print(st)
    fa=collections.defaultdict(list)
    for d in fails: fa[(d['attempt'],d['tree'][:10],d['ts'][:16])].append((d['runner'],d['status'],d['test_id'][:150]))
    for k,v in sorted(fa.items(), key=lambda x:x[0][2]):
        print(' ',k,len(v))
        for x in v[:6]: print('    ',x)
    flaky=[k for k,v in trees.items() if 'passed' in v and ('failed' in v or 'timedOut' in v)]
    print(' same-tree pass+fail:',len(flaky))
    for k in flaky[:20]: print('    ',k[0][:10],k[1][:140])
