---
id: LESSON-0248
type: gotcha
domain: build-engine
tags: [agentType, version-skew, plugin-update, lease, pre-loop, guaranteed-shutdown, graceful-degradation]
context: a build/orchestration engine that references a newly-introduced agent/worker type, launched by a session whose resident runtime/plugin may still be on an older version (a version bump that applies at session restart, not mid-session)
trigger: use this when adding a new agent/worker type to an orchestration engine, or when designing/reviewing how an engine's very first action (before any scheduler loop or error-handling boundary exists) can fail
source: "mission-control .pandacorp/run/lessons.md 2026-09-22 (agent-inferred), corroborated by factory/backlog/BL-0141 (branch fix-engine-agenttype-fallback, not yet merged to main as of this harvest) and commit beb713ad: canary A (run wf_4cef213a-463 / wf_35a54be4-172, 2026-09-22) launched the 9.103.0 build engine — which now dispatches the newly-introduced 'pandacorp:mech' agent type (WP-03) — from a Claude Code session still resident on plugin 9.102.3. The runtime rejected the very FIRST agent() spawn ('agent type pandacorp:mech not found'), before the engine's scheduler loop (and its error-handling boundaries) even existed, leaving status.yaml at running:true and the atomic build lease held until freed by hand."
provenance: agent-inferred
created: 2026-09-22
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0113]
---

**Situation:** a plugin/engine release introduced a new agent type (`pandacorp:mech`) used at the very
first call site of a build run (`baseline-precheck`). A session that had already updated the plugin FILES
on disk but had not yet restarted (a Claude Code plugin update only takes effect at session restart) still
resolved the old runtime, which did not recognize the new type. The engine's `agent()` wrapper had no
error handling at all, so the rejection propagated straight out of a call made BEFORE the scheduler loop —
and therefore before any of the guaranteed-shutdown boundaries that protect every failure INSIDE the loop
— existed. The whole run died on its first action, leaving `running: true` and the atomic lease held; an
owner had to release it by hand.

**Lesson:** a version-skew window between "the files on disk are updated" and "the running session's
resident runtime has picked up the update" is not a rare edge case for a long-lived session working
against fast-iterating engine code — it is the ORDINARY case whenever a build is launched shortly after
its own tooling changed. Two independent gaps compound the risk: (1) referencing a brand-new type/capability
at a pipeline's FIRST call site means any incompatibility crashes before ANY of the pipeline's own recovery
machinery (loop-level try/catch, `ensureStopped()`, lease release) has a chance to run — pre-loop code is
outside every safety net the loop itself provides; (2) a bare pass-through wrapper around a capability
dispatch (here, `agent()`) with no retry/fallback treats "capability temporarily unrecognized by this
session" the same as "this call is fundamentally broken," when the former is a transient, recoverable
condition (the next session restart fixes it) and should degrade, not crash.

**Apply next time:** (1) any PRE-LOOP await in an orchestration engine — a precheck spawn, a planner call,
anything that runs before the scheduler loop exists — needs the SAME guaranteed-shutdown boundary
(`try { … } catch { release lease; running:false; rethrow }`) the loop's own failure branches already get;
don't assume "early" code is safe just because nothing has gone wrong there before. (2) when introducing a
NEW capability/agent type that a dispatch wrapper references, make the wrapper degrade gracefully on an
"unknown type" rejection specifically (retry once with a documented fallback type, sticky for the rest of
the run to avoid repeat-paying the same guaranteed failure) rather than let a generic exception propagate —
distinguish "this exact type isn't recognized yet" (retryable, likely a version-skew symptom) from any
other failure (never retried). (3) the true preventive fix — warning the owner "the plugin updated but
this session hasn't restarted" BEFORE a build launches into the skew — is a separate, smaller, still-open
follow-up (a launch-time version-skew preflight comparing the session's resident plugin version against the
installed one); the runtime fallback above is the safety net, not a substitute for that preflight.
