/**
 * FRD-17 — REVIEWER wiring gate test (DR-015 / DR-050), rewritten for the v2 surface.
 *
 * `loadProposalsData()` must feed computeSuggestions from real readers (REQ-17-019) and reuse the
 * one lesson read (DR-115); the signals land grouped on Resumen, and each one that routes to a
 * different skill keeps its own command (AC-17-001.2).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadProposalsData } from "@/lib/proposals/data";
import { groupSignals } from "@/lib/proposals/signals";
import type { Suggestion } from "@/lib/self-suggest/self-suggest";
import { SignalGroup } from "../_components/SignalGroup/SignalGroup";

const created: string[] = [];
afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function signal(kind: Suggestion["kind"], command: string, target?: string): Suggestion {
  return {
    kind,
    title: `Señal ${kind}`,
    evidence: "evidencia",
    command,
    target,
    severity: "nudge",
  };
}

describe("FRD-17 gate: the signals are wired to real readers (REQ-17-019)", () => {
  it("a real board pile-up reaches the bundle, with no invented lesson read", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mc-frd17-wire-"));
    created.push(root);
    fs.mkdirSync(path.join(root, "factory/ideas"), { recursive: true });
    for (let index = 0; index < 6; index++)
      fs.writeFileSync(
        path.join(root, "factory/ideas", `idea-${index}.md`),
        `---\ntitle: idea-${index}\nstatus: discovered\n---\n# idea\n`,
      );
    vi.stubEnv("PANDACORP_FACTORY_ROOT", root);
    const data = loadProposalsData();
    expect(data.discoveredIdeas).toBe(6);
    expect(data.suggestions.some((x) => x.kind === "bottleneck")).toBe(true);
  });
});

describe("FRD-17 gate: each signal that routes to its own skill shows it (AC-17-001.2, REQ-17-018)", () => {
  it("a launch review and a policy friction in Otras carry their own copyable command", () => {
    const [group] = groupSignals(
      [
        signal("launch-review", "/pandacorp:review-launch", "proj"),
        signal("policy-friction", "/pandacorp:decide"),
      ],
      10,
    );
    if (!group) throw new Error("expected the Otras group");
    render(<SignalGroup group={group} skillCount={10} />);
    expect(
      screen.getByRole("button", { name: /Copiar \/pandacorp:review-launch/, hidden: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Copiar \/pandacorp:decide/, hidden: true }),
    ).toBeInTheDocument();
  });

  it("the noisy unused-skills group is marked unreliable and asks for no action (AC-17-011.3)", () => {
    const [group] = groupSignals(
      Array.from({ length: 6 }, (_, i) => signal("unused-capability", `/pandacorp:s${i}`, `s${i}`)),
      10,
    );
    if (!group) throw new Error("expected the unused group");
    expect(group.unreliable).toBe(true);
    render(<SignalGroup group={group} skillCount={10} />);
    expect(screen.getByText(/Señal poco fiable/)).toBeInTheDocument();
  });
});
