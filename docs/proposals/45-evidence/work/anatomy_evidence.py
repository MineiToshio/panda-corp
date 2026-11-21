from collections import Counter
from datetime import datetime, timedelta
from hashlib import sha256
from pathlib import Path
import json
import re
import subprocess

P = Path('/Users/Shared/Proyectos/panda-corp')
F = P.parent / 'funko-tracker'
R = P / 'plugin/runtime/build'
Q = F / '.pandacorp/run'
S = Path.cwd()
cut = datetime.fromisoformat('2026-11-22T00:00:00-05:00')
start = cut - timedelta(days=60)

def git(*args, repo=P):
    return subprocess.check_output(['git', '-C', str(repo), *args], text=True)

def lines(s):
    return len(s.splitlines())

def src(path, base=P):
    return str(path.relative_to(base))

def fence(content, lang=''):
    delim = '~' * max(4, max((len(m[0])+1 for m in re.finditer(r'~{3,}', content)), default=4))
    return f'{delim}{lang}\n{content.rstrip()}\n{delim}\n'

def md_table(headings, rows):
    return '\n'.join([
        '| ' + ' | '.join(headings) + ' |',
        '| ' + ' | '.join(['---'] * len(headings)) + ' |',
        *['| ' + ' | '.join(str(c).replace('|', r'\|').replace('\n',' ') for c in row) + ' |' for row in rows],
    ]) + '\n'

def changes(paths, since=start, until=cut):
    command = ('log', 'HEAD', f'--since={since.isoformat()}', f'--until={until.isoformat()}',
               '--format=%h%x09%cs%x09%s', '--', *paths)
    out = [tuple(row.split('\t', 2)) for row in git(*command).splitlines()]
    return 'git ' + ' '.join(command), out

buildpath = 'plugin/runtime/build'
skillpath = 'plugin/skills/implement'
cli = P / 'plugin/scripts/pandacorp-build.mjs'
version = 'plugin/runtime/plugin-metadata.json'
manifest = 'plugin/.claude-plugin/plugin.json'
overlay = 'plugin/templates/OVERLAY_VERSION'
metrics = [
    '## Appendix A. Source, Git, schema and log measurements',
    'All counts in this appendix are **MEASURED**, except token estimates. Source ranges are from the checked-out factory at HEAD ' + git('rev-parse','HEAD').strip() + '.',
]
runtime = sorted(R.rglob('*.mjs'))
schemas = sorted((R/'schemas').glob('*.schema.json'))
skills = sorted((P/skillpath).rglob('*.md'))
metrics.append('### A1. Line counts and churn')
metrics.append(f'Physical lines via Python splitlines: {len(runtime)} build runtime modules, {sum(lines(f.read_text()) for f in runtime):,} lines; {len(schemas)} build schemas, {sum(lines(f.read_text()) for f in schemas):,} lines; CLI {lines(cli.read_text()):,} lines; {len(skills)} implement skill + reference Markdown files, {sum(lines(f.read_text()) for f in skills):,} lines. Runtime boundary excludes the CLI, shared capacity, build-state, worker launcher, queue, verifier and tests.')
metrics.append(md_table(['Module group under plugin/runtime/build', 'Files', 'Physical lines'], [(g, len(group), sum(lines(f.read_text()) for f in group)) for g in ['(root)', *sorted({f.parent.name for f in runtime if f.parent != R})] for group in [[f for f in runtime if (f.parent.name if f.parent != R else '(root)') == g]]]))
metrics.append('Per-file physical lines (Path.rglob, read_text().splitlines()):\n\n'+fence('\n'.join(f'{lines(p.read_text()):5} {src(p)}' for p in [cli, *runtime, *schemas, *skills]), 'text'))

scopes = [
    ('Runtime', (buildpath,)),
    ('Implement skill', (skillpath,)),
    ('Runtime ∪ skill', (buildpath, skillpath)),
    ('Runtime ∪ skill ∪ CLI', (buildpath, skillpath, src(cli))),
    ('Entire plugin', ('plugin',)),
]
rows = []
commands = []
for label, paths in scopes:
    command, data = changes(paths)
    commands.append(command)
    rows.append((label, len(data), sum(s.startswith('fix(build):') for _,_,s in data),
                 sum(s.startswith('fix(plugin):') for _,_,s in data), sum(bool(re.match(r'^fix\([^)]+\)!?:', s)) for _,_,s in data),
                 sum(s.startswith('Merge ') for _,_,s in data)))
