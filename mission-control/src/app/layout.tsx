/**
 * Root layout — Server Component.
 *
 * Guard: calls readProfile() at load time.
 * IF { present: false } → renders <OnboardingGate /> instead of children
 *   (AC-01-001.1: gate is the entire view; nothing else renders behind it).
 * IF { present: true } → renders children normally.
 *
 * Traceability:
 *   CMP-01-onboarding-gate (layout guard) → REQ-01-001 → AC-01-001.1
 *   Depends on WO-01-002 (readProfile, lib/profile.ts)
 */

import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingGate } from "@/app/_components/OnboardingGate/OnboardingGate";
import { GamificationLedgerSync } from "@/components/dashboard/GamificationLedgerSync/GamificationLedgerSync";
import {
  type AchievementNotice,
  AchievementToast,
} from "@/components/modules/AchievementToast/AchievementToast";
import { AppShell } from "@/components/modules/AppShell/AppShell";
import { PendingPill } from "@/components/modules/AppShell/PendingPill";
import { PluginPill } from "@/components/modules/AppShell/PluginPill";
import { SidebarProjects } from "@/components/modules/AppShell/SidebarProjects";
import { ThemeToggle } from "@/components/modules/AppShell/ThemeToggle";
import { GuildCard } from "@/components/modules/GuildBar/GuildCard";
import { now } from "@/lib/clock/clock";
import { getIdeaCounts } from "@/lib/ideas/ideas";
import { guildAchievements } from "@/lib/inicio/achievement";
import { isFreshAchievement } from "@/lib/inicio/achievementSelection";
import { inicioGuild } from "@/lib/inicio/guild";
import { ownerTurnItems } from "@/lib/inicio/turn";
import { summarizeWorktrees } from "@/lib/pendingMerge/pillSummary";
import { getWorktreesByRepo } from "@/lib/pendingMerge/worktreesByRepo";
import { getPluginSyncState } from "@/lib/plugin-sync/plugin-sync";
import { getSidebarProjects } from "@/lib/portfolio/sidebarProjects";
import { readProfile } from "@/lib/profile/profile";
import { ownerActions } from "@/lib/proposals/ownerActions";
import { THEME_BOOT_SCRIPT } from "@/lib/theme/bootScript";
import "./globals.css";

// Local always-on deploy: the production build is served as a stable snapshot via launchd, but the
// app is a LIVE dashboard over the factory filesystem — so every route must render per-request (read
// the current status.yaml / ideas / portfolio), never freeze at build time. force-dynamic on the root
// layout makes all routes dynamic (SSR per request). Live surfaces also push deltas via SSE (/api/live).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pandacorp Mission Control",
  description: "Centro de control local y de solo lectura de la fábrica Pandacorp.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Guard: read the factory profile at load time (read-only, never calls Claude).
  // Path resolved at call-time inside readProfile() so PANDACORP_FACTORY_ROOT env is respected.
  const profileResult = readProfile();

  const { turn, proposals, ideas, guild, plugin, achievement } = readSidebarData(
    profileResult.present,
  );
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Boot script (IF-13-theme): sets data-theme and the sidebar preference before first paint, so
            there is no flash of the wrong theme. Static source, rendered in the root layout only. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static first-party boot script, no user input */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        {/* Tabler Icons webfont — same CDN version as the prototype (index.html line 8).
            Provides .ti .ti-* icon classes used by PageTitle, SectionHead, Tabs,
            ConfigurationShell, ManualShell, SectionHero and other components (DR-054). */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.31.0/dist/tabler-icons.min.css"
        />
      </head>
      <body>
        {profileResult.present ? (
          <>
            <AppShell
              counts={{
                inicio: turn && !turn.errors.length ? turn.count : undefined,
                tablero: ideas ? ideas.totalIdeas - ideas.ideasDiscarded : undefined,
                propuestas:
                  proposals && !proposals.errors.length ? proposals.badgeCount : undefined,
              }}
              projects={
                <Suspense fallback={null}>
                  <ProjectsSlot />
                </Suspense>
              }
              guild={guild ? <GuildCard level={guild.level} /> : null}
              pills={
                <>
                  <PluginPill state={plugin} />
                  <Suspense fallback={null}>
                    <PendingSlot />
                  </Suspense>
                </>
              }
              footer={<ThemeToggle />}
            >
              {children}
            </AppShell>
            <AchievementToast achievements={achievement ?? []} />
            {/* Reconcile durable accounting on every route; direct navigation to
                Logros/Configuración must not depend on visiting Inicio first. */}
            <GamificationLedgerSync />
          </>
        ) : (
          <OnboardingGate />
        )}
      </body>
    </html>
  );
}

/** Each optional slot fails independently; unreadable facts never turn into zero counts. */
function readSlot<T>(name: string, read: () => T): T | null {
  try {
    return read();
  } catch (error) {
    console.error(`Sidebar ${name} unavailable`, error);
    return null;
  }
}
function noticeData(): AchievementNotice[] {
  const nowIso = now().toISOString();
  return guildAchievements()
    .filter((item) => item.unlocked && isFreshAchievement(item, nowIso))
    .sort((a, b) => (Date.parse(b.date ?? "") || 0) - (Date.parse(a.date ?? "") || 0))
    .map((item) => ({
      id: item.name,
      title: item.name,
      description: item.condition,
      fresh: true,
    }));
}
/** Project git reads start after the shell can stream. */
async function ProjectsSlot(): Promise<React.JSX.Element> {
  try {
    return <SidebarProjects projects={await getSidebarProjects()} />;
  } catch (error) {
    console.error("Sidebar projects unavailable", error);
    return <SidebarProjects projects={null} />;
  }
}
/** Git traversal streams without delaying the rest of the shell. */
async function PendingSlot(): Promise<React.JSX.Element | null> {
  try {
    return <PendingPill summary={summarizeWorktrees(await getWorktreesByRepo())} />;
  } catch (error) {
    console.error("Sidebar worktrees unavailable", error);
    return <PendingPill summary={{ count: 0, urgent: false, unreadable: 1, hidden: false }} />;
  }
}

function readSidebarData(present: boolean) {
  if (!present)
    return {
      turn: null,
      proposals: null,
      ideas: null,
      guild: null,
      plugin: null,
      achievement: null,
    };
  return {
    turn: readSlot("owner turn", ownerTurnItems),
    proposals: readSlot("owner actions", ownerActions),
    ideas: readSlot("ideas", getIdeaCounts),
    guild: readSlot("guild", inicioGuild),
    plugin: readSlot("plugin", getPluginSyncState),
    achievement: readSlot("achievement", noticeData),
  };
}
