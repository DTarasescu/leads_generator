/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_BASE: process.env.NEXT_PUBLIC_APP_BASE || 'http://localhost:3400',
  },
};

module.exports = nextConfig;
