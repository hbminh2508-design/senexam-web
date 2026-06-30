'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  ArrowLeft, BarChart3, Calculator, TrendingUp, Info,
  AlertCircle, Bot, Lock, User, Moon, Sun
} from 'lucide-react'

// --- MATERIAL 3 & LIQUID GLASS CONSTANTS ---
const mdCard = "bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl backdrop-saturate-[1.5] rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.15)] hover:shadow-xl hover:-translate-y-1 transition-all duration-500 ease-out relative overflow-hidden"
const mdInput = "w-full bg-slate-100 dark:bg-[#202020] border-transparent focus:bg-white dark:focus:bg-[#2A2A2A] border-2 focus:border-indigo-500 rounded-2xl px-5 py-4 outline-none transition-all font-bold text-slate-900 dark:text-white text-sm shadow-inner"

// ============================================================================
// DỮ LIỆU GỐC, TRÍCH XUẤT TRỰC TIẾP TỪ "BÁO CÁO THỐNG KÊ VÀ PHÂN TÍCH PHỔ ĐIỂM
// THI TỐT NGHIỆP THPT 2025" DO BỘ GD&ĐT CÔNG BỐ NGÀY 15/7/2025.
// Nguồn: xaydungchinhsach.chinhphu.vn (Cổng TTĐT Chính phủ) — bao gồm:
//  - Các chỉ số thống kê cơ bản (tổng số thí sinh, ĐTB, trung vị, độ lệch chuẩn,
//    số điểm 10, số điểm 0, số bài thi điểm liệt <=1)
//  - Bảng BÁCH PHÂN VỊ chính thức (percentile 1-25 và 76-100, cộng mốc trung vị = P50)
//    — đây chính là bảng số liệu Bộ GD&ĐT dùng để các trường đại học so sánh phổ điểm
//    khi xét tuyển, nên đây là nguồn "chuẩn" nhất hiện có ở dạng số (không phải suy
//    đoán từ ảnh biểu đồ).
// Lưu ý: báo cáo gốc KHÔNG công bố số liệu tần suất theo từng khoảng 0,25đ dưới
// dạng bảng số (chỉ có ở dạng ảnh biểu đồ cột), nên phần "hình dạng phổ điểm" bên
// dưới được vẽ lại bằng đường cong bách phân vị thực tế (chính xác tuyệt đối tại
// các mốc phần trăm) thay vì áng chừng chiều cao cột từ ảnh.
// ============================================================================

type PercentilePoint = [number, number] // [percentile, score]

interface SubjectInfo {
  totalStudents: number
  mean: number
  median: number
  stdDev: number
  d10: number
  d0: number
  liet: number // số bài thi <= 1 điểm
  note?: string
  // Bảng bách phân vị chính thức: percentile 0(giả định 0đ), 1-25, 50(trung vị), 76-100
  percentiles: PercentilePoint[]
}

