'use client'

import {
  BookOpen, Clock, Trophy, User, ChevronRight, ShieldCheck, AlertCircle,
  LayoutGrid, Sun, Moon, KeyRound, Target, Bell, Lock, ArrowRight,
  FileText,
} from 'lucide-react'
import { AnnouncementRenderer } from './Announcement'
import { getModernThemeVars } from '@/app/components/modernTheme'
import CrossfadeIcon from '@/app/components/CrossfadeIcon'
import type { HomeProps } from './types'

const FEATURE_COLOR_MAP: Record<string, string> = {
  indigo: "bg-[var(--accent-soft)] text-[var(--accent)]",
  slate: "bg-black/5 dark:bg-white/5 text-current",
  purple: "bg-[var(--accent-soft)] text-[var(--accent)]",
  cyan: "bg-[var(--accent-soft)] text-[var(--accent)]",
  emerald: "bg-[var(--accent-soft)] text-[var(--accent)]",
  sky: "bg-[var(--accent-soft)] text-[var(--accent)]",
  rose: "bg-[var(--accent-soft)] text-[var(--accent)]",
  amber: "bg-[var(--accent-soft)] text-[var(--accent)]",
}

export default function ModernHome({
  router, userRole, formData, isDark, toggleTheme, unreadCount,
  setShowNotifications, setShowProfile, showFeatureMenu, setShowFeatureMenu,
  FEATURES, activeAnnouncement, studentHistoryList, setShowCodeModal,
  overlayActive, themeColor, density, animationsEnabled, isBetaTester,
}: HomeProps) {
  const bestScore = studentHistoryList.length > 0 ? Math.max(...studentHistoryList.map(s => s.score || 0)) : null
  const isCompact = density === 'compact'

  return (
    <div
      className="min-h-screen font-sans pb-16"
      data-motion={animationsEnabled ? 'on' : 'off'}
      style={{
        // Bảng màu trung tính ấm, giảm hiệu ứng blur/gradient nặng để trang tải nhẹ hơn
        ...getModernThemeVars(themeColor, isDark),
        background: 'var(--bg)',
        color: 'var(--text)',
      } as React.CSSProperties}
    >
      <header
        className="ms-glass h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-40"
        style={{ background: 'color-mix(in srgb, var(--glass-surface) 85%, transparent)', borderBottom: '1px solid var(--border)', boxShadow: 'none' }}
      >
        <div className="flex items-center gap-2.5 cursor-pointer shrink-0" onClick={() => router.push('/dashboard')}>
          <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain rounded-lg" />
          <span className="hidden md:inline text-[15px] font-semibold tracking-tight flex items-center gap-1.5">
            SenExam
            {isBetaTester && <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-widest" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>BETA</span>}
          </span>
        </div>

        <div className="flex-1 min-w-0 max-w-xl mx-3 sm:mx-6 relative">
          <button
            onClick={() => setShowFeatureMenu(v => !v)}
            className="w-full flex items-center gap-2.5 rounded-lg pl-3 pr-3 py-2 text-sm transition-colors"
            style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            <LayoutGrid className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />
            <span className="flex-1 min-w-0 text-left truncate">Tất cả tính năng</span>
          </button>

          {showFeatureMenu && (
            <>
              <div className="fixed inset-0 z-[90]" onClick={() => setShowFeatureMenu(false)} />
              <div
                className="absolute top-[calc(100%+8px)] w-full rounded-xl overflow-hidden z-[100] p-2 max-h-[70vh] overflow-y-auto custom-scrollbar shadow-lg"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {FEATURES.map(f => {
                    const Icon = f.icon
                    return (
                      <button
                        key={f.key}
                        onClick={() => { f.onSelect(); setShowFeatureMenu(false) }}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                      >
                        <div className="p-2 rounded-lg shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                          <Icon className="w-4 h-4"/>
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm">{f.label}</div>
                          <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{f.desc}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {(userRole === 'admin' || userRole === 'collab') && (
            <button
              onClick={() => router.push('/admin')}
              className="hidden lg:flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              style={{ border: '1px solid var(--border)' }}
            >
              <ShieldCheck className="w-4 h-4"/> Quản trị
            </button>
          )}

          <button onClick={() => setShowNotifications(true)} className="p-2.5 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors relative">
            <Bell className="w-4.5 h-4.5"/>
            {unreadCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }}></span>}
          </button>

          <button onClick={toggleTheme} className="p-2.5 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors active:scale-90">
            <CrossfadeIcon show={isDark} className="w-4.5 h-4.5" first={<Sun className="w-4.5 h-4.5"/>} second={<Moon className="w-4.5 h-4.5"/>} />
          </button>

          <button
            onClick={() => setShowProfile(true)}
            className="ml-1 w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {formData.fullName ? formData.fullName.charAt(0).toUpperCase() : <User className="w-4 h-4"/>}
          </button>
        </div>
      </header>

      <main
        className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 transition-opacity duration-200 ${isCompact ? 'py-5 space-y-5' : 'py-8 space-y-8'} ${overlayActive ? 'opacity-30 pointer-events-none select-none' : ''}`}
      >
        {activeAnnouncement && (
          <div className="rounded-xl p-5 flex items-start gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="p-2.5 rounded-lg shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
              <AlertCircle className="w-5 h-5"/>
            </div>
            <div className="flex-1 min-w-0"><AnnouncementRenderer text={activeAnnouncement} /></div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 rounded-2xl p-8 flex flex-col justify-between min-h-[260px]" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--accent)' }}>Mục tiêu hiện tại</p>
              <h2 className="text-3xl font-semibold leading-tight tracking-tight mb-3">
                Chinh phục {formData.targetExams.length > 0 ? formData.targetExams.join(' & ') : 'kỳ thi sắp tới'}
              </h2>
              <p className="text-sm leading-relaxed max-w-md" style={{ color: 'var(--text-muted)' }}>
                Không gian luyện thi cá nhân hoá — đề bám sát cấu trúc mới, chấm điểm tự động, theo dõi tiến bộ theo thời gian thực.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 mt-8">
              <button
                onClick={() => router.push('/exams')}
                className="px-5 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-opacity hover:opacity-90"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                <Target className="w-4 h-4"/> Vào thi ngay
              </button>
              <button
                onClick={() => setShowCodeModal(true)}
                className="px-5 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                style={{ border: '1px solid var(--border)' }}
              >
                <KeyRound className="w-4 h-4"/> Nhập code đề
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
            <div className="rounded-2xl p-6 flex flex-col justify-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <Trophy className="w-5 h-5 mb-3" style={{ color: 'var(--accent)' }}/>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Điểm cao nhất</p>
              <p className="text-3xl font-semibold">{bestScore ?? '--'}</p>
            </div>
            <div className="rounded-2xl p-6 flex flex-col justify-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <FileText className="w-5 h-5 mb-3" style={{ color: 'var(--accent)' }}/>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Số đề đã giải</p>
              <p className="text-3xl font-semibold">{studentHistoryList.length}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {FEATURES.filter(f => ['focus', 'library', 'senvideo', 'lab', 'forum', 'score'].includes(f.key)).map(f => {
            const Icon = f.icon
            return (
              <button
                key={f.key}
                onClick={f.onSelect}
                className="rounded-xl p-4 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03] group"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                  <Icon className="w-4.5 h-4.5"/>
                </div>
                <h3 className="text-sm font-medium flex items-center gap-1">
                  {f.label} <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"/>
                </h3>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
              </button>
            )
          })}
        </div>

        <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-5">
            <Clock className="w-4 h-4" style={{ color: 'var(--accent)' }}/> Lịch sử bài làm gần đây
          </h3>

          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
            {studentHistoryList.length === 0 ? (
              <div className="text-center py-16 rounded-xl" style={{ border: '1px dashed var(--border)' }}>
                <BookOpen className="w-8 h-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }}/>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Chưa ghi nhận hoạt động thi nào.</p>
              </div>
            ) : (
              studentHistoryList.map(sub => (
                <div
                  key={sub.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                  style={{ border: '1px solid var(--border)' }}
                >
                  <div className="min-w-0">
                    <h4 className="font-medium text-sm truncate">{sub.exams?.title}</h4>
                    <div className="flex items-center gap-2 text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      <span>{new Date(sub.created_at).toLocaleString('vi-VN', {hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'})}</span>
                      <span>·</span>
                      <span>{sub.exams?.exam_type}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                    <div
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={sub.is_graded
                        ? { background: 'var(--accent-soft)', color: 'var(--accent)' }
                        : { background: 'var(--border)', color: 'var(--text-muted)' }}
                    >
                      {sub.is_graded ? `${String(sub.score).replace('.', ',')} điểm` : 'Đang chờ chấm'}
                    </div>
                    {sub.exams?.allow_review && sub.is_graded ? (
                      <button onClick={() => router.push(`/submissions/${sub.id}/review`)} className="p-2 rounded-lg transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]" style={{ border: '1px solid var(--border)' }} title="Xem lại bài làm">
                        <ArrowRight className="w-4 h-4"/>
                      </button>
                    ) : (
                      <div className="p-2 rounded-lg" style={{ color: 'var(--text-muted)' }} title="Không hỗ trợ xem lại">
                        <Lock className="w-4 h-4"/>
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
