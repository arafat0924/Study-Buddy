import type { NextConfig } from 'next';

// Fully static export: every tool runs in the browser, so Netlify only serves files.
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
