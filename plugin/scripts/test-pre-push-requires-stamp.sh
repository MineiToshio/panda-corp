#!/bin/bash
# Synthetic local repositories only. Real queue, verify, stamp and installed hook;
# pnpm is a deterministic gate-tool stub (no package downloads or browser required).
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
TEST_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/pre-push-proof.XXXXXX")
trap 'rm -rf "$TEST_ROOT"' EXIT
python3 - "$ROOT" "$TEST_ROOT" <<'PY'
import datetime, json, os, pathlib, shlex, shutil, subprocess, sys, uuid

factory, tmp = map(pathlib.Path, sys.argv[1:])
tmp = tmp.resolve()
env = {k: v for k, v in os.environ.items() if not k.startswith(('GIT_', 'PANDACORP_OWNER_'))}
env.update(GIT_CONFIG_GLOBAL='/dev/null', GIT_CONFIG_NOSYSTEM='1',
           GIT_AUTHOR_NAME='Fixture', GIT_AUTHOR_EMAIL='fixture@example.invalid',
           GIT_COMMITTER_NAME='Fixture', GIT_COMMITTER_EMAIL='fixture@example.invalid',
           PANDACORP_HOST_DIR=str(tmp / 'host'), PANDACORP_NOTIFY='off')
tools = tmp / 'bin'
tools.mkdir()
for name in ('pnpm', 'osascript'):
    (tools / name).write_text('#!/bin/sh\nexit 0\n')
    (tools / name).chmod(0o755)
