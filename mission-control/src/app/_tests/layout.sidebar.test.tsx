import { Children, isValidElement, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AchievementToast } from "@/components/modules/AchievementToast/AchievementToast";
import { AppShell, type AppShellProps } from "@/components/modules/AppShell/AppShell";
import { PendingPill } from "@/components/modules/AppShell/PendingPill";
import { PluginPill } from "@/components/modules/AppShell/PluginPill";
import { GuildCard } from "@/components/modules/GuildBar/GuildCard";
import RootLayout from "../layout";

const readers = vi.hoisted(() => ({
  projects: vi.fn(),
  turn: vi.fn(),
  proposals: vi.fn(),
  ideas: vi.fn(),
  guild: vi.fn(),
  plugin: vi.fn(),
  last: vi.fn(),
  trophies: vi.fn(),
  worktrees: vi.fn(),
}));
vi.mock("@/lib/profile/profile", () => ({ readProfile: () => ({ present: true }) }));
vi.mock("@/lib/portfolio/sidebarProjects", () => ({ getSidebarProjects: readers.projects }));
vi.mock("@/lib/inicio/turn", () => ({ ownerTurnItems: readers.turn }));
vi.mock("@/lib/proposals/ownerActions", () => ({ ownerActions: readers.proposals }));
vi.mock("@/lib/ideas/ideas", () => ({ getIdeaCounts: readers.ideas }));
vi.mock("@/lib/inicio/guild", () => ({ inicioGuild: readers.guild }));
vi.mock("@/lib/inicio/achievement", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/inicio/achievement")>()),
  guildAchievements: readers.trophies,
}));
vi.mock("@/lib/plugin-sync/plugin-sync", () => ({ getPluginSyncState: readers.plugin }));
vi.mock("@/lib/pendingMerge/worktreesByRepo", () => ({ getWorktreesByRepo: readers.worktrees }));
function find<T>(node: unknown, type: unknown): ReactElement<T>[] {
  if (!isValidElement<{ children?: React.ReactNode }>(node)) return [];
  const matches = node.type === type ? [node as ReactElement<T>] : [];
  return [
    ...matches,
    ...Children.toArray(node.props.children).flatMap((child) => find<T>(child, type)),
  ];
}
beforeEach(() => {
  vi.clearAllMocks();
  readers.projects.mockReturnValue([]);
  readers.turn.mockReturnValue({ count: 3, errors: [] });
  readers.proposals.mockReturnValue({ badgeCount: 2, errors: [] });
  readers.ideas.mockReturnValue({ totalIdeas: 3, ideasDiscarded: 1 });
  readers.guild.mockReturnValue({ level: { level: 3, title: "Rank", xp: 230, pctToNext: 23 } });
  readers.plugin.mockReturnValue({ drift: true, installedVersion: "1", sourceVersion: "2" });
  readers.last.mockReturnValue({ title: "Fresh", fresh: true });
  readers.trophies.mockReturnValue([
    { name: "Fresh", unlocked: true, condition: "Real result", isNew: true },
  ]);
  readers.worktrees.mockResolvedValue([
    {
      id: "factory",
      name: "Factory",
      path: "/fixture",
      kind: "ok",
      branches: [{ name: "work" }],
      state: "cleanNow",
    },
  ]);
});
describe("root layout sidebar wiring", () => {
  it("AC-19-005.1 AC-19-005.2 AC-09-008.1 AC-09-008.2 AC-15-006.1: forwards canonical facts and mounts exactly one notice", () => {
    const tree = RootLayout({ children: "Page" });
    const shell = find<AppShellProps>(tree, AppShell)[0];
    expect(shell?.props.counts).toEqual({ inicio: 3, tablero: 2, propuestas: 2 });
    expect(readers.projects).not.toHaveBeenCalled();
    expect(find<{ level: unknown }>(shell?.props.guild, GuildCard)[0]?.props.level).toBe(
      readers.guild.mock.results[0]?.value.level,
    );
    expect(find<{ state: unknown }>(shell?.props.pills, PluginPill)[0]?.props.state).toBe(
      readers.plugin.mock.results[0]?.value,
    );
    const notices = find<{ achievements: unknown }>(tree, AchievementToast);
    expect(notices).toHaveLength(1);
    expect(notices[0]?.props.achievements).toEqual([
      {
        id: "Fresh",
        title: "Fresh",
        description: "Real result",
        fresh: true,
      },
    ]);
    for (const reader of [
      readers.turn,
      readers.proposals,
      readers.ideas,
      readers.guild,
      readers.plugin,
      readers.trophies,
    ])
      expect(reader).toHaveBeenCalledTimes(1);
  });
  it("defers project reads to their Suspense slot and exposes failures independently", async () => {
    const shell = find<AppShellProps>(RootLayout({ children: "Page" }), AppShell)[0];
    expect(readers.projects).not.toHaveBeenCalled();
    const suspense = shell?.props.projects as ReactElement<{ children: ReactElement }>;
    const slot = suspense.props.children.type as () => Promise<ReactElement<{ projects: unknown }>>;
    const rows = [{ id: "one" }];
    readers.projects.mockResolvedValueOnce(rows);
    expect((await slot()).props.projects).toBe(rows);
    readers.projects.mockRejectedValueOnce(new Error("unreadable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await slot()).props.projects).toBeNull();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
  it("AC-21-008.1 AC-21-008.2: streams the shared worktree summary and exposes unreadable failures", async () => {
    const shell = find<AppShellProps>(RootLayout({ children: "Page" }), AppShell)[0];
    const pills = shell?.props.pills as ReactElement<{ children: React.ReactNode }>;
    const suspense = Children.toArray(pills.props.children).find(
      (node) => isValidElement(node) && typeof node.type !== "function",
    ) as ReactElement<{ children: ReactElement }>;
    const slot = suspense.props.children.type as () => Promise<ReactElement<{ summary: unknown }>>;
    expect((await slot()).type).toBe(PendingPill);
    expect((await slot()).props.summary).toEqual({
      count: 1,
      urgent: true,
      unreadable: 0,
      hidden: false,
    });
    readers.worktrees.mockRejectedValueOnce(new Error("unreadable"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await slot()).props.summary).toEqual({
      count: 0,
      urgent: false,
      unreadable: 1,
      hidden: false,
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
  it("partial proposal errors preserve the authoritative badge while unrelated failed slots stay unavailable", () => {
    readers.turn.mockReturnValue({ count: 99, errors: [{ message: "read failed" }] });
    readers.proposals.mockReturnValue({ badgeCount: 99, errors: [{ message: "read failed" }] });
    readers.projects.mockImplementationOnce(() => {
      throw new Error("read failed");
    });
    readers.guild.mockImplementationOnce(() => {
      throw new Error("read failed");
    });
    readers.trophies.mockImplementationOnce(() => {
      throw new Error("read failed");
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const tree = RootLayout({ children: "Page" });
    const shell = find<AppShellProps>(tree, AppShell)[0];
    expect(shell?.props.counts).toEqual({ inicio: undefined, tablero: 2, propuestas: 99 });
    expect(shell?.props.guild).toBeNull();
    expect(find<{ achievements: unknown }>(tree, AchievementToast)[0]?.props.achievements).toEqual(
      [],
    );
    expect(find(shell?.props.pills, PluginPill)).toHaveLength(1);
    log.mockRestore();
  });
});
