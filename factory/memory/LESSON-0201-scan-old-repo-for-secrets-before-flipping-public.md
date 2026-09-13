---
id: LESSON-0201
type: gotcha
domain: security
tags: [repo-visibility, secrets, pii, publishing-checklist]
context: an owner asks to make an old/inactive private repository public
trigger: use this before flipping ANY existing private repository to public, especially an old one the owner describes as "it's old, just publish it"
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-06 (agent-inferred) — github.com/MineiToshio/Bildin (private) contained a 10.9MB SQL Server backup with real client/agent records, a second SQL dump, a Web.config with live SQL Server and Azure SQL credentials, and a plaintext SendGrid API key"
provenance: agent-inferred
created: 2026-09-07
status: candidate
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0241]
---

**Situation:** the owner asked to flip an old private repo public ("es un proyecto antiguo") without
knowing what was actually in it. The repo contained a 10.9MB SQL Server backup of a real estate portal
with real client/agent records, a second large SQL dump, a `Web.config` with live SQL Server and Azure
SQL credentials, and a plaintext SendGrid API key. The request was refused and escalated instead of
executed.

**Lesson:** an owner's "it's old, just publish it" is a judgment about the repo's AGE/relevance, not about
its CONTENTS — the two are independent, and an old repo is exactly the kind that accumulated real
credentials/data before better hygiene existed.

**Apply next time:** before flipping any existing repository from private to public, enumerate its tree
for `*.bak|*.sql|web.config|*.pfx|*.key` (or the local-stack equivalent) and grep configs/scripts for
credential-shaped strings — do this even when (especially when) the owner frames the request as routine.
Independent of the publish decision, flag any credential found this way for rotation, regardless of
whether the repo ends up public.
