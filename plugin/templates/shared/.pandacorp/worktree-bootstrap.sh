#!/bin/bash
# Pandacorp worktree bootstrap (DR-096) — reconstitute everything a fresh git worktree does NOT carry
# (git checks out tracked files only: no node_modules, private run state or secrets).
# Run it ONCE right after entering a fresh worktree, before editing.
#
# It is cheap by design: pnpm makes APFS clones from the shared store, secrets are referenced not
# copied (SOPS lives outside the repo), data is referenced not copied (PANDACORP_FACTORY_ROOT). A project
# with its own state (a DB) adds the heavy bit in the per-project hook `.pandacorp/worktree-setup.sh`.
set -euo pipefail

# Queue preparation must not run dependency installs, hooks or dotenv generation after sealing.
PORT_ONLY=0
[ "${1:-}" != "--e2e-port-only" ] || PORT_ONLY=1

WORKTREE="$(git rev-parse --show-toplevel)"
# DR-145: creator/coordinator registers ownership before workers or dependency installation.
if [ "$PORT_ONLY" = 0 ] && [ -n "${PANDACORP_CLEANUP_SESSION:-}" ]; then
  bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/session-cleanup.sh" register --session "$PANDACORP_CLEANUP_SESSION" --worktree "$WORKTREE" || exit 3
fi
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
COMMON_DIR="$(cd "$(git rev-parse --git-common-dir)" && pwd)"
MAIN_WT="$(dirname "$COMMON_DIR")"                       # the .git's parent = the main checkout
SLUG="$(echo "$BRANCH" | tr '/' '-' | tr -cd '[:alnum:]-')"

