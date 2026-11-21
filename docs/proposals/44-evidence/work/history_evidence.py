from pathlib import Path
import collections, json, re, subprocess
root = Path('/Users/Shared/Proyectos/panda-corp')
out = []
def emit(s=''):
    out.append(str(s))
emit('### Runtime inventory')
emit('Command: `python3 work/history_evidence.py` (JSON parse and line counts read directly from each project).')
for project in (root/'mission-control', root.parent/'funko-tracker', root.parent/'personal-page-v2'):
    emit(f'\n- {project.name}')
    for name in ('queue-log.jsonl','test-outcomes.jsonl','gate-report.json','green-stamp','gate-reports'):
        p = project/'.pandacorp/run'/name
        if not p.exists():
            emit(f'  - `{p}` missing')
        elif name.endswith('.jsonl'):
            rows = [x for x in p.read_text().splitlines() if x.strip()]
            parsed = []
            for row in rows:
                try:
                    parsed.append(json.loads(row))
                except ValueError:
                    pass
            keys = ', '.join(sorted({key for row in parsed if isinstance(row,dict) for key in row}))
            emit(f'  - `{p}` — MEASURED {len(rows)} nonblank rows, {len(parsed)} parseable. Keys: {keys}.')
        elif p.is_dir():
            emit(f'  - `{p}` — MEASURED {sum(1 for x in p.iterdir() if x.is_file())} direct files.')
        else:
            emit(f'  - `{p}` present.')
emit('\n### Memory and backlog cross-reference')
emit('The following catalog records whose triggers/titles match verification reliability or speed. Backlog status records the tracker disposition and is independent of measured production impact.')
pattern = re.compile(r'flak|^gate|verify|verification|\b(gate|tests?|baseline|playwright|vitest|canar(?:y|ies))\b', re.I)
idx = (root/'factory/memory/INDEX.md').read_text().splitlines()
active = {m.group(1): n for n,line in enumerate(idx,1) if (m:=re.match(r'- (LESSON-\d+)',line))}
for directory, mask, fields in [('factory/memory','LESSON-*.md',('created','status','trigger')), ('factory/backlog','BL-*.md',('filed','created','closed','status','title'))]:
    emit(f'\n**{directory}**\n')
    records = []
    for p in (root/directory).glob(mask):
        lines = p.read_text(errors='replace').splitlines()
        end = next((n for n,line in enumerate(lines[1:],1) if line=='---'),0)
        meta = {k:(n+1,v.strip(' "\'')) for n,line in enumerate(lines[:end]) if (m:=re.match(r'([\w-]+):\s*(.*)',line)) for k,v in [m.groups()]}
        key = 'trigger' if 'memory' in directory else 'title'
        if not pattern.search(meta.get(key,(0,''))[1] if 'memory' in directory else p.stem.replace('-',' ')+' '+meta.get(key,(0,''))[1]):
            continue
        date = meta.get('closed',(0,''))[1] or meta.get('filed',(0,''))[1] or meta.get('created',(0,''))[1]
        index = active.get(p.stem[:11])
        line = meta.get(key,meta.get('status',(1,'')))[0]
        description = ' · '.join(meta[k][1] for k in fields if meta.get(k,(0,''))[1])
        if index:
            description += f' · INDEX.md:{index}'
        records.append((date,p.name,f'- `{p.relative_to(root)}:{line}` — {description}'))
    for _,_,item in sorted(records):
        emit(item)
emit('\n### Proposal numbering check')
files = sorted(p.name for p in (root/'docs/proposals').iterdir() if re.match(r'^\d\d-',p.name))
emit(f'MEASURED largest prefix {max(int(x[:2]) for x in files)}. Recent entries: {", ".join(files[-5:])}.')
print('\n'.join(out))
