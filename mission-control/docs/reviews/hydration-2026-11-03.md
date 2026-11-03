# Deferred shell hydration investigation (2026-11-03)

## Reproduction and root cause

Next 16.4.3 is installed (`node_modules/next/package.json`). With the default Playwright
configuration and frozen `e2e/server-env.json` fixtures, the architecture/keyboard tests pass;
the following client-navigation tests produce the errors. The existing selected suites passed
12/12 while the server logged three uncaught hydration errors. The new browser regression
records both `pageerror` and console errors together with `page.url()`. On the original code,
its final red run failed 6/8 cases. Observed destination URLs:

- `http://127.0.0.1:3986/board`: server `Inicio`, client `Tablero`.
- `http://127.0.0.1:3986/configuration`: server `Portafolio`, client `Configuración`.

The async root-layout `LocationSlot` retains server HTML under Suspense. A client route transition
can happen after AppShell hydration but before ShellLocation hydration, changing its `usePathname`
value. The same timing affects `ProjectsSlot`/`ProjectNavItem`: server `aria-current="page"`,
client undefined. Direct loads do not change the pathname between SSR and hydration, explaining
the previously clean cold-route sweep and the timing-dependent non-failures.

The mismatch is route identity, not time, locale, randomness, localStorage or theme. It reproduced
with frozen data in both themes and with no production-code changes between red runs. The exact
server/client text and component stack locate the changing input at `usePathname`; the sibling
audit also inspected AppShell, Nav, theme snapshots and URL-state server seeds. No concurrent
writer was needed: the isolated original-code browser run reproduced it with one worker.

## Exact React diagnostic

The first complete text diagnostic from the final red run follows (React itself abbreviates
ancestor frames with `...`). The same diagnostic for `/board` changes Inicio to Tablero.

```text
[browser] Uncaught Error: Hydration failed because the server rendered text didn't match the client. As a result this tree will be regenerated on the client. This can happen if a SSR-ed Client Component used:

- A server/client branch `if (typeof window !== 'undefined')`.
- Variable input such as `Date.now()` or `Math.random()` which changes each time it's called.
- Date formatting in a user's locale which doesn't match the server.
- External changing data without sending a snapshot of it along with the HTML.
- Invalid HTML tag nesting.

It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.

https://react.dev/link/hydration-mismatch

  ...
    <SegmentViewNode type="layout" pagePath="layout.tsx">
      <SegmentTrieNode>
      <link>
      <script>
      <script>
      <RootLayout>
        <html lang="es" suppressHydrationWarning={true}>
          <head>
          <body>
            <NavigationProvider>
              <AppShell location={{...}} counts={{inicio:2,tablero:4, ...}} projects={{...}} guild={{...}} pills={[...]} ...>
                <SkipLink>
                <div id="app" className="app AppShe..." data-testid="app-shell" data-sidebar="expanded" ...>
                  <Sidebar>
                  <div>
                  <div className="main AppSh...">
                    <TopBar location={{...}} active="configuracion" open={false} onOpen={function handleOpen}>
                      <header className="topbar App...">
                        <IconButton>
                        <img>
                        <div id="where" className="where AppS...">
                          <Suspense fallback={{...}}>
                            <LocationSlot>
                              <ShellLocation projects={[...]}>
                                <span
+                                 title="Configuración"
-                                 title="Portafolio"
                                >
+                                 Configuración
-                                 Portafolio
                                ...
                    ...
              ...

    at <unknown> (https://react.dev/link/hydration-mismatch)
    at span (<anonymous>)
    at ShellLocation (src/components/modules/AppShell/ShellLocation.tsx:42:7)
    at LocationSlot (src/app/layout.tsx:151:12)
    at RootLayout (src/app/layout.tsx:87:19)
  40 |   return (
  41 |     <>
> 42 |       <span title={title}>{title}</span>
     |       ^
  43 |       <small>{subtitle}</small>
  44 |     </>
  45 |   );
```

## Initial fix and verification (superseded)

`useHydratedPathname` returns a neutral pathname in SSR and the first hydration render, then
Next's live pathname. ShellLocation initially displays the existing localized brand; deferred
project rows initially omit `aria-current`. URL-derived project/tab snapshots remain unchanged.
No warning suppression was added. No persisted data, style, token, copy or logical data model changed.

