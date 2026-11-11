---
id: LESSON-0671
type: pattern
domain: testing
tags: [test-philosophy, flaky-tests, root-cause-fix, owner-policy, critical-path]
context: deciding whether a non-deterministic/flaky test should be patched (wider timeout, added retry) or fixed at the root, and deciding whether a given code path needs a test at all
trigger: use this when a test is non-deterministic/flaky, or when deciding whether a given code path even warrants a test
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-09 (owner-stated): 'Una prueba no determinista se arregla de raíz (timers falsos, reloj inyectado, aislamiento de DB, fixtures deterministas) o se elimina; prohibido arreglarla subiendo timeouts o añadiendo reintentos. Las pruebas son para lo crítico (dinero, datos, auth, integridad de publicación, flujos núcleo), no para todo.' Corroborating same-day verdict (owner-stated): the owner questioned spending gate time on 5,153 tests for a mere merge+push, and proposed auditing/trimming the suite down to that scope."
provenance: owner-stated
created: 2026-11-11
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0480]
---

**Situation:** the owner, reacting to both a recurring class of non-deterministic test failures and the
sheer size/runtime of the project's full test suite (5,153 tests, ~20 minutes), stated an explicit
standing policy rather than approving a point-fix each time: fix non-determinism at its actual root cause
or delete the test, and scope testing effort to what is genuinely critical.

**Lesson:** this owner draws a hard line between two things that can look similar in the moment — "this
test is annoying, widen its timeout / add a retry so it stops failing" vs. "this test is non-deterministic
because of a real root cause (uninjected real time, shared DB state, a non-deterministic fixture), fix
that cause or remove the test." Only the second is acceptable; raising timeouts and adding retries treats
the symptom and leaves the real defect (a test that doesn't actually test what it claims to) in place.
Separately, "more tests" is not an unqualified good to this owner — a test suite's size/runtime should be
justified against which paths are actually critical (money, data, auth, publication integrity, core
flows), not allowed to grow by default for every code path.

**Apply next time:** when a test is flaky, diagnose and fix the actual non-determinism (fake/injected
clock, isolated test database, deterministic fixtures) or remove the test — never "fix" it by widening a
timeout or adding a retry (this generalizes LESSON-0480's existing finding that most apparent flakiness is
resource contention, not code regression, into an explicit policy on how it must be fixed). When
proposing new tests or auditing an existing suite's size, scope coverage to critical paths (money, data,
auth, publication integrity, core user flows) explicitly, and treat a bloated low-value test suite as a
legitimate target for trimming, not just growth.
