import { expect, it } from "vitest";
import { extractSections } from "../sections";

it("AC-05-008.4 keeps only criterion lines, including indented and lazy continuations", () => {
  const markdown = `## Acceptance Criteria
Owned criteria follow:

- **AC-05-008.4** — WHEN opened THEN it SHALL read **facts** and \`paths\`.
  A wrapped line belongs to the criterion.

  An indented continuation belongs too.
- **AC-12-005.2** — IF no event arrived
THEN the view SHALL stay consistent.

Also satisfied here without owning the criterion: REQ-05-001.

**Completeness and NFRs.** These are not another criterion.
- An unrelated checklist item.
## Status Note
Built`;
  expect(extractSections(markdown).criteria).toEqual([
    {
      id: "AC-05-008.4",
      text: "WHEN opened THEN it SHALL read **facts** and `paths`.\n  A wrapped line belongs to the criterion.\n\n  An indented continuation belongs too.",
    },
    { id: "AC-12-005.2", text: "IF no event arrived\nTHEN the view SHALL stay consistent." },
  ]);
});

it("AC-05-008.4 excludes subheadings and trailing prose from numbered criteria", () => {
  expect(
    extractSections(`## Definition of done
1. Read it.
2. Keep it.
### Notes
Not part of criterion 2.`).criteria,
  ).toEqual([{ text: "Read it." }, { text: "Keep it." }]);
});
