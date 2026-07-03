/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['utils', 'ui'],
  // Proxy é feito via src/pages/api/[...path].ts (preserva Set-Cookie)
};

module.exports = nextConfig;