Commands below use the installed pnpm 10.12.1 path listed under Environment. Browser commands
include the remote endpoint, worktree TMPDIR and polling environment described there.

| Command | Result |
| --- | --- |
| `pnpm exec playwright test e2e/shell-hydration.spec.ts` (original production code) | Exit 1; 6 failed, 2 passed (19.8s). Both text and aria-current diagnostics captured. |
| Same regression command after the fix | Exit 0; 8 passed (17.5s). |
| `pnpm exec playwright test e2e/frd-19-app-shell.reviewer.spec.ts e2e/shell-usability.spec.ts e2e/shell-hydration.spec.ts` | Exit 0; 156 passed (2.3m), zero text/attribute hydration diagnostics in server output. |
| `pnpm exec vitest run src/components/modules/AppShell/_tests src/components/modules/Nav/_tests` | Exit 0; 13 files, 61 tests passed. Includes three controlled SSR-to-hydration route transitions. |
| `pnpm exec tsc --noEmit` | Exit 0, also rechecked after restoring next.config.ts. |
| `pnpm exec biome check` (five changed TS/TSX files) | Exit 0; formatting/import order corrected. |
| `git diff --check` | Exit 0. |

The browser run still emits the pre-existing CampaignPipeline CSS keyframe parser warnings;
those also appeared before the fix and are outside this hydration change.

An independent read-only reviewer found no blocking defects and reran 19 targeted component/URL
unit tests plus TypeScript successfully. Its noted coverage limit is that ProjectNavItem's
attribute race is guarded by the browser regression rather than a dedicated SSR unit test.

The native watcher config was restored after browser validation. No reviewer suite or baseline
was edited. The initial commit is 1e65ce45 on `fin/hydration`. The SSR correction below remains uncommitted, without landing or push.

## SSR correction after independent owner review

The initial neutral pathname removed hydration errors by removing route identity from SSR.
That was a regression: JavaScript-disabled /board and /configuration served Pandacorp, and
/portfolio/mission-control/summary omitted the project's aria-current="page". The reviewer
correctly rejected that delivery. Its earlier passing navigation tests did not verify server HTML.

AppShell now captures its first pathname with `useState(() => pathname)` and exposes it through
InitialPathnameContext. Each deferred island hydrates using that captured route; after hydration
useHydratedPathname returns Next's current pathname. Without context it uses the current pathname.
The initial snapshot is never synchronized after navigation. Thus SSR retains its original title
and project attributes while late hydration can still reconcile against that original HTML.

Red evidence before changing production code:

- renderToString unit tests: three semantic failures (missing Tablero, Configuración and current
  project aria-current), five existing tests passed.
- `pnpm exec playwright test e2e/shell-ssr.spec.ts`: six failures across desktop/mobile; received
  Pandacorp instead of both route titles and an absent project aria-current. JavaScript was disabled.

The controlled deferred-hydration tests now supply the original context pathname explicitly,
matching AppShell's earlier hydration. An AppShell rerender test verifies that the captured pathname
stays unchanged when the live route changes. The SSR tests also exercise the standalone fallback.

The new SSR unit tests pass after the change: the focused two-file run went from three semantic
failures to green within the full AppShell/Nav/navigation run (29 files, 153 tests). The
JavaScript-disabled browser suite went from six failures to six passes; the focused SSR plus
hydration navigation run passed 14/14 (22.6s), without hydration diagnostics.

The first follow-up full browser attempt entered an HMR reload loop, with repeated Fast Refresh,
empty changed-module lists, aborted/ECONNRESET requests and hydration-marker timeouts. It was
interrupted, not counted as a green run. A diagnostic captured repeated navigation to /board;
the exact reload reason was not established. The server then stopped responding (curl timed out).
The same source passed the focused browser suites using a new dedicated distDir
`.next-hydration-ssr` and fixture port 3987. This separates clean-runtime validation from the
inconclusive existing dev-cache failure; it does not prove the cache was the underlying cause.
Both temporary configuration changes are restored after testing.

Follow-up commands (using the pnpm 10.12.1 absolute path described below):