metrics.append('Sixty Lima calendar dates ending Nov 21 inclusive. HEAD ancestry, default Git path-history simplification, committer-date filters, distinct subjects counted per commit (exact prefixes shown; Merge is subject-based).')
metrics.append(md_table(['Path scope','Commits','fix(build):','fix(plugin):','All fix(scopes)','Merge subjects'], rows))
metrics.append(fence('\n'.join(commands), 'text'))
halves = []
for low, high in [(start, start+timedelta(days=30)),(start+timedelta(days=30),cut)]:
    command, data = changes((buildpath, skillpath), low, high)
    halves.append((low.date(), (high-timedelta(days=1)).date(),len(data),sum(s.startswith('fix(') for _,_,s in data),command))
metrics.append(md_table(['Start','End','Union commits','fix( subjects'], [v[:4] for v in halves]))
metrics.append(fence('\n'.join(v[4] for v in halves), 'text'))
baseline = git('rev-list','-1',f'--before={start.isoformat()}','HEAD').strip()
for ref in [baseline,'1ba7d1c6','HEAD']:
    paths = [p for p in git('ls-tree','-r','--name-only',ref,'--',buildpath).splitlines() if p.endswith('.mjs')]
    count = sum(lines(git('show',f'{ref}:{p}')) for p in paths)
    metrics.append(f'git ls-tree -r --name-only {ref} -- {buildpath} and git show {ref}:<path> → {len(paths)} modules and {count:,} physical lines.')
for kind, path in [('Plugin canonical metadata', version), ('Installed manifest source',manifest),('Overlay',overlay)]:
    def read(ref):
        t = git('show', f'{ref}:{path}')
        return (json.loads(t)['version'] if t.startswith('{') else t.strip())
    cmd, data = changes((path,))
    deltas = []
    for sha,date,subject in data:
        after,before = read(sha),read(sha+'^1')
        if after != before: deltas.append((sha,date,before,after,subject))
    metrics.append(f'{kind}, {path}: {read(baseline)} → {read("HEAD")}. {len(data)} path-history commits, {len(deltas)} first-parent-relative version changes, {len({v[3] for v in deltas})} distinct resulting versions. This can include branch versions and non-increasing changes. Command: {cmd}, then git show <sha>^1:{path} and git show <sha>:{path}.')
    if kind != 'Installed manifest source':
        metrics.append(fence('\n'.join(f'{sha} {date} {before} → {after} {subject}' for sha,date,before,after,subject in deltas),'text'))

def enum(d, path):
    for k in path.split('.'):
        d = d[k]
    return d['enum']

state = json.loads((R/'schemas/state.schema.json').read_text())
journal = json.loads((R/'schemas/journal-event.schema.json').read_text())
metrics.append('### A2. Exact CLI, machine state and schema inventory')
text = cli.read_text()
command, modes = [re.findall(r'^  (?:"([^"]+)"|([\w-]+)):', text.split(f'const {n} = Object.freeze({{\n',1)[1].split('\n});',1)[0],re.M) for n in ('COMMANDS','START_MODES')]
cmds = [a or b for a,b in command]
starts = [a or b for a,b in modes]
metrics.append(f'{src(cli)}:44–88,373–415: {len(cmds)+1} top-level commands, including start; {len(starts)} start modes; {len(cmds)+len(starts)} help rows, excluding help itself. Expanding card/doubt/quota gives {len(cmds)+len(starts)+2} callable variants, or {len(cmds)+len(starts)+3} with the explicit drive --standby submode counted separately.')
metrics.append('Top-level: start, ' + ', '.join(cmds) + '. Start: ' + ', '.join('--'+v for v in starts) + '.')
for label,p in [('run.status','properties.status'),('unit.state','properties.units.items.properties.state'),('unit.kind','properties.units.items.properties.kind'),('job.state','properties.jobs.items.properties.state'),('job.kind','properties.jobs.items.properties.kind'),('landing_state','properties.landing_state'),('coordinator','properties.coordinator')]:
    e=enum(state,p)
    metrics.append(f'- {label}: **{len(e)}** · '+', '.join(e)+'.')
