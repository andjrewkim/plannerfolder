/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // replaces next export
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'unsafe-none' },
          { key: 'Permissions-Policy', value: 'identity-credentials-get=(), otp-credentials=(), publickey-credentials-get=(), publickey-credentials-create=()' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
        ]
      }
    ];
  },
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;
