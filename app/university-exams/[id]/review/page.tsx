'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import UniversityExamRoom from '@/app/components/UniversityExamRoom'
import ModernLoading from '@/app/components/ModernLoading'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'

export default function UniversityExamReviewPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const examId = params?.id as string
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
  const [reviewData, setReviewData] = useState<any>(null)

  useEffect(() => {
    if (!examId) return

    const loadReview = async () => {
      setLoading(true)
      try {
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

        const { data: examData, error: examError } = await supabase
          .from('exams')
          .select('*')
          .eq('id', examId)
          .maybeSingle()

        if (examError || !examData) {
          setErrorMsg('Không tìm thấy đề thi này.')
          setLoading(false)
          return
        }

        setExam(examData)

        // Tải submission gần nhất
        let query = supabase
          .from('submissions')
          .select('*')
          .eq('exam_id', examId)

        if (auth?.user?.id) {
          query = query.eq('user_id', auth.user.id)
        }

        if (submissionId) {
          query = supabase.from('submissions').select('*').eq('id', submissionId).maybeSingle()
        } else {
          query = query.order('created_at', { ascending: false }).limit(1)
        }

        const { data: subData } = await query
        const singleSub = Array.isArray(subData) ? subData[0] : subData

        if (singleSub && singleSub.details) {
          setReviewData(singleSub.details)
        } else if (singleSub) {
          // Xây dựng review data từ singleSub
          setReviewData({
            examId: examData.id,
            examTitle: examData.title,
            studentName: studentInfo.name,
            studentEmail: studentInfo.email,
            startTime: singleSub.created_at || new Date().toISOString(),
            finishTime: singleSub.created_at || new Date().toISOString(),
            durationSeconds: singleSub.time_spent || 1800,
            earnedPoints: singleSub.earned_points || singleSub.score || 0,
            maxPoints: singleSub.total_points || 10,
            gradeOn10: singleSub.score || 0,
            percentage: singleSub.score ? Math.round((singleSub.score / 10) * 100) : 0,
            correctCount: singleSub.correct_count || 0,
            totalQuestions: singleSub.total_questions || 0,
            questionResults: [],
          })
        } else {
          setErrorMsg('Không tìm thấy bài làm nào để xem lại.')
        }
      } catch (err: any) {
        console.error('Lỗi khi tải kết quả xem lại:', err)
        setErrorMsg('Có lỗi xảy ra khi tải dữ liệu xem lại.')
      } finally {
        setLoading(false)
      }
    }

    loadReview()
  }, [examId, submissionId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
        <ModernLoading text="Đang tải kết quả bài kiểm tra Portal UET..." />
      </div>
    )
  }

  if (errorMsg || !exam) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="bg-white border border-slate-300 shadow-sm max-w-md w-full p-6 text-center rounded-none">
          <AlertCircle className="w-12 h-12 text-rose-600 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900 mb-2">Thông báo</h2>
          <p className="text-xs text-slate-600 mb-6">{errorMsg || 'Không thể xem lại bài thi này.'}</p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href={`/university-exams/${examId}`}
              className="px-4 py-2 bg-[#003366] text-white text-xs font-bold rounded-none hover:bg-[#002244]"
            >
              Làm bài thi
            </Link>
            <Link
              href="/new-sen-ground"
              className="px-4 py-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-none hover:bg-slate-300"
            >
              Về Portal
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
      initialReviewData={reviewData}
      onExit={() => router.push('/new-sen-ground')}
    />
  )
}
