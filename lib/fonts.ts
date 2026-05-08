// Application fonts. Both fonts are self-hosted at build time by
// `next/font/google` — no third-party CDN load at runtime, which keeps
// the Content-Security-Policy tight and protects user privacy.
//
// PRD Section 6:
//   - Cal Sans → headings, numbers, logo
//   - Inter    → body text
//
// We expose them as CSS variables (--font-cal-sans, --font-inter) so
// Tailwind v4 @theme can reference them and Cal/Tailwind classes can
// pick them up uniformly.

import { Cal_Sans, Inter } from "next/font/google";

// Cal Sans on Google Fonts ships a single weight (400). The PRD asks
// for it at 28px / weight 500 for display headings — at display size
// the visual difference between 400 and 500 is negligible, especially
// for a geometric sans like Cal Sans. We render headings with this
// font at whatever weight the spec calls for; CSS `font-weight: 500`
// will fall back to the closest synthesised weight.
export const calSans = Cal_Sans({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-cal-sans",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});
