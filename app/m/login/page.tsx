'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ModernLoading from '@/app/components/ModernLoading'
import { ShieldCheck, ArrowRight, Lock } from 'lucide-react'

const MOBILE_VERSION = '2.0.2194024.10890.04'

export default function MobileLoginPage() {
  const router = useRouter()

  useEffect(() => {
    // Tự động chuyển qua cổng đăng nhập chính thức SenExam IDP để đảm bảo an toàn tuyệt đối
    router.replace('/new-idp?returnUrl=/m')
  }, [router])

  return (
    <div className="flex-1 w-full p-5 flex flex-col justify-between animate-in fade-in">
      <div className="space-y-6 pt-12 text-center">
        <div className="w-20 h-20 mx-auto flex items-center justify-center">
          <img
            src="/logo.png"
            alt="SenExam Logo"
            className="w-full h-full object-contain drop-shadow-xl select-none"
          />
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Cổng Đăng Nhập SenExam IDP
          </h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Hệ thống xác thực bảo mật chuẩn hóa đa yếu tố của SenExam
          </p>
        </div>

        <div className="pt-4">
          <Link
            href="/new-idp?returnUrl=/m"
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black text-xs shadow-md active:scale-98 transition flex items-center justify-center gap-2"
          >
            <span>TIẾP TỤC ĐĂNG NHẬP SENEXAM IDP</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="text-center text-[10px] text-slate-400 font-mono pb-2">
        SenExam IDP Mobile v{MOBILE_VERSION}
      </div>
    </div>
  )
}
