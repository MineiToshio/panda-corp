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
import { OnboardingGate } from "@/app/_components/OnboardingGate/OnboardingGate";
import { GamificationLedgerSync } from "@/components/dashboard/GamificationLedgerSync/GamificationLedgerSync";
import { AppShell } from "@/components/modules/AppShell/AppShell";
import { readProfile } from "@/lib/profile/profile";
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
            <AppShell>{children}</AppShell>
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
