from pathlib import Path
import json,re,datetime,hashlib
p=Path('timeline-mc.md');t=p.read_text();lines=t.splitlines();count=0
for n,l in enumerate(lines,1):
 if not l.startswith('| '):continue
 if all(set(c.strip())<=set('-: ') for c in l.split('|')[1:-1]):continue
 if any(x in l for x in ['Fuente |','Fuentes |','Fuente (gz:']):continue
 assert re.search(r'`[^`]+:\d+`|@2026-',l),(n,l)
 count+=1
for r in json.loads(Path('report-sums.json').read_text()):
 snap=Path(r['snapshot']);j=json.loads(snap.read_text());actual=sum(g['duration_ms'] for g in j['subgates'])
 assert actual==r['sum_ms'];assert str(actual) in t
 assert hashlib.sha256(snap.read_bytes()).hexdigest()==r['sha256']
 print(r['at'],'stage sum',actual,'ms; no total field:',not any(k in j for k in ['total_ms','duration_ms']))
for line in lines:
 if any('| '+x+' |' in line for x in ['56fcd1f9','fa9b6462','cf9ec1f5']):
  cs=[c.strip() for c in line.split('|')[1:-1]]
  if len(cs)==7 and cs[3].isdigit():
   a=datetime.datetime.strptime(cs[1],'%Y-%m-%d %H:%M:%S %z');b=datetime.datetime.strptime(cs[2],'%Y-%m-%d %H:%M:%S %z');assert (b-a).total_seconds()==int(cs[3])
print('PASS',count,'table rows cited; report sums and 3 landing intervals verified')
