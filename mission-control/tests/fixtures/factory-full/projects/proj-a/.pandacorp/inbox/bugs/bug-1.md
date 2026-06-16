# BUG-001 — readIdeas crashes on malformed frontmatter

**Reported:** 2026-06-14
**Status:** open

## Description
When `idea-malformed.md` has broken YAML, `readIdeas` throws instead of skipping the card.

## Steps to reproduce
1. Add a card with unterminated YAML string in `factory/ideas/`
2. Call `readIdeas()`
3. Observe: unhandled exception instead of a skipped card

## Expected behavior
`readIdeas` skips the malformed card, logs a warning, and returns the valid cards.

## Root cause
`gray-matter` throws on malformed YAML; the reader does not catch the exception per-card.
