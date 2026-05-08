// Root layout — placeholder. The real layout (with TenantProvider, fonts,
// dark mode, etc.) is added in F04 + F05.

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Church Event Management",
  description: "Plan, approve, and publish church events.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
