'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import {
  X,
  Users,
  Folder,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  FileText,
  ExternalLink,
  Camera,
  VideoOff,
  Clock,
  Search,
  School,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  Calendar,
  Image as ImageIcon,
  Loader2,
  Eye,
} from 'lucide-react'

interface ExamStudentProctorModalProps {
  isOpen: boolean
  onClose: () => void
  exam: any
}

export default function ExamStudentProctorModal({
  isOpen,
  onClose,
  exam,
}: ExamStudentProctorModalProps) {
  const [loading, setLoading] = useState(true)
  const [submissions, setSubmissions] = useState<any[]>([])
  const [proctorLogs, setProctorLogs] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Folder navigation hierarchy: School -> Class -> Student
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null)
  const [selectedClass, setSelectedClass] = useState<string | null>(null)

  // Evidence snapshot modal
  const [viewingEvidenceStudent, setViewingEvidenceStudent] = useState<any | null>(null)
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !exam?.id) return

    let isMounted = true
    const fetchData = async () => {
      setLoading(true)
      try {
        // 1. Tải danh sách bài làm & thông tin học sinh
        const { data: subs } = await supabase
          .from('submissions')
          .select('id, user_id, score, is_graded, created_at, profiles(id, full_name, email, school, class_name, grade, province)')
          .eq('exam_id', exam.id)
          .order('created_at', { ascending: false })

        // 2. Tải nhật ký giám thị AI (kèm bằng chứng chụp ảnh)
        const { data: logs } = await supabase
          .from('exam_proctoring_logs')
          .select('*')
          .eq('exam_id', exam.id)
          .order('created_at', { ascending: false })

        if (isMounted) {
          setSubmissions(subs || [])
          setProctorLogs(logs || [])
        }
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu quản lý học sinh:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchData()

    return () => {
      isMounted = false
    }
  }, [isOpen, exam?.id])

  // Ghép nối danh sách học sinh: tổng hợp từ submissions và proctorLogs
  const allStudents = useMemo(() => {
    const studentMap = new Map<string, any>()

    // Từ submissions
    submissions.forEach((sub) => {
      const uId = sub.user_id || sub.id
      const p = sub.profiles || {}
      const sLogs = proctorLogs.filter((l) => l.user_id === sub.user_id)
      const evidenceList = sLogs.filter((l) => l.snapshot_url && l.violation_type !== 'none' && l.violation_type !== 'no_camera')
      const noCamLog = sLogs.find((l) => l.violation_type === 'no_camera' || l.has_camera === false)

      studentMap.set(uId, {
        userId: sub.user_id,
        submissionId: sub.id,
        fullName: p.full_name || 'Học sinh',
        email: p.email || 'N/A',
        school: p.school?.trim() || 'Trường Khác (Chưa cập nhật)',
        className: p.class_name?.trim() || p.grade?.trim() || 'Lớp Khác',
        province: p.province?.trim() || 'Chưa rõ',
        score: sub.score,
        hasSubmitted: true,
        submittedAt: sub.created_at,
        logs: sLogs,
        evidence: evidenceList,
        hasCamera: !noCamLog,
        noCameraReported: Boolean(noCamLog),
        violationCount: evidenceList.length,
      })
    })

    // Từ proctorLogs (các em đang thi chưa nộp bài)
    proctorLogs.forEach((log) => {
      const uId = log.user_id
      if (uId && !studentMap.has(uId)) {
        const sLogs = proctorLogs.filter((l) => l.user_id === uId)
        const evidenceList = sLogs.filter((l) => l.snapshot_url && l.violation_type !== 'none' && l.violation_type !== 'no_camera')
        const noCamLog = sLogs.find((l) => l.violation_type === 'no_camera' || l.has_camera === false)

        studentMap.set(uId, {
          userId: uId,
          submissionId: null,
          fullName: log.user_name || 'Học sinh đang thi',
          email: log.user_email || 'N/A',
          school: log.school?.trim() || 'Trường Khác (Chưa cập nhật)',
          className: log.class_name?.trim() || 'Lớp Khác',
          province: log.province?.trim() || 'Chưa rõ',
          score: null,
          hasSubmitted: false,
          submittedAt: null,
          logs: sLogs,
          evidence: evidenceList,
          hasCamera: !noCamLog,
          noCameraReported: Boolean(noCamLog),
          violationCount: evidenceList.length,
        })
      }
    })

    return Array.from(studentMap.values())
  }, [submissions, proctorLogs])

  // Lọc theo từ khóa tìm kiếm
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return allStudents
    const q = searchQuery.toLowerCase().trim()
    return allStudents.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.school.toLowerCase().includes(q) ||
        s.className.toLowerCase().includes(q)
    )
  }, [allStudents, searchQuery])

  // Nhóm theo Trường học (Level 1 Folders)
  const schoolFolders = useMemo(() => {
    const map = new Map<string, any[]>()
    filteredStudents.forEach((s) => {
      const sch = s.school || 'Trường Khác'
      if (!map.has(sch)) map.set(sch, [])
      map.get(sch)!.push(s)
    })
    return Array.from(map.entries()).map(([schoolName, students]) => ({
      name: schoolName,
      studentCount: students.length,
      students,
      violationTotal: students.reduce((acc, st) => acc + st.violationCount, 0),
      noCameraCount: students.filter((st) => st.noCameraReported).length,
    }))
  }, [filteredStudents])

  // Nhóm theo Lớp học bên trong Trường đã chọn (Level 2 Folders)
  const classFolders = useMemo(() => {
    if (!selectedSchool) return []
    const studentsInSchool = filteredStudents.filter((s) => s.school === selectedSchool)
    const map = new Map<string, any[]>()
    studentsInSchool.forEach((s) => {
      const cls = s.className || 'Lớp Khác'
      if (!map.has(cls)) map.set(cls, [])
      map.get(cls)!.push(s)
    })
    return Array.from(map.entries()).map(([className, students]) => ({
      name: className,
      studentCount: students.length,
      students,
      violationTotal: students.reduce((acc, st) => acc + st.violationCount, 0),
      noCameraCount: students.filter((st) => st.noCameraReported).length,
    }))
  }, [selectedSchool, filteredStudents])

  // Danh sách Học sinh của Lớp đã chọn (Level 3 Items)
  const activeClassStudents = useMemo(() => {
    if (!selectedSchool || !selectedClass) return []
    return filteredStudents.filter(
      (s) => s.school === selectedSchool && s.className === selectedClass
    )
  }, [selectedSchool, selectedClass, filteredStudents])

  if (!isOpen || !exam) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in select-none">
      <div className="w-full max-w-5xl h-[90vh] bg-white dark:bg-slate-900 rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-200">
        {/* HEADER MODAL */}
        <div className="px-6 py-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between gap-4 bg-slate-50/80 dark:bg-slate-800/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {exam.exam_type || 'Kỳ thi'}
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  Môn: {exam.subject || 'Tổng hợp'}
                </span>
                {exam.require_seb && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                    🛡️ SEB
                  </span>
                )}
              </div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate mt-0.5">
                Quản Lý Học Sinh: {exam.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl border border-black/10 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* BREADCRUMB NAVIGATION & SEARCH */}
        <div className="px-6 py-3 border-b border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Breadcrumb Tree */}
          <div className="flex items-center gap-1.5 text-xs font-bold overflow-x-auto w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setSelectedSchool(null)
                setSelectedClass(null)
              }}
              className={`hover:text-indigo-600 transition flex items-center gap-1 shrink-0 ${
                !selectedSchool ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-500'
              }`}
            >
              <School className="h-3.5 w-3.5" />
              <span>Tất cả Trường ({schoolFolders.length})</span>
            </button>

            {selectedSchool && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                <button
                  type="button"
                  onClick={() => setSelectedClass(null)}
                  className={`hover:text-indigo-600 transition flex items-center gap-1 shrink-0 ${
                    !selectedClass ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-500'
                  }`}
                >
                  <Folder className="h-3.5 w-3.5" />
                  <span className="max-w-[150px] truncate">{selectedSchool}</span>
                </button>
              </>
            )}

            {selectedClass && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                <span className="text-indigo-600 dark:text-indigo-400 font-black flex items-center gap-1 shrink-0">
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span>{selectedClass}</span>
                </span>
              </>
            )}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm học sinh, trường, lớp..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs rounded-xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* MAIN FOLDER & STUDENT VIEW */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span className="text-xs font-bold">Đang tải dữ liệu học sinh & giám thị AI...</span>
            </div>
          ) : allStudents.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400 text-center">
              <Users className="h-10 w-10 text-slate-300" />
              <p className="text-xs font-bold">Chưa có học sinh nào tham gia thi môn/đề thi này.</p>
            </div>
          ) : (
            <>
              {/* LEVEL 1: DANH SÁCH THƯ MỤC CÁC TRƯỜNG HỌC */}
              {!selectedSchool && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>Danh Sách Trường Học ({schoolFolders.length} trường)</span>
                    <span>Bấm vào thư mục để xem các lớp</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {schoolFolders.map((folder) => (
                      <button
                        key={folder.name}
                        type="button"
                        onClick={() => setSelectedSchool(folder.name)}
                        className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 hover:border-indigo-300 transition text-left flex items-start gap-3 group shadow-2xs"
                      >
                        <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                          <Folder className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black text-slate-900 dark:text-white line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                            {folder.name}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mt-1.5 flex-wrap">
                            <span>{folder.studentCount} thí sinh</span>
                            {folder.violationTotal > 0 && (
                              <span className="text-rose-500 font-black">
                                • ⚠️ {folder.violationTotal} vi phạm
                              </span>
                            )}
                            {folder.noCameraCount > 0 && (
                              <span className="text-amber-500 font-black">
                                • 📷 {folder.noCameraCount} không cam
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* LEVEL 2: DANH SÁCH THƯ MỤC CÁC LỚP TRONG TRƯỜNG ĐÃ CHỌN */}
              {selectedSchool && !selectedClass && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>
                      Các Lớp tại: <strong className="text-slate-800 dark:text-white">{selectedSchool}</strong> ({classFolders.length} lớp)
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedSchool(null)}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      ← Quay lại danh sách trường
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {classFolders.map((cls) => (
                      <button
                        key={cls.name}
                        type="button"
                        onClick={() => setSelectedClass(cls.name)}
                        className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 hover:border-indigo-300 transition text-left flex items-start gap-3 group shadow-2xs"
                      >
                        <div className="h-10 w-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                          <GraduationCap className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                            {cls.name}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mt-1.5 flex-wrap">
                            <span>{cls.studentCount} học sinh</span>
                            {cls.violationTotal > 0 && (
                              <span className="text-rose-500 font-black">
                                • ⚠️ {cls.violationTotal} vi phạm
                              </span>
                            )}
                            {cls.noCameraCount > 0 && (
                              <span className="text-amber-500 font-black">
                                • 📷 {cls.noCameraCount} không cam
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* LEVEL 3: BẢNG DANH SÁCH HỌC SINH TRONG LỚP (KIỂM TRA NGHIÊM TÚC, XEM BÀI & BẰNG CHỨNG) */}
              {selectedSchool && selectedClass && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>
                      Học sinh lớp: <strong className="text-slate-800 dark:text-white">{selectedClass}</strong> ({activeClassStudents.length} học sinh)
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedClass(null)}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      ← Quay lại danh sách lớp
                    </button>
                  </div>

                  <div className="rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden bg-white dark:bg-slate-900">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-black/10 dark:border-white/10 bg-slate-50/60 dark:bg-slate-800/60 text-slate-500 font-bold uppercase text-[10px]">
                            <th className="p-3.5">Học sinh</th>
                            <th className="p-3.5">Trạng thái thi</th>
                            <th className="p-3.5">Độ nghiêm túc (Camera & AI)</th>
                            <th className="p-3.5 text-right">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5 dark:divide-white/5 font-semibold">
                          {activeClassStudents.map((st) => (
                            <tr key={st.userId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                              {/* Thông tin học sinh */}
                              <td className="p-3.5">
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {st.fullName}
                                </div>
                                <div className="text-[10px] text-slate-400 font-normal">
                                  {st.email} • {st.province}
                                </div>
                              </td>

                              {/* Trạng thái thi & Điểm */}
                              <td className="p-3.5">
                                {st.hasSubmitted ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                                      Điểm: {Number(st.score).toFixed(2)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold text-[10px]">
                                    Đang làm bài
                                  </span>
                                )}
                              </td>

                              {/* Kiểm tra học sinh có làm bài nghiêm túc hay không */}
                              <td className="p-3.5">
                                {st.noCameraReported ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold text-[10px] border border-amber-500/30">
                                      <VideoOff className="h-3 w-3" /> Không có camera
                                    </span>
                                    <span className="block text-[9px] text-slate-400">
                                      {st.hasSubmitted ? 'Đã hoàn thành nộp bài' : 'Đang tích cực làm bài'}
                                    </span>
                                  </div>
                                ) : st.violationCount > 0 ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-400 font-bold text-[10px] border border-rose-500/30 animate-pulse">
                                      <ShieldAlert className="h-3 w-3" /> Nghi vấn vi phạm ({st.violationCount} lần)
                                    </span>
                                    <span className="block text-[9px] text-rose-500">
                                      Che cam, điện thoại hoặc phao thi
                                    </span>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] border border-emerald-500/30">
                                    <ShieldCheck className="h-3 w-3" /> Nghiêm túc (Camera chuẩn)
                                  </span>
                                )}
                              </td>

                              {/* Hành động: Xem bài thi & Xem bằng chứng ảnh 1 tuần */}
                              <td className="p-3.5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {/* Xem lại bài thi */}
                                  {st.submissionId ? (
                                    <Link
                                      href={`/seb-reviews/${st.submissionId}`}
                                      target="_blank"
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] transition"
                                      title="Xem lại chi tiết bài thi"
                                    >
                                      <Eye className="h-3.5 w-3.5 text-indigo-500" />
                                      <span>Xem bài</span>
                                    </Link>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 italic">Chưa nộp</span>
                                  )}

                                  {/* Bằng chứng gian lận (Snapshots 1 tuần) */}
                                  {st.evidence.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setViewingEvidenceStudent(st)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 font-bold text-[11px] transition border border-rose-500/30"
                                      title="Xem các ảnh chụp nghi vấn vi phạm"
                                    >
                                      <Camera className="h-3.5 w-3.5" />
                                      <span>Bằng chứng ({st.evidence.length})</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER STATS */}
        <div className="px-6 py-3 border-t border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 flex items-center justify-between text-xs text-slate-500 font-bold shrink-0">
          <div className="flex items-center gap-4">
            <span>Tổng số thí sinh: <strong>{allStudents.length}</strong></span>
            <span>Đã nộp bài: <strong>{submissions.length}</strong></span>
          </div>
          <span className="text-[11px] text-slate-400">
            * Bằng chứng hình ảnh nghi vấn gian lận được hệ thống lưu trữ tự động trong vòng 1 tuần (7 ngày)
          </span>
        </div>
      </div>

      {/* MODAL XEM BỘ ẢNH BẰNG CHỨNG GIAN LẬN CỦA HỌC SINH (LƯU 1 TUẦN) */}
      {viewingEvidenceStudent && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[85vh] bg-white dark:bg-slate-900 rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-slate-800">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-500" />
                  Kho Bằng Chứng Gian Lận: {viewingEvidenceStudent.fullName}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Lớp: {viewingEvidenceStudent.className} • Trường: {viewingEvidenceStudent.school}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingEvidenceStudent(null)}
                className="p-1.5 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                🛡️ Hệ thống tự động ghi lại khung hình camera khi Gemini AI phát hiện hành vi nghi vấn (che camera, sử dụng điện thoại, phao thi). Dữ liệu này được lưu trữ trong 7 ngày.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {viewingEvidenceStudent.evidence.map((log: any, idx: number) => (
                  <div
                    key={log.id || idx}
                    className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800 flex flex-col"
                  >
                    <div className="relative aspect-4/3 bg-black">
                      <img
                        src={log.snapshot_url}
                        alt="Bằng chứng gian lận"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-rose-600 text-white font-black text-[9px] uppercase">
                        {log.violation_type === 'phone_detected'
                          ? '📱 Dùng điện thoại'
                          : log.violation_type === 'cheat_sheet_detected'
                          ? '📑 Phao thi / Tài liệu'
                          : log.violation_type === 'camera_blocked'
                          ? '🚫 Che camera'
                          : '⚠️ Hành vi nghi vấn'}
                      </span>
                    </div>

                    <div className="p-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(log.created_at).toLocaleTimeString('vi-VN')}
                        </span>
                        <span>Độ tin cậy: {log.confidence || 90}%</span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        {log.details}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingEvidenceStudent(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
