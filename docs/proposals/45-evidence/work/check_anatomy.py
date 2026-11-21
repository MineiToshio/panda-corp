from collections import Counter
from pathlib import Path
import json
import re
import subprocess

dir = Path.cwd()
root = Path('/Users/Shared/Proyectos')
p = root/'panda-corp'
f = root/'funko-tracker'
audit = (dir/'audit/anatomy.md').read_text()
main = audit.split('## Appendix A.',1)[0]
runtime = p/'plugin/runtime/build'
fr = f/'.pandacorp/run'
mapping = {
    'R':runtime, 'SK':p/'plugin/skills/implement',
    'CLI':p/'plugin/scripts/pandacorp-build.mjs',
    'MQ':p/'plugin/templates/shared/.pandacorp/merge-queue.sh',
    'V':p/'plugin/templates/stack-a-nextjs/verify.sh',
    'F':f, 'FR':fr, 'J1':fr/'build/journal.jsonl',
    'J2':f/'.claude/worktrees/catalog-line-scope/.pandacorp/run/build/journal.jsonl',
    'N16':fr/'build-archive/br-2026-11-16-01/journal.jsonl',
    'N14':fr/'build-suspended/br-2026-11-14-01/journal.jsonl',
    'N13':fr/'build-suspended/br-2026-11-13-02/journal.jsonl',
    'EJ':f/'.claude/worktrees/eloquent-nash-b37282/.pandacorp/run/build/journal.jsonl',
    'PJ':f/'.claude/worktrees/pensive-wing-dad871/.pandacorp/run/build/journal.jsonl',
}

assert [int(x) for x in re.findall(r'^(\d+)\. \*\*',main,re.M)]==list(range(1,19))
assert [int(x) for x in re.findall(r'^\| (\d+) \|',main,re.M)]==list(range(1,11))
assert all(f'## {n}.' in main for n in range(1,8))
assert audit.count('## Appendix A.')==1
assert audit.count('## Appendix B.')==1
assert not any(s.count(chr(96))%2 for s in main.splitlines())
assert not re.search(r'(?mi)^token:\s*[0-9a-f]{32,}$',audit)
assert 'schema, unit, token, status, summary, files, verification, pending, doubt, diagnosis, gate, authored_by' in main
assert 'contract, contract_class, status and tests' in main

line_count=0
paths=set()
warnings=[]
for ma in re.finditer(r'\x60([^\x60\n]+):(\d+(?:[–-]\d+)?(?:\s*,\s*\d+(?:[–-]\d+)?)*)\x60',main):
    path, nums = ma.groups()
    if path.startswith('/'):
        q=Path(path)
    elif path in mapping:
        q=mapping[path]
    elif '/' in path and path.split('/',1)[0] in mapping:
        alias, rel=path.split('/',1)
        q=mapping[alias]/rel
    elif any(path.startswith(s) for s in ('plugin/','factory/','docs/')):
        q=p/path
    else:
        continue
    if not q.is_file():
        warnings.append((path, nums, 'missing path'))
        continue
    total=len(q.read_bytes().splitlines())
    paths.add(q)
    if any(int(i)>total or int(i)<1 for i in re.findall(r'\d+',nums)):
        warnings.append((path,nums,f'file lines {total}'))
    line_count+=1
for path,nums,why in warnings:
    print('citation:',path,nums,why)
assert not warnings
print(f'artifact headings 7/7, sequence 18/18, ranked items 10/10, {line_count} line citations within range across {len(paths)} source/log files')

fences=Counter()
inside=None
for line in audit.splitlines():
    m=re.match(r'^(~{4,})([A-Za-z]+)?$',line)
    if not m:
        continue
    delim,lang=m.groups()
    if inside is None:
        assert lang
        inside=delim
        fences[lang]+=1
    elif delim==inside and not lang:
        inside=None
assert inside is None
assert fences['markdown']>=10 and fences['json']==2 and fences['diff']==1
print('appendix fences balanced;',sum(fences.values()),'literal blocks; no unmasked token fields in the audit')

def git(*args):
    return subprocess.check_output(['git','-C',str(p),*args],text=True).strip()
assert git('rev-parse','HEAD').startswith('3105fd55')
assert len(list(runtime.rglob('*.mjs')))==166
assert sum(len(path.read_text().splitlines()) for path in runtime.rglob('*.mjs'))==19371
assert len(list((runtime/'schemas').glob('*.json')))==14
assert git('rev-list','--count','HEAD','--since=2026-09-23T00:00:00-05:00','--until=2026-11-22T00:00:00-05:00','--','plugin/runtime/build','plugin/skills/implement')=='104'
print('independent source/Git count checks: 166 modules, 19,371 lines, 14 schemas, 104 commits')

run_paths=[fr/'build/journal.jsonl',*sorted((fr/'build-archive').glob('*/journal.jsonl')),*sorted((fr/'build-suspended').glob('*/journal.jsonl')),*sorted((f/'.claude/worktrees').glob('*/.pandacorp/run/build/journal.jsonl'))]
rows=[json.loads(line) for path in run_paths for line in path.open()]
counts=Counter(r['type'] for r in rows)
assert (len(run_paths),len(rows),counts['unit_dispatched'],counts['batch_landed'])==(8,939,59,0)
assert 'Invalid schema for response_format' in main
pattern="Invalid schema for response_format 'codex_output_schema': At schema path /properties/schema, schema must specify a type"
incident=list((fr/'codex-workers').glob('w-br-2026-11-21-01-u-tests-wo-06-010-*/codex.log'))
assert len(incident)==2 and all(pattern in path.read_text() for path in incident)
assert json.loads(git('show','3105fd55^:plugin/runtime/build/schemas/report.schema.json'))['properties']['schema']=={'const':1}
assert json.loads(git('show','3105fd55:plugin/runtime/build/schemas/report.schema.json'))['properties']['schema']=={'const':1,'type':'integer'}
print('incident and sample checks: 2 exact error logs, exact parent/patch node, 939 events across 8 journals, 59 dispatches, 0 batch-landed')
