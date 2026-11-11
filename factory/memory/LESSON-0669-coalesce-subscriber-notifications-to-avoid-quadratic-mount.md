---
id: LESSON-0669
type: pattern
domain: frontend-performance
tags: [react, subscription-store, quadratic, rendering-performance, tbt]
context: a list/grid of N items where each item mounts a subscription to a shared store, and the store notifies ALL current subscribers synchronously on every state change (including every new subscriber's own mount)
trigger: use this when a list/grid's hydration or mount performance is dominated by a shared subscription store, and each item's mount itself triggers a store notification
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-11 (agent-inferred): My Collection's hydration Total Blocking Time was dominated by an O(n²) ownership-store wake-up — every card's mount notified EVERY existing subscriber, so mounting N cards fired roughly N² notification callbacks; coalescing notifications into a single microtask cut TBT from 591ms to 157ms, more than `content-visibility` alone had achieved."
provenance: agent-inferred
created: 2026-11-11
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0660]
---

**Situation:** a collection view mounted N item cards, each subscribing to a shared ownership store on
mount. The store's subscribe/notify implementation synchronously notified every CURRENT subscriber
whenever anything changed — including each new card's own subscription event — so mounting N cards
triggered on the order of N² notification callbacks. This dominated hydration Total Blocking Time;
`content-visibility` (deferring off-screen rendering) helped but left the underlying O(n²) work intact
for whatever was still on-screen.

**Lesson:** a shared store that notifies ALL subscribers synchronously on every change is linear-cost per
notification, but when the SOURCE of notifications is itself proportional to the list size (every mount
is also a notification-triggering event), the combination becomes quadratic in list size — a cost that
scales invisibly during development (small test data) and only shows up at production catalog scale. A
viewport-based optimization (virtualization, `content-visibility`) reduces how much of the O(n²) surface
is active at once, but does not fix the underlying notification fan-out for whatever IS rendered.

**Apply next time:** when a list/grid's items each subscribe to a shared store, check whether a mount
event itself fires a store-wide notification — if so, coalesce notifications into a single microtask
(batch all subscriber callbacks from the same synchronous burst of mounts into one flush) rather than
firing one notification pass per individual mount; this fixes the quadratic cost directly, and compounds
with (rather than substitutes for) a viewport-based rendering optimization.