# DSWEEP2: provenance is outside the disposable tree and bound to its .git-file identity.
# Capture bytes immediately after each producer, before project hooks or later owner edits.
BOOTSTRAP_ID="$(printf '%s' "$WORKTREE" | shasum -a 256 | awk '{print $1}')"
BOOTSTRAP_MANIFEST="$MAIN_WT/.pandacorp/run/worktrees/bootstrap-$BOOTSTRAP_ID.json"
BOOTSTRAP_FILES=()
bootstrap_record_output() {
  local relative="${1#"$WORKTREE"/}"
  local hash
  hash="$(shasum -a 256 "$1" | awk '{print $1}')"
  BOOTSTRAP_FILES+=("$relative" "$hash")
}
# Missing proof permits recording only committed input; an earlier proof permits exactly its
# recorded bytes. Bootstrap never certifies later owner edits to generated environment files.
bootstrap_owned_input() {
  node --input-type=module - "$WORKTREE" "$1" "$BOOTSTRAP_MANIFEST" <<'NODE'
import {createHash} from 'node:crypto';
import {readFileSync,lstatSync,realpathSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const [root,file,manifest]=process.argv.slice(2);
let owned=false;
try {
  const hash=b=>createHash('sha256').update(b).digest('hex');
  if(!lstatSync(file).isFile()||realpathSync(file)!==file) throw new Error('Not an owned regular output');
  const name=path.relative(root,file), bytes=readFileSync(file);
  const head=spawnSync('git',['show',`HEAD:${name}`],{cwd:root});
  owned=head.status===0&&hash(bytes)===hash(head.stdout);
  if(!owned&&lstatSync(manifest).isFile()&&realpathSync(manifest)===manifest) {
    const proof=JSON.parse(readFileSync(manifest,'utf8')), st=lstatSync(path.join(root,'.git'));
    const gd=spawnSync('git',['rev-parse','--absolute-git-dir'],{cwd:root,encoding:'utf8'});
    // Match cleanup's complete trust boundary before renewing any generated-output proof.
    // This script is a standalone overlay, so it cannot import the factory cleanup module.
    owned=st.isFile()&&proof.producer==='worktree-bootstrap'&&proof.version===1&&proof.path===root&&
      proof.identity===`${st.dev}:${st.ino}:${st.birthtimeMs}`&&gd.status===0&&
      proof.gitdir===realpathSync(gd.stdout.trim())&&proof.generated_files&&
      typeof proof.generated_files==='object'&&!Array.isArray(proof.generated_files)&&
      proof.generated_files[name]===hash(bytes);
  }
} catch { /* Unknown input is retained by cleanup. */ }
process.exitCode=owned?0:1;
NODE
}

# Provenance remains outside the disposable checkout, including narrow port preparation.
bootstrap_write_manifest() {
MANIFEST_DIR="$MAIN_WT/.pandacorp/run/worktrees"
mkdir -p "$MANIFEST_DIR"
node --input-type=module - "$PORT_ONLY" "$WORKTREE" "$BRANCH" "$SLUG" "${PANDACORP_WORKTREE_TASK:-}" "$BOOTSTRAP_MANIFEST" ${BOOTSTRAP_FILES[@]+"${BOOTSTRAP_FILES[@]}"} <<'NODE'
import {lstatSync,realpathSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const [portOnly,root,branch,slug,task,manifest,...pairs]=process.argv.slice(2);
const st=lstatSync(path.join(root,'.git'));
const gd=spawnSync('git',['rev-parse','--absolute-git-dir'],{cwd:root,encoding:'utf8'});
if(gd.status!==0) throw new Error('Cannot resolve bootstrap worktree identity');
const identity=`${st.dev}:${st.ino}:${st.birthtimeMs}`, gitdir=realpathSync(gd.stdout.trim());
const generated_files={};
// Port-only preparation leaves other producers untouched. Retain only identity/hash-valid
// earlier evidence; the port itself must be explicitly proven before this invocation wrote it.
if(portOnly==='1') {
  try {
    if(!lstatSync(manifest).isFile()||realpathSync(manifest)!==manifest) throw new Error('Untrusted manifest');
    const prior=JSON.parse(readFileSync(manifest,'utf8'));
    if(st.isFile()&&prior.producer==='worktree-bootstrap'&&prior.version===1&&prior.path===root&&
      prior.identity===identity&&prior.gitdir===gitdir&&prior.generated_files&&
      typeof prior.generated_files==='object'&&!Array.isArray(prior.generated_files)) {
      for(const [name,hash] of Object.entries(prior.generated_files||{})) {
        if(!/^(?:\.claude\/launch\.json|(?:[^/]+\/)?(?:e2e\/server-env\.json|\.env\.local))$/.test(name)) continue;
        try {
          const file=path.resolve(root,name);
          if(file.startsWith(root+path.sep)&&lstatSync(file).isFile()&&realpathSync(file)===file&&
            createHash('sha256').update(readFileSync(file)).digest('hex')===hash) generated_files[name]=hash;
        } catch { /* One stale output cannot bless itself or discard valid sibling evidence. */ }
      }
    }
  } catch { /* Untrusted or incomplete prior evidence never authorizes cleanup. */ }
}
for(let i=0;i<pairs.length;i+=2) generated_files[pairs[i]]=pairs[i+1];
const data={version:1,producer:'worktree-bootstrap',branch,path:root,slug,task,
  started_at:new Date().toISOString(),identity,gitdir,generated_files};
const temporary=`${manifest}.${process.pid}.tmp`;
writeFileSync(temporary,JSON.stringify(data,null,2),{flag:'wx',mode:0o600});
renameSync(temporary,manifest);
NODE

}

echo "▸ bootstrapping worktree $BRANCH"

# ── 0. Project dir resolution — Mission Control lives NESTED inside the factory's own repo (shares
# its .git; panda-corp/ itself is not an npm package), so its package.json is at
# $WORKTREE/mission-control, never at $WORKTREE's own root; every other product project's own repo
# root IS $WORKTREE. Resolve it ONCE here (steps 1 and 3 both need "the real project dir inside this
# worktree") via $WORKTREE-relative paths only, so the result never depends on the CWD this script
# happened to be invoked from.
APP_DIR=""
for candidate in "$WORKTREE/mission-control" "$WORKTREE"; do
  if [ -f "$candidate/package.json" ]; then APP_DIR="$candidate"; break; fi
done

# ── 1. Dependencies — APFS clones from the shared store (never symlink node_modules; .next stays local) ─
# Idempotent (BL-0149): a re-run of this script (e.g. the gate worktree re-bootstraps on every reuse,
# ensureGateWorktree) must not pay a full reinstall when node_modules is already present and
# pnpm-lock.yaml hasn't moved since the last bootstrap in THIS worktree — skip via a lockfile-hash
# marker stored INSIDE node_modules (so a deleted node_modules always re-triggers a real install).
#
# BL-0155: this used to check bare `package.json` (CWD-relative) — correct only when the project IS
# the worktree root. For a nested project (Mission Control, the real production topology) that file
# never exists at the worktree root, so this step silently installed NOTHING (canary B2's confirmed
# root cause of `gate-worktree-not-bootstrapped`: the evidence collector correctly refused to fabricate
# a report against a worktree with no node_modules, and the gate had to bootstrap by hand, burning the
# exact cost `gateEvidence: digested` exists to avoid). Use the $APP_DIR resolved above instead.
if [ "$PORT_ONLY" = 0 ] && [ -n "$APP_DIR" ] && command -v pnpm >/dev/null 2>&1; then
  LOCK_MARKER="$APP_DIR/node_modules/.pandacorp-lock-sha"
  LOCK_SHA=""
  [ -f "$APP_DIR/pnpm-lock.yaml" ] && LOCK_SHA="$(shasum -a 256 "$APP_DIR/pnpm-lock.yaml" 2>/dev/null | awk '{print $1}')"
  if [ -d "$APP_DIR/node_modules" ] && [ -n "$LOCK_SHA" ] && [ -f "$LOCK_MARKER" ] && [ "$(cat "$LOCK_MARKER" 2>/dev/null)" = "$LOCK_SHA" ]; then
    echo "  • pnpm install skipped ($APP_DIR/node_modules present, pnpm-lock.yaml unchanged)"
  else
    # Measure the target volume, not the sealed system volume. The override is a test hook.
    FREE_KB="$(df -Pk "$APP_DIR" | awk 'NR==2 {print $4}')"
    FREE_MB="${PANDACORP_DISK_FREE_MB:-$(( FREE_KB / 1024 ))}"
    MIN_FREE_MB="${PANDACORP_MIN_FREE_MB:-15360}"
    WT_NEED_MB="${PANDACORP_WT_NEED_MB:-1500}"
    if [ "$FREE_MB" -lt $(( MIN_FREE_MB + WT_NEED_MB )) ]; then
      echo "Disco insuficiente: ${FREE_MB} MiB libres; se requieren $(( MIN_FREE_MB + WT_NEED_MB )) MiB para instalar." >&2
      exit 4
    fi
    MAIN_APP_DIR="$MAIN_WT${APP_DIR#"$WORKTREE"}"
    LOCK_DIFFERS=0
    # Missing locks on both sides are not a change. A newly added/deleted lock is.
    if [ -f "$APP_DIR/pnpm-lock.yaml" ] || [ -f "$MAIN_APP_DIR/pnpm-lock.yaml" ]; then
      cmp -s "$APP_DIR/pnpm-lock.yaml" "$MAIN_APP_DIR/pnpm-lock.yaml" || LOCK_DIFFERS=1
    fi
    echo "  • pnpm install ($APP_DIR, clones APFS desde el almacén global)"
    (
      cd "$APP_DIR"
      if ! pnpm install --offline --frozen-lockfile >/dev/null 2>&1; then
        if ! pnpm install --prefer-offline --frozen-lockfile; then
          if [ "$LOCK_DIFFERS" = 1 ]; then
            pnpm install
          else
            echo "No se pudo instalar con el lockfile congelado; el lockfile coincide con el checkout principal." >&2
            exit 1
          fi
        fi
      fi
    )
    AFTER_KB="$(df -Pk "$APP_DIR" | awk 'NR==2 {print $4}')"
    MODULES_KB="$(du -sk "$APP_DIR/node_modules" 2>/dev/null | awk '{print $1}')" || MODULES_KB=0
    if [ "${MODULES_KB:-0}" -gt 0 ] && [ $(( (FREE_KB - AFTER_KB) * 100 )) -gt $(( MODULES_KB * 15 )) ]; then
      echo "Aviso: la instalación consumió más del 15% de du node_modules; pnpm podría estar copiando en vez de clonar. Revisa el volumen del almacén." >&2
    fi
    # A permitted plain install can rewrite the lock; stamp its final bytes.
    LOCK_SHA=""
    [ ! -f "$APP_DIR/pnpm-lock.yaml" ] || LOCK_SHA="$(shasum -a 256 "$APP_DIR/pnpm-lock.yaml" | awk '{print $1}')"
    [ -z "$LOCK_SHA" ] || { mkdir -p "$APP_DIR/node_modules"; echo "$LOCK_SHA" > "$LOCK_MARKER"; }
  fi
fi

# ── 2. Preview launch configuration stays committed; bootstrap never hides tracked edits. ──
# Worktree e2e ports live only in ignored run state (proposal 43 phase 2).

# ── 2b. Private e2e port — one writer, no tracked JSON edits or index flags. ──
SERVER_ENV_FILE="$APP_DIR/e2e/server-env.json"
if [ "$WORKTREE" != "$MAIN_WT" ] && [ -n "$APP_DIR" ] && [ -f "$SERVER_ENV_FILE" ]; then
  PRIVATE_PORT_FILE="$APP_DIR/.pandacorp/run/e2e-port"
  [ ! -L "$PRIVATE_PORT_FILE" ] || { echo "Invalid symlink e2e port" >&2; exit 3; }
  PRIVATE_PORT_PROVEN=0
  if [ ! -e "$PRIVATE_PORT_FILE" ] || bootstrap_owned_input "$PRIVATE_PORT_FILE"; then
    PRIVATE_PORT_PROVEN=1
  fi
  PORT_BASE=3900
  PORT_SPAN=100
  if [ -n "${PANDACORP_E2E_PORT:-}" ]; then
    # Explicit override always wins (an operator/canary pinning a known-free port).
    E2E_PORT="$PANDACORP_E2E_PORT"
  elif [ -f "$PRIVATE_PORT_FILE" ]; then
    # A certified input is stable even if its listener is currently busy. Port ownership is
    # enforced by Playwright; silently selecting another port here would invalidate the seal.
    E2E_PORT="$(cat "$PRIVATE_PORT_FILE")"
  else
    # Deterministic starting port from a hash of the worktree's absolute path — the SAME worktree
    # bootstrapped twice (ensureGateWorktree reuse) always hashes to the same candidate.
    HASH_HEX="$(printf '%s' "$WORKTREE" | shasum -a 256 | awk '{print $1}')"
    OFFSET=$(( 0x${HASH_HEX:0:8} % PORT_SPAN ))
    E2E_PORT=$(( PORT_BASE + OFFSET ))
    # Free-port probe: a hash collision between two worktrees (or a leftover listener) must not wedge
    # them onto the same port — walk forward from the candidate, wrapping inside the range, and stop
    # at the first port nothing answers on. An exhausted range falls back to the deterministic
    # candidate (vanishingly unlikely with PORT_SPAN=100 concurrent worktrees).
    TRIES=0
    while [ "$TRIES" -lt "$PORT_SPAN" ]; do
      if ! (exec 3<>"/dev/tcp/127.0.0.1/$E2E_PORT") 2>/dev/null; then
        break
      fi
      E2E_PORT=$(( PORT_BASE + ( (E2E_PORT - PORT_BASE + 1) % PORT_SPAN ) ))
      TRIES=$(( TRIES + 1 ))
    done
  fi
  case "$E2E_PORT" in ''|*[!0-9]*) echo "Invalid e2e port" >&2; exit 3 ;; esac
  [ "$E2E_PORT" -ge 1 ] && [ "$E2E_PORT" -le 65535 ] || { echo "Invalid e2e port" >&2; exit 3; }
  mkdir -p "$APP_DIR/.pandacorp/run"
  if [ ! -f "$PRIVATE_PORT_FILE" ] || [ "$(cat "$PRIVATE_PORT_FILE")" != "$E2E_PORT" ]; then
    printf '%s\n' "$E2E_PORT" > "$PRIVATE_PORT_FILE"
  fi
  # Existing owner edits must not gain a fresh proof, even under an explicit port override.
  [ "$PRIVATE_PORT_PROVEN" != 1 ] || bootstrap_record_output "$PRIVATE_PORT_FILE"
  echo "  • .pandacorp/run/e2e-port → $E2E_PORT (worktree-private)"
fi
# The queue uses this narrow mode before fingerprinting, without dotenv/hooks/session registration.
if [ "$PORT_ONLY" = 1 ]; then bootstrap_write_manifest; exit 0; fi

# ── 3. Secrets & data are REFERENCED, not copied ────────────────────────────────────────────────────
# Secrets: SOPS+age lives outside any repo (~/.config/pandacorp/) — the worktree runs the same
#   `sops exec-env ...` as the main checkout; nothing to bootstrap here.
# Mission Control (stateless): config.ts::resolveFactoryRoot() falls back to cwd/.. when
#   PANDACORP_FACTORY_ROOT is unset, which in a fresh worktree resolves to this worktree's own
#   near-empty factory/ (gitignored files like profile.md/portfolio.md aren't checked out) and trips
#   the onboarding gate. Write a worktree-local .env.local pointing at a factory checkout instead.
# BL-0155: reuses the SAME $APP_DIR resolved in step 0 (was its own duplicate search loop) — one
# resolution, two consumers.
# BL-0160: point at $WORKTREE (THIS worktree's own top-level — a full nested factory/ checkout, since
#   `git worktree add` checks out ALL tracked files, not just the app subtree), never $MAIN_WT. Every
#   linked worktree shares ONE common .git (`git rev-parse --git-common-dir`), so $MAIN_WT resolves to
#   the SAME ultimate original checkout NO MATTER HOW MANY WORKTREE-OF-A-WORKTREE HOPS deep this one
#   is — a canary's OWN gate-worktree (`git -C <canary>/mission-control worktree add ... GATE_WORKTREE`)
#   used to land on panda-corp's real main checkout this way, so the gate's Preview Smoke run read (and
#   risked reading mid-write) `factory/ideas/`/`portfolio.md`/another project's `status.yaml` that a
#   DIFFERENT, concurrently-running session was actively mutating — cross-session contamination, not
#   isolation (canary-c-forensics.md §7). $WORKTREE is this run's OWN pinned, quiet copy: no other
#   session can mutate it. Tradeoff accepted deliberately: an ordinary attended worktree previewing the
#   live dashboard now sees ITS OWN gitignored-data-free factory/ (the pre-existing onboarding-gate
#   caveat above) instead of main's real portfolio, unless the owner overrides PANDACORP_FACTORY_ROOT by
#   hand — never reading another session's in-flight state is worth that inconvenience.
if [ -n "$APP_DIR" ] && { grep -q '"name": *"pandacorp"' "$WORKTREE/package.json" 2>/dev/null \
   || [ -d "$WORKTREE/../factory" ] || [ -d "$WORKTREE/factory" ]; } && {
  { [ ! -e "$APP_DIR/.env.local" ] && [ ! -L "$APP_DIR/.env.local" ]; } || bootstrap_owned_input "$APP_DIR/.env.local";
}; then
  echo "  • PANDACORP_FACTORY_ROOT → $WORKTREE ($APP_DIR/.env.local, gitignored, BL-0160: this worktree's own nested factory)"
  echo "PANDACORP_FACTORY_ROOT=$WORKTREE" > "$APP_DIR/.env.local"
  bootstrap_record_output "$APP_DIR/.env.local"
  if [ -n "${PANDACORP_CLEANUP_SESSION:-}" ]; then
    cleanup_env_rel="${APP_DIR#"$WORKTREE"/}/.env.local"
    [ "$APP_DIR" != "$WORKTREE" ] || cleanup_env_rel=".env.local"
    bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/session-cleanup.sh" register --session "$PANDACORP_CLEANUP_SESSION" --worktree "$WORKTREE" --generated-file "$cleanup_env_rel"
  fi
fi

# ── 4. Per-project hook — stateful projects clone their DB here (CREATE DATABASE ... TEMPLATE, §4) ───
if [ -x "$WORKTREE/.pandacorp/worktree-setup.sh" ]; then
  echo "  • project hook .pandacorp/worktree-setup.sh"
  PANDACORP_WORKTREE_SLUG="$SLUG" bash "$WORKTREE/.pandacorp/worktree-setup.sh"
fi

# ── 5. Manifest entry (DR-096 §7) — written to the MAIN checkout so every session + MC can read it ──
bootstrap_write_manifest

echo "▸ worktree ready. Other active worktrees:"
ls "$MANIFEST_DIR" 2>/dev/null | sed 's/\.json$//' | sed 's/^/    - /' || true
