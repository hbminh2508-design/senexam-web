'use client'

import React, { useState, useEffect } from 'react'
import { senHeart, SenHeartTelemetry } from '@/lib/senheart'
import { Activity, ShieldCheck, Zap, RefreshCw, Cpu, Layers, CheckCircle2, Sparkles, HardDrive } from 'lucide-react'

interface SenHeartAdminWidgetProps {
  userRole: string
}

export default function SenHeartAdminWidget({ userRole }: SenHeartAdminWidgetProps) {
  const [telemetry, setTelemetry] = useState<SenHeartTelemetry>(() => senHeart.getTelemetry())
  const [optimizing, setOptimizing] = useState(false)
  const [optResult, setOptResult] = useState<string | null>(null)

  useEffect(() => {
    // Đăng ký nhận telemetry thời gian thực từ Sen Heart Core
    const unsubscribe = senHeart.subscribeTelemetry((t) => {
      setTelemetry(t)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  // Chỉ hiển thị cho Quản trị viên (Admin / Collab), ẩn hoàn toàn với học sinh
  if (userRole !== 'admin' && userRole !== 'collab') {
    return null
  }

  const handleManualOptimize = async () => {
    if (optimizing) return
    setOptimizing(true)
    setOptResult(null)

    try {
      const res = await senHeart.optimizeNow()
      setOptResult(
        `✓ Đã tối ưu ${res.threadsCleaned} luồng & giải phóng ${res.cacheSavedKb} KB cache rác!`
      )
      setTimeout(() => {
        setOptResult(null)
      }, 5000)
    } catch {
      setOptResult('Lỗi khi tối ưu hóa luồng.')
    } finally {
      setOptimizing(false)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-cyan-500/30 bg-gradient-to-br from-white/90 via-cyan-500/5 to-slate-900/5 dark:from-slate-900/90 dark:via-cyan-950/20 dark:to-slate-950 p-5 shadow-[0_18px_40px_rgba(6,182,212,0.08)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl animate-in fade-in zoom-in-95">
      {/* Hiệu ứng tia sáng hạt nhân Sen Heart ngầm */}
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-cyan-400/20 blur-2xl pointer-events-none" />

      <div className="relative">
        {/* Header Widget */}
        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 shadow-xs">
              <Cpu className="h-4 w-4 animate-spin" style={{ animationDuration: '8s' }} />
            </span>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                Sen Heart Core <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold">(Admin Mode)</span>
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                Kiến trúc quản lý phân luồng & dữ liệu tập trung
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30">
            <Zap className="h-2.5 w-2.5 text-cyan-500 fill-cyan-500" /> v{telemetry.version}
          </span>
        </div>

        {/* Thông Số Kỹ Thuật Sen Heart */}
        <div className="mt-3.5 grid grid-cols-2 gap-2 text-left">
          {/* Luồng hoạt động */}
          <div className="rounded-xl border border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Layers className="h-3 w-3 text-cyan-500" /> Luồng Trang Web
            </div>
            <p className="mt-1 text-sm font-black text-slate-900 dark:text-white flex items-center gap-1">
              {telemetry.activeThreads} <span className="text-[10px] font-normal text-slate-400">active thread</span>
            </p>
          </div>

          {/* Dọn Cache Tự Động */}
          <div className="rounded-xl border border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <HardDrive className="h-3 w-3 text-emerald-500" /> Đã Giảm Tải Cache
            </div>
            <p className="mt-1 text-sm font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              {telemetry.cacheSavingsKb} <span className="text-[10px] font-normal">KB giải phóng</span>
            </p>
          </div>
        </div>

        {/* Trạng Thái An Ninh Toàn Vẹn */}
        <div className="mt-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300">
                Khiên An Ninh Sen Heart: {telemetry.securityStatus.status.toUpperCase()}
              </p>
              <p className="text-[9px] text-emerald-700/80 dark:text-emerald-400/80">
                Chống Zombie Process • Ngắt luồng thoát trang • Cập nhật bảo mật
              </p>
            </div>
          </div>
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
        </div>

        {/* Thông Báo Kết Quả Tối Ưu Hóa */}
        {optResult && (
          <div className="mt-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2 text-center text-[10px] font-bold text-cyan-800 dark:text-cyan-300 animate-in fade-in">
            {optResult}
          </div>
        )}

        {/* Nút Kích Hoạt Tối Ưu Hóa Thủ Công */}
        <div className="mt-3">
          <button
            type="button"
            onClick={handleManualOptimize}
            disabled={optimizing}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white py-2 text-xs font-bold transition shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${optimizing ? 'animate-spin' : ''}`} />
            {optimizing ? 'Đang điều phối & dọn dẹp...' : 'Tối ưu luồng & Dọn cache ngay'}
          </button>
        </div>
      </div>
    </div>
  )
}
