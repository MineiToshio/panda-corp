---
id: BL-0301
type: bug
area: build-engine
title: "Factory engine corpus fails 10 suites on clean Ubuntu"
status: doing
severity: p1
opened: 2026-10-31
source: "Owner-supplied factory-engine-tests GitHub Actions log, 41 passed / 10 failed"
---

## Problem

The CI job runs the full corpus without zsh, Codex, Acorn, Playwright or Chromium.
Several fixtures also assume a configured Git author or a working host sleep service;
the Manual oracle references a file deleted by `519570d1`. Installing Codex alone
exposes another assumption: `doctor` requires credentials and provider reachability.

## Repair

See `plugin/docs/engine-tests.md` and plugin decision log v9.148.1. The branch `fix/engine-tests-ci` contains the repair. Test assertions remain strict,
including real parser/browser oracles and revocation exit/call/state checks.

## Done when

Run the unchanged complete corpus on Ubuntu/Node 24 with the declared dependencies.
Local sandbox limitations (process inspection, local sockets and protected `.codex`
writes) must remain visible; they cannot justify skipping or weakening tests.
Linux behaviour remains to be proven by CI.

## Local evidence (2026-10-31)

The local clean-environment run passed all 51/51 suites with Codex 0.144.1. Linux
behaviour remains to be proven by CI.
