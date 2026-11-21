import json,collections,sys
for p in sys.argv[1:]:
    f=p+'/.pandacorp/run/queue-log.jsonl'
    ev=collections.Counter(); rows=[json.loads(l) for l in open(f) if l.strip()]
    for d in rows: ev[d['event']]+=1
    print('==',p,len(rows),rows[0]['ts'],rows[-1]['ts']); print(ev)
    keys=collections.Counter()
    for d in rows:
        if d['event'] not in ('start','lock_wait','lock_acquired','lock_released'):
            print('  ',d['ts'][:16],d['event'],d.get('branch'),{k:v for k,v in d.items() if k not in ('v','attempt','ts','event','branch','project','pid','head')})
