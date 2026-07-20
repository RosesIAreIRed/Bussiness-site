import type { NextConfig } from 'next';

const codespaceHost =
  process.env.CODESPACE_NAME &&
  process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    ? `${process.env.CODESPACE_NAME}-3000.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`
    : undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        '127.0.0.1:3000',
        ...(codespaceHost ? [codespaceHost] : []),
      ],
    },
  },

  // Лінт — окрема задача pipeline, не частина next build.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;