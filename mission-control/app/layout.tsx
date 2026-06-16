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
import { OnboardingGate } from "@/components/OnboardingGate";
import { readProfile } from "@/lib/profile";
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

  return (
    <html lang="es">
      <body>{profileResult.present ? children : <OnboardingGate />}</body>
    </html>
  );
}
