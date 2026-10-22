---
id: LESSON-0481
type: gotcha
domain: local-dev-infra
tags: [macos, firewall, python, lan, local-server]
context: serving a local static mockup/prototype to other devices on the same LAN from macOS
trigger: use this when starting a local HTTP server (e.g. `python3 -m http.server`) on macOS and binding it so other devices on the LAN can reach it
source: "mission-control .pandacorp/run/lessons.md 2026-10-21 (agent-inferred) — serving the Orbita prototype to another device over the LAN"
provenance: agent-inferred
created: 2026-10-22
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: []
---

**Situation:** a local mockup needed to be reachable from a second device on the owner's home LAN.
Starting the server with the Homebrew-installed `python3` and binding `0.0.0.0` produced a server that
started cleanly but was silently unreachable from the other device; starting the identical command with
the system `/usr/bin/python3` worked immediately.

**Lesson:** macOS's Application Firewall authorizes applications individually, not by command name. It
had already allowed `/usr/bin/python3` (the system interpreter) through a prior exception, but a
Homebrew-installed `python3` is a DIFFERENT binary the firewall treats as unauthorized — it silently
drops inbound connections to it while the process itself runs with no error. The machine's LAN IP also
changes between sessions (DHCP), so a hardcoded numeric IP given to the owner once stops working later.

**Apply next time:** when a locally-served mockup/prototype must be reachable from another device on the
LAN, bind `0.0.0.0` and start the server with the interpreter already allowed through the macOS
Application Firewall — prefer `/usr/bin/python3` over a Homebrew `python3` if the latter is silently
unreachable from another device. Give the owner the machine's `.local` hostname alias first (stable
across DHCP renewals) rather than the numeric LAN IP, which can change between sessions.
