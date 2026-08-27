'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { getModernThemeVars } from '@/app/components/modernTheme'
import {
  ArrowLeft,
  Calculator,
  GraduationCap,
  Target,
  Sparkles,
  Award,
  BookOpen,
  Send,
  Loader2,
  Sun,
  Moon,
  ChevronRight,
  HelpCircle,
  TrendingUp,
  School,
  CheckCircle2,
  FileCheck,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-newmark-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-newmark-body' })

// KHỐI THI ĐẠI HỌC
const EXAM_BLOCKS = [
  { code: 'A00', name: 'Toán, Vật lí, Hóa học', subs: ['Toán', 'Vật lí', 'Hóa học'] },
  { code: 'A01', name: 'Toán, Vật lí, Tiếng Anh', subs: ['Toán', 'Vật lí', 'Tiếng Anh'] },
  { code: 'B00', name: 'Toán, Hóa học, Sinh học', subs: ['Toán', 'Hóa học', 'Sinh học'] },
  { code: 'C00', name: 'Ngữ văn, Lịch sử, Địa lí', subs: ['Ngữ văn', 'Lịch sử', 'Địa lí'] },
  { code: 'D01', name: 'Ngữ văn, Toán, Tiếng Anh', subs: ['Ngữ văn', 'Toán', 'Tiếng Anh'] },
  { code: 'D07', name: 'Toán, Hóa học, Tiếng Anh', subs: ['Toán', 'Hóa học', 'Tiếng Anh'] },
  { code: 'A02', name: 'Toán, Vật lí, Sinh học', subs: ['Toán', 'Vật lí', 'Sinh học'] },
  { code: 'C01', name: 'Ngữ văn, Toán, Vật lí', subs: ['Ngữ văn', 'Toán', 'Vật lí'] },
]

export default function NewMarkCalculatePage() {
  const router = useRouter()
  const [isDark, setIsDark] = useState(false)
  const [activeTab, setActiveTab] = useState<'THPT' | 'UNIVERSITY' | 'HSA_TSA'>('UNIVERSITY')

  // KHỐI THI ĐẠI HỌC
  const [selectedBlock, setSelectedBlock] = useState('A00')
  const [scores, setScores] = useState({ s1: '', s2: '', s3: '' })
  const [multiplier, setMultiplier] = useState<'none' | 's1' | 's2' | 's3'>('none')
  const [regionPriority, setRegionPriority] = useState<number>(0) // 0.75 (KV1), 0.5 (KV2-NT), 0.25 (KV2), 0 (KV3)
  const [objectPriority, setObjectPriority] = useState<number>(0) // 2.0 (DT1), 1.0 (DT2), 0

  // TÍNH ĐIỂM TỐT NGHIỆP THPT (2025/2026)
  const [gradScores, setGradScores] = useState({
    math: '',
    lit: '',
    sub1: '',
    sub2: '',
    gpa10: '',
    gpa11: '',
    gpa12: '',
    bonus: '0',
  })

  // ĐGNL / ĐGTD
  const [hsaScores, setHsaScores] = useState({ math: '', lit: '', science: '' })
  const [tsaScores, setTsaScores] = useState({ math: '', reading: '', science: '' })

  // AI Advice
  const [aiAdvice, setAiAdvice] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)
  }, [])

  const toggleDarkMode = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  // TÍNH ĐIỂM XÉT TUYỂN ĐẠI HỌC
  const uniCalcResult = useMemo(() => {
    const s1 = parseFloat(scores.s1) || 0
    const s2 = parseFloat(scores.s2) || 0
    const s3 = parseFloat(scores.s3) || 0

    let raw = s1 + s2 + s3
    let scaledTotal = raw

    if (multiplier === 's1') scaledTotal = ((s1 * 2 + s2 + s3) * 3) / 4
    if (multiplier === 's2') scaledTotal = ((s1 + s2 * 2 + s3) * 3) / 4
    if (multiplier === 's3') scaledTotal = ((s1 + s2 + s3 * 2) * 3) / 4

    // Công thức tính điểm ưu tiên Bộ GD&ĐT:
    // Nếu tổng điểm >= 22.5: Điểm ƯT = [(30 - Tổng điểm) / 7.5] * Mức ƯT quy định
    const basePriority = regionPriority + objectPriority
    let finalPriority = basePriority
    if (scaledTotal >= 22.5 && basePriority > 0) {
      finalPriority = ((30 - Math.min(30, scaledTotal)) / 7.5) * basePriority
    }

    const finalTotal = Math.min(30, parseFloat((scaledTotal + finalPriority).toFixed(2)))

    return {
      raw: raw.toFixed(2),
      scaledTotal: scaledTotal.toFixed(2),
      finalPriority: finalPriority.toFixed(2),
      finalTotal: finalTotal.toFixed(2),
    }
  }, [scores, multiplier, regionPriority, objectPriority])

  // TÍNH ĐIỂM TỐT NGHIỆP THPT (Quy chế mới)
  const gradCalcResult = useMemo(() => {
    const m = parseFloat(gradScores.math) || 0
    const l = parseFloat(gradScores.lit) || 0
    const s1 = parseFloat(gradScores.sub1) || 0
    const s2 = parseFloat(gradScores.sub2) || 0

    const g10 = parseFloat(gradScores.gpa10) || 0
    const g11 = parseFloat(gradScores.gpa11) || 0
    const g12 = parseFloat(gradScores.gpa12) || 0
    const b = parseFloat(gradScores.bonus) || 0

    const examAvg = (m + l + s1 + s2) / 4
    const gpaAvg = (g10 + g11 + g12 * 2) / 4 // hoặc (g10 + g11 + g12)/3

    // ĐXTN = (Điểm 4 bài thi / 4) * 0.7 + ĐTB Học bạ * 0.3 + Điểm khuyến khích/4
    const finalGrad = examAvg * 0.7 + gpaAvg * 0.3 + b / 4
    const isPassed = finalGrad >= 5.0 && m > 1 && l > 1 && s1 > 1 && s2 > 1

    return {
      examAvg: examAvg.toFixed(2),
      gpaAvg: gpaAvg.toFixed(2),
      finalGrad: finalGrad.toFixed(2),
      isPassed,
    }
  }, [gradScores])

  // TÍNH ĐIỂM HSA / TSA
  const hsaTotal = (parseFloat(hsaScores.math) || 0) + (parseFloat(hsaScores.lit) || 0) + (parseFloat(hsaScores.science) || 0)
  const tsaTotal = (parseFloat(tsaScores.math) || 0) + (parseFloat(tsaScores.reading) || 0) + (parseFloat(tsaScores.science) || 0)

  const handleConsultAi = async () => {
    setIsAiLoading(true)
    try {
      const prompt = `Tôi vừa tính điểm thi Đại học khối ${selectedBlock} được ${uniCalcResult.finalTotal} điểm (Điểm 3 môn: ${scores.s1}, ${scores.s2}, ${scores.s3}, điểm ưu tiên: ${uniCalcResult.finalPriority}). Hãy phân tích các nhóm ngành, trường đại học Top và cơ hội xét tuyển phù hợp nhất cho mức điểm này.`
      const res = await fetch('/api/senai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt }),
      })
      const data = await res.json()
      setAiAdvice(data.reply || data.text || 'SenAI đã tiếp nhận thông tin.')
    } catch (e: any) {
      setAiAdvice(`Lỗi tư vấn: ${e.message}`)
    } finally {
      setIsAiLoading(false)
    }
  }

  const currentBlock = EXAM_BLOCKS.find((b) => b.code === selectedBlock) || EXAM_BLOCKS[0]
  const themeVars = getModernThemeVars('indigo', isDark)

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-[#1A1A1A] dark:text-slate-100 font-sans transition-colors duration-300`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 10% 10%, rgba(56, 189, 248, 0.12), transparent 30%), radial-gradient(circle at 90% 20%, rgba(168, 85, 247, 0.12), transparent 30%), #080C14'
          : 'radial-gradient(circle at 10% 10%, rgba(255, 187, 120, 0.35), transparent 30%), radial-gradient(circle at 90% 20%, rgba(94, 234, 212, 0.3), transparent 30%), #F4F7FB',
      }}
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* HEADER */}
        <div className="flex items-center justify-between pb-6 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <Link
              href="/new-dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
              title="Về Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <Calculator className="inline h-3 w-3 mr-1" /> Công Cụ Tính Điểm 2026
                </span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-newmark-heading)' }}>
                Tính Điểm Tốt Nghiệp & Xét Tuyển Đại Học
              </h1>
              <p className="text-xs text-[#6B7280] dark:text-slate-400">
                Chuẩn hóa quy chế Bộ GD&ĐT, hỗ trợ công thức giảm dần điểm ưu tiên và tư vấn SenAI thông minh.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
          >
            {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('UNIVERSITY')}
            className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'UNIVERSITY'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <GraduationCap className="h-4 w-4" /> Xét Tuyển Đại Học
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('THPT')}
            className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'THPT'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <School className="h-4 w-4" /> Tốt Nghiệp THPT 2026
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('HSA_TSA')}
            className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'HSA_TSA'
                ? 'bg-[#111827] dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-800/70 hover:bg-black/5'
            }`}
          >
            <Target className="h-4 w-4" /> ĐGNL (HSA) & ĐGTD (TSA)
          </button>
        </div>

        {/* TAB 1: XÉT TUYỂN ĐẠI HỌC */}
        {activeTab === 'UNIVERSITY' && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Input Form */}
            <div className="lg:col-span-2 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-5">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-slate-400 block mb-2">
                  1. Chọn Tổ Hợp Khối Thi
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {EXAM_BLOCKS.map((b) => (
                    <button
                      key={b.code}
                      type="button"
                      onClick={() => setSelectedBlock(b.code)}
                      className={`rounded-xl p-2.5 text-center text-xs font-bold border transition ${
                        selectedBlock === b.code
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'border-black/10 dark:border-white/10 bg-white/60 dark:bg-slate-800/60 hover:bg-black/5'
                      }`}
                    >
                      <span className="font-black block text-sm">{b.code}</span>
                      <span className="text-[10px] opacity-75 truncate block">{b.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3 Subject Scores */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-slate-400 block mb-2">
                  2. Nhập Điểm 3 Môn Thi (Thang Điểm 10)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block mb-1">
                      {currentBlock.subs[0]}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      placeholder="0.0"
                      value={scores.s1}
                      onChange={(e) => setScores({ ...scores, s1: e.target.value })}
                      className="h-12 w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-4 text-sm font-black outline-none focus:border-indigo-500 shadow-inner"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block mb-1">
                      {currentBlock.subs[1]}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      placeholder="0.0"
                      value={scores.s2}
                      onChange={(e) => setScores({ ...scores, s2: e.target.value })}
                      className="h-12 w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-4 text-sm font-black outline-none focus:border-indigo-500 shadow-inner"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block mb-1">
                      {currentBlock.subs[2]}
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      placeholder="0.0"
                      value={scores.s3}
                      onChange={(e) => setScores({ ...scores, s3: e.target.value })}
                      className="h-12 w-full rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-4 text-sm font-black outline-none focus:border-indigo-500 shadow-inner"
                    />
                  </div>
                </div>
              </div>

              {/* Priorities */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="text-xs font-bold text-[#6B7280] dark:text-slate-400 block mb-1">
                    Khu Vực Ưu Tiên
                  </span>
                  <select
                    value={regionPriority}
                    onChange={(e) => setRegionPriority(parseFloat(e.target.value))}
                    className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value={0}>KV3 (Không cộng)</option>
                    <option value={0.25}>KV2 (+0.25đ)</option>
                    <option value={0.5}>KV2-NT (+0.5đ)</option>
                    <option value={0.75}>KV1 (+0.75đ)</option>
                  </select>
                </div>

                <div>
                  <span className="text-xs font-bold text-[#6B7280] dark:text-slate-400 block mb-1">
                    Đối Tượng Ưu Tiên
                  </span>
                  <select
                    value={objectPriority}
                    onChange={(e) => setObjectPriority(parseFloat(e.target.value))}
                    className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value={0}>Không thuộc đối tượng ưu tiên</option>
                    <option value={1.0}>Nhóm UT2 (ĐT 05, 06, 07: +1.0đ)</option>
                    <option value={2.0}>Nhóm UT1 (ĐT 01, 02, 03, 04: +2.0đ)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Result Box */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl flex flex-col justify-between space-y-6">
              <div>
                <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 text-xs font-black uppercase tracking-wider border border-emerald-500/20">
                  Kết Quả Xét Tuyển
                </span>

                <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                    Tổng Điểm Xét Tuyển
                  </span>
                  <p className="text-4xl sm:text-5xl font-black text-amber-600 dark:text-amber-400 mt-1" style={{ fontFamily: 'var(--font-newmark-heading)' }}>
                    {uniCalcResult.finalTotal} <span className="text-lg font-bold text-[#6B7280]">/ 30</span>
                  </p>
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-black/5 dark:border-white/5">
                    <span className="text-[#6B7280]">Điểm 3 môn gốc:</span>
                    <strong className="font-bold">{uniCalcResult.raw}đ</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-black/5 dark:border-white/5">
                    <span className="text-[#6B7280]">Điểm ưu tiên thực nhận:</span>
                    <strong className="font-bold text-emerald-600">+{uniCalcResult.finalPriority}đ</strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleConsultAi}
                disabled={isAiLoading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white py-3 text-xs font-black uppercase tracking-wider shadow-md transition hover:opacity-90 disabled:opacity-50"
              >
                {isAiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isAiLoading ? 'SenAI đang phân tích trường...' : 'Tư Vấn Ngành & Trường Đại Học'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: TỐT NGHIỆP THPT */}
        {activeTab === 'THPT' && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
              <h3 className="text-sm font-black" style={{ fontFamily: 'var(--font-newmark-heading)' }}>
                1. Điểm 4 Môn Thi Tốt Nghiệp (2 Bắt Buộc + 2 Tự Chọn)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-xs font-bold text-indigo-600 block mb-1">Toán</span>
                  <input
                    type="number"
                    placeholder="0.0"
                    value={gradScores.math}
                    onChange={(e) => setGradScores({ ...gradScores, math: e.target.value })}
                    className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-sm font-bold outline-none"
                  />
                </div>
                <div>
                  <span className="text-xs font-bold text-indigo-600 block mb-1">Ngữ văn</span>
                  <input
                    type="number"
                    placeholder="0.0"
                    value={gradScores.lit}
                    onChange={(e) => setGradScores({ ...gradScores, lit: e.target.value })}
                    className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-sm font-bold outline-none"
                  />
                </div>
                <div>
                  <span className="text-xs font-bold text-indigo-600 block mb-1">Môn tự chọn 1</span>
                  <input
                    type="number"
                    placeholder="0.0"
                    value={gradScores.sub1}
                    onChange={(e) => setGradScores({ ...gradScores, sub1: e.target.value })}
                    className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-sm font-bold outline-none"
                  />
                </div>
                <div>
                  <span className="text-xs font-bold text-indigo-600 block mb-1">Môn tự chọn 2</span>
                  <input
                    type="number"
                    placeholder="0.0"
                    value={gradScores.sub2}
                    onChange={(e) => setGradScores({ ...gradScores, sub2: e.target.value })}
                    className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-sm font-bold outline-none"
                  />
                </div>
              </div>

              <h3 className="text-sm font-black pt-3" style={{ fontFamily: 'var(--font-newmark-heading)' }}>
                2. Điểm Trung Bình Học Bạ (Lớp 10, 11, 12)
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-xs font-bold text-[#6B7280] block mb-1">ĐTB Lớp 10</span>
                  <input
                    type="number"
                    placeholder="0.0"
                    value={gradScores.gpa10}
                    onChange={(e) => setGradScores({ ...gradScores, gpa10: e.target.value })}
                    className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-sm font-bold outline-none"
                  />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#6B7280] block mb-1">ĐTB Lớp 11</span>
                  <input
                    type="number"
                    placeholder="0.0"
                    value={gradScores.gpa11}
                    onChange={(e) => setGradScores({ ...gradScores, gpa11: e.target.value })}
                    className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-sm font-bold outline-none"
                  />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#6B7280] block mb-1">ĐTB Lớp 12</span>
                  <input
                    type="number"
                    placeholder="0.0"
                    value={gradScores.gpa12}
                    onChange={(e) => setGradScores({ ...gradScores, gpa12: e.target.value })}
                    className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-sm font-bold outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Grad Result Box */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl flex flex-col justify-between space-y-6">
              <div>
                <span className="rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1 text-xs font-black uppercase tracking-wider border border-indigo-500/20">
                  Điểm Xét Tốt Nghiệp THPT
                </span>

                <div className="mt-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                    Điểm Xét Tốt Nghiệp (ĐXTN)
                  </span>
                  <p className="text-4xl sm:text-5xl font-black text-emerald-600 dark:text-emerald-400 mt-1" style={{ fontFamily: 'var(--font-newmark-heading)' }}>
                    {gradCalcResult.finalGrad} <span className="text-lg font-bold text-[#6B7280]">/ 10</span>
                  </p>
                </div>

                <div className="mt-4 p-3 rounded-xl border text-center text-xs font-black">
                  {gradCalcResult.isPassed ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                      <CheckCircle2 className="h-4 w-4" /> ĐỦ ĐIỀU KIỆN ĐỖ TỐT NGHIỆP THPT
                    </span>
                  ) : (
                    <span className="text-rose-600 dark:text-rose-400">
                      CHƯA ĐỦ ĐIỀU KIỆN (Cần ĐXTN &gt;= 5.0 và không môn nào bị điểm liệt &lt;= 1.0)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ĐGNL / ĐGTD */}
        {activeTab === 'HSA_TSA' && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* HSA Box */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
              <span className="rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-3 py-1 text-xs font-black uppercase tracking-wider border border-cyan-500/20">
                Đánh Giá Năng Lực (HSA - ĐHQG HN)
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-xs font-bold block mb-1">Toán (50đ)</span>
                  <input
                    type="number"
                    max="50"
                    placeholder="0"
                    value={hsaScores.math}
                    onChange={(e) => setHsaScores({ ...hsaScores, math: e.target.value })}
                    className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-sm font-bold outline-none"
                  />
                </div>
                <div>
                  <span className="text-xs font-bold block mb-1">Văn (50đ)</span>
                  <input
                    type="number"
                    max="50"
                    placeholder="0"
                    value={hsaScores.lit}
                    onChange={(e) => setHsaScores({ ...hsaScores, lit: e.target.value })}
                    className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-sm font-bold outline-none"
                  />
                </div>
                <div>
                  <span className="text-xs font-bold block mb-1">KHTN/KHXH (50đ)</span>
                  <input
                    type="number"
                    max="50"
                    placeholder="0"
                    value={hsaScores.science}
                    onChange={(e) => setHsaScores({ ...hsaScores, science: e.target.value })}
                    className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-sm font-bold outline-none"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-center">
                <span className="text-xs font-bold text-cyan-800 dark:text-cyan-300 uppercase">Tổng Điểm HSA</span>
                <p className="text-4xl font-black text-cyan-600 dark:text-cyan-400 mt-1" style={{ fontFamily: 'var(--font-newmark-heading)' }}>
                  {hsaTotal} <span className="text-base font-bold text-[#6B7280]">/ 150</span>
                </p>
              </div>
            </div>

            {/* TSA Box */}
            <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 p-6 shadow-sm backdrop-blur-xl space-y-4">
              <span className="rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 px-3 py-1 text-xs font-black uppercase tracking-wider border border-rose-500/20">
                Đánh Giá Tư Duy (TSA - ĐH Bách Khoa)
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-xs font-bold block mb-1">Toán (40đ)</span>
                  <input
                    type="number"
                    max="40"
                    placeholder="0"
                    value={tsaScores.math}
                    onChange={(e) => setTsaScores({ ...tsaScores, math: e.target.value })}
                    className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-sm font-bold outline-none"
                  />
                </div>
                <div>
                  <span className="text-xs font-bold block mb-1">Đọc hiểu (20đ)</span>
                  <input
                    type="number"
                    max="20"
                    placeholder="0"
                    value={tsaScores.reading}
                    onChange={(e) => setTsaScores({ ...tsaScores, reading: e.target.value })}
                    className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-sm font-bold outline-none"
                  />
                </div>
                <div>
                  <span className="text-xs font-bold block mb-1">Khoa học (40đ)</span>
                  <input
                    type="number"
                    max="40"
                    placeholder="0"
                    value={tsaScores.science}
                    onChange={(e) => setTsaScores({ ...tsaScores, science: e.target.value })}
                    className="h-11 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 text-sm font-bold outline-none"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
                <span className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase">Tổng Điểm TSA</span>
                <p className="text-4xl font-black text-rose-600 dark:text-rose-400 mt-1" style={{ fontFamily: 'var(--font-newmark-heading)' }}>
                  {tsaTotal} <span className="text-base font-bold text-[#6B7280]">/ 100</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* AI Consultation Advice Box */}
        {aiAdvice && (
          <div className="mt-6 rounded-[28px] border border-indigo-500/30 bg-white/90 dark:bg-slate-900/90 p-6 shadow-lg backdrop-blur-xl space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h3 className="font-black text-base" style={{ fontFamily: 'var(--font-newmark-heading)' }}>
                Tư Vấn Hướng Nghiệp & Chiến Lược Xét Tuyển SenAI
              </h3>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {aiAdvice}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
