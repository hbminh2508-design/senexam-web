'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  Lock,
  Mail,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'

export default function MobileLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setErrorMsg('Vui lòng nhập đầy đủ email và mật khẩu!')
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) throw error

      router.replace('/m')
    } catch (err: any) {
      setErrorMsg(err.message || 'Email hoặc mật khẩu không chính xác!')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex-1 w-full p-5 flex flex-col justify-between animate-in fade-in">
      <div className="space-y-6 pt-6">
        {/* Logo / Badge */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-xl">
            <Lock className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              Đăng Nhập SenExam
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Cổng thi cử và học tập thuần Mobile
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500">Email của bạn</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 pl-10 pr-3 text-xs outline-none focus:border-violet-600 focus:bg-white dark:focus:bg-slate-900 transition"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500">Mật khẩu</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 pl-10 pr-3 text-xs outline-none focus:border-violet-600 focus:bg-white dark:focus:bg-slate-900 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black text-xs shadow-md active:scale-98 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer mt-4"
          >
            <span>{isSubmitting ? 'Đang xác thực...' : 'ĐĂNG NHẬP NGAY'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>

      <div className="text-center text-xs text-slate-400 pb-2">
        <span>Chưa có tài khoản? </span>
        <a href="https://senexam.me/new-idp" className="text-violet-600 dark:text-violet-400 font-bold underline">
          Đăng ký trên web
        </a>
      </div>
    </div>
  )
}
