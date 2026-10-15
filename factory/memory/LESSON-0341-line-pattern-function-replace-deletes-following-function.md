---
id: LESSON-0341
type: gotcha
domain: code-editing
tags: [patch-tool, regex, code-generation, one-liner, text-replace]
context: a text-pattern-based "replace this function" patch helper locates a function's end by searching for the next line matching `\n}\n`
trigger: use this when writing or using a helper that finds a function's boundaries by searching for a closing-brace line pattern rather than parsing structure
source: "pandasaga .pandacorp/run/lessons.md 2026-10-14 (agent-inferred): a 'replace function' patch helper searching for the next \"\\n}\\n\" to find a function's end silently deleted the FOLLOWING function when the target function was written as a one-liner (`function f() { ... }`, no standalone closing-brace line)"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0008]
---

**Situation:** a patch helper replacing a named function located its end by text-searching for the next
line that was just a closing brace (`\n}\n`). For a target function written as a single line
(`function f() { ... }`, no standalone closing-brace line of its own), that search skipped past the
target entirely and matched the closing brace of the NEXT function in the file — the helper then
silently replaced the target's text through to that later brace, deleting the next function whole.

**Lesson:** any text-pattern search for "the end of this code block" (a closing brace on its own line, a
specific indentation level, a blank line) is only valid for the subset of code that happens to be
formatted that way. A one-line function, a function with its own nested one-liners, or any code with
unconventional formatting breaks the assumption invisibly — the search doesn't fail, it finds a WRONG
but plausible-looking boundary and overwrites past it with no error.

**Apply next time:** when writing or relying on a line-pattern-based code-replacement helper, bound the
search to the next TOP-LEVEL construct of the same kind (e.g. the next `function `/`const `/`class `
declaration at the same indentation), or verify after the fact that the replaced span contains exactly
one instance of the target construct before writing — never trust a bare closing-brace-line search alone.
