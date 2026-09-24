import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import ClientErrorReporter from "./components/ClientErrorReporter";
import SenChatFloatingBubble from "./components/SenChatFloatingBubble";
import MobileBottomNav from "./components/MobileBottomNav";
import MobileBatteryManager from "./components/MobileBatteryManager";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7774417042006604"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body className="app-shell min-h-screen flex flex-col bg-background text-foreground pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        <ClientErrorReporter />
        <MobileBatteryManager />
        {children}
        <SenChatFloatingBubble />
        <MobileBottomNav />
      </body>
    </html>
  );
}