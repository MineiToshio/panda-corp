# FRD-02 — Ideas board

Read-only kanban of the idea base, with idea capture, a navigable detail and discard.

## Acceptance criteria (EARS)
- The board SHALL place each idea into one of the columns `discovered → documented → design → architecture → building → shipped` (plus a `discarded` column) by **deriving the column from two axes** (the card `status` and, once handed off, the project `phase` — see FRD-01), NOT from the card `status` alone:
  - card `status: discovered` or `recommended` (not handed off yet) → **discovered** column (a `recommended` card SHALL show a "recommended" badge).
  - card `status: in-pipeline` → the column comes from the linked project's `.pandacorp/status.yaml` **phase**: `product`→documented, `design`→design, `architecture`→architecture, `implementation`/`release`→building, `operation`→shipped.
  - card `status: shipped` → **shipped** column; card `status: discarded` → **discarded** column.
  - The board SHALL NOT expect `design`/`architecture`/`building` to ever appear as a card `status` (those columns only come from the project phase). IF an `in-pipeline` card's project or `status.yaml` is missing, THEN it SHALL fall back to the **documented** column without breaking.
- The board SHALL NOT allow moving cards by hand (drag or arrows): the transitions are written by the skills. The columns SHALL have the same width, be **wide** (not tiny) and have **horizontal scroll** when they don't fit; the text SHALL wrap onto several lines if it doesn't fit.
- WHEN the owner clicks "Capture ideas / oportunidades", the system SHALL open a **modal overlay** (dark backdrop + blur) with the four intake commands — `/pandacorp:explore`, `:new-idea`, `:discover` and `:recommend` — each with an icon, title, description and copy-command row. Clicking the backdrop or the ✕ button SHALL close the modal. The board SHALL remain visible behind the modal as context.
- WHEN the owner clicks a card, the system SHALL show the card: summary, key points, a navigator of the idea's documents, and the next-step command (with a copy button).
- EACH card SHALL show two labels besides the score: **category** (`project_type`: web, mobile, desktop, ai, claude-code, prompt-system, automation, cli, rework…) and **return** (`return_type`: monetary, opportunity, personal or mixed). The board SHALL allow **filtering by category**.
- WHILE an idea's project has `running: true` (build in progress, phase `implementation` → "building" column), the system SHALL show an indicator on its card that it is being built.
- WHEN the owner presses "Discard idea", the system SHALL rewrite `status: discarded` in the `.md` frontmatter, preserving the rest of the file (Pandacorp's only write).

## Edge cases
- Idea with no documents → show only the summary.
- Category (web/mobile/desktop/AI/…), return (monetary/opportunity/personal/mixed) and score are shown with a legend explaining them.
