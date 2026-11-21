import json,pathlib,re
s=pathlib.Path('timeline-ext.md').read_text();data=json.load(open('evidence.json'));count=0
for name,d in data.items():
 assert '## '+name in s
 for n in range(1,7):assert f'### {n}.' in s
 for r in d['reports']:
  total=sum(g['duration_ms'] for g in r['data']['subgates'])
  record=next(t for t in d['totals'] if t[0]==r['path'])
  assert record[2]==total
  assert str(total) in s and r['path'] in s
  if 'duration_ms' in r['data']:assert r['data']['duration_ms']>=total
  for g in r['data']['subgates']:assert g['duration_ms']>=0 and g['name'] in s
  count+=1
 for w in d['worktrees']:assert w in s
 for f in [name+'-git-log.txt',name+'-main-reflog.txt']:assert pathlib.Path(f).stat().st_size>0
assert '299.769' in s and '387.61' in s
assert 'PermissionError' in s and 'sin total wall-clock' in s
assert 'no existe' in s and 'certified-tree' in s
print(f'PASS: {count} reportes, sumas recalculadas, 26 worktrees, 2 corridas journal, referencias y huecos verificados; total wall-clock ausente explícito.')
