---
description: Accessibility — semantic HTML, keyboard & focus management, forms, motion, landmarks, WCAG 2.2 (drag, focus visibility, accessible auth).
applies_when: web-ui
globs: ["**/*.tsx", "**/*.jsx"]
source: Pandacorp standard — patterns (a11y)
---

# Accessibility (target: WCAG 2.2 AA)

## Semantic HTML & contrast
- Use semantic elements (`<button>` for actions, `<a>`/`<nav>` for navigation, `<main>`/`<section>`/`<header>`/`<article>`). **No `<div onClick>`.** Provide `type`, `aria-*` where needed.
- WCAG **AA contrast**; visible focus states; touch targets: **44px design target, 24px gated floor** (WCAG 2.2 SC 2.5.8, fail-closed in the Responsive Gate — DR-074). Verify with axe-core.
- **Never convey meaning by color/shape/position alone** (required fields, status pills, chart series, errors) — add text or an icon.

## Keyboard & focus
- Everything operable by mouse is operable by **keyboard**; logical tab order.
- **Modal dialogs**: move focus in on open, **trap** Tab/Shift+Tab inside, close on **Escape**, and **return focus to the trigger** on close.
- **Focus must not be obscured** by sticky headers/banners/widgets (WCAG 2.2 SC 2.4.11) — use `scroll-margin`.
- Provide a keyboard-reachable **skip link** as the first focusable element.

## Forms
- Every field has a programmatic label (`<label for>` or `aria-labelledby`). On error, set `aria-invalid="true"` + `aria-describedby` pointing to the error text; convey the error by text, not color alone.

## Motion
- Respect **`prefers-reduced-motion: reduce`** — disable/soften animations, parallax, autoplay motion.

## Structure
- Landmarks (`main`/`nav`/`header`/`footer`), exactly **one `<h1>`**, no skipped heading levels. (axe: `region`, `landmark-one-main`, `heading-order`)

## WCAG 2.2 specifics
- **Dragging has a single-pointer alternative** (SC 2.5.7): reorder/sliders/kanban also work with plain click/tap.
- **Accessible authentication** (SC 3.3.8): no cognitive-test-only login; password/OTP fields **allow paste** and don't block password managers/autofill (`autocomplete` set).
