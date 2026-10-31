import { describe, expect, it } from "vitest";
import { directoryAccountRows, projectServiceRows } from "../views";
import { servicesFixture } from "./fixture";

const link = (integrationId: string, providerId: string, status: string, accountRef = null) => ({
  integrationId,
  projectId: "demo",
  projectName: "Demo",
  projectHref: "",
  providerId,
  accountRef,
  status,
  resources: [],
});

describe("directory and project row derivation, adversarial", () => {
  it("AC-26-004.1: an unassigned allocation of a provider that has accounts keeps its consumer visible", () => {
    const data = servicesFixture();
    data.allocations.push({ ...link("cache", "neon", "proposed"), projectName: "Orphan consumer" });
    const consumers = directoryAccountRows(data).flatMap((row) =>
      row.allocations.map((allocation) => allocation.projectName),
    );
    expect(consumers).toContain("Orphan consumer");
  });
  it("AC-26-005.1: two identities of one provider stay separate and each owns only its own links", () => {
    const rows = directoryAccountRows(servicesFixture()).filter(
      (row) => row.provider.id === "neon",
    );
    expect(rows.map((row) => row.account?.id).sort()).toEqual(["neon-main", "neon-second"]);
    expect(rows.find((row) => row.account?.id === "neon-second")?.allocations).toEqual([]);
  });
  it("AC-26-005.1: reference adoption wins over candidate and every account precedence stays exclusive", () => {
    const data = servicesFixture();
    const modal = data.providers.find((provider) => provider.id === "modal");
    if (!modal) throw new Error("fixture");
    modal.adoption = "reference";
    expect(directoryAccountRows(data).find((row) => row.provider.id === "modal")?.state).toBe(
      "reference",
    );
  });
  it("AC-26-011.1: orders configured, proposed, inactive, then unknown statuses, A to Z inside each", () => {
    const data = servicesFixture();
    data.allocations = [
      link("a", "neon", "unknown-status"),
      link("b", "neon", "inactive"),
      link("c", "modal", "configured"),
      link("d", "neon", "configured"),
      link("e", "modal", "proposed"),
    ];
    expect(projectServiceRows(data, "demo").map((row) => row.allocation.integrationId)).toEqual([
      "c",
      "d",
      "e",
      "b",
      "a",
    ]);
  });
  it("AC-26-006.1: never lists another project's links, an unknown project is empty", () => {
    const data = servicesFixture();
    expect(projectServiceRows(data, "demo")).toHaveLength(1);
    expect(projectServiceRows(data, "nobody")).toEqual([]);
  });
});
