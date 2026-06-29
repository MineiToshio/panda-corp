# Surface playbooks (DR-101)

Per-surface design playbooks for content/portfolio-style products, captured so future projects do
**not** have to re-research the same best practices live. Born from `personal-page-v2` (2026-06-28):
the per-surface quality (a case study, a Now page, a blog post) had to be researched on the canvas one
screen at a time. These are the durable answers.

**How to use them.** When `/pandacorp:design` (EXPLORE + Claude Design) generates a surface that matches
one of these, the generation prompt for that screen carries the matching playbook, and the per-screen
review (the rubric in `factory/standards/design.md` §12) checks the screen against it. They are
**defaults to adapt to the project's voice and tokens**, not a fixed template — never carry one
project's literal content into another (DR-098). They describe *content structure and hierarchy*, not a
palette.

Cross-cutting rules every playbook below inherits (canonical in `factory/standards/design.md`):
- **Weight = importance (§9).** The surface's primary action gets prominent treatment; the conversion
  is never an undersized one-line link.
- **One shared closing `cta-band` (§7).** Every page closes with the SAME cta-band component, not a
  per-page ad-hoc "let's talk" line.
- **Real content, never invented (§10).** Lists, cards, stacks, archives are derived from the owner's
  real sources; description lengths are balanced so cards align.
- **Don't open with a context-free hero (§9).** Lead with title + context + at-a-glance facts; imagery
  is contained and secondary.

---

## Case study (project detail)

A recruiter/peer skims a case study in **under 60 seconds** and wants proof of judgement, not a gallery.

- **Lead with the outcome, not a full-bleed cover.** Open with a **two-column header**: text + facts on
  the left (title, a one-line context: what the project is + timeframe), a **contained** image on the
  right — never a big context-free cover image as the first thing.
- **At-a-glance bar near the top:** Role · Timeframe · Team · Stack · headline result. The headline
  result (the metric or shipped outcome) is the most prominent fact.
- **"What I did" = 3 key decisions + the WHY**, not one flat paragraph — show the *process thinking*
  (the trade-off, why this choice). This is the part that proves seniority.
- **Structure:** context → problem → what I did (3 decisions + why) → impact (metrics) → optional
  **"what it proves"** takeaways → `cta-band`.
- Images are contained/aspect-ratio framed (MediaFrame), with placeholder media so the layout renders
  before real assets exist.

## Now page

A "Now" page answers *what is this person focused on right now* — its value is **freshness**.

- **The "Last updated" date is the hero** (optionally with a relative recency, e.g. "updated 3 weeks
  ago"). A stale Now page is worse than none.
- **Scannable, first-person momentum blocks** (Building / Writing / Learning / Open to…), standardized —
  **no special-casing one block** (e.g. no unique green "Building" treatment); labels are legible, not
  over-muted.
- **Each status block links to its artifact** (Building → the relevant case study; Writing → the blog;
  "open to the right problems" → Contact) — a Now page that lists activity but links nowhere wastes the
  intent.
- **Close with the shared `cta-band`** (same as every other page), not a tiny text nudge.

## Blog index

- **Featured hero post** at the top (the one to read first), then the rest.
- **Tag filter is DERIVED dynamically** from the union of tags across published posts — never a
  hardcoded chip list; an "All" chip clears the filter. Clicking a tag filters the list.
- **"Recent / more from the blog" renders only when there is more than one published post** (graceful
  degradation: with 0–1 posts show only the featured post or the empty state).
- **RSS** is offered (a feed link/icon).
- Each post card carries balanced metadata (title, date, reading time, tags) so cards align.

## Blog post

- **Reading-progress bar** at the top.
- **Sticky table of contents** with the **active section** highlighted (same-page anchors use smooth
  scroll, reduced-motion-safe).
- **Syntax-highlighted code blocks with a copy button** (use a copy/clipboard icon, not an arrow).
- **Measure ~65–75 characters** per line for the prose column (readability).
- Close with **share links + a short author bio (real social URLs) + related posts**; design the **404**
  for a missing/unpublished slug.

## Contact

The contact page IS the conversion — it gets the most deliberate hierarchy, never a one-line link.

- **Single-column form** (low cognitive load), with the full field state set (label, inline error,
  success, loading, rate-limited).
- **Multiple low-friction paths:** the form **plus** a direct `mailto:` **plus** social links — let the
  visitor pick their channel.
- **Set the response expectation** ("what happens next" / typical reply time) — it raises completion.
- **Scope discipline:** for a personal/portfolio contact page, **no booking calendars, pricing packages
  or testimonials** unless the product is actually selling a service — they add friction and read as
  salesy.

## Projects / archive

- **A small set of FEATURED projects** (e.g. 4) with full cards, then a **compact archive** of the rest
  built from **real data** (the owner's `projects.json` / repos — descriptions condensed, never
  invented), 3 per row, **equal-height cards** with short, balanced descriptions.
- **"For more, see my GitHub →"** affordance after the archive (real URL, new tab) instead of padding
  the archive with everything.

## Stack / tools

- **Grouped, compact chips** (by layer: language / framework / data / tooling…), derived from the
  owner's **real** repos and tools — not an aspirational list.
- **Real brand logos** where available, rendered in **ONE consistent icon treatment** (a single icon
  color) — no meaningless decorative dots, no rainbow of brand colors fighting the palette.
- Exclude tools the owner hasn't actually used.

---

Related canonical standards: `factory/standards/design.md` §7 (cohesion / shared cta-band), §9
(hierarchy & proportion), §10 (real content), §11 (two-stage cadence + explicit prompts), §12 (the
per-screen review rubric). Generation flow: `plugin/skills/design/SKILL.md` (EXPLORE / Claude Design
path). Policy: DR-101 (+ DR-058 generation mechanism, DR-062 cohesion).
