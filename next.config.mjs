// GITHUB_PAGES=1 builds the public viewer-only demo as a static site served
// from /aura-clinical-viewer. A normal build is unaffected.
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const isPages = process.env.GITHUB_PAGES === "1";
const here = dirname(fileURLToPath(import.meta.url));

/** Where the demo is served from on GitHub Pages (set by scripts/build-demo.mjs). */
const DEMO_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required on Next 14 for instrumentation.ts (the attribution gate) to run.
  experimental: { instrumentationHook: true },
  reactStrictMode: true,
  ...(isPages
    ? {
        output: "export",
        basePath: DEMO_BASE_PATH,
        images: { unoptimized: true },
        trailingSlash: true,
        webpack: (config) => {
          // The real Clerk package registers Server Actions, which a static
          // export cannot contain. The demo has no sign-in, so swap it for an
          // inert stub.
          config.resolve.alias["@clerk/nextjs"] = resolve(here, "lib/stubs/clerk.tsx");
          return config;
        },
      }
    : {}),
};

export default nextConfig;