const SUBJECTS_DATA: Record<string, SubjectInfo> = {
  'Toán': {
    totalStudents: 1126172, mean: 4.78, median: 4.6, stdDev: 1.68, d10: 513, d0: 6, liet: 777,
    note: 'Đề thi đổi mới cấu trúc khiến phổ điểm lệch trái rõ rệt: 56,4% thí sinh dưới điểm trung bình, nhưng vẫn có 513 bài đạt điểm 10 tuyệt đối.',
    percentiles: [
      [0,0],[1,1.45],[2,1.75],[3,1.95],[4,2.10],[5,2.20],[6,2.35],[7,2.35],[8,2.50],[9,2.60],[10,2.60],
      [11,2.75],[12,2.85],[13,2.85],[14,2.95],[15,3.00],[16,3.10],[17,3.10],[18,3.20],[19,3.25],[20,3.25],
      [21,3.35],[22,3.35],[23,3.50],[24,3.50],[25,3.50],
      [50,4.6],
      [76,5.85],[77,6.00],[78,6.00],[79,6.00],[80,6.25],[81,6.25],[82,6.25],[83,6.35],[84,6.50],[85,6.50],
      [86,6.75],[87,6.75],[88,6.75],[89,7.00],[90,7.00],[91,7.25],[92,7.25],[93,7.50],[94,7.50],[95,7.75],
      [96,8.00],[97,8.25],[98,8.50],[99,8.75],[100,9.00],
    ],
  },
  'Ngữ Văn': {
    totalStudents: 1126726, mean: 7.0, median: 7.25, stdDev: 1.28, d10: 0, d0: 7, liet: 87,
    note: 'Không có thí sinh nào đạt điểm 10 trên toàn quốc. Phổ điểm tập trung cao quanh mức 7,0 - 7,5.',
    percentiles: [
      [0,0],[1,2.75],[2,3.50],[3,4.00],[4,4.25],[5,4.50],[6,4.75],[7,5.00],[8,5.00],[9,5.00],[10,5.25],
      [11,5.25],[12,5.50],[13,5.50],[14,5.50],[15,5.75],[16,5.75],[17,5.75],[18,6.00],[19,6.00],[20,6.00],
      [21,6.00],[22,6.00],[23,6.25],[24,6.25],[25,6.25],
      [50,7.25],
      [76,8.00],[77,8.00],[78,8.00],[79,8.00],[80,8.00],[81,8.00],[82,8.25],[83,8.25],[84,8.25],[85,8.25],
      [86,8.25],[87,8.25],[88,8.50],[89,8.50],[90,8.50],[91,8.50],[92,8.50],[93,8.75],[94,8.75],[95,8.75],
      [96,8.75],[97,9.00],[98,9.00],[99,9.00],[100,9.25],
    ],
  },
  'Vật Lí': {
    totalStudents: 347599, mean: 6.99, median: 7.0, stdDev: 1.52, d10: 3929, d0: 1, liet: 3,
    note: 'Môn bùng nổ điểm 10 nhất kỳ thi với 3.929 bài tuyệt đối (năm 2024 chỉ có 55 bài).',
    percentiles: [
      [0,0],[1,3.20],[2,3.75],[3,4.00],[4,4.20],[5,4.35],[6,4.50],[7,4.60],[8,4.75],[9,4.75],[10,4.85],
      [11,5.00],[12,5.00],[13,5.10],[14,5.25],[15,5.25],[16,5.35],[17,5.35],[18,5.50],[19,5.50],[20,5.60],
      [21,5.60],[22,5.75],[23,5.75],[24,5.75],[25,5.85],
      [50,7.0],
      [76,8.25],[77,8.25],[78,8.25],[79,8.25],[80,8.35],[81,8.50],[82,8.50],[83,8.50],[84,8.50],[85,8.75],
      [86,8.75],[87,8.75],[88,8.75],[89,9.00],[90,9.00],[91,9.00],[92,9.00],[93,9.25],[94,9.25],[95,9.25],
      [96,9.50],[97,9.50],[98,9.50],[99,9.75],[100,10.00],
    ],
  },
  'Hóa Học': {
    totalStudents: 240135, mean: 6.06, median: 6.0, stdDev: 1.81, d10: 625, d0: 0, liet: 8,
    note: 'Phổ điểm phân hóa rõ, độ lệch chuẩn cao nhất trong các môn KHTN (1,81).',
    percentiles: [
      [0,0],[1,2.20],[2,2.60],[3,2.85],[4,3.00],[5,3.20],[6,3.30],[7,3.35],[8,3.50],[9,3.60],[10,3.70],
      [11,3.75],[12,3.85],[13,3.95],[14,4.00],[15,4.10],[16,4.10],[17,4.25],[18,4.25],[19,4.25],[20,4.35],
      [21,4.45],[22,4.50],[23,4.50],[24,4.60],[25,4.60],
      [50,6.0],
      [76,7.50],[77,7.50],[78,7.75],[79,7.75],[80,7.75],[81,7.75],[82,8.00],[83,8.00],[84,8.00],[85,8.25],
      [86,8.25],[87,8.25],[88,8.50],[89,8.50],[90,8.75],[91,8.75],[92,8.75],[93,8.75],[94,9.00],[95,9.00],
      [96,9.25],[97,9.25],[98,9.25],[99,9.50],[100,9.75],
    ],
  },
  'Sinh Học': {
    totalStudents: 69895, mean: 5.78, median: 5.75, stdDev: 1.58, d10: 82, d0: 0, liet: 1,
    note: 'Môn có quy mô thí sinh nhỏ nhất trong tổ hợp KHTN (69.895 bài thi).',
    percentiles: [
      [0,0],[1,2.30],[2,2.70],[3,2.95],[4,3.10],[5,3.25],[6,3.35],[7,3.50],[8,3.60],[9,3.60],[10,3.75],
      [11,3.80],[12,3.85],[13,3.95],[14,4.00],[15,4.10],[16,4.10],[17,4.20],[18,4.25],[19,4.25],[20,4.35],
      [21,4.35],[22,4.45],[23,4.50],[24,4.50],[25,4.60],
      [50,5.75],
      [76,7.00],[77,7.00],[78,7.00],[79,7.10],[80,7.25],[81,7.25],[82,7.25],[83,7.35],[84,7.50],[85,7.50],
      [86,7.50],[87,7.75],[88,7.75],[89,7.75],[90,8.00],[91,8.00],[92,8.00],[93,8.25],[94,8.25],[95,8.50],
      [96,8.50],[97,8.75],[98,9.00],[99,9.00],[100,9.50],
    ],
  },
  'Lịch Sử': {
    totalStudents: 481293, mean: 6.52, median: 6.6, stdDev: 1.63, d10: 1518, d0: 2, liet: 13,
    note: '1.518 bài đạt điểm 10 (năm 2024 có 2.108 bài), điểm phổ biến nhất là 7,25.',
    percentiles: [
      [0,0],[1,2.60],[2,3.10],[3,3.35],[4,3.50],[5,3.70],[6,3.85],[7,3.95],[8,4.00],[9,4.10],[10,4.25],
      [11,4.35],[12,4.45],[13,4.50],[14,4.60],[15,4.60],[16,4.75],[17,4.75],[18,4.85],[19,4.95],[20,5.00],
      [21,5.00],[22,5.10],[23,5.20],[24,5.25],[25,5.25],
      [50,6.6],
      [76,7.75],[77,7.75],[78,8.00],[79,8.00],[80,8.00],[81,8.00],[82,8.10],[83,8.25],[84,8.25],[85,8.25],
      [86,8.25],[87,8.50],[88,8.50],[89,8.50],[90,8.50],[91,8.75],[92,8.75],[93,8.75],[94,9.00],[95,9.00],
      [96,9.00],[97,9.25],[98,9.25],[99,9.50],[100,9.75],
    ],
  },
  'Địa Lí': {
    totalStudents: 476472, mean: 6.63, median: 6.75, stdDev: 1.75, d10: 6907, d0: 3, liet: 19,
    note: 'Môn có số điểm 10 lớn nhất hệ thống: 6.907 bài (năm 2024 có 3.175 bài).',
    percentiles: [
      [0,0],[1,2.50],[2,3.00],[3,3.25],[4,3.45],[5,3.60],[6,3.75],[7,3.85],[8,4.00],[9,4.10],[10,4.25],
      [11,4.35],[12,4.35],[13,4.50],[14,4.60],[15,4.60],[16,4.75],[17,4.75],[18,4.85],[19,4.95],[20,5.00],
      [21,5.00],[22,5.10],[23,5.20],[24,5.25],[25,5.25],
      [50,6.75],
      [76,8.00],[77,8.00],[78,8.10],[79,8.25],[80,8.25],[81,8.25],[82,8.50],[83,8.50],[84,8.50],[85,8.50],
      [86,8.75],[87,8.75],[88,8.75],[89,8.75],[90,9.00],[91,9.00],[92,9.00],[93,9.00],[94,9.25],[95,9.25],
      [96,9.50],[97,9.50],[98,9.75],[99,9.75],[100,10.00],
    ],
  },
  'Tiếng Anh': {
    totalStudents: 351848, mean: 5.38, median: 5.25, stdDev: 1.45, d10: 141, d0: 2, liet: 28,
    note: 'Số thí sinh dự thi giảm mạnh so với 2024 (do thay đổi quy chế xét miễn thi/quy đổi chứng chỉ).',
    percentiles: [
      [0,0],[1,2.25],[2,2.50],[3,2.75],[4,3.00],[5,3.00],[6,3.25],[7,3.25],[8,3.25],[9,3.50],[10,3.50],
      [11,3.50],[12,3.75],[13,3.75],[14,3.75],[15,3.75],[16,4.00],[17,4.00],[18,4.00],[19,4.00],[20,4.00],
      [21,4.25],[22,4.25],[23,4.25],[24,4.25],[25,4.25],
      [50,5.25],
      [76,6.25],[77,6.50],[78,6.50],[79,6.50],[80,6.50],[81,6.50],[82,6.75],[83,6.75],[84,6.75],[85,6.75],
      [86,7.00],[87,7.00],[88,7.00],[89,7.25],[90,7.25],[91,7.25],[92,7.50],[93,7.50],[94,7.75],[95,7.75],
      [96,8.00],[97,8.25],[98,8.50],[99,8.75],[100,9.25],
    ],
  },
  'GDKT&PL': {
    totalStudents: 246401, mean: 7.69, median: 7.75, stdDev: 1.18, d10: 1451, d0: 0, liet: 0,
    note: 'Trước 2025 là môn Giáo dục Công dân (GDCD). Không có bài thi nào bị điểm liệt.',
    percentiles: [
      [0,0],[1,3.75],[2,4.50],[3,4.85],[4,5.25],[5,5.35],[6,5.50],[7,5.75],[8,5.75],[9,6.00],[10,6.00],
      [11,6.25],[12,6.25],[13,6.25],[14,6.50],[15,6.50],[16,6.50],[17,6.50],[18,6.75],[19,6.75],[20,6.75],
      [21,6.75],[22,6.85],[23,7.00],[24,7.00],[25,7.00],
      [50,7.75],
      [76,8.50],[77,8.50],[78,8.50],[79,8.75],[80,8.75],[81,8.75],[82,8.75],[83,8.75],[84,8.75],[85,8.75],
      [86,8.75],[87,9.00],[88,9.00],[89,9.00],[90,9.00],[91,9.00],[92,9.10],[93,9.25],[94,9.25],[95,9.25],
      [96,9.50],[97,9.50],[98,9.50],[99,9.75],[100,10.00],
    ],
  },
  'Tin Học': {
    totalStudents: 7602, mean: 6.78, median: 6.75, stdDev: 1.48, d10: 60, d0: 0, liet: 0,
    note: 'Năm đầu tiên thi tốt nghiệp THPT môn Tin học (7.602 thí sinh dự thi).',
    percentiles: [
      [0,0],[1,3.10],[2,3.60],[3,3.85],[4,4.10],[5,4.25],[6,4.35],[7,4.50],[8,4.60],[9,4.75],[10,4.75],
      [11,4.85],[12,5.00],[13,5.00],[14,5.10],[15,5.10],[16,5.25],[17,5.25],[18,5.35],[19,5.35],[20,5.50],
      [21,5.50],[22,5.50],[23,5.60],[24,5.75],[25,5.75],
      [50,6.75],
      [76,8.00],[77,8.00],[78,8.00],[79,8.00],[80,8.00],[81,8.25],[82,8.25],[83,8.25],[84,8.25],[85,8.25],
      [86,8.50],[87,8.50],[88,8.50],[89,8.75],[90,8.75],[91,8.75],[92,8.85],[93,9.00],[94,9.00],[95,9.25],
      [96,9.25],[97,9.25],[98,9.50],[99,9.50],[100,9.75],
    ],
  },
  'CN Công nghiệp': {
    totalStudents: 2290, mean: 5.79, median: 5.6, stdDev: 1.54, d10: 4, d0: 0, liet: 0,
    note: 'Năm đầu tổ chức thi tốt nghiệp môn Công nghệ - Công nghiệp, quy mô còn rất nhỏ (2.290 thí sinh).',
    percentiles: [
      [0,0],[1,2.85],[2,3.10],[3,3.35],[4,3.35],[5,3.50],[6,3.60],[7,3.75],[8,3.78],[9,3.85],[10,3.85],
      [11,3.95],[12,4.00],[13,4.00],[14,4.10],[15,4.10],[16,4.20],[17,4.25],[18,4.25],[19,4.25],[20,4.35],
      [21,4.35],[22,4.35],[23,4.50],[24,4.50],[25,4.50],
      [50,5.6],
      [76,7.00],[77,7.00],[78,7.00],[79,7.10],[80,7.25],[81,7.25],[82,7.25],[83,7.35],[84,7.50],[85,7.50],
      [86,7.50],[87,7.75],[88,7.75],[89,7.75],[90,8.00],[91,8.00],[92,8.18],[93,8.25],[94,8.43],[95,8.50],
      [96,8.60],[97,8.75],[98,9.00],[99,9.25],[100,9.50],
    ],
  },
  'CN Nông nghiệp': {
    totalStudents: 22048, mean: 7.72, median: 7.75, stdDev: 1.17, d10: 101, d0: 0, liet: 0,
    note: 'Năm đầu tổ chức thi tốt nghiệp môn Công nghệ - Nông nghiệp; điểm trung bình cao nhất hệ thống.',
    percentiles: [
      [0,0],[1,3.75],[2,4.60],[3,5.00],[4,5.25],[5,5.50],[6,5.75],[7,5.75],[8,6.00],[9,6.00],[10,6.10],
      [11,6.25],[12,6.25],[13,6.35],[14,6.50],[15,6.50],[16,6.50],[17,6.60],[18,6.75],[19,6.75],[20,6.75],
      [21,6.75],[22,6.85],[23,7.00],[24,7.00],[25,7.00],
      [50,7.75],
      [76,8.50],[77,8.50],[78,8.75],[79,8.75],[80,8.75],[81,8.75],[82,8.75],[83,8.75],[84,8.75],[85,9.00],
      [86,9.00],[87,9.00],[88,9.00],[89,9.00],[90,9.00],[91,9.25],[92,9.25],[93,9.25],[94,9.25],[95,9.25],
      [96,9.50],[97,9.50],[98,9.50],[99,9.75],[100,9.75],
    ],
  },
}

