# Replace with the project name

> One-line description: what this is, for whom. This is the repo's front door (GitHub, a brownfield
> adopt, a future contributor) — it answers "what is this" and "how do I run it". It never duplicates
> the PRD/blueprint; point to `docs/` for depth instead of repeating it here.

## What it does

2-4 sentences: the problem it solves, who it's for, the core value. Pulled from the PRD's problem/
value hypothesis — plain language, no jargon.

## Tech stack

The short list (language, framework, DB, key services) — link `docs/product/architecture.md` for the
full picture and the *why*.

## Getting started

Prerequisites (runtime versions, external services/accounts needed).

```bash
# install
<install command>

# configure
cp .env.example .env   # fill in the values — see .env.example for what each one is

# run
<dev command>           # served at http://127.0.0.1:<port>

# test
<test command>
```

## Project structure

One line pointing to `docs/` (product docs, decision log) and `docs/rules/` (engineering rules) for
anyone who wants to go deeper. Don't re-describe the folder layout here — `factory/standards/structure.md`
already owns that.

## Status & docs

- Product spec: `docs/product/prd.md`
- Decision history: `docs/decision-log.md`
- (For an externally launched project) deploy/how it's hosted: link the relevant ADR.
