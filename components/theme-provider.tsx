"use client";

// Theme provider — wraps next-themes for class-based dark mode.
// PRD Section 17: "Toggle in nav bar persists in localStorage (only the
// theme preference, not tokens)".

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