metrics.append(f'- Total run + unit + job state entries: **{sum(len(enum(state,p)) for p in ("properties.status","properties.units.items.properties.state","properties.jobs.items.properties.state"))}**. Landing projection and enum values for kind/coordinator are separate axes.')
jt=enum(journal,'properties.type')
metrics.append(f'- Journal event types: **{len(jt)}** · '+', '.join(jt)+'. Schema plugin/runtime/build/schemas/journal-event.schema.json:29–74; persisted event types need not all fire on one run.')
outnames={'report','review-report','rescue-report','doubt-answer'}

def required(d, p=''):
    ret=[]
    if isinstance(d,dict):
        if 'required' in d: ret.append((p or '/', ', '.join(d['required'])))
        for k,v in d.items(): ret.extend(required(v,f'{p}/{k}'))
    if isinstance(d,list):
        for i,v in enumerate(d): ret.extend(required(v,f'{p}/{i}'))
    return ret

def untyped(d,p=''):
    out=[]
    if isinstance(d,dict):
        if ('const' in d or 'enum' in d) and 'type' not in d: out.append(p or '/')
        for k,v in d.items(): out.extend(untyped(v,f'{p}/{k}'))
    if isinstance(d,list):
        for i,v in enumerate(d): out.extend(untyped(v,f'{p}/{i}'))
    return out

metrics.append(f'{len(schemas)} files in the build schema directory, {len(outnames)} structured output schemas on the CLI-worker routes. File inventory in A1. Required keys of all four output files (JSON Pointers are structural, disjunction paths are conditional):')
rows=[]
for n in sorted(outnames):
    p=R/'schemas'/f'{n}.schema.json'
    rows.extend((n,key,value) for key,value in required(json.loads(p.read_text())))
metrics.append(md_table(['Schema','Object location','Required fields'],rows))
rows=[]
for n in sorted(outnames):
    p=R/'schemas'/f'{n}.schema.json'
    before=json.loads(git('show',f'3105fd55^:{src(p)}'))
    after=json.loads(git('show',f'3105fd55:{src(p)}'))
    rows.append((n,len(untyped(before)),len(untyped(after)),', '.join(untyped(before))))
metrics.append('Independent recursive const/enum node inspection of git show 3105fd55^:<schema> and git show 3105fd55:<schema>:')
metrics.append(md_table(['Schema','Parent untyped','Patch untyped','Parent JSON pointers'],rows))

metrics.append('### A3. Journal sample and chain integrity')
jpaths = sorted(set((Q/'build-archive').glob('*/journal.jsonl')) | set((Q/'build-suspended').glob('*/journal.jsonl')) | {Q/'build/journal.jsonl'} | set((F/'.claude/worktrees').glob('*/.pandacorp/run/build/journal.jsonl')))
evidence = re.compile(r'reject|handback|rescue|abandon|handoff|takeover|waiting|unblock|suspend|watchdog|engine_failure|stale|conflict|orphan|batch_landed')
rows=[]
ledger=[]
assert len(jpaths) >= 6
for p in jpaths:
    previous = None
    raw = p.read_bytes()
    entries = raw.splitlines()
    status = 'ok' if raw.endswith(b'\n') else 'torn tail'
    count = Counter()
    end=''
    for i,b in enumerate(entries,1):
        try: j=json.loads(b)
        except ValueError:
            status='invalid JSON at '+str(i)
            break
        if j['seq']!=i or j.get('prev')!=previous:
            status='bad chain at '+str(i)
        previous=sha256(b).hexdigest()
        t,d,at=j['type'],j['data'],j['at']
        count[t]+=1
        if evidence.search(t) or t=='gate' and d.get('exit')!=0 or t=='job_finished' and d.get('exit') not in (0,None) or t.startswith('run_'):
            safe = {k:d[k] for k in ('unit','kind','reason','reason_code','cause','tier','frd','exit','status','outcome','step','from_epoch','to_epoch','why','command','detail','code','sha','mq_exit') if k in d}
            ledger.append(f'{src(p,F)}:{i} {at} {t} {json.dumps(safe,ensure_ascii=False)[:420]}')
        end=t
    rows.append((src(p,F),len(entries),status,count['unit_dispatched'],count['handoff_requested'],count['drive_takeover'],count['batch_landed'],end))
