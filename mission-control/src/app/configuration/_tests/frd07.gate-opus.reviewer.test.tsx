/**
 * FRD-07 GATE — opus reviewer adversarial tests (DR-015).
 *
 * Written by the FRD gate reviewer (a DIFFERENT model from the implementers).
 * These probe REQUIRED EARS behaviors the implementers' own tests did not cover
 * (their 272 tests pass because they only assert what was built — not what the
 * FRD requires). Each test below is anchored to a specific FRD-07 EARS bullet and
 * is RED against the current code, proving the requirement is unmet.
 *
 * Exercises WO-07-005 (the whole Configuración UI surface) TOGETHER with the
 * VERIFIED readers (WO-07-001/003/004) through the real ConfigurationPage Server
 * Component wired to the real factory tree.
 */

import path from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readSkills } from "@/lib/reference/reference";

const FACTORY_ROOT = path.resolve(__dirname, "../../../../../"); // panda-corp root

let prevFactoryRoot: string | undefined;

beforeEach(() => {
  prevFactoryRoot = process.env.PANDACORP_FACTORY_ROOT;
  process.env.PANDACORP_FACTORY_ROOT = FACTORY_ROOT;
});

afterEach(() => {
  if (prevFactoryRoot === undefined) {
    delete process.env.PANDACORP_FACTORY_ROOT;
  } else {
    process.env.PANDACORP_FACTORY_ROOT = prevFactoryRoot;
  }
  vi.restoreAllMocks();
  cleanup();
});

async function renderRealPage() {
  const { default: ConfigurationPage } = await import("../page");
  return render(ConfigurationPage());
}

/** Open the Skills tab and click the first skill card to enter its detail. */
function openFirstSkillDetail(): void {
  fireEvent.click(screen.getByTestId("config-tab-skills"));
  const skills = readSkills();
  const first = skills[0];
  if (!first) throw new Error("real factory should ship skills");
  fireEvent.click(screen.getByTestId(`skill-card-${first.slug}`));
}

// ---------------------------------------------------------------------------
// EARS: "WHERE a command (skill) is shown, the /pandacorp:<slug> chip SHALL
//        offer a copy-to-clipboard action"
// ---------------------------------------------------------------------------

describe("FRD-07 gate (opus) — skill command chip offers copy-to-clipboard", () => {
  it("the skill detail /pandacorp:<slug> chip writes the command to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });

    await renderRealPage();
    openFirstSkillDetail();
    const skill = readSkills()[0];
    if (!skill) return;

    // A copy affordance must exist on the command surface. The shared CopyButton
    // renders data-testid="copy-button"; any copy control on the skill detail
    // satisfies the EARS. We assert one exists and copies the exact command.
    const copyButtons = screen.queryAllByTestId("copy-button");
    expect(
      copyButtons.length,
      "skill detail must offer a copy-to-clipboard action on /pandacorp:<slug> (EARS)",
    ).toBeGreaterThan(0);

    fireEvent.click(copyButtons[0] as HTMLElement);
    expect(writeText).toHaveBeenCalledWith(`/pandacorp:${skill.slug}`);
  });
});

// ---------------------------------------------------------------------------
// EARS: "A skill that is internal SHALL carry an 'interno' flag on its card and
//        in its detail header."
//   The factory ships internal skills (e.g. scaffold, work-orders) — they MUST
//   be marked. The reader/UI carry no 'interno' concept at all today.
// ---------------------------------------------------------------------------

describe("FRD-07 gate (opus) — internal skills carry an 'interno' flag", () => {
  it("at least one internal skill card shows an 'interno' marker", async () => {
    await renderRealPage();
    fireEvent.click(screen.getByTestId("config-tab-skills"));
    const section = screen.getByTestId("config-section-skills");
    // The factory has internal skills (scaffold, work-orders). The surface must
    // surface the 'interno' flag somewhere in the skills section.
    expect(
      /interno/i.test(section.textContent ?? ""),
      "internal skills must be marked 'interno' on the card (EARS)",
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EARS: "The detail of a skill SHALL show what it is for, where it runs, WHAT IT
//        PRODUCES, and a high-level mini-flow."
//   'where it runs' and the flow exist; 'what it produces' is absent.
// ---------------------------------------------------------------------------

describe("FRD-07 gate (opus) — skill detail shows what it produces", () => {
  it("the skill detail includes a 'Produce' section", async () => {
    await renderRealPage();
    openFirstSkillDetail();
    const detail = screen.getByTestId("skill-detail");
    expect(
      /produce/i.test(detail.textContent ?? ""),
      "skill detail must show WHAT IT PRODUCES (EARS)",
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EARS: "The Skills and Agents sections SHALL support cross-navigation: from a
//        skill's detail the owner SHALL be able to jump to any agent it uses,
//        and from an agent's detail to any skill that uses it (clicking the
//        linked chip opens the other item's detail)."
//   The flow chips have no onClick; agent detail lists no using-skills.
// ---------------------------------------------------------------------------

describe("FRD-07 gate (opus) — Skills↔Agents cross-navigation", () => {
  it("agent chips in a skill's flow are clickable (jump-to-agent)", async () => {
    await renderRealPage();

    // Find a skill whose flow renders at least one agent chip.
    const skills = readSkills();
    fireEvent.click(screen.getByTestId("config-tab-skills"));

    let foundClickableChip = false;
    for (const skill of skills) {
      fireEvent.click(screen.getByTestId(`skill-card-${skill.slug}`));
      const flow = screen.queryByTestId("skill-detail-flow");
      if (flow) {
        // A jump-to-agent chip is an interactive element (button or link/role).
        const chips = within(flow).queryAllByRole("button");
        if (chips.length > 0) {
          foundClickableChip = true;
          break;
        }
      }
      // back to the list for the next skill
      const back = screen.queryByTestId("skill-detail-back");
      if (back) fireEvent.click(back);
    }

    expect(
      foundClickableChip,
      "skill flow agent chips must be clickable to jump to the agent's detail (EARS cross-nav)",
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EARS: "When an agent's detail is opened, it SHALL show … an explanation of its
//        model assignment — why it uses opus (judgment work) or sonnet
//        (mechanical, verifiable work)."
//   AgentDetail shows XP + levels-up, but no model-assignment explanation.
// ---------------------------------------------------------------------------

describe("FRD-07 gate (opus) — agent detail explains its model assignment", () => {
  it("the agent detail explains why the agent runs on opus or sonnet", async () => {
    await renderRealPage();
    fireEvent.click(screen.getByTestId("config-tab-agents"));

    // Select the first agent card.
    const cards = screen.getAllByTestId("agent-card");
    expect(cards.length).toBeGreaterThan(0);
    fireEvent.click(cards[0] as HTMLElement);

    const detail = screen.getByTestId("agent-detail");
    const text = (detail.textContent ?? "").toLowerCase();
    // The model name appears AND there is an explanation of judgment vs mechanical
    // work — not merely a bare chip.
    const mentionsModel = text.includes("opus") || text.includes("sonnet");
    const explainsWhy =
      text.includes("juicio") ||
      text.includes("judgment") ||
      text.includes("mecán") ||
      text.includes("mechanical") ||
      text.includes("más capaz") ||
      text.includes("verificable");
    expect(
      mentionsModel && explainsWhy,
      "agent detail must explain its model assignment (opus=judgment / sonnet=mechanical) (EARS)",
    ).toBe(true);
  });
});
