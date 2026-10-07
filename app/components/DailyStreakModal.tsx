'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  X,
  Flame,
  Coins,
  CheckCircle2,
  Calendar,
  Sparkles,
  Trophy,
  Rocket,
  Gift,
  Clock,
  ArrowRight,
  ShieldCheck,
  Check,
  Loader2,
} from 'lucide-react'

interface DailyStreakModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  currentStreak: number
  senCashBalance: number
  onRewardClaimed: (newBalance: number, newStreak: number) => void
}

interface WeekDayItem {
  dayName: string
  dayIndex: number // 1: Mon, 2: Tue, ..., 6: Sat, 0: Sun
  reward: number
  isToday: boolean
  isPast: boolean
  isClaimed: boolean
}

export default function DailyStreakModal({
  isOpen,
  onClose,
  userId,
  currentStreak,
  senCashBalance,
  onRewardClaimed,
}: DailyStreakModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [claimedToday, setClaimedToday] = useState(false)
  const [claimedDates, setClaimedDates] = useState<Set<string>>(new Set())
  const [weekendMissionClaimed, setWeekendMissionClaimed] = useState(false)
  const [hasDoneExamToday, setHasDoneExamToday] = useState(false)
  const [randomExamId, setRandomExamId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  const todayReward = isWeekend ? 3 : 2

  // Tính ngày Thứ 2 và Chủ Nhật của tuần hiện tại
  const dayOffsetFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const mondayDate = new Date(today)
  mondayDate.setDate(today.getDate() - dayOffsetFromMonday)
  mondayDate.setHours(0, 0, 0, 0)
  const mondayStr = `${mondayDate.getFullYear()}-${String(mondayDate.getMonth() + 1).padStart(2, '0')}-${String(mondayDate.getDate()).padStart(2, '0')}`

  const sundayDate = new Date(mondayDate)
  sundayDate.setDate(mondayDate.getDate() + 6)
  const sundayStr = `${sundayDate.getFullYear()}-${String(sundayDate.getMonth() + 1).padStart(2, '0')}-${String(sundayDate.getDate()).padStart(2, '0')}`

  useEffect(() => {
    if (!isOpen || !userId) return

    let isMounted = true
    const checkStatus = async () => {
      setLoading(true)
      try {
        // 1. Lấy thông tin điểm danh của user từ profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('last_checkin_date, streak_days, sencash_balance, weekend_mission_claimed_date')
          .eq('id', userId)
          .maybeSingle()

        const checkedSet = new Set<string>()

        // 2. Lấy danh sách điểm danh tuần này từ daily_checkins
        try {
          const { data: checkinRows } = await supabase
            .from('daily_checkins')
            .select('checkin_date')
            .eq('user_id', userId)
            .gte('checkin_date', mondayStr)
            .lte('checkin_date', sundayStr)

          if (checkinRows && checkinRows.length > 0) {
            checkinRows.forEach((row: any) => {
              if (row.checkin_date) {
                checkedSet.add(String(row.checkin_date).slice(0, 10))
              }
            })
          }
        } catch {}

        // 3. Fallback: Lấy thêm từ sencash_transactions
        try {
          const { data: txRows } = await supabase
            .from('sencash_transactions')
            .select('created_at')
            .eq('user_id', userId)
            .eq('transaction_type', 'daily_checkin')
            .gte('created_at', mondayDate.toISOString())

          if (txRows && txRows.length > 0) {
            txRows.forEach((tx: any) => {
              if (tx.created_at) {
                const d = new Date(tx.created_at)
                const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                checkedSet.add(ymd)
              }
            })
          }
        } catch {}

        if (profile?.last_checkin_date) {
          checkedSet.add(profile.last_checkin_date)
        }

        if (isMounted) {
          setClaimedDates(checkedSet)
          if (checkedSet.has(todayStr) || profile?.last_checkin_date === todayStr) {
            setClaimedToday(true)
          } else {
            setClaimedToday(false)
          }

          if (profile?.weekend_mission_claimed_date === todayStr) {
            setWeekendMissionClaimed(true)
          } else {
            setWeekendMissionClaimed(false)
          }
        }

        // 4. Nếu là cuối tuần, kiểm tra xem hôm nay user đã nộp ít nhất 1 bài thi chưa
        if (isWeekend) {
          const startOfToday = new Date()
          startOfToday.setHours(0, 0, 0, 0)

          const { data: todaySubs } = await supabase
            .from('submissions')
            .select('id, created_at')
            .eq('user_id', userId)
            .gte('created_at', startOfToday.toISOString())
            .limit(1)

          if (isMounted) {
            setHasDoneExamToday(Boolean(todaySubs && todaySubs.length > 0))
          }
        }

        // 5. Tải 1 đề thi ngẫu nhiên để chuẩn bị sẵn cho nhiệm vụ
        const { data: exList } = await supabase
          .from('exams')
          .select('id')
          .limit(20)

        if (exList && exList.length > 0 && isMounted) {
          const randomIndex = Math.floor(Math.random() * exList.length)
          setRandomExamId(exList[randomIndex]?.id || null)
        }
      } catch (err) {
        console.error('Lỗi kiểm tra chuỗi điểm danh:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    checkStatus()

    return () => {
      isMounted = false
    }
  }, [isOpen, userId, todayStr, isWeekend, mondayStr, sundayStr])

  if (!isOpen) return null

  // Tạo danh sách 7 ngày trong tuần hiện tại (Thứ 2 -> Chủ Nhật)
  const dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật']

  const weekDays = dayNames.map((name, idx) => {
    const curDate = new Date(mondayDate)
    curDate.setDate(mondayDate.getDate() + idx)
    const y = curDate.getFullYear()
    const m = String(curDate.getMonth() + 1).padStart(2, '0')
    const dt = String(curDate.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${dt}`

    const isWeekendDay = idx >= 5
    const reward = isWeekendDay ? 3 : 2

    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    const curTime = new Date(curDate.getFullYear(), curDate.getMonth(), curDate.getDate()).getTime()

    const isToday = curTime === todayStart
    const isPast = curTime < todayStart
    const isFuture = curTime > todayStart
    const isClaimed = claimedDates.has(dateStr) || (isToday && claimedToday)
    const isMissed = isPast && !isClaimed

    return {
      dayName: name,
      dateStr,
      reward,
      isToday,
      isPast,
      isFuture,
      isClaimed,
      isMissed,
    }
  })

  // Xử lý điểm danh nhận SC hôm nay
  const handleClaimDailyReward = async () => {
    if (claimedToday || claiming) return
    setClaiming(true)
    setSuccessMsg(null)

    try {
      // Tính chuỗi mới: kiểm tra ngày điểm danh gần nhất
      const { data: pData } = await supabase
        .from('profiles')
        .select('last_checkin_date, streak_days, sencash_balance')
        .eq('id', userId)
        .maybeSingle()

      let newStreak = 1
      if (pData?.last_checkin_date) {
        const lastDate = new Date(pData.last_checkin_date)
        const diffDays = Math.round((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays === 1) {
          newStreak = (pData.streak_days || 0) + 1
        } else if (diffDays === 0) {
          newStreak = pData.streak_days || 1
        }
      }

      const newBalance = (pData?.sencash_balance || 0) + todayReward

      // Cập nhật profile
      await supabase
        .from('profiles')
        .update({
          sencash_balance: newBalance,
          streak_days: newStreak,
          last_checkin_date: todayStr,
        })
        .eq('id', userId)

      // Ghi nhận vào daily_checkins
      try {
        await supabase.from('daily_checkins').insert({
          user_id: userId,
          checkin_date: todayStr,
          reward_sc: todayReward,
        })
      } catch (checkinErr) {
        console.warn('daily_checkins insert warning:', checkinErr)
      }

      // Ghi lịch sử giao dịch
      try {
        await supabase.from('sencash_transactions').insert({
          user_id: userId,
          amount: todayReward,
          transaction_type: 'daily_checkin',
          description: `Điểm danh ${isWeekend ? 'Cuối tuần' : 'Hằng ngày'} (+${todayReward} SC)`,
        })
      } catch {}

      setClaimedToday(true)
      setClaimedDates((prev) => new Set([...prev, todayStr]))
      setSuccessMsg(`🎉 Điểm danh thành công! Bạn nhận được +${todayReward} SC và nâng chuỗi lên ${newStreak} ngày!`)
      onRewardClaimed(newBalance, newStreak)
    } catch (e: any) {
      alert('Lỗi điểm danh: ' + (e.message || 'Vui lòng thử lại sau.'))
    } finally {
      setClaiming(false)
    }
  }

  // Xử lý nhận thưởng nhiệm vụ cuối tuần (+5 SC)
  const handleClaimWeekendMission = async () => {
    if (weekendMissionClaimed || !hasDoneExamToday || claiming) return
    setClaiming(true)
    try {
      const { data: pData } = await supabase
        .from('profiles')
        .select('sencash_balance, streak_days')
        .eq('id', userId)
        .maybeSingle()

      const newBalance = (pData?.sencash_balance || 0) + 5
      await supabase
        .from('profiles')
        .update({
          sencash_balance: newBalance,
          weekend_mission_claimed_date: todayStr,
        })
        .eq('id', userId)

      try {
        await supabase.from('sencash_transactions').insert({
          user_id: userId,
          amount: 5,
          transaction_type: 'weekend_mission',
          description: 'Hoàn thành nhiệm vụ thi ngẫu nhiên cuối tuần (+5 SC)',
        })
      } catch {}

      setWeekendMissionClaimed(true)
      setSuccessMsg('🔥 Chúc mừng! Bạn đã nhận thêm +5 SC từ Nhiệm vụ cuối tuần!')
      onRewardClaimed(newBalance, pData?.streak_days || currentStreak)
    } catch (e: any) {
      alert('Lỗi nhận thưởng nhiệm vụ: ' + (e.message || 'Thử lại sau.'))
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-6 sm:p-7 shadow-2xl backdrop-blur-2xl text-slate-800 dark:text-slate-100 space-y-5">
        
        {/* Nút đóng */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 h-9 w-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Chuỗi & Số dư SC */}
        <div className="flex items-center gap-3.5">
          <div className="h-13 w-13 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-500 shadow-sm shrink-0">
            <Flame className="h-7 w-7 text-amber-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Chuỗi học tập hàng ngày
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center gap-1">
                <Coins className="h-3 w-3" /> Ví: {senCashBalance} SC
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black mt-1">
              Đang giữ chuỗi {currentStreak} ngày 🔥
            </h2>
          </div>
        </div>

        {/* Thông báo thành công */}
        {successMsg && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in zoom-in-95">
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Lịch tuần 7 ngày nhận SC */}
        <div>
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-400 mb-2.5">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> Lịch nhận thưởng tuần
            </span>
            <span className="text-[10px] text-amber-500 font-bold lowercase">
              T2-T6: +2 SC • T7-CN: +3 SC
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {weekDays.map((d, idx) => {
              return (
                <div
                  key={idx}
                  className={`flex flex-col items-center justify-between p-2 rounded-2xl border text-center transition-all ${
                    d.isToday
                      ? d.isClaimed
                        ? 'border-emerald-500/60 bg-emerald-500/15 shadow-md scale-105'
                        : 'border-amber-500/70 bg-gradient-to-b from-amber-500/20 to-transparent shadow-lg scale-105 ring-2 ring-amber-500/40'
                      : d.isClaimed
                      ? 'border-emerald-500/40 bg-emerald-500/10 opacity-95'
                      : d.isMissed
                      ? 'border-rose-500/40 bg-rose-500/10 dark:bg-rose-500/15'
                      : 'border-slate-200 dark:border-white/10 bg-black/5 dark:bg-white/5 opacity-60'
                  }`}
                >
                  <span className={`text-[10px] font-black truncate ${
                    d.isToday
                      ? 'text-amber-500'
                      : d.isMissed
                      ? 'text-rose-500'
                      : d.isClaimed
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500'
                  }`}>
                    {d.dayName}
                  </span>

                  <div className="my-1.5">
                    {d.isClaimed ? (
                      <div className="h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-xs" title="Đã điểm danh thành công">
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                    ) : d.isMissed ? (
                      <div className="h-6 w-6 rounded-full bg-rose-500 text-white flex items-center justify-center mx-auto shadow-xs" title="Chưa điểm danh (Bỏ lỡ)">
                        <X className="h-3.5 w-3.5 stroke-[3]" />
                      </div>
                    ) : d.isToday ? (
                      <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center mx-auto shadow-sm animate-bounce" title="Hôm nay - Nhấn để điểm danh!">
                        <Gift className="h-3.5 w-3.5" />
                      </div>
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-400 flex items-center justify-center mx-auto" title="Chưa tới ngày">
                        <Clock className="h-3 w-3" />
                      </div>
                    )}
                  </div>

                  <span className={`text-[10px] font-black ${
                    d.isClaimed
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : d.isMissed
                      ? 'text-rose-600 dark:text-rose-400'
                      : d.isToday
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {d.isMissed ? '✕ Bỏ lỡ' : d.isClaimed ? '✓ Nhận' : `+${d.reward}`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Nút điểm danh nhận SC hôm nay */}
        <div>
          {claimedToday ? (
            <button
              type="button"
              disabled
              className="w-full py-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-black text-sm flex items-center justify-center gap-2 cursor-default"
            >
              <CheckCircle2 className="h-4 w-4" /> Đã điểm danh hôm nay (+{todayReward} SC)
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClaimDailyReward}
              disabled={claiming || loading}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 hover:scale-[1.02] active:scale-95 transition cursor-pointer disabled:opacity-50"
            >
              {claiming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Gift className="h-4 w-4 animate-bounce" />
              )}
              Điểm danh nhận ngay +{todayReward} SC {isWeekend ? '(Thưởng Cuối Tuần)' : ''}
            </button>
          )}
        </div>

        {/* KHU VỰC NHIỆM VỤ CUỐI TUẦN (Thứ 7 & Chủ Nhật: Làm 1 đề ngẫu nhiên nhận +5 SC) */}
        <div className={`rounded-2xl border p-4 transition-all ${
          isWeekend
            ? 'border-indigo-500/30 bg-indigo-500/10'
            : 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/40 opacity-70'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0">
                <Rocket className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black uppercase text-indigo-700 dark:text-indigo-300">
                    Nhiệm vụ cuối tuần (T7 - CN)
                  </h4>
                  <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-amber-500 text-white">
                    +5 SC
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Làm 1 đề thi ngẫu nhiên trong kho khảo thí để rèn luyện và nhận thêm 5 SC.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-indigo-500/15 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] font-bold text-slate-500">
              Trạng thái:{' '}
              {weekendMissionClaimed ? (
                <span className="text-emerald-500 font-black">✓ Đã nhận thưởng (+5 SC)</span>
              ) : hasDoneExamToday ? (
                <span className="text-emerald-500 font-black">✓ Đã hoàn thành 1 đề thi!</span>
              ) : isWeekend ? (
                <span className="text-amber-500 font-black">Chưa làm đề thi nào hôm nay</span>
              ) : (
                <span>Chỉ mở vào Thứ 7 & Chủ Nhật</span>
              )}
            </div>

            {isWeekend && !weekendMissionClaimed && (
              hasDoneExamToday ? (
                <button
                  type="button"
                  onClick={handleClaimWeekendMission}
                  disabled={claiming}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-black shadow-md hover:scale-105 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Gift className="h-3.5 w-3.5" /> Nhận ngay +5 SC
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    if (randomExamId) {
                      router.push(`/new-exams/${randomExamId}`)
                    } else {
                      router.push('/new-exams')
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md hover:scale-105 active:scale-95 transition flex items-center gap-1 cursor-pointer"
                >
                  Làm đề ngẫu nhiên ngay <ArrowRight className="h-3 w-3" />
                </button>
              )
            )}
          </div>
        </div>

        {/* Lời khuyên duy trì chuỗi */}
        <p className="text-[11px] text-center text-slate-400">
          💡 Điểm danh liên tục mỗi ngày để tích lũy SenCash (SC) dùng cho đăng ký VIP, mở khóa đề độc quyền và sử dụng Sen AI không giới hạn!
        </p>
      </div>
    </div>
  )
}
