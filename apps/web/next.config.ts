import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Лінт — окрема задача pipeline (turbo lint / CI), не частина next build.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
