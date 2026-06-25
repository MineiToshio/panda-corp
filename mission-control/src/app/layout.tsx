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
import { Pixelify_Sans, Space_Grotesk } from "next/font/google";
import { OnboardingGate } from "@/app/_components/OnboardingGate/OnboardingGate";
import { AppShell } from "@/components/modules/AppShell/AppShell";
import { CelebrationWatcher } from "@/components/modules/CelebrationWatcher/CelebrationWatcher";
import { GuildBar } from "@/components/modules/GuildBar/GuildBar";
import { ProposalsBadge } from "@/components/modules/ProposalsBadge/ProposalsBadge";
import { resolveProjectPath } from "@/lib/config/config";
import { readEvents } from "@/lib/events/events";
import { deriveGuildOutcomes } from "@/lib/gamification/gamification";
import { readPortfolio } from "@/lib/portfolio/portfolio";
import { readProfile } from "@/lib/profile/profile";
import { countOpenProposals } from "@/lib/proposals/proposals";
import { readStatus } from "@/lib/status/status";
import "./globals.css";

// Local always-on deploy: the production build is served as a stable snapshot via launchd, but the
// app is a LIVE dashboard over the factory filesystem — so every route must render per-request (read
// the current status.yaml / ideas / portfolio), never freeze at build time. force-dynamic on the root
// layout makes all routes dynamic (SSR per request). Live surfaces also push deltas via SSE (/api/live).
export const dynamic = "force-dynamic";

// Prototype fonts (DR-054) — wired via next/font to avoid CLS and self-host.
// Exposed as CSS variables consumed by globals.css @theme (--font-pixel / --font-display).
const pixelify = Pixelify_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-pixelify",
  display: "swap",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

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

  // Derive guild outcomes from real portfolio data (AC-09-004.1).
  // Read-only: readPortfolio, readStatus, readEvents — no writes, no Claude calls.
  // Fail-soft: absent portfolio → empty array; missing status → skipped.
  const portfolioEntries = readPortfolio();
  const statuses = portfolioEntries.map((entry) => readStatus(resolveProjectPath(entry.path)));
  const eventsSnapshot = readEvents();
  const guildOutcomes = deriveGuildOutcomes({ statuses, eventsSnapshot });

  // Open proposal count for the top-bar guild badge (CMP-17-badge, AC-17-007.1).
  // Fail-soft: missing factory/memory → { total: 0 } → calm state.
  const proposalCounts = countOpenProposals();

  return (
    <html lang="es" className={`${pixelify.variable} ${spaceGrotesk.variable}`}>
      <head>
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
            {/* AppShell — the persistent global topbar (FRD-19): brand + guild level/XP on the left,
                the six top-level destinations on the right. GuildBar (embedded) and ProposalsBadge are
                passed as slots so they keep their server-derived data; AppShell decides scope (no
                topbar on the exempt drill-ins) and wraps the page in #main-content. */}
            <AppShell
              levelBar={<GuildBar outcomes={guildOutcomes} embedded />}
              proposalsBadge={<ProposalsBadge openCount={proposalCounts.total} />}
            >
              {children}
            </AppShell>
            {/* CelebrationWatcher — auto-fires CelebrationSurface on result events
                (release/levelup/phase/toast). Client component; no server I/O;
                fires automatically from the live event stream (DR-061, AC-09-006.1). */}
            <CelebrationWatcher />
          </>
        ) : (
          <OnboardingGate />
        )}
      </body>
    </html>
  );
}
