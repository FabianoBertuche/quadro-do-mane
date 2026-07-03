const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['utils', 'ui'],
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname, 'src');
    return config;
  },
  // Proxy é feito via src/pages/api/[...path].ts (preserva Set-Cookie)
};

module.exports = nextConfig;
