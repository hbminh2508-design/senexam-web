import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import dynamic from "next/dynamic";
import ClientErrorReporter from "./components/ClientErrorReporter";
import MobileBatteryManager from "./components/MobileBatteryManager";
import GlobalCanvasEngine from "./components/GlobalCanvasEngine";
import "./globals.css";

// Tách mã SenChat và ExamOrientation thành dynamic chunks để giải phóng hoàn toàn critical rendering path
const SenChatFloatingBubble = dynamic(
  () => import("./components/SenChatFloatingBubble")
);

const ExamOrientationPrompt = dynamic(
  () => import("./components/ExamOrientationPrompt")
);

// Tắt preload để ngăn trình duyệt chặn render critical path chờ tải các tệp .woff2
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL('https://senexam.me'),
  title: {
    default: "SenExam - Hệ thống Khảo thí & Quản trị Học tập Thông minh",
    template: "%s | SenExam",
  },
  description: "Nền tảng thi thử đại học, khảo thí trực tuyến (HSA, TSA, VNU TEST, University Portal UET), quản lý học tập và tài chính lớp học thông minh thế hệ mới.",
  keywords: ["SenExam", "khảo thí trực tuyến", "thi thử HSA", "thi thử TSA", "VNU TEST", "Portal UET", "luyện thi đại học"],
  authors: [{ name: "SenExam Team", url: "https://senexam.me" }],
  creator: "SenExam",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: "https://senexam.me",
    title: "SenExam - Hệ thống Khảo thí & Quản trị Học tập Thông minh",
    description: "Nền tảng thi cử và học tập trực tuyến thông minh",
    siteName: "SenExam",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "SenExam Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SenExam - Hệ thống Khảo thí & Quản trị Học tập",
    description: "Nền tảng thi cử và học tập trực tuyến thông minh",
    images: ["/logo.png"],
  },
  icons: {
    icon: [
      { url: '/logo.png', sizes: 'any' },
      { url: '/icon.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Preconnect tới Supabase API tối ưu 250ms LCP/FCP cho các truy vấn dữ liệu */}
        <link rel="preconnect" href="https://nphryrldlfiuvpuqjovr.supabase.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://nphryrldlfiuvpuqjovr.supabase.co" />

        {/* Preconnect candidates tối ưu tải tài nguyên quảng cáo */}
        <link rel="preconnect" href="https://pagead2.googlesyndication.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://pagead2.googlesyndication.com" />
        <link rel="preconnect" href="https://ep1.adtrafficquality.google" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://ep1.adtrafficquality.google" />
        <link rel="preconnect" href="https://googleads.g.doubleclick.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://googleads.g.doubleclick.net" />

        {/* AdSense được nạp bằng lazyOnload để không chặn render đầu trang */}
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7774417042006604"
          crossOrigin="anonymous"
          strategy="lazyOnload"
        />
      </head>
      <body className="app-shell min-h-screen flex flex-col bg-background text-foreground">
        {/* Skip to main content link for Accessibility (Lighthouse 100) */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:p-3 focus:bg-sky-600 focus:text-white focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-sky-400"
        >
          Chuyển đến nội dung chính
        </a>
        <GlobalCanvasEngine />
        <ClientErrorReporter />
        <MobileBatteryManager />
        <ExamOrientationPrompt />
        <main id="main-content" className="flex-1 flex flex-col min-w-0 w-full" tabIndex={-1}>
          {children}
        </main>
        <SenChatFloatingBubble />
      </body>
    </html>
  );
}