metrics.append('Raw JSONL hash checks (SHA-256 over prior UTF-8 line, without newline) equivalent to the chain portion of plugin/runtime/build/fsx.mjs:316–341. Enumeration is the Funko main build, archive/suspended and currently present adjacent Claude worktree builds. This is a retained-artifact sample. The production CLI and schema validator were outside scope.')
metrics.append(md_table(['Funko journal','Lines','Chain','Dispatch events','Handoff requests','Drive takeovers','Batch-landed events','Last event'],rows))
for p in [P/'mission-control',P.parent/'personal-page-v2']:
    for name in ('.pandacorp/run/build/journal.jsonl','.pandacorp/run/build-archive','.pandacorp/run/build-suspended','.pandacorp/run/queue-log.jsonl','.pandacorp/track.jsonl'):
        a=p/name
        metrics.append(f'- {a}: '+(f'{a.stat().st_size:,} bytes.' if a.is_file() else 'directory present.' if a.is_dir() else 'missing.'))
(S/'work/anatomy_ledger.txt').write_text('\n'.join(ledger)+'\n')
(S/'work/anatomy_metrics.md').write_text('\n\n'.join(metrics)+'\n')

sample = [
    ('Builder', 'implementer', 'report', 'w-br-2026-11-16-01-u-build-wo-12-002-d0bed5570', 'lane/br-2026-11-16-01/integration'),
    ('Test writer', 'test-writer', 'report', 'w-br-2026-11-16-01-u-tests-wo-12-002-daa8528e7', 'lane/br-2026-11-16-01/integration'),
    ('FRD reviewer', 'reviewer', 'review-report', 'w-br-2026-11-14-01-u-review-frd-01-catalog-browsing-d9ae33ad1', None),
]

def classify(t):
    ct=Counter()
    in_scope=False
    arg=None
    for ln in t.splitlines(keepends=True):
        if ln.startswith('## '):
            arg=ln[3:4]; in_scope=False
        if ln.startswith(('Dentro (','Fuera (','Owned acceptance criteria (')):
            in_scope=True
        if ln.startswith(('Write allowlist','Forbidden paths','RED-first')):
            in_scope=False
        if arg in ('8','9'): cat='Reporting'
        elif ln.startswith('Diff range:') or (in_scope and ln.startswith('- ')): cat='Task'
        elif re.match(r'^(Forbidden paths|Never |RED-first|DR-159:|Read-only, hashed|Test budget:|Worktree for probes:|Work only in:)',ln): cat='Explicit constraints'
        else: cat='Process'
        ct[cat]+=len(ln)
    assert sum(ct.values()) == len(t)
    return ct

def words(t):
    return [len(re.findall(r'\b'+key+r'\b',t)) for key in ('MUST','NEVER')]

prompts=[]
annex=[]
stack=[]
for name,role,schema,key,ref in sample:
    w=Q/'codex-workers'/key
    parent=json.loads((w/'state.json').read_text())
    b=(w/'full-prompt.md').read_text()
    assert (w/'full-prompt.md').read_bytes()==(w/'prompt.md').read_bytes()
    role_path=P/'plugin/agents'/f'{role}.md'
    role_body=role_path.read_text().split('---\n',2)[2].lstrip('\n')
    sch=R/'schemas'/f'{schema}.schema.json'
    schtext=sch.read_text()
    pinned=ref is None
    if pinned:
        ref=re.search(r'^Diff range: \S+\.\.(\S+)$',b,re.M)[1]
    docs=[]
    for line in b.splitlines():
        if not re.search(r'/work-orders/wo-.*\.md$',line): continue
        file='docs/frds/'+line.split('/docs/frds/',1)[1]
        docs.append((file,git('show',f'{ref}:{file}',repo=F)))
    c=classify(b)
    doc_total=sum(len(t) for f,t in docs)
    named=(len(b)+len(role_body)+len(schtext)+doc_total)
    stack.append((name,f'{len(b):,}',f'{round(len(b)/4):,}',f'{c["Task"]:,}',f'{c["Explicit constraints"]:,}',f'{c["Process"]:,}',f'{c["Reporting"]:,}', '/'.join(map(str,words(b))),
                  f'{len(role_body):,}', '/'.join(map(str,words(role_body))),f'{len(schtext):,}',f'{doc_total:,}',f'{named:,} / ~{round(named/4):,}',f'{100*(c["Task"]+doc_total)/named:.1f}%'))
    annex.append(f'### {name} · {key}')
    annex.append(f'Exact archived direct-transport text, with the unit credential redacted if present. Raw role pointer and checkout paths are retained. Source {w}/full-prompt.md:1–{lines(b)}. prompt.md and full-prompt.md are byte-identical at read time. Worker metadata {w}/state.json:1 records direct={parent.get("direct")} and tool={parent.get("tool")}.')
    # Avoid publishing even historic unit bearer tokens from archived prompts.
    safe=re.sub(r'(?mi)^(token:\s*)(.+)$',lambda m:m[0] if m[2]=='launcher-bound' else m[1]+'[REDACTED UNIT CREDENTIAL]',b)
    annex.append(fence(safe,'markdown'))
    for file,t in docs:
        note='This is the pinned review range end.' if pinned else 'This is the surviving historical integration-branch version. Exact worker-time equality is unverified.'
        annex.append(f'Work-order body + frontmatter from git -C {F} show {ref}:{file} ({lines(t)} lines, {len(t):,} characters). {note} WO bodies contain their own process instructions.')
        annex.append(fence(t,'markdown'))

