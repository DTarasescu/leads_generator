/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_BASE: process.env.NEXT_PUBLIC_APP_BASE || 'http://localhost:3400',
    NEXT_PUBLIC_APP_DOMAIN: process.env.NEXT_PUBLIC_APP_DOMAIN || 'leads-generator.ai-client-recovery.com',
  },
  domains: ['leads-generator.ai-client-recovery.com'],
};

module.exports = nextConfig;
