---
id: LESSON-0325
type: gotcha
domain: tooling
tags: [codex-cli, model-override, chatgpt-account, image-generation]
context: running `codex exec` from this machine when the Codex CLI's default model is rejected by the account's actual subscription tier
trigger: use this when invoking `codex exec` on this machine and it fails with a 400 "model not supported" (or similar) error, especially for image-generation calls
source: "funko-tracker .pandacorp/comms/iteration.md ronda 18, 2026-10-13 (agent-inferred): codex CLI's default model on this machine (a recent gpt-6.1-class id) was rejected by the owner's ChatGPT-account-linked Codex with a 400 model-not-supported error; passing an explicit older-generation model id (gpt-5.6-class) via `-m` worked, including for image generation. Corroborated on a SECOND, distinct project (pandasaga, .pandacorp/run/lessons.md, 2026-10-13/14, agent-inferred): the same account-side model-rejection pattern recurred, confirming `-m <older-generation id>` (gpt-5.6-sol worked there) as the general fix rather than a one-off; also found two related but DISTINCT gotchas on the same CLI: `codex exec -i <FILE>...` is variadic and swallows a trailing prompt argument (\"No prompt provided via stdin\") — pass the prompt on stdin with `-` instead; and image-generation calls can return transient 503s with exit code 0 even though no file was written, so a caller must retry with backoff AND verify the output file actually exists rather than trusting the exit code."
provenance: agent-inferred
created: 2026-10-15
status: active
promotion: proposed   # 2026-10-15 (librarian review) — target: factory/standards/agent-portability.md's Codex section, add as a short "codex exec CLI gotchas" appendix: (1) a model-not-supported 400 is an account-tier mismatch, not a missing capability — retry with an explicit `-m <older-generation id>`, verified against a recent working run since account-side availability can shift; (2) `-i <FILE>` is variadic and swallows a trailing prompt argument — pass the prompt via stdin with a literal `-`; (3) an image-generation 503 can exit 0 with no file written — retry with backoff and verify the output file exists, never trust the exit code alone. Corroborated across 2 distinct projects (funko-tracker, pandasaga) with the same fixes recurring. Caveat worth the owner's own judgment: this is CLI-version/account-tier specific and may go stale faster than most standards entries — a narrower "known gotchas" note rather than a MUST rule may be the right shape if promoted.
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** `codex exec` on this machine defaults to a newer model id than the owner's
ChatGPT-account-linked Codex subscription actually supports, so an unqualified invocation fails with a
400 "model not supported" error — including for image-generation requests, which otherwise work fine
once the right model is selected.

**Lesson:** the Codex CLI's locally-configured default model is not guaranteed to match what the
specific linked account/subscription tier actually supports; a 400 model-rejection error from `codex
exec` on this machine is a model-selection mismatch, not a sign that the requested capability
(including image generation) is unavailable.

**Apply next time:** when `codex exec` on this machine fails with a model-not-supported error, retry
with an explicit `-m <older-generation model id>` override rather than concluding the capability
(e.g. image generation) doesn't work — confirm the currently-working override id against a recent
successful run before relying on it, since account-side model availability can change.

**Corroborated, plus two related CLI gotchas (pandasaga, 2026-10-13/14):** the model-override fix
reproduced verbatim on a second, independent project, confirming it as a general fix rather than a
one-off. Two further distinct gotchas on the same CLI surfaced in the same build: (1) `codex exec -i
<FILE>...` is a variadic flag that greedily consumes the rest of the argv, including what was meant as
the trailing prompt text, failing with "No prompt provided via stdin" — pass the prompt via stdin with a
literal `-` argument instead of appending it after `-i <file>`. (2) image-generation calls can return a
transient 503 while still exiting 0 with NO file written — never trust exit code alone; retry with
backoff and verify the expected output file actually exists on disk before proceeding.
