---
description: Configures the Pandacorp factory for a new owner (first run after cloning the repo). It interviews you in depth —name, goals, interests, hobbies, tastes, assets/levers, monetization appetite, project types, how you work— and saves your profile in factory/profile.md (personal, gitignored). That profile feeds /discover and /recommend to propose ideas well aligned with you. Use when cloning the repo, or when the owner says "configure", "onboarding", "make the factory mine", or "update my profile".
---

# /pandacorp:onboarding

The **first step** when cloning Pandacorp. It turns a generic factory into *your* factory:
it interviews you and saves your profile in `factory/profile.md`, which the rest of the skills and agents
read to personalize themselves — and most especially so that **`/discover` and `/recommend`
propose ideas well aligned with you** (not generic).

Runs IN the factory root. It is **idempotent**: re-running it updates the profile
(it reads what's already there and only asks for what's missing or what you want to change).

## Steps

1. **Greeting and context** (brief). Explain in 2-3 lines what the factory is: a software
   assembly line that is 100% AI where the owner directs with gates and the agents build. Say
   why you're interviewing: to recommend ideas aligned with them, not generic ones. If
   `factory/profile.md` already exists, offer to update it instead of starting from scratch.

2. **Interview** (conversational, in short batches — not a form all at once). Cover, and
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
   - **How you work**: strengths and weaknesses (e.g. "weak in design").

3. **Write the profile**: copy `factory/profile.example.md` → `factory/profile.md` (if it
   doesn't exist) and fill it in: complete the frontmatter (`nombre`, `github`, `ruta_proyectos`,
   `nivel_tecnico`, `idioma`, `objetivos`, `intereses`, `hobbies`, `gustos`, `disgustos`,
   `activos`, `apetito_monetizacion`, `tipos_proyecto`) and the prose sections with what was
   discussed. **Never invent data**: whatever they haven't said, leave empty and say so.
   `factory/profile.md` is personal (gitignored) — it is not uploaded.

4. **Portfolio bootstrap**: if `factory/portfolio.md` doesn't exist, create it by copying
   `factory/portfolio.example.md`.

5. **Close with the next steps**, personalized to the profile:
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
- It is the only skill meant to be run when cloning; the rest assume there is already a profile.