env['PATH'] = str(tools) + ':' + env['PATH']
order = {'PANDACORP_OWNER_RELEASE_OK': '1'}
passed = 0
def run(cwd, *args, extra=None, stdin=None, code=0):
    result = subprocess.run(args, cwd=cwd, env={**env, **(extra or {})}, input=stdin,
                            text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if code is not None:
        assert result.returncode == code, (args, result.returncode, result.stdout)
    return result
def git(cwd, *args):
    return run(cwd, 'git', *args).stdout.strip()
def ok(message):
    global passed
    passed += 1
    print('PASS ' + message, flush=True)
def commit(cwd, name):
    git(cwd, 'add', '.')
    git(cwd, 'commit', '-qm', name)
    return git(cwd, 'rev-parse', 'HEAD')
def fixture(name, prefix=''):
    base = tmp / name
    base.mkdir()
    remote, repo = base / 'remote.git', base / 'app'
    git(base, 'init', '-q', '--bare', '-b', 'main', str(remote))
    git(base, 'clone', '-q', str(remote), str(repo))
    git(repo, 'config', 'commit.gpgsign', 'false')
    project = repo / prefix
    (project / '.pandacorp').mkdir(parents=True)
    for script in ('merge-queue.sh', 'green-stamp.sh'):
        shutil.copyfile(factory / 'plugin/templates/shared/.pandacorp' / script, project / '.pandacorp' / script)
    shutil.copyfile(factory / 'plugin/templates/stack-a-nextjs/verify.sh', project / '.pandacorp/verify.sh')
    (project / '.pandacorp/verify.sh').chmod(0o755)
    (project / '.pandacorp/status.yaml').write_text('phase: release\ndeploy_target: external\n')
    (project / '.gitignore').write_text('.pandacorp/run/\nnode_modules/\n.env*\ne2e/local-input.json\ne2e/output/\n')
    (project / 'e2e').mkdir()
    (project / 'playwright.config.ts').write_text('')
    (project / 'package.json').write_text('{"name":"pre-push-proof-fixture"}\n')
    for name in ('smoke', 'visual', 'responsive', 'shell', 'headers'):
        (project / 'e2e' / (name + '.spec.ts')).write_text('')
    (project / 'e2e/.run-outputs').write_text('e2e/output/\n')
    (project / 'value.txt').write_text('base\n')
    commit(repo, 'base')
    git(repo, 'push', '-q', 'origin', 'main')
    run(repo, 'node', str(factory / 'plugin/scripts/install-pre-push.mjs'), '--project', str(project))
    return base, remote, repo, project
def hook(repo, sha, extra=None, code=0, cwd=None):
    hooks = pathlib.Path(git(repo, 'rev-parse', '--git-path', 'hooks'))
    if not hooks.is_absolute(): hooks = repo / hooks
    return run(cwd or repo, str(hooks / 'pre-push'), 'origin', 'unused',
               extra=order if extra is None else extra,
               stdin=f'HEAD {sha} refs/heads/main {"0" * 40}\n', code=code)
def events(project, sha, terminal=0, pid=None):
    common = dict(v=1, attempt=str(uuid.uuid4()), branch='feature', project=str(project),
                  ts=datetime.datetime.now(datetime.timezone.utc).isoformat())
    rows = [{**common, 'event':'start', 'head':sha, 'pid':os.getpid() if pid is None else pid,
             'launched':1, 'owner_release_ok':1},
            {**common, 'event':'ff', 'sha':sha, 'result':'ok'}]
    if terminal is not None: rows.append({**common, 'event':'end', 'exit':terminal})
    return rows
def write_log(project, rows):
    log = project / '.pandacorp/run/queue-log.jsonl'
    log.parent.mkdir(exist_ok=True)
    log.write_text(''.join(json.dumps(row) + '\n' for row in rows))
    return log

base, remote, repo, project = fixture('proof')
(project / 'value.txt').write_text('direct\n')
sha = commit(repo, 'direct')
old = git(remote, 'rev-parse', 'main')
result = run(repo, 'git', 'push', 'origin', 'main', extra=order, code=None)
assert result.returncode != 0 and git(remote, 'rev-parse', 'main') == old, result.stdout
ok('direct commit refused even with the release order; remote unchanged')
for value in ('0', 'true', 'yes', ''):
    hook(repo, sha, extra={**order, 'PANDACORP_OWNER_UNGATED_PUSH':value}, code=1)
hook(repo, sha, extra={'PANDACORP_OWNER_UNGATED_PUSH':'1'}, code=1)
ok('only exact bypass value 1 works, and bypass never supplies the release order')
reason = 'owner test "quoted"\nsecond line'
run(repo, 'git', 'push', 'origin', 'main', extra={**order, 'PANDACORP_OWNER_UNGATED_PUSH':'1',
    'PANDACORP_OWNER_UNGATED_REASON':reason})
audit = project / '.pandacorp/run/ungated-pushes.jsonl'
row = json.loads(audit.read_text())
assert row['commit'] == sha and row['reason'] == reason
datetime.datetime.fromisoformat(row['time'].replace('Z', '+00:00'))
hook(repo, sha, extra={**order, 'PANDACORP_OWNER_UNGATED_PUSH':'1'})
assert json.loads(audit.read_text().splitlines()[-1])['reason'] == 'unspecified'
audit.unlink()
audit.mkdir()
hook(repo, sha, extra={**order, 'PANDACORP_OWNER_UNGATED_PUSH':'1'}, code=1)
audit.rmdir()
ok('bypass logs exact commit/time/escaped reason and fails closed on audit write failure')

for terminal in (0, 13):
    write_log(project, events(project, sha, terminal))
    hook(repo, sha)
    hook(repo, sha, extra={}, code=1)
ok('same-attempt ff accepts end 0/13; still requires order')
# A recycled live PID is not the process/lock that produced an unfinished ff.
write_log(project, events(project, sha, None, os.getpid()))
hook(repo, sha, code=1)
ok('unfinished attempt with unrelated live PID and no owned lock refused')
# Even plausible lock metadata must match the process birth identity and attempt token.
rows = events(project, sha, None, os.getpid())
rows[0]['process_identity'] = 'a' * 32
rows[0]['process_proof'] = 'pandacorp-merge.proof-' + 'a' * 32
rows[0]['worktree'] = str(repo)
rows.insert(1, {**rows[0], 'event':'lock_acquired', 'lock_token':'old-token'})
common_dir = repo / '.git'
lock = common_dir / 'pandacorp-merge.lock'
lock.mkdir()
(lock / 'owner.json').write_text(json.dumps(dict(pid=os.getpid(), token='old-token', attempt=rows[0]['attempt'], process_identity='a'*32, process_proof=rows[0]['process_proof'], branch=rows[0]['branch'], worktree=str(repo), hostname=__import__('socket').gethostname())))
proof = common_dir / rows[0]['process_proof']
proof.write_text(json.dumps(dict(pid=os.getpid(), identity='a'*32)))
try:
    write_log(project, rows)
    hook(repo, sha, code=1)
finally:
    (lock / 'owner.json').unlink(); lock.rmdir(); proof.unlink()
ok('reused PID with stale process identity refused even with matching old lock metadata')
with subprocess.Popen(['true']) as child: child.wait()
dead_pid = child.pid
for label, rows in (
    ('dead unfinished attempt', events(project, sha, None, dead_pid)),
    ('failed terminal', events(project, sha, 11)),
    ('signalled terminal', events(project, sha, 143)),
    ('wrong sha', events(project, old)),
    ('missing start', events(project, sha)[1:]),
):
    write_log(project, rows)
    hook(repo, sha, code=1)
    ok(label + ' refused')
rows = events(project, sha)
rows[1]['result'] = 'failed'
write_log(project, rows)
hook(repo, sha, code=1)
rows = events(project, sha)
rows[-1]['attempt'] = str(uuid.uuid4())
rows[0]['pid'] = dead_pid
write_log(project, rows)
hook(repo, sha, code=1)
rows = events(project, sha)
for row in rows: row['project'] = str(tmp / 'other')
write_log(project, rows)
hook(repo, sha, code=1)
log = write_log(project, events(project, sha))
with log.open('a') as stream: stream.write('{broken\n')
hook(repo, sha, code=1)
ok('failed ff, cross-attempt end, foreign project and malformed log are not proof')
log.unlink()

# Real full verify on main is the fallback, bound to the stdin commit tree, not HEAD alone.
(project / 'value.txt').write_text('certified on main\n')
sha = commit(repo, 'main gate candidate')
run(project, '/bin/bash', '.pandacorp/verify.sh')
run(project, '/bin/bash', '.pandacorp/green-stamp.sh', 'check')
# Observe the environment Git actually gives the hook, not only a direct hook invocation.
# The wrapper is synthetic/untracked, preserves stdin, and restores the installed hook afterward.
installed = repo / '.git/hooks/pre-push'
saved = installed.with_name('pre-push.saved')
diagnostic = base / 'git-stamp-diagnostic'
installed.rename(saved)
installed.write_text('#!/bin/sh\nbash .pandacorp/green-stamp.sh check --explain > ' +
                     shlex.quote(str(diagnostic)) + ' 2>&1\nexec ' + shlex.quote(str(saved)) + ' "$@"\n')
installed.chmod(0o755)
try:
    push = run(repo, 'git', 'push', 'origin', 'main', extra=order, code=None)
finally:
    installed.unlink()
    saved.rename(installed)
if push.returncode:
    assert 'no full-gate proof' in push.stdout, push.stdout
    assert 'environment variable PATH' in diagnostic.read_text() or 'environment variable GIT_EXEC_PATH' in diagnostic.read_text(), diagnostic.read_text()
    ok('check (2) real push MISMATCH: Git hook environment differs despite fresh main certificate')
else:
    assert git(remote, 'rev-parse', 'main') == sha
    ok('check (2) real push MATCH: this Git preserves the certified environment')
hook(repo, sha)
hook(repo, old, code=1)
(project / 'value.txt').write_text('dirty\n')
hook(repo, sha, code=1)
git(repo, 'restore', 'value.txt')
stamp = project / '.pandacorp/run/green-stamp'
original = stamp.read_text()
stamp.write_text('broken\n')
hook(repo, sha, code=1)
stamp.write_text(original)
ok('direct main-stamp check accepts its tree, rejects other stdin tree, dirty checkout and corrupt stamp')

for prefix in ('', 'nested/app'):
    base, remote, repo, project = fixture('landing-' + ('nested' if prefix else 'root'), prefix)
    wt = base / 'wt'
    git(repo, 'worktree', 'add', '-q', '-b', 'feature', str(wt))
    wp = wt / prefix
    (wp / 'value.txt').write_text('queued\n')
    sha = commit(wt, 'feature')
    # Independent physical installations and ignored inputs differ exactly as real checkouts can.
    for root, label in ((project, 'main'), (wp, 'worktree')):
        (root / 'node_modules/.pnpm').mkdir(parents=True)
        (root / 'node_modules/.modules.yaml').write_text('virtualStoreDir: ' + str(root / 'node_modules/.pnpm') + '\n')
        (root / 'node_modules/.pnpm/lock.yaml').write_text('lockfileVersion: 9\n')
        (root / 'e2e/local-input.json').write_text(json.dumps({'checkout':label}))
        (root / '.env.local').write_text('FIXTURE_CHECKOUT=' + label + '\n')
        (root / 'e2e/output').mkdir()
        (root / 'e2e/output/result.json').write_text(label)
    # A different waiting attempt may append while the current owner is pushing.
    # Its ID must not replace the ID of the active proof group under validation.
    live_hook = repo / '.git/hooks/pre-push'
    actual_hook = live_hook.with_name('pre-push.actual')
    live_hook.rename(actual_hook)
    waiter = dict(v=1, attempt=str(uuid.uuid4()), event='start', branch='concurrent-waiter', project=str(project),
                  ts=datetime.datetime.now(datetime.timezone.utc).isoformat(), head=sha, pid=os.getpid(), launched=1, owner_release_ok=0)
    payload = shlex.quote(json.dumps(waiter))
    logpath = shlex.quote(str(project / '.pandacorp/run/queue-log.jsonl'))
    live_hook.write_text("#!/bin/sh\nprintf '%s\\n' " + payload + " >> " + logpath + "\nexec " + shlex.quote(str(actual_hook)) + ' "$@"\n')
    live_hook.chmod(0o755)
    try:
        result = run(wp, '/bin/bash', '.pandacorp/merge-queue.sh', extra=order)
    finally:
        live_hook.unlink(); actual_hook.rename(live_hook)
    assert git(remote, 'rev-parse', 'main') == sha
    rows = [json.loads(line) for line in (project / '.pandacorp/run/queue-log.jsonl').read_text().splitlines()]
    assert [(r['sha'], r['result']) for r in rows if r['event'] == 'ff'] == [(sha, 'ok')]
    assert [r['result'] for r in rows if r['event'] == 'push'] == ['ok']
    assert [r['exit'] for r in rows if r['event'] == 'end'] == [0]
    assert (project / '.pandacorp/run/green-stamp').is_file(), result.stdout
    check = run(project, '/bin/bash', '.pandacorp/green-stamp.sh', 'check', '--explain', code=1)
    assert 'dependencies' in check.stdout and 'e2e' in check.stdout, check.stdout
    ok(('nested' if prefix else 'root') + ' real queue landing passes proof (1); check (2) MISMATCH: dependencies + e2e/.env inputs')
    (project / '.pandacorp/run/queue-log.jsonl').unlink()
    hook(repo, sha, cwd=wt, code=1)
    ok('without queue proof the handed-off stamp cannot authorize this main checkout')
    # A fresh full gate on main certifies main inputs; linked-worktree hooks must read that main stamp.
    run(project, '/bin/bash', '.pandacorp/verify.sh')
    hook(repo, sha, cwd=wt)
    ok('fresh main gate matches check (2) in direct hook invocation from a linked worktree')

print(f'RESULT: {passed} passed, 0 failed')
PY
