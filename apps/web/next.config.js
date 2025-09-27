/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  // Remove static export for development - we'll run Next.js server
  // output: 'export',
  images: {
    unoptimized: true,
  },
  // Disable critters optimizeCss to avoid missing module during build
  experimental: {
    optimizeCss: false,
    scrollRestoration: true,
  }
};

module.exports = nextConfig;