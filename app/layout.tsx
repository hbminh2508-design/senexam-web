import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import dynamic from "next/dynamic";
import ClientErrorReporter from "./components/ClientErrorReporter";
import MobileBottomNav from "./components/MobileBottomNav";
import MobileBatteryManager from "./components/MobileBatteryManager";
import GlobalCanvasEngine from "./components/GlobalCanvasEngine";
import "./globals.css";

// Tách mã SenChat và ExamOrientation thành dynamic chunks để giải phóng hoàn toàn critical rendering path
const SenChatFloatingBubble = dynamic(
  () => import("./components/SenChatFloatingBubble"),
  { ssr: false }
);

const ExamOrientationPrompt = dynamic(
  () => import("./components/ExamOrientationPrompt"),
  { ssr: false }
);

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
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
        {/* AdSense được nạp bằng lazyOnload để không chặn render đầu trang (tiết kiệm 280ms LCP/FCP) */}
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7774417042006604"
          crossOrigin="anonymous"
          strategy="lazyOnload"
        />
      </head>
      <body className="app-shell min-h-screen flex flex-col bg-background text-foreground pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        <GlobalCanvasEngine />
        <ClientErrorReporter />
        <MobileBatteryManager />
        <ExamOrientationPrompt />
        {children}
        <SenChatFloatingBubble />
        <MobileBottomNav />
      </body>
    </html>
  );
}