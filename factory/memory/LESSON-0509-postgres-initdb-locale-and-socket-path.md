---
id: LESSON-0509
type: gotcha
domain: infra
tags: [postgresql, homebrew, macos, initdb, locale, unix-socket]
context: bootstrapping a native (non-Docker) PostgreSQL instance via Homebrew on macOS for local/test-harness use
trigger: use this when `initdb` (Homebrew PostgreSQL on macOS) fails with an "invalid locale" error, or a Postgres server fails to start with a unix-socket path error
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-21/22 (agent-inferred)"
provenance: agent-inferred
created: 2026-10-23
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** `initdb` on a Homebrew-installed native PostgreSQL failed with "configuración regional
inválida" ("invalid locale") under a Spanish-language macOS shell `LANG`; separately, pointing the data
directory at a long nested path (a session scratchpad) made the server fail to start because the Unix
domain socket path (`<datadir>/.s.PGSQL.<port>`) exceeded the ~103-byte OS limit.

**Lesson:** `initdb` inherits the invoking shell's `LANG`/`LC_ALL` and fails outright if that locale isn't
one the Postgres build supports/has compiled in — a non-English shell locale is a real, reproducible
blocker, not a coincidence. Independently, Postgres derives its default Unix socket path from the data
directory path, and macOS/BSD caps that path length near 103 bytes — a data directory nested under a long
session/scratch path can silently exceed it even though `initdb` itself succeeded.

**Apply next time:** force a plain locale explicitly regardless of the shell's own: `LANG=C LC_ALL=C
initdb --locale=C -D <datadir>`. If the data directory lives under a long or deeply nested path, start the
server with `-k ''` (empty `unix_socket_directories`, TCP-only) or relocate the data directory to a short
path, rather than assuming any filesystem location works for the socket.
