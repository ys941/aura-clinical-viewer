/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required on Next 14 for instrumentation.ts (the attribution gate) to run.
  experimental: { instrumentationHook: true },
  reactStrictMode: true,
};

export default nextConfig;