| Command | Result |
| --- | --- |
| `pnpm exec vitest run src/components/modules/AppShell/_tests/ShellLocation.hydration.test.tsx src/components/modules/Nav/_tests/project-nav-item.test.tsx` before the correction | Exit 1: 3 failed, 5 passed. Failures are the two SSR titles and current project attribute. |
| `pnpm exec playwright test e2e/shell-ssr.spec.ts` before the correction | Exit 1: all 6 failed. |
| `pnpm exec vitest run src/components/modules/AppShell/_tests src/components/modules/Nav/_tests src/lib/navigation/_tests` after the correction | Exit 0: 29 files, 153 passed. |
| `pnpm exec playwright test e2e/shell-ssr.spec.ts e2e/shell-hydration.spec.ts --max-failures=1` with fresh runtime | Exit 0: 14 passed (22.6s), including all 6 no-JavaScript SSR checks. |
| `pnpm exec biome check` on the 7 changed/new TS/TSX files | Exit 0. |

Final full browser validation:

- `pnpm exec playwright test e2e/shell-ssr.spec.ts e2e/shell-hydration.spec.ts e2e/shell-usability.spec.ts e2e/frd-19-app-shell.reviewer.spec.ts --max-failures=1`: exit 0, **162 passed (2.4m)**.
- Server-output scan: **zero** `Hydration failed` and **zero** `A tree hydrated` diagnostics.
- `pnpm exec tsc --noEmit` after restoring next.config.ts, server-env.json, tsconfig.json and generated next-env.d.ts references: **exit 0**.
- `git diff --check`: **exit 0**. Ports **3900, 3929 and 3987** have no listeners after testing.

The native-watcher limitation remains. Final browser validation used WATCHPACK_POLLING=true,
temporary watchOptions.pollIntervalMs=1000, a fresh dedicated build directory and port 3987;
PW_TEST_CONNECT_WS_ENDPOINT was ws://127.0.0.1:4950/pw and TMPDIR was
`$PWD/.pandacorp/run/hydration-ssr`. No temporary configuration changes remain in the diff.
Generated build and node cache artifacts were moved into the ignored evidence directory; no files
were deleted. The first interrupted dev process could not be signaled across the sandbox, and
its exact HMR reload cause remains unverified; no result from that attempt is claimed green.
The new e2e tuple matrix is `as const` after TypeScript caught unchecked tuple destructuring.
An independent follow-up review found no production-mechanism defect; its 31 targeted tests passed.
It correctly noted the initial SSR review omission and the now-updated documentation.
Raw follow-up logs live in `.pandacorp/run/hydration-ssr/`. No commit or landing is authorized for
this correction. New deliverable files are `e2e/shell-ssr.spec.ts` and
`src/lib/navigation/InitialPathnameContext.ts`.

## Environment and limits

The unmodified default server could not start in the sandbox: `unable to start FSEvent stream`.
`TURBO_TASKS_FORCE_WATCH_MODE=nonrecursive` failed identically. To run Turbopack, only local
watching was temporarily adapted: `watchOptions: { pollIntervalMs: 1000 }` in next.config.ts and
`WATCHPACK_POLLING=true`. Playwright used its default config, fixture port 3986, both projects,
one worker and zero retries, with `PW_TEST_CONNECT_WS_ENDPOINT=ws://127.0.0.1:4950/pw` and
`TMPDIR="$PWD/.tmp/hydration"`. The Next config adaptation is excluded from the deliverable.

The system pnpm initially ran the tests but later failed resolving its package-manager lockfile
with an EPERM error; disabling its version management exposed pnpm 12's incompatible settings.
Subsequent checks invoke the already installed repository-declared pnpm 10.12.1 at
`/Users/sergio/Library/pnpm/.tools/pnpm/10.12.1/bin/pnpm`; no dependencies or lockfiles changed.

The user prohibited verify.sh, merge/push, baseline changes and reviewer-suite edits. No full gate,
production build or exact-default native-watcher browser run is claimed. LESSON-0185 and
LESSON-0480 informed environment attribution. Raw run logs are retained in `.pandacorp/run/hydration-evidence/hydration/`
locally; this report records the durable diagnostic.
