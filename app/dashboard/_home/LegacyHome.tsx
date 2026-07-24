'use client'

import {
  BookOpen, Clock, Trophy, User,
  ChevronRight, ShieldCheck, AlertCircle, LayoutGrid,
  Sun, Moon, KeyRound, Target,
  Bell, Sparkles, Lock, ArrowRight,
  FileText, Crown, Coins,
} from 'lucide-react'
import { AnnouncementRenderer } from './Announcement'
import CrossfadeIcon from '@/app/components/CrossfadeIcon'
import type { HomeProps } from './types'

const FEATURE_COLOR_MAP: Record<string, string> = {
  indigo: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/20",
  slate: "bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/40",
  purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-500/20",
  cyan: "bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 border-cyan-100 dark:border-cyan-500/20",
  emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20",
  sky: "bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-500/20",
  rose: "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20",
  amber: "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20",
}

export default function LegacyHome({
  router, userRole, formData, isDark, toggleTheme, unreadCount,
  setShowNotifications, setShowProfile, showFeatureMenu, setShowFeatureMenu,
  FEATURES, activeAnnouncement, studentHistoryList, setShowCodeModal,
  overlayActive, isBetaTester, isVip, senCashBalance, vipFeatureEnabled,
}: HomeProps) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-500 selection:bg-indigo-200 dark:selection:bg-indigo-900 overflow-x-hidden pb-10">

      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-blue-400/20 to-indigo-400/10 dark:from-blue-800/20 dark:to-indigo-900/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed top-[30%] right-[-10%] w-[500px] h-[500px] bg-gradient-to-tr from-purple-400/15 to-pink-400/10 dark:from-purple-800/15 dark:to-pink-900/10 rounded-full blur-[100px] pointer-events-none"></div>

      <header className="h-[80px] px-4 sm:px-6 lg:px-10 flex items-center justify-between bg-white/80 dark:bg-[#121212]/80 backdrop-blur-2xl backdrop-saturate-[1.5] border-b border-slate-200 dark:border-white/5 sticky top-0 z-40 transition-colors shadow-sm">

        <div
          className="flex items-center gap-3 cursor-pointer group shrink-0"
          onClick={() => router.push('/dashboard')}
        >
          <div className="w-14 h-14 rounded-[18px] bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/20 border border-slate-200 dark:border-white/10 flex items-center justify-center p-2.5 group-hover:scale-105 transition-transform duration-300 shadow-sm">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-sm scale-110" />
          </div>
          <div className="hidden md:block">
            <h1 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white leading-none flex items-center gap-2">
              SenExam
              {isBetaTester && <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 tracking-widest">BETA</span>}
            </h1>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 block">Hệ thống V2.0</span>
          </div>
        </div>

        <div className="flex-1 min-w-0 max-w-2xl mx-2 sm:mx-4 md:mx-8 relative z-50">
          <button
            onClick={() => setShowFeatureMenu(v => !v)}
            className="w-full flex items-center gap-2 sm:gap-3 bg-slate-100/80 dark:bg-[#1A1A1A] hover:bg-slate-200/50 dark:hover:bg-[#202020] border-2 border-transparent rounded-full pl-3 pr-2.5 py-2.5 sm:pl-5 sm:pr-4 sm:py-3 transition-all shadow-inner"
          >
            <LayoutGrid className="w-5 h-5 text-indigo-500 shrink-0"/>
            <span className="flex-1 min-w-0 text-left font-bold text-sm text-slate-500 dark:text-slate-400 truncate">
              <span className="sm:hidden">Tính năng</span>
              <span className="hidden sm:inline">Tất cả tính năng</span>
            </span>
            <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${showFeatureMenu ? 'rotate-90' : ''}`}/>
          </button>

          {showFeatureMenu && (
            <>
              <div className="fixed inset-0 z-[90]" onClick={() => setShowFeatureMenu(false)} />
              <div className="absolute top-[calc(100%+12px)] w-full bg-white dark:bg-[#1E1E1E] rounded-3xl border border-slate-200 dark:border-white/5 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[100] p-3 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FEATURES.map(f => {
                    const Icon = f.icon
                    const colorClass = FEATURE_COLOR_MAP[f.color] ?? FEATURE_COLOR_MAP.indigo
                    return (
                      <button
                        key={f.key}
                        onClick={() => { f.onSelect(); setShowFeatureMenu(false) }}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-[#2A2A2A] transition-colors text-left group"
                      >
                        <div className={`p-2.5 rounded-xl border shrink-0 group-hover:scale-110 transition-transform ${colorClass}`}>
                          <Icon className="w-5 h-5"/>
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-sm text-slate-900 dark:text-white">{f.label}</div>
                          <div className="text-xs text-slate-500 font-medium mt-0.5 truncate">{f.desc}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
          {(userRole === 'admin' || userRole === 'collab') && (
            <button
              onClick={() => router.push('/admin')}
              className="hidden lg:flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-[#1E1E1E] dark:hover:bg-indigo-900/30 dark:text-indigo-400 px-5 py-3 rounded-full font-extrabold text-sm transition-colors border border-indigo-200 dark:border-indigo-900/50 shadow-sm"
            >
              <ShieldCheck className="w-4 h-4"/> Bảng Quản trị
            </button>
          )}

          {vipFeatureEnabled && (
            <>
              <button
                onClick={() => router.push('/vip')}
                className={`hidden sm:flex items-center gap-1.5 px-4 py-2.5 rounded-full font-extrabold text-xs transition-all shadow-sm ${isVip ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white' : 'bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-[#1E1E1E] dark:hover:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50'}`}
              >
                <Crown className="w-3.5 h-3.5"/> {isVip ? 'VIP' : 'Nâng cấp VIP'}
              </button>

              <button
                onClick={() => router.push('/vip')}
                className="hidden sm:flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#1E1E1E] dark:hover:bg-[#2A2A2A] text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-full font-extrabold text-xs transition-colors border border-slate-200 dark:border-white/10"
              >
                <Coins className="w-3.5 h-3.5 text-amber-500"/> {senCashBalance}
              </button>
            </>
          )}

          <button
            onClick={() => setShowNotifications(true)}
            className="p-2.5 sm:p-3 rounded-full hover:bg-slate-100 dark:hover:bg-[#2A2A2A] text-slate-600 dark:text-slate-300 transition-colors active:scale-95 relative"
          >
            <Bell className="w-5 h-5"/>
            {unreadCount > 0 && <span className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 w-2.5 h-2.5 bg-red-500 border-2 border-white dark:border-[#121212] rounded-full"></span>}
          </button>

          <button
            onClick={toggleTheme}
            className="p-2.5 sm:p-3 rounded-full hover:bg-slate-100 dark:hover:bg-[#2A2A2A] text-slate-600 dark:text-slate-300 transition-colors active:scale-95"
          >
            <CrossfadeIcon show={isDark} first={<Sun className="w-5 h-5 text-amber-400"/>} second={<Moon className="w-5 h-5"/>} />
          </button>

          <button
            onClick={() => setShowProfile(true)}
            className="ml-1 sm:ml-2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center font-black shadow-md hover:shadow-lg hover:scale-105 transition-all shrink-0"
          >
            {formData.fullName ? formData.fullName.charAt(0).toUpperCase() : <User className="w-5 h-5"/>}
          </button>
        </div>
      </header>

      <main
        className={`max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 relative z-10 transition-all duration-300
          ${overlayActive ? 'opacity-30 pointer-events-none select-none blur-md scale-[0.98]' : ''}
        `}
      >

        {activeAnnouncement && (
          <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl border border-indigo-200/50 dark:border-indigo-900/30 rounded-[2rem] p-6 flex items-start gap-5 animate-in fade-in slide-in-from-top-4 shadow-sm">
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl shrink-0">
              <AlertCircle className="w-7 h-7"/>
            </div>
            <div className="flex-1 min-w-0">
              <AnnouncementRenderer text={activeAnnouncement} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6">

          <div className="md:col-span-8 bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-600 dark:from-indigo-800 dark:via-blue-800 dark:to-cyan-900 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-lg hover:shadow-xl transition-all duration-500 flex flex-col justify-between min-h-[360px] group border border-white/20 dark:border-white/5">
            <div className="absolute inset-0 opacity-[0.08] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
            <div className="absolute -right-32 -bottom-32 w-96 h-96 bg-white/20 rounded-full blur-[80px] group-hover:scale-110 transition-transform duration-1000 ease-out"></div>

            <div className="relative z-10">
              <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-full text-[11px] font-black uppercase tracking-widest mb-6 shadow-sm border border-white/20">
                <Sparkles className="w-4 h-4 text-yellow-300" /> Bứt phá giới hạn
              </span>
              <h2 className="text-4xl lg:text-5xl font-black mb-5 leading-tight tracking-tight drop-shadow-md">
                Chinh phục mục tiêu <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-100 to-white drop-shadow-none">
                  {formData.targetExams.length > 0 ? formData.targetExams.join(' & ') : 'Kỳ thi sắp tới'}
                </span>
              </h2>
              <p className="text-blue-50/90 font-medium max-w-md leading-relaxed text-sm md:text-base mb-10 drop-shadow-sm">
                Không gian luyện thi cá nhân hóa. Đánh giá năng lực chính xác. Trải nghiệm làm bài trực tuyến mượt mà.
              </p>
            </div>

            <div className="relative z-10 flex flex-wrap gap-4">
              <button
                onClick={() => router.push('/exams')}
                className="bg-white text-indigo-700 hover:bg-slate-50 px-8 py-4 rounded-full font-black flex items-center gap-2 transition-transform active:scale-95 shadow-md"
              >
                <Target className="w-5 h-5"/> Vào thi ngay
              </button>
              <button
                onClick={() => setShowCodeModal(true)}
                className="bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/30 px-7 py-4 rounded-full font-bold flex items-center gap-2 transition-colors active:scale-95"
              >
                <KeyRound className="w-5 h-5"/> Nhập Code Đề
              </button>
            </div>

            <BookOpen className="absolute -right-10 -bottom-10 w-[300px] h-[300px] text-white/5 rotate-12 blur-[2px] pointer-events-none" />
          </div>

          <div className="md:col-span-4 flex flex-col gap-5 lg:gap-6">

            <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-500 flex-1 flex flex-col justify-center items-center text-center group">
              <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 text-orange-500 rounded-[1.2rem] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-inner border border-orange-100 dark:border-orange-500/20">
                <Trophy className="w-8 h-8 drop-shadow-sm"/>
              </div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest">Điểm cao nhất</p>
              <p className="text-[2.5rem] font-black text-slate-900 dark:text-white leading-none">
                {studentHistoryList.length > 0 ? Math.max(...studentHistoryList.map(s => s.score || 0)) : '--'}
              </p>
            </div>

            <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-500 flex-1 flex flex-col justify-center items-center text-center group">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-[1.2rem] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shadow-inner border border-emerald-100 dark:border-emerald-500/20">
                <FileText className="w-8 h-8 drop-shadow-sm"/>
              </div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest">Số đề đã giải</p>
              <p className="text-[2.5rem] font-black text-slate-900 dark:text-white leading-none">
                {studentHistoryList.length}
              </p>
            </div>

          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5 lg:gap-6">
          {FEATURES.filter(f => ['focus', 'library', 'senvideo', 'lab', 'forum', 'score'].includes(f.key)).map(f => {
            const Icon = f.icon
            const colorClass = FEATURE_COLOR_MAP[f.color] ?? FEATURE_COLOR_MAP.indigo
            return (
              <div
                key={f.key}
                onClick={f.onSelect}
                className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl rounded-[2rem] p-6 border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-lg hover:-translate-y-1 flex flex-col items-start cursor-pointer group transition-all duration-500"
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner border ${colorClass}`}>
                  <Icon className="w-6 h-6 drop-shadow-sm"/>
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white transition-colors flex items-center gap-1">
                  {f.label} <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"/>
                </h3>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            )
          })}
        </div>

        <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-2xl rounded-[2.5rem] p-8 border border-slate-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <Clock className="w-6 h-6 text-indigo-600 dark:text-indigo-400"/>
              Lịch sử bài làm gần đây
            </h3>
          </div>

          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-3 custom-scrollbar">
            {studentHistoryList.length === 0 ? (
              <div className="text-center py-20 bg-slate-50 dark:bg-[#1E1E1E] rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                <BookOpen className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-4"/>
                <p className="font-bold text-slate-500 dark:text-slate-400 text-sm">Chưa ghi nhận hoạt động thi nào trên hệ thống.</p>
              </div>
            ) : (
              studentHistoryList.map(sub => (
                <div
                  key={sub.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 p-5 rounded-[1.5rem] bg-slate-50 dark:bg-[#1E1E1E] hover:bg-slate-100 dark:hover:bg-[#252525] border border-transparent hover:border-slate-200 dark:hover:border-white/5 transition-all group"
                >
                  <div className="flex items-center gap-5 min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#2A2A2A] border border-slate-200 dark:border-white/5 flex items-center justify-center text-slate-400 shrink-0 shadow-sm group-hover:scale-105 transition-transform group-hover:text-indigo-500">
                      <FileText className="w-6 h-6"/>
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-slate-900 dark:text-white truncate text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {sub.exams?.title}
                      </h4>
                      <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-bold">
                        <span>{new Date(sub.created_at).toLocaleString('vi-VN', {hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'})}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                        <span className="uppercase tracking-widest text-indigo-500 dark:text-indigo-400">{sub.exams?.exam_type}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full sm:w-auto pl-16 sm:pl-0 shrink-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800 pt-4 sm:pt-0 mt-2 sm:mt-0">
                    <div className={`px-5 py-2.5 rounded-full text-xs font-black shadow-sm ${
                        sub.is_graded
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50'
                      }`}
                    >
                      {sub.is_graded ? `${String(sub.score).replace('.', ',')} Điểm` : 'Đang chờ chấm'}
                    </div>
                    {sub.exams?.allow_review && sub.is_graded ? (
                      <button
                        onClick={() => router.push(`/submissions/${sub.id}/review`)}
                        className="p-3.5 rounded-xl bg-white dark:bg-[#2A2A2A] border border-slate-200 dark:border-white/5 hover:border-indigo-500 dark:hover:border-indigo-500 hover:text-indigo-600 dark:text-slate-300 shadow-sm transition-all group-hover:scale-105 active:scale-95"
                        title="Xem lại bài làm"
                      >
                        <ArrowRight className="w-5 h-5"/>
                      </button>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-[#1A1A1A] text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-transparent cursor-not-allowed" title="Bài thi này không hỗ trợ xem lại">
                        <Lock className="w-5 h-5"/>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </main>
    </div>
  )
}
