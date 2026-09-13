---
id: LESSON-0238
type: gotcha
domain: devops
tags: [libreoffice, macos, homebrew, docx-to-pdf, fontconfig, headless]
context: converting a .docx to PDF via headless LibreOffice on macOS, or installing LibreOffice on macOS for that purpose
trigger: use this when needing headless docx-to-pdf conversion on macOS and considering `brew install --cask libreoffice`, or when a converted PDF's fonts don't match the source document
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-11 (agent-inferred, 2 facets) — (1) on this Mac, brew install --cask libreoffice fails twice over: the cask definition errors ('undefined method command_wrapper') until brew update, and brew update itself fails because /opt/homebrew is not owned by the user; download the official LibreOffice .dmg and copy the .app into ~/Applications (no sudo) instead of fighting Homebrew. (2) headless LibreOffice on macOS (dmg build) silently substitutes Liberation Sans for Arial when converting .docx->PDF, even outside the sandbox, because its headless backend uses its bundled fontconfig which never scans /System/Library/Fonts/Supplemental. Fix: write a fonts.conf listing /System/Library/Fonts, /System/Library/Fonts/Supplemental and /Library/Fonts, then run FONTCONFIG_FILE=<fonts.conf> SAL_USE_VCLPLUGIN=svp soffice --headless --convert-to pdf; verify with pdffonts (ArialMT embedded). Liberation Sans is metric-compatible, so page counts were already valid even before the fix."
provenance: agent-inferred
created: 2026-09-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** needed to render a `.docx` to PDF headlessly on macOS to check its output, first hitting a
broken Homebrew cask install, then a silent font substitution in the resulting PDF.

**Lesson:** (1) `brew install --cask libreoffice` can fail twice on a given Mac — the cask definition
itself errors until `brew update` runs, and `brew update` can separately fail if `/opt/homebrew` isn't
owned by the current user; downloading the official `.dmg` and copying the `.app` into `~/Applications`
(no sudo, no Homebrew) sidesteps both failures. (2) Headless LibreOffice's `.dmg` build on macOS silently
substitutes Liberation Sans for Arial during `.docx`→PDF conversion, even when run outside a sandbox,
because its bundled fontconfig never scans `/System/Library/Fonts/Supplemental` (where Arial lives on
macOS). Liberation Sans is metric-compatible, so page/line counts stay correct even with the substitution
— but the rendered font is visibly wrong. Fix: point `FONTCONFIG_FILE` at a custom `fonts.conf` that lists
`/System/Library/Fonts`, `/System/Library/Fonts/Supplemental` and `/Library/Fonts`, then run with
`SAL_USE_VCLPLUGIN=svp`; verify the fix with `pdffonts` (should show `ArialMT` embedded, not Liberation
Sans).

**Apply next time:** for headless LibreOffice docx→PDF checks on macOS, install via the official `.dmg`
into `~/Applications` rather than fighting Homebrew, and always verify the output's embedded fonts with
`pdffonts` — set a custom `FONTCONFIG_FILE` covering the macOS system font directories if the source
document uses fonts like Arial that aren't in LibreOffice's bundled fontconfig scan path.