prompts.append('## Appendix B. Worker prompt reconstruction and exact readable inputs')
prompts.append('Character counts are **MEASURED** on original Unicode text, including newlines and before redaction. Token estimates divide by four. The table gives two boundaries: archive text sent by direct transport, and a named potential reading stack (brief + current role body + current schema once + recovered WO docs). Runtime system framing, other referenced project docs, model-selected reads and reasoning are outside both sums. Task counts copied Dentro/Fuera/AC bullet rows and pinned review range. Explicit constraints counts imperative lines by their leading label. Reporting counts sections 8–9. Process is all other characters including pointers, identifiers, mechanics, and some constraint prose. Literal uppercase words use whole-word, case-sensitive matches. Entire WO documents are provisionally counted with task in the last column, making it an upper-bound allocation within this named stack.')
prompts.append(md_table(['Role','Brief chars','~Tokens est.','Task','Explicit constraints','Process/metadata','Reporting','MUST/NEVER brief','Role-body chars','MUST/NEVER role','Current schema chars','WO chars','Named chars / tokens est.','Upper task %'],stack))
prompts.append(f'Coordinator-only plugin/skills/implement/SKILL.md: {len((P/skillpath/"SKILL.md").read_text()):,} chars; {sum(len(p.read_text()) for p in skills if p.name!="SKILL.md"):,} chars in references. Funko main AGENTS.md: {len((F/"AGENTS.md").read_text()):,} chars (current file; inclusion and historical revision vary by worker). These counts are outside the named worker stack.')
prompts.extend(annex)
prompts.append('### Canonical role definitions and current schema contracts')
prompts.append('These complete current files reconstruct the instructions the archived brief pointed to. They are path-addressed reads for direct Codex and headless Claude workers. Native Claude receives its named role through the platform. Historic runtime/tool-level system wrappers and which reads were actually executed are separate evidence.')
for name,role,schema,key,ref in sample:
    p=P/'plugin/agents'/f'{role}.md'
    prompts.append(f'{src(p)}:1–{lines(p.read_text())}')
    prompts.append(fence(p.read_text(),'markdown'))
for schema in ('report','review-report'):
    p=R/'schemas'/f'{schema}.schema.json'
    prompts.append(f'{src(p)}:1–{lines(p.read_text())}')
    prompts.append(fence(p.read_text(),'json'))
(S/'work/anatomy_prompts.md').write_text('\n\n'.join(prompts)+'\n')
print('runtime_modules', len(runtime), 'runtime_lines', sum(lines(p.read_text()) for p in runtime))
print('schemas',len(schemas),'cli_commands',len(cmds)+1,'journal_files',len(jpaths))
print('schema_check_after',all(not untyped(json.loads((R/'schemas'/f'{n}.schema.json').read_text())) for n in outnames))
print('churn', len(changes((buildpath,skillpath))[1]))
print('prompt_chars',[(x[0],x[1]) for x in stack])
