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
  title: "SenExam",
  description: "Thi cử và học tập trực tuyến",
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
        {/* Preconnect candidates giúp tối ưu LCP tới 300ms theo báo cáo Lighthouse */}
        <link rel="preconnect" href="https://pagead2.googlesyndication.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://pagead2.googlesyndication.com" />
        <link rel="preconnect" href="https://ep1.adtrafficquality.google" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://ep1.adtrafficquality.google" />
        <link rel="preconnect" href="https://googleads.g.doubleclick.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://googleads.g.doubleclick.net" />

        {/* AdSense được nạp bằng lazyOnload để không chặn render đầu trang (tiết kiệm 280ms LCP/FCP) */}
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7774417042006604"
          crossOrigin="anonymous"
          strategy="lazyOnload"
        />
      </head>
      <body className="app-shell min-h-screen flex flex-col bg-background text-foreground">
        <GlobalCanvasEngine />
        <ClientErrorReporter />
        <MobileBatteryManager />
        <ExamOrientationPrompt />
        <main id="main-content" className="flex-1 flex flex-col min-w-0 w-full">
          {children}
        </main>
        <SenChatFloatingBubble />
      </body>
    </html>
  );
}