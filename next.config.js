/** @type {import('next').NextConfig} */
const nextConfig = {
  // PWA and Performance Optimizations
  poweredByHeader: false,
  compress: true,

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ]
  },

  // Image optimization for PWA
  images: {
    domains: [],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 1 week
  },

  // Production optimizations
  reactStrictMode: true,

  // Environment-specific configurations
  env: {
    CUSTOM_KEY: process.env.NODE_ENV,
  },

  // Build performance
  typescript: {
    // Type checking is handled by CI pipeline
    ignoreBuildErrors: false,
  },

  eslint: {
    // Linting is handled by CI pipeline
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig