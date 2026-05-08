// Root layout. Loads:
//  - globals.css (Cal.com tokens + Tailwind v4 @theme)
//  - Cal Sans + Inter via next/font/google (self-hosted at build time)
//  - ThemeProvider (class-based dark mode via next-themes)
//
// `suppressHydrationWarning` on <html> is required by next-themes — it
// injects a data-theme attribute before React hydrates, which would
// otherwise trigger a hydration warning.

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { calSans, inter } from "@/lib/fonts";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Church Event Management",
  description: "Plan, approve, and publish church events.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${calSans.variable} ${inter.variable}`}>
      <body className="bg-cal-bg text-cal-text antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
