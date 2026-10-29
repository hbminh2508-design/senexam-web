'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import UniversityExamRoom from '@/app/components/UniversityExamRoom'
import ModernLoading from '@/app/components/ModernLoading'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Clock, AlertCircle } from 'lucide-react'

export default function UniversityExamPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const examId = params?.id as string
  const isReviewMode = searchParams?.get('review') === 'true'
  const submissionId = searchParams?.get('submission_id')

  const [loading, setLoading] = useState(true)
  const [exam, setExam] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [studentInfo, setStudentInfo] = useState<{
    id?: string
    name: string
    email: string
    avatar?: string | null
    studentId?: string
    school?: string
  }>({
    name: 'Sinh viên UET',
    email: 'sinhvien@vnu.edu.vn',
    studentId: '22020000',
  })
  const [initialReviewData, setInitialReviewData] = useState<any>(null)

  useEffect(() => {
    if (!examId) return

    const loadData = async () => {
      setLoading(true)
      try {
        // 1. Kiểm tra xác thực thí sinh
        const { data: auth } = await supabase.auth.getUser()
        if (auth?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', auth.user.id)
            .maybeSingle()

          const userEmail = auth.user.email || ''
          const msvMatch = userEmail.match(/^(\d{8})/i)

          setStudentInfo({
            id: auth.user.id,
            name: profile?.full_name || profile?.username || userEmail.split('@')[0] || 'Sinh viên Đại học',
            email: userEmail,
            avatar: profile?.avatar_url || null,
            studentId: msvMatch ? msvMatch[1] : (profile?.phone || '2202' + auth.user.id.slice(0, 4)),
            school: profile?.school || 'Trường Đại học Công nghệ (VNU-UET)',
          })
        }

        // 2. Tải thông tin đề thi
        const { data: examData, error: examError } = await supabase
          .from('exams')
          .select('*')
          .eq('id', examId)
          .maybeSingle()

        if (examError || !examData) {
          setErrorMsg('Không tìm thấy đề thi hoặc đề thi đã bị xóa khỏi hệ thống.')
          setLoading(false)
          return
        }

        setExam(examData)

        // 3. Nếu là chế độ xem lại, tải submission tương ứng
        if (isReviewMode && auth?.user) {
          let query = supabase
            .from('submissions')
            .select('*')
            .eq('exam_id', examId)
            .eq('user_id', auth.user.id)
            .order('created_at', { ascending: false })
            .limit(1)

          if (submissionId) {
            query = supabase
              .from('submissions')
              .select('*')
              .eq('id', submissionId)
              .maybeSingle()
          }

          const { data: subData } = await query
          if (subData) {
            const singleSub = Array.isArray(subData) ? subData[0] : subData
            if (singleSub && singleSub.details) {
              setInitialReviewData(singleSub.details)
            }
          }
        }
      } catch (err: any) {
        console.error('Lỗi khi tải thông tin đề thi Đại học:', err)
        setErrorMsg('Có lỗi xảy ra khi tải đề thi. Vui lòng thử lại!')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [examId, isReviewMode, submissionId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
        <ModernLoading text="Đang tải hệ thống thi trực tuyến Portal UET..." />
      </div>
    )
  }

  if (errorMsg || !exam) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="bg-white border border-slate-300 shadow-sm max-w-md w-full p-6 text-center rounded-none">
          <AlertCircle className="w-12 h-12 text-rose-600 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900 mb-2">Thông báo</h2>
          <p className="text-xs text-slate-600 mb-6">{errorMsg || 'Không thể mở bài thi này.'}</p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/new-sen-ground"
              className="px-4 py-2 bg-[#003366] text-white text-xs font-bold rounded-none hover:bg-[#002244]"
            >
              Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <UniversityExamRoom
      exam={exam}
      studentInfo={studentInfo}
      initialReviewData={initialReviewData}
      onExit={() => router.push('/new-sen-ground')}
    />
  )
}
