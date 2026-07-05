---
description: Accessibility — semantic HTML, keyboard & focus management, forms, motion, landmarks, WCAG 2.2 (drag, focus visibility, accessible auth).
applies_when: web-ui
globs: ["**/*.tsx", "**/*.jsx"]
source: Pandacorp standard — accessibility
---

# Accessibility (target: WCAG 2.2 AA)

(A11y basics — alt text, button types, click-without-keyboard, roles/aria misuse — are enforced by Biome's `a11y` group in the canonical `biome.json`, and the 24px tap-target floor by the Responsive Gate (axe `target-size`, DR-074); fix the gate's message, don't argue with it.)

## Semantics & perception
- Semantic elements always: `<button>` for actions, `<a>`/`<nav>` for navigation, `<main>`/`<section>`/`<header>`. **No `<div onClick>`.**
- WCAG **AA contrast**; visible focus states; touch targets **44px design target** (24px is only the gated floor). Verify with axe-core.
- **Never convey meaning by color/shape/position alone** (required fields, status pills, chart series, errors) — add text or an icon.
- Landmarks (`main`/`nav`/`header`/`footer`), exactly **one `<h1>`**, no skipped heading levels.

## Keyboard & focus
- Everything mouse-operable is **keyboard**-operable; logical tab order.
- **Modal dialogs**: move focus in on open, **trap** Tab/Shift+Tab, close on **Escape**, **return focus to the trigger** on close.
- Focus must not be obscured by sticky headers/banners (SC 2.4.11) — use `scroll-margin`.
- Keyboard-reachable **skip link** as the first focusable element.

## Forms
- Every field has a programmatic label (`<label for>` / `aria-labelledby`). On error: `aria-invalid="true"` + `aria-describedby` → the error text; error conveyed by text, not color alone.

## Motion & WCAG 2.2 specifics
- Respect **`prefers-reduced-motion: reduce`** — disable/soften animations, parallax, autoplay motion.
- **Dragging has a single-pointer alternative** (SC 2.5.7): reorder/sliders/kanban also work with plain click/tap.
- **Accessible authentication** (SC 3.3.8): no cognitive-test-only login; password/OTP fields **allow paste** and don't block password managers (`autocomplete` set).
