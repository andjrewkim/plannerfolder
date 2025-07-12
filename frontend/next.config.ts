// next.config.js
module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*',
      },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true, // ✅ This tells Vercel to skip ESLint during build
  },
};
