import type { Metadata } from "next";
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
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
