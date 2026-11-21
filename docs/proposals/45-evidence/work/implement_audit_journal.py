import json, re, collections
from pathlib import Path
f=Path('/Users/Shared/Proyectos/funko-tracker')
roots=[f/'.pandacorp/run',*(f/'.claude/worktrees').glob('*/.pandacorp/run')]
files=sorted({p for root in roots for sub in ('build','build-archive','build-suspended') for p in [root/sub/'journal.jsonl',*(root/sub).glob('*/journal.jsonl')] if p.is_file()})
interesting='run_started run_resumed run_stopped run_finished unit_queued unit_dispatched report_received review_recorded gate technical_failure rescue_started rescue_stage scope_repair_approved engine_failure unit_abandoned handback doubt_opened answer_recorded parked waiting_gate quota_reading capacity_state patch'.split()
for path in files:
 rows=[json.loads(s) for s in path.open()]
 print('\n##',rows[0]['run_id'],path)
 repeated=collections.Counter()
 for i,r in enumerate(rows,1):
  d=r['data']; kind=r['type']
  if kind not in interesting:continue
  if kind=='gate' and not d.get('exit'):
   key=(d.get('tier'), d.get('sha'))
   repeated[key]+=1
   if repeated[key]>1: continue
  if kind=='run_started':
   detect=d.get('detect',{}); sig=detect.get('signals',{})
   d={k:v for k,v in d.items() if k!='detect'}|{'mode':detect.get('case'),'scope':sig.get('args'),'cards':[(c.get('slug'),c.get('status')) for c in sig.get('cards',[])]}
  if kind in ('unit_dispatched','unit_queued','report_received'):
   d={k:d.get(k) for k in ('unit','id','kind','wos','role','cell','via','resume','outcome','reason','detail','report_type','attempt') if d.get(k) is not None}
  if kind=='technical_failure' and 'cause' in d:
   try:
    cause=json.loads(d['cause'])
    if len(cause)>3 and isinstance(cause[2],list): cause[2]=f'{len(cause[2])} files'
    d=d|{'cause':cause}
   except (ValueError,TypeError):pass
  print(f'{i:3} {r["at"][11:23]} {kind:22}',str(d)[:850])
 print('repeat:',repeated)
