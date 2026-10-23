'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  Crown,
  Zap,
  CheckCircle2,
  QrCode,
  ArrowLeft,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react'

export default function MobilePayPage() {
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState<'month' | 'year' | 'lifetime'>('year')
  const [copied, setCopied] = useState(false)

  const plans = [
    {
      key: 'month',
      title: 'Hội Viên 1 Tháng',
      price: '59.000đ',
      rawPrice: 59000,
      desc: 'Trải nghiệm toàn bộ kho đề và tài liệu VIP.',
    },
    {
      key: 'year',
      title: 'Hội Viên 1 Năm (Khuyên Dùng)',
      price: '199.000đ',
      rawPrice: 199000,
      badge: 'TIẾT KIỆM 70%',
      desc: 'Đồng hành trọn vẹn cả năm học, giải chi tiết và SenAI 2.0.',
    },
    {
      key: 'lifetime',
      title: 'Hội Viên Vĩnh Viễn',
      price: '499.000đ',
      rawPrice: 499000,
      badge: 'TRỌN ĐỜI',
      desc: 'Mở khóa toàn bộ đặc quyền hiện tại và tương lai.',
    },
  ]

  const activePlanObj = plans.find((p) => p.key === selectedPlan) || plans[1]

  const handleCopyContent = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex-1 w-full p-4 space-y-4 animate-in fade-in">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-base font-black text-slate-900 dark:text-white">
          Cửa Hàng VIP SenExam
        </h1>
      </div>

      {/* Banner VIP */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-pink-600 text-white shadow-lg space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider">
          <Crown className="h-4 w-4" /> Đặc Quyền Hội Viên VIP
        </div>
        <p className="text-xs text-amber-100 leading-relaxed">
          Mở khóa toàn bộ đề thi khảo thí chuẩn Canvas, tải tài liệu không giới hạn và nhận lời giải thích KaTeX chuyên sâu.
        </p>
      </div>

      {/* Danh sách các gói */}
      <div className="space-y-2.5">
        <span className="text-xs font-black uppercase text-slate-500">Chọn Gói Hội Viên</span>
        {plans.map((p) => {
          const isSelected = selectedPlan === p.key
          return (
            <div
              key={p.key}
              onClick={() => setSelectedPlan(p.key as any)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                isSelected
                  ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/40 shadow-xs'
                  : 'border-black/10 dark:border-white/10 bg-white dark:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                    {p.title}
                  </h4>
                  {p.badge && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] uppercase">
                      {p.badge}
                    </span>
                  )}
                </div>
                <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                  {p.price}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{p.desc}</p>
            </div>
          )
        })}
      </div>

      {/* Box Thanh Toán VietQR Tự Động 1 Chạm */}
      <div className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 space-y-3 text-center">
        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
          <QrCode className="h-4 w-4 text-violet-600" />
          <span>Thanh Toán QR Tự Động 24/7 (SePay)</span>
        </div>

        {/* QR Code demo image */}
        <div className="w-48 h-48 mx-auto rounded-2xl border border-black/10 dark:border-white/10 p-2 bg-white flex items-center justify-center shadow-inner">
          <img
            src={`https://api.vietqr.io/image/970422-0987654321-compact2.png?amount=${activePlanObj.rawPrice}&addInfo=SENEXAM%20VIP&accountName=SENEXAM%20ME`}
            alt="VietQR Payment"
            className="w-full h-full object-contain"
          />
        </div>

        <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-[11px] space-y-1 text-left font-mono">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Số tiền:</span>
            <span className="font-bold text-amber-500">{activePlanObj.price}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Nội dung CK:</span>
            <span className="font-bold text-violet-600">SENEXAM VIP</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleCopyContent('SENEXAM VIP')}
          className="w-full py-2.5 rounded-xl bg-violet-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span>{copied ? 'Đã sao chép nội dung!' : 'Sao chép cú pháp chuyển khoản'}</span>
        </button>
      </div>
    </div>
  )
}
