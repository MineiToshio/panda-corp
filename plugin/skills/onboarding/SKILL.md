---
name: onboarding
description: Configures the Pandacorp factory for a new owner (first run after cloning the repo). It interviews you in depth —name, goals, interests, hobbies, tastes, assets/levers, monetization appetite, project types, how you work— and saves your profile in factory/profile.md (personal, gitignored). That profile feeds /discover and /recommend to propose ideas well aligned with you. Use when cloning the repo, or when the owner says "configure", "onboarding", "make the factory mine", or "update my profile".
---

# /pandacorp:onboarding

The **first step** when cloning Pandacorp. It turns a generic factory into *your* factory:
it interviews you and saves your profile in `factory/profile.md`, which the rest of the skills and agents
read to personalize themselves — and most especially so that **`/discover` and `/recommend`
propose ideas well aligned with you** (not generic).

Runs IN the factory root. It is **idempotent**: re-running it updates the profile
(it reads what's already there and only asks for what's missing or what you want to change).

The profile is a **living document** (DR-053): onboarding *bootstraps* it from the owner's
past conversations, and from then on it grows continuously as the owner talks to the factory
(the capture rule lives in panda-corp's `CLAUDE.md` and in every product project's
`.pandacorp/guide.md`). So the interview is a head start with context, not an interrogation from zero.

## Steps

1. **Greeting and context** (brief). Explain in 2-3 lines what the factory is: a software
   assembly line that is 100% AI where the owner directs with gates and the agents build. Say
   why you're interviewing: to recommend ideas aligned with them, not generic ones. If
   `factory/profile.md` already exists, offer to update it instead of starting from scratch.

2. **Bootstrap from history (ASK FIRST — DR-053).** Before interviewing, look for the owner's
   past Claude Code conversations and offer to learn from them so the interview starts warm:
   - **Detect**: list the project transcript folders `~/.claude/projects/*/` (each is a project;
     count the `*.jsonl` files in each). **Archived** sessions are included (the files stay on disk);
     **deleted** ones are gone — say so if asked.
   - **Ask the owner, yes/no**: *"Encontré conversaciones en N proyectos. ¿Quieres que saque
     contexto sobre ti de ahí para no empezar de cero?"* If **no** → skip straight to the interview.
     If **yes** → run the funnel below.
   - **The funnel — cheap by design (don't read transcripts raw).** A single transcript can be tens of
     MB but ~0.4% of it is human-typed text; the rest is tool results, code and assistant output. So:
     1. *Layer 0 (free)*: read any already-distilled auto-memory about the owner if present.
     2. *Layer 1 (mechanical, 0 model tokens)*: extract ONLY the owner's typed turns across the chosen
        projects with `jq` — this strips ~99.6% of the bulk before any model reads anything:
        ```bash
        for f in ~/.claude/projects/*/*.jsonl; do
          jq -r 'select(.type=="user") | (.message.content)
                 | if type=="string" then .
                   elif type=="array" then ([.[]? | select(.type=="text") | .text] | join("\n"))
                   else empty end' "$f" 2>/dev/null
        done > /tmp/pandacorp-owner-corpus.txt
        ```
     3. *Layer 2 (agents)*: fan out a few subagents over that compact corpus (chunk by project/size),
        each extracting **structured personal signal** — interests, hobbies, tastes/dislikes, goals,
        assets/levers, project types, how they work — and **ignoring orchestration/agent prompts**
        (injected `# Contexto…` blocks are not the owner talking). Synthesize into one draft profile.
   - **Present, don't assume**: show the owner *"esto es lo que ya sé de ti"* (a short, organized
     summary of what was inferred) and then interview FROM there — confirm, correct, fill gaps —
     never re-asking what's already solid. Mark anything uncertain as a guess to confirm.

3. **Interview** (conversational, in short batches — not a form all at once). Cover, and
   **ask follow-ups to nail down the concrete** (vague answers give vague recommendations):
   - **Name**: how you want the factory to call you.
   - **Who you are / what you do**: what you do for a living, context.
   - **Interests and hobbies**: topics that interest you, what you do in your free time. These are
     the "lens" through which the factory will filter ideas.
   - **Tastes and dislikes**: what draws you to build and what you would avoid or bores you.
   - **Goals**: the real mix — income, tools for your life, opening doors,
     learning, positioning yourself. Don't assume it's all about money.
   - **Assets and levers**: do you have an audience/community, a network of contacts, access to
     a niche, particular skills or data? This changes what's worth it: an idea with modest
     monetary return can be worth a lot if it leverages a lever of yours or opens doors for you.
   - **Monetization appetite**: high / medium / low / open. Are you after money, or also (or
     above all) value and opportunity?
   - **Project types**: what interests you? The factory is open to **any tech
     solution**: web app, mobile app, rework, Claude Code project/tooling, prompt or
     prompt system, automation, etc.
   - **GitHub**: user/organization where the repos are created (DR-010 creates them private by
     default). If they don't use GitHub, leave it empty.
   - **Projects path**: folder where projects are born. By default, the sibling of the
     factory (empty = that default).
   - **Language**: documents and conversation (default Spanish).
   - **Country**: where you're based — conditions which markets/languages are easiest and highest-ROI to launch a product in (used by `spec`'s launch research, DR-041).
   - **How you work**: strengths and weaknesses (e.g. "weak in design").

4. **Write the profile**: copy `factory/profile.example.md` → `factory/profile.md` (if it
   doesn't exist) and fill it in: complete the frontmatter (`name`, `github`, `country`, `projects_path`,
   `technical_level`, `language`, `goals`, `interests`, `hobbies`, `likes`, `dislikes`,
   `assets`, `monetization_appetite`, `project_types`) and the prose sections with what was
   discussed. **Never invent data**: whatever they haven't said, leave empty and say so.
   `factory/profile.md` is personal (gitignored) — it is not uploaded.

5. **Portfolio bootstrap**: if `factory/portfolio.md` doesn't exist, create it by copying
   `factory/portfolio.example.md`.

6. **Close with the next steps**, personalized to the profile:
   - For the factory to go look for ideas aligned with you: `/pandacorp:discover`.
   - To capture an idea of your own: `/pandacorp:new-idea` (or `/pandacorp:explore` if it's fuzzy).
   - To ask for a ranking: `/pandacorp:recommend`.
   - The full flow is in `CLAUDE.md`.

## Rules
- **Don't upload personal data**: `factory/profile.md` and `factory/portfolio.md` are gitignored.
  If you notice that `factory/profile.md` ended up tracked, warn (something is wrong in `.gitignore`).
- **Don't invent the profile**: when in doubt, ask; whatever wasn't said stays empty.
- **Nail down the vague**: a concrete profile (interests, assets, appetite) is what makes
  `/discover` and `/recommend` hit the mark. It's worth asking follow-ups.
- **The profile keeps growing on its own (DR-053)**: don't treat this as the only chance to learn the
  owner. The continuous-capture rule (panda-corp `CLAUDE.md` + each project's `.pandacorp/guide.md`)
  appends durable personal facts as they come up in any conversation. Onboarding seeds it; daily talk feeds it.
- It is the only skill meant to be run when cloning; the rest assume there is already a profile.
