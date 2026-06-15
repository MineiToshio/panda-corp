# FRD-02 — Ideas board

Read-only kanban of the idea base, with idea capture, a navigable detail and discard.

## Acceptance criteria (EARS)
- The board SHALL group ideas into columns by `status`: discovered → documented → design → architecture → building → shipped, plus a `discarded` column.
- The board SHALL NOT allow moving cards by hand (drag or arrows): the transitions are written by the skills. The columns SHALL have the same width, be **wide** (not tiny) and have **horizontal scroll** when they don't fit; the text SHALL wrap onto several lines if it doesn't fit.
- WHEN the owner opens "Capture ideas", the system SHALL show the `/pandacorp:new-idea`, `:discover` and `:recommend` commands, each with a description and a copy button.
- WHEN the owner clicks a card, the system SHALL show the card: summary, key points, a navigator of the idea's documents, and the next-step command (with a copy button).
- EACH card SHALL show two labels besides the score: **category** (`project_type`: web, mobile, desktop, ai, claude-code, prompt-system, automation, cli, rework…) and **return** (`return_type`: monetary, opportunity, personal or mixed). The board SHALL allow **filtering by category**.
- WHILE an idea is `building`, the system SHALL show an indicator that it is being built.
- WHEN the owner presses "Discard idea", the system SHALL rewrite `status: discarded` in the `.md` frontmatter, preserving the rest of the file (Pandacorp's only write).

## Edge cases
- Idea with no documents → show only the summary.
- Category (web/mobile/desktop/AI/…), return (monetary/opportunity/personal/mixed) and score are shown with a legend explaining them.
