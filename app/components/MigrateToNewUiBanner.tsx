'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Sparkles, Rocket, ArrowRight, CheckCircle2, Loader2, Zap, Heart } from 'lucide-react'

export default function MigrateToNewUiBanner() {
  const router = useRouter()
  const [migrating, setMigrating] = useState(false)

  const handleConfirmMigration = async () => {
    setMigrating(true)
    localStorage.setItem('sen_prefer_new_ui', 'true')

    try {
      const { data: auth } = await supabase.auth.getUser()
      if (auth.user) {
        await supabase
          .from('profiles')
          .update({
            migrated_to_new_ui: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', auth.user.id)

        await supabase.from('ui_migration_opt_ins').insert({
          user_id: auth.user.id,
          migrated_at: new Date().toISOString(),
          source_path: '/dashboard',
        })
      }
    } catch (e) {
      console.error('Error saving migration preference:', e)
    }

    router.replace('/new-dashboard')
  }

  return (
    <div className="mt-10 rounded-[2.5rem] border border-indigo-500/30 bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-pink-900/40 p-8 text-white shadow-2xl backdrop-blur-2xl relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-10 -top-10 w-60 h-60 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-indigo-300 border border-white/15">
            <Sparkles className="h-3.5 w-3.5" /> Hệ Sinh Thái SenExam 2.0
          </div>
          <h3 className="text-xl sm:text-2xl font-black leading-tight text-white">
            Nâng Cấp Trải Nghiệm Sang Giao Diện New Dashboard Mới
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Giao diện cũ sẽ chính thức dừng hoạt động vào ngày <strong>31/08/2026</strong>. Hãy xác nhận chuyển sang giao diện mới ngay hôm nay để tận hưởng tốc độ 60FPS mượt mà, công cụ soạn đề THPT 2026 và SenAI 3.7 Flash!
          </p>
        </div>

        <button
          type="button"
          onClick={handleConfirmMigration}
          disabled={migrating}
          className="shrink-0 flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white px-8 py-4 text-sm font-black uppercase tracking-wider shadow-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
        >
          {migrating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Đang chuyển tiếp...</span>
            </>
          ) : (
            <>
              <Rocket className="h-5 w-5" />
              <span>Xác Nhận Chuyển Giao Diện Mới Ngay</span>
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