const subjectsList = Object.keys(SUBJECTS_DATA)

// Nội suy tuyến tính trên bảng bách phân vị chính thức để suy ra:
// (a) điểm ứng với 1 mốc % bất kỳ (dùng để vẽ đường cong)
// (b) bách phân vị ứng với 1 điểm số bất kỳ (dùng để tính thứ hạng người dùng nhập)
function percentileForScore(score: number, info: SubjectInfo): number {
  const pts = info.percentiles
  if (score <= pts[0][1]) return pts[0][0]
  for (let i = 0; i < pts.length - 1; i++) {
    const [p1, s1] = pts[i]
    const [p2, s2] = pts[i + 1]
    if (score >= s1 && score <= s2) {
      if (s2 === s1) return p2
      const ratio = (score - s1) / (s2 - s1)
      return p1 + ratio * (p2 - p1)
    }
  }
  // Điểm cao hơn mốc P100 chính thức (vùng top ~1%, chứa cả các bài điểm 10).
  // Ước lượng dựa trên tỉ lệ điểm 10 thực tế / tổng số thí sinh.
  const topScore = pts[pts.length - 1][1]
  const d10Share = (info.d10 / info.totalStudents) * 100
  if (score >= 10) return Math.max(100 - d10Share / 2, 99) // đứng giữa nhóm thí sinh đạt điểm 10
  const ratio = (score - topScore) / (10 - topScore)
  return 100 - (1 - ratio) * d10Share - (1 - ratio) // xấp xỉ tăng dần về phía 100
}

