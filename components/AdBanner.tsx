'use client'

import { useEffect } from 'react'

export default function AdBanner({ dataAdSlot }: { dataAdSlot: string }) {
  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error("AdSense error:", err);
    }
  }, []);

  return (
    <div className="w-full flex justify-center my-4 overflow-hidden rounded-2xl bg-slate-100/50 dark:bg-[#1A1A1A]/50 border border-slate-200 dark:border-white/5 backdrop-blur-md shadow-sm transition-all hover:shadow-md">
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%' }}
        data-ad-client="ca-pub-7774417042006604"
        data-ad-slot={dataAdSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>
  )
}