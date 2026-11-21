import json, os, sys, time
roots = sys.argv[1:]
for root in roots:
    for dp, dns, fns in os.walk(root):
        dns[:] = [d for d in dns if d not in ('node_modules', '.next', '.git', 'test-results', '.next-fidelity')]
        if not dp.endswith('.pandacorp/run'):
            continue
        for name in ('green-stamp', 'gate-report.json'):
            p = os.path.join(dp, name)
            if not os.path.isfile(p):
                continue
            mt = time.strftime('%Y-%m-%d %H:%M', time.localtime(os.path.getmtime(p)))
            if name == 'green-stamp':
                print('STAMP', p, mt, open(p).read().replace('\n', ' '))
            else:
                try:
                    d = json.load(open(p))
                    tot = sum(g.get('duration_ms', 0) for g in d.get('subgates', [])) // 1000
                    names = ','.join(f"{g['name']}={g['exit']}" for g in d.get('subgates', []) if g.get('exit'))
                    print('REPORT', p, mt, d.get('at'), d.get('scope'), d.get('green'), f'{tot}s', names)
                except Exception as e:
                    print('REPORT-ERR', p, e)
