import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false, // Ẩn header X-Powered-By chống thu thập dấu vết công nghệ
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard', // Hoặc đổi thành '/login' nếu bạn muốn bắt đăng nhập trước
        permanent: true, // Báo cho trình duyệt biết đây là chuyển hướng vĩnh viễn (301)
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

export default nextConfig;