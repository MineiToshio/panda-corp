---
id: LESSON-0024
type: library-verdict
domain: payments
tags: [payments, stripe, polar, paddle, gumroad, latam, peru]
context: choosing a payment processor for a product whose operator/owner is based in Peru
trigger: use this when selecting a payment processor and the operating owner is based in Peru (or a similarly Stripe-unsupported LatAm country)
source: "panda-corp research 2026-07-01 — access-tested against each provider's official supported-countries list"
provenance: agent-inferred
created: 2026-07-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** the factory's default payments stack (`factory/standards/external-services.md`) assumes
Polar, but an owner operating from Peru needs to know which processors actually support payout there
before a blueprint locks in a choice.

**Lesson:** as of 2026-07-01, Stripe does NOT operate in Peru (no direct Stripe account) — this also
rules out anything that requires a Stripe account underneath it, e.g. ExtensionPay. Confirmed viable
for a Peru-based owner: Polar (official supported-country list includes Peru; runs on Stripe Connect
Express under the hood, so it works even though direct Stripe doesn't), Paddle (payout via Payoneer),
Gumroad (payout to a local bank). Lemon Squeezy is unconfirmed and in limbo after its acquisition by
Stripe — treat as unverified, re-check before relying on it.

**Apply next time:** when the owner/operator is based in a country Stripe doesn't directly support,
verify payment-processor viability against the owner's country BEFORE it reaches the blueprint's stack
choice, and prefer Polar/Paddle/Gumroad over anything that silently requires a direct Stripe account.
