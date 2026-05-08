import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Required for `runtime: "nodejs"` in middleware.ts. The middleware
  // talks to Postgres via Drizzle, which can't run in the Edge runtime.
  // The `nodeMiddleware` flag is supported at runtime in Next 15.5+ but
  // not yet exposed in the public TypeScript types — hence the cast.
  experimental: {
    nodeMiddleware: true,
  } as NextConfig["experimental"] & { nodeMiddleware: true },

  // Security headers — applied to every response.
  // Per PRD Section 16 + SECURITY_CHECKLIST Phase 1 (MITM Protection).
  async headers() {
    // Content-Security-Policy whitelist:
    //   self          — our app's own assets
    //   *.supabase.co — Supabase Auth + REST + Realtime endpoints
    //   data:         — Next.js inlines small images as data: URIs
    //   blob:         — required for some Next.js image / font optimisation paths
    //
    // `unsafe-inline` for style-src is unfortunately required by many
    // Next.js dev tools and Shadcn components that use inline styles
    // (Radix UI animations, focus styles). We tighten this to nonces
    // when we have time post-MVP.
    //
    // `unsafe-eval` is required by Next.js dev mode (HMR uses eval).
    // It's stripped in production by setting NODE_ENV=production.
    const isDev = process.env.NODE_ENV !== "production";
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      isDev ? "" : "upgrade-insecure-requests",
    ]
      .filter(Boolean)
      .join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
