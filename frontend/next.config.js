// next.config.js - Merged configuration
module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },
  
  // Add headers configuration for Google OAuth COOP policy fix
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Fix COOP policy for Google OAuth popups
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups'
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none'
          },
          // Disable problematic credential APIs that interfere with Google Sign-In
          {
            key: 'Permissions-Policy',
            value: 'identity-credentials-get=(), otp-credentials=(), publickey-credentials-get=(), publickey-credentials-create=()'
          },
          // Additional security headers that don't interfere with OAuth
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ]
      }
    ]
  },
  
  eslint: {
    ignoreDuringBuilds: true, // ✅ This tells Vercel to skip ESLint during build
  },
};