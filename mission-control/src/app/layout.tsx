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
import { GuildBar } from "@/components/rpg/GuildBar";
import { readEvents } from "@/lib/events";
import { deriveGuildOutcomes } from "@/lib/gamification";
import { readPortfolio } from "@/lib/portfolio";
import { readProfile } from "@/lib/profile";
import { readStatus } from "@/lib/status";
import "./globals.css";

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
  const statuses = portfolioEntries.map((entry) => readStatus(entry.path));
  const eventsSnapshot = readEvents();
  const guildOutcomes = deriveGuildOutcomes({ statuses, eventsSnapshot });

  return (
    <html lang="es">
      <body>
        {profileResult.present ? (
          <>
            <GuildBar outcomes={guildOutcomes} />
            {children}
          </>
        ) : (
          <OnboardingGate />
        )}
      </body>
    </html>
  );
}
