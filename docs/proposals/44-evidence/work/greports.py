import json,sys,glob
for f in sys.argv[1:]:
    d=json.load(open(f))
    print('==',f.split('/')[-5] if 'panda-corp' not in f else 'MC', f.split('/')[-1][:8], {k:d[k] for k in d if k not in ('stages',)} if isinstance(d,dict) else '')
    for s in d.get('stages',[]) if isinstance(d,dict) else []:
        if s.get('status') not in ('pass','skip','passed','skipped'):
            print('   ',json.dumps(s)[:600])