function scoreForPercentile(p: number, info: SubjectInfo): number {
  const pts = info.percentiles
  if (p <= pts[0][0]) return pts[0][1]
  if (p >= pts[pts.length - 1][0]) return pts[pts.length - 1][1]
  for (let i = 0; i < pts.length - 1; i++) {
    const [p1, s1] = pts[i]
    const [p2, s2] = pts[i + 1]
    if (p >= p1 && p <= p2) {
      if (p2 === p1) return s2
      const ratio = (p - p1) / (p2 - p1)
      return s1 + ratio * (s2 - s1)
    }
  }
  return pts[pts.length - 1][1]
}

export default function SoSanhPhoDiemPage() {
  const router = useRouter()

  const [userName, setUserName] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(false)
  const [activeYear, setActiveYear] = useState<'2025' | '2026'>('2025')
  const [selectedSubject, setSelectedSubject] = useState<string>('Toán')
  const [userScore, setUserScore] = useState<string>('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('full_name').eq('id', user.id).single().then(({ data }) => {
          if (data) setUserName(data.full_name)
        })
      }
    })

    if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') {
      setIsDark(true); document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleTheme = () => {
    if (isDark) { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); setIsDark(false) }
    else { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); setIsDark(true) }
  }

  const currentData = SUBJECTS_DATA[selectedSubject]

  // Các điểm dùng để vẽ đường cong bách phân vị (đã nội suy mượt giữa các mốc chính thức
  // 0,1..25,50,76..100 -> lấp đầy 0..100 để biểu đồ liền mạch).
  const curvePoints = useMemo(() => {
    const pts: { p: number; score: number }[] = []
    for (let p = 0; p <= 100; p++) {
      pts.push({ p, score: scoreForPercentile(p, currentData) })
    }
    return pts
  }, [currentData])

  const userPercentileInfo = useMemo(() => {
    if (!userScore) return null
    const val = parseFloat(userScore.replace(',', '.'))
    if (isNaN(val) || val < 0 || val > 10) return null

    const percentile = percentileForScore(val, currentData)
    const clamped = Math.min(100, Math.max(0, percentile))
    const studentsBelowApprox = Math.round((clamped / 100) * currentData.totalStudents)

    return {
      percentile: clamped.toFixed(2),
      studentsBelowApprox,
    }
  }, [userScore, currentData])

  // Tọa độ SVG cho biểu đồ đường cong (viewBox 0 0 1000 400, lề trong để vẽ trục)
  const chartW = 1000, chartH = 360, padL = 50, padB = 30, padT = 10, padR = 10
  const xScale = (p: number) => padL + (p / 100) * (chartW - padL - padR)
  const yScale = (s: number) => padT + (1 - s / 10) * (chartH - padT - padB)

  const linePath = useMemo(() => {
    return curvePoints.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${xScale(pt.p).toFixed(1)} ${yScale(pt.score).toFixed(1)}`).join(' ')
  }, [curvePoints])

  const areaPath = useMemo(() => {
    const base = `M ${xScale(0)} ${yScale(0)} `
    const line = curvePoints.map(pt => `L ${xScale(pt.p).toFixed(1)} ${yScale(pt.score).toFixed(1)}`).join(' ')
    const close = ` L ${xScale(100)} ${yScale(0)} Z`
    return base + line + close
  }, [curvePoints])

  const userPoint = userPercentileInfo ? {
    p: parseFloat(userPercentileInfo.percentile),
    score: parseFloat(userScore.replace(',', '.')),
  } : null

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 font-sans relative overflow-x-hidden pb-20 transition-colors duration-500">

      {/* 🌟 NỀN AMBIENT LIQUID GLASS MỜ ẢO */}
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/10 to-blue-500/10 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="fixed top-[40%] right-[-10%] w-[500px] h-[500px] bg-gradient-to-tr from-purple-500/10 to-pink-500/10 dark:from-purple-900/15 dark:to-pink-900/10 rounded-full blur-[100px] pointer-events-none z-0"></div>

      {/* HEADER BAR */}
      <header className="h-[80px] px-4 sm:px-8 flex items-center justify-between bg-white/80 dark:bg-[#121212]/80 backdrop-blur-2xl backdrop-saturate-[1.5] border-b border-slate-200 dark:border-white/5 sticky top-0 z-40 transition-colors shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-3 bg-slate-100 dark:bg-[#202020] rounded-full hover:scale-105 active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="h-6 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1"></div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">Phổ Điểm <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded-md uppercase animate-pulse shadow-md">Quốc Gia</span></h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Đối soát và Phân tích</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button onClick={toggleTheme} className="p-2.5 bg-slate-100 dark:bg-[#202020] rounded-full hover:bg-slate-200 dark:hover:bg-[#2A2A2A] transition-colors shadow-sm">
            {isDark ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5" />}
          </button>
          <div className="w-10 h-10 ml-2 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-full flex items-center justify-center text-white font-black shadow-md cursor-pointer hover:scale-105 transition-transform">
            {userName ? userName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="max-w-[1400px] mx-auto pt-8 px-4 md:px-8 relative z-10">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl p-4 sm:p-6 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-sm mb-8">
          <div className="min-w-0 pl-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3"><BarChart3 className="text-indigo-500 w-7 h-7" /> Đối soát Phổ Điểm Quốc Gia</h2>
            <p className="text-xs font-bold text-slate-500 mt-1.5">Số liệu trích xuất từ Báo cáo thống kê và phân tích phổ điểm thi tốt nghiệp THPT 2025 — Bộ GD&ĐT, công bố 15/7/2025.</p>
          </div>
          <div className="flex gap-2 bg-slate-100 dark:bg-[#202020] p-1.5 rounded-2xl shrink-0 border border-slate-200 dark:border-white/5 shadow-inner">
            <button onClick={() => setActiveYear('2025')} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${activeYear === '2025' ? 'bg-white dark:bg-[#2A2A2A] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Kỳ thi năm 2025</button>
            <button onClick={() => setActiveYear('2026')} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${activeYear === '2026' ? 'bg-white dark:bg-[#2A2A2A] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Năm 2026 (Mới)</button>
          </div>
        </div>

        {activeYear === '2026' ? (
          <div className={`${mdCard} flex flex-col items-center justify-center py-32 px-6 text-center relative`}>
            <div className="w-20 h-20 bg-slate-100 dark:bg-[#252525] rounded-[2rem] flex items-center justify-center mb-6 shadow-inner border border-slate-200 dark:border-white/5">
              <Lock className="w-10 h-10 text-slate-400 dark:text-slate-500 drop-shadow-md" />
            </div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Dữ liệu 2026 đang được cập nhật</h2>
            <p className="text-slate-500 dark:text-slate-400 font-bold mt-3 max-w-lg leading-relaxed text-sm">Phổ điểm kỳ thi THPT Quốc gia năm 2026 (công bố dự kiến 01/7/2026) sẽ được hệ thống đồng bộ ngay sau khi Bộ GD&ĐT chính thức công bố báo cáo thống kê.</p>
            <button onClick={() => setActiveYear('2025')} className="mt-8 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-black shadow-md hover:shadow-lg transition-all active:scale-95 text-sm uppercase tracking-wider flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Quay lại dữ liệu 2025</button>
          </div>
        ) : (
          <div className="space-y-6">

            <div className="flex flex-wrap gap-2.5">
              {subjectsList.map(sub => (
                <button
                  key={sub} onClick={() => setSelectedSubject(sub)}
                  className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all border shadow-sm ${selectedSubject === sub ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white/70 dark:bg-[#1A1A1A]/70 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:border-indigo-400'}`}
                >
                  {sub}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

              {/* TRÁI */}
              <div className="lg:col-span-4 space-y-6">
                <div className={`${mdCard} p-6 md:p-8 space-y-6`}>
                  <h3 className="font-black text-lg text-indigo-600 dark:text-indigo-400 flex items-center gap-2"><TrendingUp className="w-5 h-5" /> Phân tích bách phân vị</h3>

                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2 pl-1">Nhập điểm thi thực tế (0 - 10)</label>
                    <input
                      type="text" value={userScore}
                      onChange={(e) => { const val = e.target.value; if (val === '' || /^[0-9.,]*$/.test(val)) setUserScore(val) }}
                      placeholder="Ví dụ: 8.5 hoặc 8,5..."
                      className={mdInput + " text-lg text-center tracking-widest py-4 bg-white dark:bg-[#1E1E1E]"}
                    />
                  </div>

                  {userPercentileInfo ? (
                    <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-3xl animate-in zoom-in-95 text-center shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>
                      <p className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-2">Đối chiếu bách phân vị chính thức</p>

                      <p className="text-[3.5rem] font-black text-rose-500 drop-shadow-sm my-1 leading-none">
                        Top {(100 - parseFloat(userPercentileInfo.percentile)).toFixed(2).replace('.', ',')}<span className="text-2xl text-rose-400">%</span>
                      </p>

                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed mt-3 relative z-10">
                        Với mức điểm <strong className="text-indigo-600 dark:text-indigo-400 mx-1">{userScore}</strong>, ước tính bạn vượt qua khoảng <strong className="text-indigo-600 dark:text-indigo-400">{userPercentileInfo.percentile.replace('.', ',')}%</strong> (~<strong className="text-rose-500">{userPercentileInfo.studentsBelowApprox.toLocaleString('vi-VN')}</strong> thí sinh) trong tổng số <strong>{currentData.totalStudents.toLocaleString('vi-VN')}</strong> thí sinh dự thi môn <strong className="text-indigo-600 dark:text-indigo-400">{selectedSubject}</strong>.
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 mt-2 italic">* Nội suy tuyến tính trên bảng bách phân vị chính thức của Bộ GD&ĐT (mốc 1-25, 50, 76-100).</p>
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/5 rounded-3xl flex items-start gap-4 shadow-sm">
                      <div className="w-12 h-12 bg-white dark:bg-[#252525] rounded-xl flex items-center justify-center shrink-0 shadow-inner"><Calculator className="w-6 h-6 text-slate-400" /></div>
                      <p className="text-xs font-bold text-slate-500 leading-relaxed mt-1">Nhập điểm thi thực tế hoặc điểm thi thử của bạn vào ô trên để hệ thống đối chiếu thứ hạng bách phân vị toàn quốc theo số liệu chính thức của Bộ GD&ĐT.</p>
                    </div>
                  )}
                </div>

                <div className={`${mdCard} p-6 md:p-8`}>
                  <h3 className="font-black text-base text-slate-800 dark:text-white flex items-center gap-2 mb-5"><Info className="w-5 h-5 text-indigo-500" /> Tổng quan môn {selectedSubject}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-[#1A1A1A] border border-slate-100 dark:border-white/5 rounded-2xl text-center shadow-sm">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Điểm TB</p>
                      <p className="text-2xl font-black text-slate-800 dark:text-white mt-1.5">{currentData.mean.toString().replace('.', ',')}</p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-[#1A1A1A] border border-slate-100 dark:border-white/5 rounded-2xl text-center shadow-sm">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Trung vị</p>
                      <p className="text-2xl font-black text-slate-800 dark:text-white mt-1.5">{currentData.median.toString().replace('.', ',')}</p>
                    </div>
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl text-center shadow-sm">
                      <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Điểm 10</p>
                      <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">{currentData.d10.toLocaleString('vi-VN')}</p>
                    </div>
                    <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 rounded-2xl text-center shadow-sm">
                      <p className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Điểm Liệt (≤1,0)</p>
                      <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1.5">{currentData.liet.toLocaleString('vi-VN')}</p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-[#1A1A1A] border border-slate-100 dark:border-white/5 rounded-2xl text-center shadow-sm col-span-2">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tổng số thí sinh dự thi</p>
                      <p className="text-2xl font-black text-slate-800 dark:text-white mt-1.5">{currentData.totalStudents.toLocaleString('vi-VN')}</p>
                    </div>
                  </div>

                  {currentData.note && (
                    <div className="mt-5 p-5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl text-xs font-bold text-amber-700 dark:text-amber-500 flex items-start gap-3 leading-relaxed shadow-sm">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" /> <span>{currentData.note}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* PHẢI: BIỂU ĐỒ ĐƯỜNG CONG BÁCH PHÂN VỊ (DỮ LIỆU GỐC TỪ BỘ GD&ĐT) */}
              <div className="lg:col-span-8 space-y-6">
                <div className={`${mdCard} p-6 md:p-8 min-h-[500px] flex flex-col justify-between`}>
                  <div className="mb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                      <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2"><BarChart3 className="w-5 h-5 text-indigo-500" /> Đường cong bách phân vị môn {selectedSubject}</h3>
                      <p className="text-xs font-bold text-slate-500 mt-1.5">Trục ngang: bách phân vị (0-100%) · Trục dọc: điểm số tương ứng (0-10). Vẽ trực tiếp từ bảng bách phân vị chính thức của Bộ GD&ĐT.</p>
                    </div>
                  </div>

                  <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-[350px] mt-2">
                    {/* lưới ngang */}
                    {[0, 2.5, 5, 7.5, 10].map(s => (
                      <g key={s}>
                        <line x1={padL} x2={chartW - padR} y1={yScale(s)} y2={yScale(s)} className="stroke-slate-200 dark:stroke-slate-800" strokeWidth={1} />
                        <text x={padL - 10} y={yScale(s) + 4} textAnchor="end" className="fill-slate-400 text-[11px] font-black">{s.toString().replace('.', ',')}</text>
                      </g>
                    ))}
                    {/* trục dọc mốc % */}
                    {[0, 25, 50, 75, 100].map(p => (
                      <g key={p}>
                        <line x1={xScale(p)} x2={xScale(p)} y1={padT} y2={chartH - padB} className="stroke-slate-100 dark:stroke-slate-900" strokeWidth={1} />
                        <text x={xScale(p)} y={chartH - padB + 18} textAnchor="middle" className="fill-slate-400 text-[11px] font-black">{p}%</text>
                      </g>
                    ))}

                    <defs>
                      <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(99,102,241)" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="rgb(99,102,241)" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>

                    <path d={areaPath} fill="url(#areaFill)" />
                    <path d={linePath} fill="none" stroke="rgb(79,70,229)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

                    {/* mốc trung vị */}
                    <circle cx={xScale(50)} cy={yScale(currentData.median)} r={4} className="fill-indigo-600" />
                    <text x={xScale(50)} y={yScale(currentData.median) - 12} textAnchor="middle" className="fill-indigo-600 dark:fill-indigo-400 text-[11px] font-black">Trung vị {currentData.median.toString().replace('.', ',')}</text>

                    {/* điểm người dùng */}
                    {userPoint && userPoint.score >= 0 && (
                      <g>
                        <line x1={xScale(userPoint.p)} x2={xScale(userPoint.p)} y1={padT} y2={chartH - padB} stroke="rgb(244,63,94)" strokeDasharray="4 4" strokeWidth={1.5} />
                        <circle cx={xScale(userPoint.p)} cy={yScale(userPoint.score)} r={6} className="fill-rose-500" stroke="white" strokeWidth={2} />
                        <text x={xScale(userPoint.p)} y={yScale(userPoint.score) - 14} textAnchor="middle" className="fill-rose-500 text-[11px] font-black">Bạn: {userScore}đ</text>
                      </g>
                    )}
                  </svg>
                </div>

                <div className={`${mdCard} p-6 md:p-8 border-l-4 border-amber-500 bg-gradient-to-r from-amber-50/50 to-transparent dark:from-amber-900/10`}>
                  <h3 className="font-black text-base text-amber-600 dark:text-amber-500 flex items-center gap-2"><Bot className="w-5 h-5" /> So sánh phổ điểm 2026</h3>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed max-w-3xl">Tính năng so sánh độ khó tương đương giữa 2 năm (2025 vs 2026) sẽ được kích hoạt ngay khi Bộ GD&ĐT công bố báo cáo thống kê và bảng bách phân vị chính thức của kỳ thi 2026 (dự kiến đầu tháng 7/2026).</p>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}