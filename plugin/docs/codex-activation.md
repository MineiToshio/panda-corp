# Codex plugin activation and trust

Codex enforcement has two separate states: **source-certified** and **active in a user session**.
Repository tests can prove the first; only an explicit local install and hook-trust decision can
produce the second. Neither state alone authorizes build writes: PORT-5 still requires the certified
executor and governed-transition evidence.

## Source certification

From the factory root:

```bash
node plugin/scripts/generate-codex-enforcement.mjs
node plugin/scripts/test-codex-enforcement.mjs
codex --strict-config doctor --summary --no-color
```

The test corpus covers dangerous commands, recursive protected-state deletion, malformed payloads,
missing `jq`, runtime-local dispatch, fenced build-state CLI calls, red Stop behavior, Codex config,
execpolicy and deterministic projections. Claude's `plugin/hooks/hooks.json` is not generated or
changed by this path.

## Disposable install canary

Validate packaging without changing the owner's configured Codex home:

```bash
TEMP_CODEX_HOME="$(mktemp -d)"
CODEX_HOME="$TEMP_CODEX_HOME" codex plugin marketplace add "$PWD" --json
CODEX_HOME="$TEMP_CODEX_HOME" codex plugin add pandacorp@panda-corp --json
CODEX_HOME="$TEMP_CODEX_HOME" codex plugin list --json
```

Remove only that newly created temporary directory after inspection. Never reuse or clean the real
`$CODEX_HOME` as part of a test.

## Owner activation gate

Activation is an explicit local action:

```bash
codex plugin marketplace add /absolute/path/to/panda-corp
codex plugin add pandacorp@panda-corp
```

On the first session after installation, review and trust the exact Pandacorp hook definitions when
Codex prompts. A hook content change invalidates that trust and must be reviewed again. Never bypass
hook trust for an interactive or production build. After activation, run live canaries in a disposable
Pandacorp fixture: a protected-state delete must be denied; a malformed hook payload must fail closed;
and a red `.pandacorp/verify.sh` must prevent Stop. Record the installed Codex version and canary output
before changing the capability matrix from source-certified to live-certified.

## Rollback

Disable or remove only `pandacorp@panda-corp` through the Codex plugin CLI, then start a fresh Codex
session. Do not delete `.codex/`, `plugin/`, `.pandacorp/`, or the marketplace source directory. A
rollback removes active enforcement, so Codex immediately returns to the narrower PORT-5 permission
boundary; Claude continues using its unchanged registration.
