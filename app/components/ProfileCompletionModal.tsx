'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { GraduationCap, Building2, MapPin, User, CheckCircle2, AlertCircle, Loader2, Phone } from 'lucide-react'

export default function ProfileCompletionModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [className, setClassName] = useState('')
  const [school, setSchool] = useState('')
  const [province, setProvince] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let isMounted = true

    const checkProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !isMounted) return

        setCurrentUser(user)

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, class_name, school, province, phone_number, phone')
          .eq('id', user.id)
          .maybeSingle()

        // Nếu người dùng chưa cập nhật lớp, trường học hoặc số điện thoại, bật modal hoàn tất thông tin
        if (profile && (!profile.school || !profile.class_name || (!profile.phone_number && !profile.phone))) {
          setFullName(profile.full_name || user.user_metadata?.full_name || '')
          setPhone(profile.phone_number || profile.phone || '')
          setClassName(profile.class_name || '')
          setSchool(profile.school || '')
          setProvince(profile.province || '')
          setIsOpen(true)
        }
      } catch (err) {
        // Im lặng để không cản trở luồng ứng dụng
      }
    }

    checkProfile()

    return () => {
      isMounted = false
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return

    if (!fullName.trim() || !phone.trim() || !className.trim() || !school.trim() || !province.trim()) {
      setErrorMsg('Vui lòng điền đầy đủ tất cả các trường thông tin (kèm số điện thoại).')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone_number: phone.trim(),
          phone: phone.trim(),
          class_name: className.trim(),
          school: school.trim(),
          province: province.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id)

      if (error) throw error

      setIsOpen(false)
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể cập nhật hồ sơ.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 p-6 shadow-2xl space-y-4">
        <div className="text-center space-y-1">
          <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            Hoàn Tất Thông Tin Học Sinh
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Vui lòng điền số điện thoại và thông tin trường lớp để thầy cô quản lý và theo dõi kết quả thi cử của bạn.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-indigo-500" />
              Họ và Tên
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ví dụ: Nguyễn Văn An"
              required
              className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-indigo-500" />
              Số Điện Thoại
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ví dụ: 0912345678"
              required
              className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-indigo-500" />
                Lớp
              </label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="Ví dụ: 12A1"
                required
                className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-indigo-500" />
                Tỉnh / TP
              </label>
              <input
                type="text"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                placeholder="Ví dụ: Hà Nội"
                required
                className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-indigo-500" />
              Trường Học
            </label>
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="Ví dụ: THPT Chuyên Hà Nội - Amsterdam"
              required
              className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-indigo-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 shadow cursor-pointer"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              <span>Lưu Thông Tin & Tiếp Tục</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
