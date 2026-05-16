import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard', // Hoặc đổi thành '/login' nếu bạn muốn bắt đăng nhập trước
        permanent: true, // Báo cho trình duyệt biết đây là chuyển hướng vĩnh viễn (301)
      },
    ];
  },
};

export default nextConfig;