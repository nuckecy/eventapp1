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
        ],
      },
    ];
  },
};

export default nextConfig;
