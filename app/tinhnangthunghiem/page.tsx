'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  ArrowLeft, BarChart3, Calculator, TrendingUp, Info, 
  AlertCircle, Bot, Lock, User, Moon, Sun, Sparkles, CheckCircle2, Award
} from 'lucide-react'

// --- MATERIAL 3 & LIQUID GLASS CONSTANTS ---
const mdCard = "bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl backdrop-saturate-[1.5] rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.15)] hover:shadow-xl hover:-translate-y-1 transition-all duration-500 ease-out relative overflow-hidden"
const mdInput = "w-full bg-slate-100 dark:bg-[#202020] border-transparent focus:bg-white dark:focus:bg-[#2A2A2A] border-2 focus:border-indigo-500 rounded-2xl px-5 py-4 outline-none transition-all font-bold text-slate-900 dark:text-white text-sm shadow-inner"
const labelClass = "block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 pl-1"

// ============================================================================
// CƠ SỞ DỮ LIỆU PHỔ ĐIỂM QUỐC GIA NĂM 2025 (TRÍCH XUẤT CHÍNH THỨC 100%)
// ============================================================================
const SUBJECTS_DATA: Record<string, any> = {
  'Toán': { 
    mean: 4.78, d10: 513, liet: 6, stdDev: 1.68, bins: 20, step: 0.5,
    note: 'Đề thi Toán đổi mới cấu trúc làm giảm mạnh số điểm giỏi, tuy nhiên vẫn có 513 điểm tuyệt đối.',
    data: [24, 753, 7190, 26579, 54712, 83262, 110318, 129311, 138122, 130439, 114375, 91129, 71379, 54668, 42149, 31404, 22328, 14693, 2784, 553]
  },
  'Ngữ Văn': { 
    mean: 7.0, d10: 0, liet: 7, stdDev: 1.28, bins: 40, step: 0.25,
    note: 'Không có điểm 10 nào trên toàn quốc. Đỉnh phổ điểm tập trung ở mức 7,0 - 7,5.',
    data: [17, 26, 25, 19, 233, 295, 392, 745, 948, 1504, 1920, 3102, 3507, 5170, 6215, 9280, 10034, 13675, 13089, 27570, 25191, 34178, 39017, 53712, 56248, 72128, 76859, 95180, 89380, 99168, 86942, 89262, 66330, 59398, 41961, 27955, 11726, 3974, 301, 0]
  },
  'Vật Lí': { 
    mean: 6.99, d10: 3929, liet: 1, stdDev: 1.52, bins: 40, step: 0.25,
    note: 'Môn học bùng nổ điểm 10 nhất trong tổ hợp KHTN với gần 4.000 bài thi tuyệt đối.',
    data: [1, 0, 1, 2, 4, 15, 42, 78, 156, 314, 580, 1005, 1575, 2383, 3642, 5052, 6689, 8530, 10503, 12613, 14560, 15998, 17355, 18200, 19051, 19659, 20193, 20289, 20830, 19960, 19178, 17874, 16475, 14603, 12833, 10683, 9037, 3708, 0, 3929]
  },
  'Hóa Học': { 
    mean: 6.06, d10: 625, liet: 0, stdDev: 1.81, bins: 40, step: 0.25,
    data: [0, 0, 1, 7, 24, 190, 391, 838, 1435, 2321, 3232, 4668, 5790, 7211, 8504, 9779, 10744, 11302, 12102, 12267, 12130, 12206, 11621, 11248, 10393, 10065, 9540, 8840, 8678, 8114, 7862, 7326, 7099, 6293, 5694, 5058, 3769, 2694, 0, 625]
  },
  'Sinh Học': { 
    mean: 5.78, d10: 82, liet: 0, stdDev: 1.58, bins: 40, step: 0.25,
    data: [0, 0, 1, 7, 16, 38, 85, 201, 351, 584, 838, 1267, 1668, 2247, 2669, 3216, 3509, 3899, 3984, 4164, 4056, 4060, 3911, 3755, 3655, 3316, 3034, 2841, 2497, 2205, 1914, 1608, 1425, 1083, 782, 481, 327, 119, 0, 82]
  },
  'Lịch Sử': { 
    mean: 6.52, d10: 1518, liet: 2, stdDev: 1.63, bins: 40, step: 0.25,
    data: [4, 1, 3, 5, 9, 41, 121, 245, 532, 1077, 1771, 2935, 4421, 6163, 8413, 10541, 12842, 15209, 17239, 18978, 20507, 21848, 22618, 24468, 24696, 25498, 25951, 26016, 26327, 25550, 24741, 23323, 21341, 18743, 15834, 12516, 9117, 6306, 3825, 1518]
  },
  'Địa Lí': { 
    mean: 6.63, d10: 6907, liet: 3, stdDev: 1.75, bins: 40, step: 0.25,
    note: 'Môn học sở hữu số lượng điểm 10 lớn nhất hệ thống.',
    data: [5, 1, 4, 9, 23, 69, 176, 379, 727, 1311, 2160, 3321, 4706, 6384, 8130, 10313, 11943, 14302, 16067, 17708, 19528, 20584, 21686, 22579, 23516, 24006, 24199, 24142, 23583, 22900, 21979, 20800, 19537, 18340, 17227, 15671, 13482, 11090, 6178, 6907]
  },
  'Tiếng Anh': { 
    mean: 5.38, d10: 141, liet: 2, stdDev: 1.45, bins: 40, step: 0.25,
    note: 'Điểm trung bình và trung vị khá thấp so với các môn khối Khoa học Tự nhiên.',
    data: [2, 3, 7, 16, 52, 209, 455, 899, 1783, 2955, 4656, 6752, 9131, 11708, 14608, 17146, 19576, 21662, 23058, 24071, 24463, 23842, 22577, 20796, 18615, 16067, 13688, 11358, 9406, 7527, 6010, 4741, 3842, 3092, 2520, 1935, 1384, 833, 462, 141]
  },
  'GDKT&PL': { 
    mean: 7.69, d10: 1451, liet: 0, stdDev: 1.18, bins: 40, step: 0.25,
    note: 'Môn thi ghi nhận mức điểm trung bình rất cao (7,69), phản ánh mức độ phân hóa vừa sức.',
    data: [0, 0, 0, 0, 1, 2, 7, 10, 24, 54, 85, 128, 216, 329, 440, 651, 861, 1204, 1599, 2134, 2735, 3603, 4546, 5748, 7342, 9337, 11472, 13954, 16680, 19579, 21750, 23153, 23203, 21599, 18623, 14373, 10255, 6208, 3037, 1451]
  },
  'Tin Học': { 
    mean: 6.78, d10: 60, liet: 0, stdDev: 1.48, bins: 40, step: 0.25,
    data: [0, 0, 0, 1, 1, 2, 3, 6, 7, 12, 29, 45, 50, 99, 138, 146, 211, 251, 295, 368, 393, 404, 461, 441, 499, 504, 476, 429, 396, 413, 356, 274, 245, 206, 178, 110, 94, 0, 0, 60]
  },
  'CN Công nghiệp': { 
    mean: 5.79, d10: 4, liet: 0, stdDev: 1.54, bins: 40, step: 0.25,
    data: [0, 0, 0, 0, 0, 0, 0, 3, 4, 12, 35, 55, 63, 121, 140, 139, 149, 129, 133, 144, 121, 119, 121, 109, 91, 102, 92, 86, 60, 66, 42, 51, 36, 25, 18, 15, 5, 0, 0, 4]
  }
}

const subjectsList = Object.keys(SUBJECTS_DATA)

export default function SapNhapTinhNangPage() {
  const router = useRouter()
  
  // --- GLOBAL STATES ---
  const [userName, setUserName] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(false)
  const [activeTab, setActiveTab] = useState<'tinhdiem' | 'phodiem'>('tinhdiem')
  
  // --- STATES TÍNH ĐIỂM XÉT TUYỂN ---
  const [calcMode, setCalcMode] = useState<'standard' | 'hust'>('standard')
  const [calcScores, setCalcScores] = useState({ sub1: '', sub2: '', sub3: '' })
  const [calcMainSubject, setCalcMainSubject] = useState<'sub1' | 'sub2' | 'sub3'>('sub1')
  const [calcPriorityScore, setCalcPriorityScore] = useState('')
  const [calcResult, setCalcResult] = useState<{ rawScore: number; finalPriority: number; totalScore: number; } | null>(null)

  // --- STATES PHỔ ĐIỂM QUỐC GIA ---
  const [activeYear, setActiveYear] = useState<'2025' | '2026'>('2025')
  const [selectedSubject, setSelectedSubject] = useState<string>('Toán')
  const [userScore, setUserScore] = useState<string>('')

  // Khởi chạy đồng bộ hệ thống tự do (Không khóa RLS đăng nhập)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if(user) {
        supabase.from('profiles').select('full_name').eq('id', user.id).single().then(({data}) => {
          if(data) setUserName(data.full_name)
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

  // ============================================================================
  // LOGIC TUYẾN TÍNH TÍNH ĐIỂM XÉT TUYỂN ĐH CHUẨN BỘ GD&ĐT
  // ============================================================================
  useEffect(() => {
    const s1 = parseFloat(calcScores.sub1.replace(',', '.'))
    const s2 = parseFloat(calcScores.sub2.replace(',', '.'))
    const s3 = parseFloat(calcScores.sub3.replace(',', '.'))
    const baseP = parseFloat(calcPriorityScore.replace(',', '.')) || 0

    if (isNaN(s1) || isNaN(s2) || isNaN(s3) || s1 > 10 || s2 > 10 || s3 > 10 || s1 < 0 || s2 < 0 || s3 < 0) {
      setCalcResult(null); return
    }

    let rawScore = 0
    if (calcMode === 'standard') {
      rawScore = s1 + s2 + s3
    } else if (calcMode === 'hust') {
      const mainS = calcMainSubject === 'sub1' ? s1 : calcMainSubject === 'sub2' ? s2 : s3
      const otherSum = (s1 + s2 + s3) - mainS
      rawScore = ((mainS * 2 + otherSum) * 3) / 4
    }

    // Áp dụng thuật toán giảm trừ giảm dần đều điểm ưu tiên khi tổng điểm trần >= 22,5
    let actualPriority = baseP
    if (rawScore >= 22.5) {
      actualPriority = ((30 - rawScore) / 7.5) * baseP
    }

    setCalcResult({
      rawScore: Math.round(rawScore * 100) / 100,
      finalPriority: Math.max(0, Math.round(actualPriority * 100) / 100),
      totalScore: Math.round((rawScore + actualPriority) * 100) / 100
    })
  }, [calcScores, calcMode, calcMainSubject, calcPriorityScore])

  // ============================================================================
  // LOGIC PHÂN TÍCH VỊ THẾ BÁCH PHÂN VỊ PHỔ ĐIỂM CHÍNH XÁC
  // ============================================================================
  const currentData = SUBJECTS_DATA[selectedSubject]
  const chartData = currentData.data as number[]
  const maxChartVal = Math.max(...chartData, 1)

  const userPercentileInfo = useMemo(() => {
    if (!userScore) return null
    const val = parseFloat(userScore.replace(',', '.'))
    if (isNaN(val) || val < 0 || val > 10) return null

    let userBinIndex = Math.ceil(val / currentData.step) - 1
    if (val === 0) userBinIndex = 0
    userBinIndex = Math.max(0, Math.min(currentData.bins - 1, userBinIndex))

    const totalStudents = chartData.reduce((a, b) => a + b, 0)
    const studentsBelow = chartData.slice(0, userBinIndex).reduce((a, b) => a + b, 0)
    const studentsAt = chartData[userBinIndex] || 0

    // Công thức tính bách phân vị nội suy (Percentile Rank) chuẩn hóa quốc gia
    const exactPercentile = ((studentsBelow + (0.5 * studentsAt)) / totalStudents) * 100
    return { percentile: exactPercentile.toFixed(2), binIndex: userBinIndex, totalStudents, studentsBelow }
  }, [userScore, chartData, currentData])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 font-sans relative overflow-x-hidden pb-20 transition-colors duration-500">
      
      {/* NỀN AMBIENT LIQUID GLASS MỜ ẢO */}
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/10 to-blue-500/10 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="fixed top-[40%] right-[-10%] w-[500px] h-[500px] bg-gradient-to-tr from-purple-500/10 to-pink-500/10 dark:from-purple-900/15 dark:to-pink-900/10 rounded-full blur-[100px] pointer-events-none z-0"></div>

      {/* HEADER BAR CHUẨN MATERIAL 3 */}
      <header className="h-[80px] px-4 sm:px-8 flex items-center justify-between bg-white/80 dark:bg-[#121212]/80 backdrop-blur-2xl backdrop-saturate-[1.5] border-b border-slate-200 dark:border-white/5 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-3 bg-slate-100 dark:bg-[#202020] rounded-full hover:scale-105 active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5"/>
          </button>
          <div className="h-6 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1"></div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">SenKhảoThí <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm">Tổng Hợp</span></h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Sáp nhập thử nghiệm 3.0</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button onClick={toggleTheme} className="p-2.5 bg-slate-100 dark:bg-[#202020] rounded-full hover:bg-slate-200 dark:hover:bg-[#2A2A2A] transition-colors shadow-sm">
            {isDark ? <Sun className="w-5 h-5 text-amber-500"/> : <Moon className="w-5 h-5"/>}
          </button>
          <div className="w-10 h-10 ml-2 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-full flex items-center justify-center text-white font-black shadow-md">
            {userName ? userName.charAt(0).toUpperCase() : <User className="w-4 h-4"/>}
          </div>
        </div>
      </header>

      {/* WORKSPACE CHÍNH */}
      <div className="max-w-[1400px] mx-auto pt-8 px-4 md:px-8 relative z-10">
        
        {/* TAB SWITCHER CHUẨN TRẠM KHẢO THÍ */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl p-4 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm mb-8">
          <div className="min-w-0 pl-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              {activeTab === 'tinhdiem' ? <Calculator className="text-indigo-500"/> : <BarChart3 className="text-indigo-500"/>}
              {activeTab === 'tinhdiem' ? 'Hệ Thống Tính Điểm Xét Tuyển ĐH' : 'Cơ Sở Dữ Liệu Phổ Điểm Quốc Gia'}
            </h2>
            <p className="text-xs font-bold text-slate-500 mt-1">Đồng bộ công thức nội nội suy tuyến tính và dữ liệu phân rã từ Bộ Giáo dục và Đào tạo.</p>
          </div>
          <div className="flex gap-2 bg-slate-100 dark:bg-[#202020] p-1.5 rounded-2xl shrink-0 border border-slate-200 dark:border-white/5 shadow-inner">
            <button onClick={() => setActiveTab('tinhdiem')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'tinhdiem' ? 'bg-white dark:bg-[#2A2A2A] text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}>Tính điểm ĐH</button>
            <button onClick={() => setActiveTab('phodiem')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'phodiem' ? 'bg-white dark:bg-[#2A2A2A] text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}>Tra cứu phổ điểm</button>
          </div>
        </div>

        {/* ============================================================================ */}
        {/* 🌟 PHÂN KHU 1: HỆ THỐNG TÍNH ĐIỂM ĐẠI HỌC CHUẨN XÁC NỘI SUY */}
        {/* ============================================================================ */}
        {activeTab === 'tinhdiem' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-300">
            
            {/* CỘT TRÁI: Ô NHẬP ĐIỂM THÀNH PHẦN */}
            <div className="lg:col-span-7 space-y-6">
              <div className={`${mdCard} p-6 md:p-8 space-y-6`}>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
                  <h3 className="font-black text-base uppercase tracking-wider text-indigo-600 dark:text-indigo-400">1. Nhập thông số tổ hợp xét tuyển</h3>
                  <select value={calcMode} onChange={e => setCalcMode(e.target.value as any)} className="bg-slate-100 dark:bg-[#202020] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2 text-xs font-black text-slate-700 dark:text-white outline-none">
                    <option value="standard">Phương thức Tiêu chuẩn (Thang 30)</option>
                    <option value="hust">Phương thức Bách Khoa (Nhân đôi môn chính)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Môn thứ nhất</label>
                    <input type="text" value={calcScores.sub1} onChange={e => { if(e.target.value===''||/^[0-9.,]*$/.test(e.target.value)) setCalcScores({...calcScores, sub1: e.target.value}) }} placeholder="Điểm môn 1..." className={mdInput} />
                    {calcMode === 'hust' && <button type="button" onClick={()=>setCalcMainSubject('sub1')} className={`w-full mt-2 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border ${calcMainSubject==='sub1'?'bg-rose-500 text-white border-rose-500':'bg-slate-50 dark:bg-[#1E1E1E] text-slate-400 border-slate-200'}`}>Môn chính</button>}
                  </div>
                  <div>
                    <label className={labelClass}>Môn thứ hai</label>
                    <input type="text" value={calcScores.sub2} onChange={e => { const val = e.target.value; if (val === '' || /^[0-9.,]*$/.test(val)) setCalcScores({...calcScores, sub2: val}) }} placeholder="Điểm môn 2..." className={mdInput} />
                    {calcMode === 'hust' && <button type="button" onClick={() => setCalcMainSubject('sub2')} className={`w-full mt-2 py-3 rounded-xl text-xs font-black border ${calcMainSubject === 'sub2' ? 'bg-indigo-600 text-white' : 'bg-slate-50 dark:bg-[#202020] text-slate-500 border-slate-200'}`}>Môn chính</button>}
                  </div>
                  <div>
                    <label className={labelClass}>Môn thứ ba</label>
                    <input type="text" value={calcScores.sub3} onChange={e => { const val = e.target.value; if (val === '' || /^[0-9.,]*$/.test(val)) setCalcScores({...calcScores, sub3: val}) }} placeholder="Điểm môn 3..." className={mdInput} />
                    {calcMode === 'hust' && <button type="button" onClick={() => setCalcMainSubject('sub3')} className={`w-full mt-2 py-3 rounded-xl text-xs font-black border ${calcMainSubject === 'sub3' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>Môn chính</button>}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Điểm ưu tiên khu vực / đối tượng (Nếu không có điền 0)</label>
                  <input type="text" value={calcPriorityScore} onChange={e => { const val = e.target.value; if (val === '' || /^[0-9.,]*$/.test(val)) setCalcPriorityScore(val) }} placeholder="Ví dụ: 0.25 hoặc 0,5..." className={mdInput} />
                </div>
              </div>
            </div>

            {/* PHẢI: KẾT QUẢ NỘI SUY ĐIỂM CHUẨN CỦA BỘ (8 COLUMNS) */}
            <div className="lg:col-span-5 space-y-6">
              <div className={`${mdCard} p-6 md:p-8 space-y-5 text-center min-h-[350px] flex flex-col justify-center`}>
                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-indigo-100"><Award className="w-7 h-7"/></div>
                <div>
                  <h3 className="font-black text-lg">Bảng điểm quy đổi xét tuyển</h3>
                  <p className="text-xs font-bold text-slate-400 mt-1">Áp dụng điều khoản quy chế Bộ GD&ĐT</p>
                </div>

                {calcResult ? (
                  <div className="space-y-4 animate-in zoom-in-95">
                    <div className="p-4 bg-slate-50 dark:bg-[#1A1A1A] border rounded-2xl grid grid-cols-2 gap-2 text-xs font-bold">
                      <div className="border-r border-slate-200 pr-2"><p className="text-slate-400 uppercase text-[10px]">Điểm trần 3 môn</p><p className="text-xl font-black text-slate-800 dark:text-white mt-1">{calcResult.rawScore.toString().replace('.', ',')}</p></div>
                      <div><p className="text-slate-400 uppercase text-[10px]">Điểm ưu tiên thực nhận</p><p className="text-xl font-black text-amber-500 mt-1">{calcResult.finalPriority.toString().replace('.', ',')}</p></div>
                    </div>
                    
                    <div className="p-5 bg-indigo-600 text-white rounded-3xl shadow-md">
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Tổng điểm xét tuyển Đại học</p>
                      <p className="text-5xl font-black mt-2 font-mono">{calcResult.totalScore.toString().replace('.', ',')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 dark:bg-[#1A1A1A] rounded-2xl border border-slate-100 text-xs font-bold text-slate-400 leading-relaxed">
                    Điền đầy đủ và chính xác điểm thi cả 3 môn thành phần để cỗ máy tự động tính toán điểm ưu tiên giảm trừ tuyến tính chuẩn Bộ GD&ĐT.
                  </div>
                )}
              </div>

              {/* Mẹo tính điểm giảm trừ tuyến tính */}
              <div className="bg-amber-50/60 border border-amber-200 p-5 rounded-3xl flex gap-3 text-xs font-bold text-amber-800 leading-relaxed">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <strong className="block uppercase tracking-wider text-amber-700 mb-1">Quy chế cộng điểm ưu tiên Bộ GD&ĐT:</strong>
                  Thí sinh đạt tổng điểm trần từ $22,5$ trở lên (khi quy đổi về thang điểm $30$) thì điểm ưu tiên được giảm trừ tuyến tính theo công thức độc quyền: 
                  <div className="bg-white/80 p-2 rounded-xl border border-amber-300 font-mono text-center my-2 text-slate-900">
                    Điểm UT = ((30 - Tổng điểm trần) . 7,5) . Điểm UT gốc
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ============================================================================ */}
        {/* 🌟 PHÂN KHU 2: CƠ SỞ DỮ LIỆU PHỔ ĐIỂM QUỐC GIA CHUẨN XÁC ĐỐI SOÁT CHÂN THỰC */}
        {/* ============================================================================ */}
        {activeTab === 'phodiem' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Thanh chọn môn học */}
            <div className="flex flex-wrap gap-2">
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
              
              {/* TRÁI: NHẬP ĐIỂM CHẤM BÁCH PHÂN VỊ (4 COLUMNS) */}
              <div className="lg:col-span-4 space-y-6">
                <div className={`${mdCard} p-6 md:p-8 space-y-6`}>
                  <h3 className="font-black text-lg text-indigo-600 dark:text-indigo-400 flex items-center gap-2"><TrendingUp className="w-5 h-5"/> Phân tích bách phân vị</h3>
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2 pl-1">Nhập điểm thi đối soát (0 - 10)</label>
                    <input 
                      type="text" value={userScore} 
                      onChange={(e) => { const val = e.target.value; if (val === '' || /^[0-9.,]*$/.test(val)) setUserScore(val) }} 
                      placeholder="Ví dụ: 7.25 hoặc 8,5..." 
                      className={mdInput + " text-lg text-center tracking-widest py-4 bg-white dark:bg-[#1E1E1E]"} 
                    />
                  </div>
                  
                  {userPercentileInfo ? (
                    <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 rounded-3xl animate-in zoom-in-95 text-center shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>
                      <p className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-2">Thống kê Real-time</p>
                      <p className="text-[3.5rem] font-black text-rose-500 drop-shadow-sm my-1 leading-none">Top {(100 - parseFloat(userPercentileInfo.percentile)).toFixed(2).replace('.', ',')}<span className="text-2xl text-rose-400">%</span></p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed mt-3">Với mức điểm <strong className="text-indigo-600 dark:text-indigo-400 mx-1">{userScore}</strong>, thành tích của bạn xuất sắc vượt qua <strong className="text-indigo-600 dark:text-indigo-400">{userPercentileInfo.percentile.replace('.', ',')}%</strong> (tương đương <strong className="text-rose-500">{userPercentileInfo.studentsBelow.toLocaleString('vi-VN')}</strong> thí sinh) toàn quốc ở môn <strong className="text-indigo-600 dark:text-indigo-400">{selectedSubject}</strong>.</p>
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/5 rounded-3xl flex items-start gap-4 shadow-sm">
                      <div className="w-12 h-12 bg-white dark:bg-[#252525] rounded-xl flex items-center justify-center shrink-0 shadow-inner"><Calculator className="w-6 h-6 text-slate-400"/></div>
                      <p className="text-xs font-bold text-slate-500 leading-relaxed mt-1">Nhập điểm thi thực tế hoặc điểm thi thử của bạn vào ô trên để hệ thống phân tích thứ hạng bách phân vị toàn quốc.</p>
                    </div>
                  )}
                </div>

                <div className={`${mdCard} p-6 md:p-8`}>
                  <h3 className="font-black text-base text-slate-800 dark:text-white flex items-center gap-2 mb-5"><Info className="w-5 h-5 text-indigo-500"/> Tổng quan môn {selectedSubject}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-[#1A1A1A] border border-slate-100 dark:border-white/5 rounded-2xl text-center shadow-sm">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Điểm TB</p>
                      <p className="text-2xl font-black text-slate-800 dark:text-white mt-1.5">{currentData.mean.toString().replace('.', ',')}</p>
                    </div>
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl text-center shadow-sm">
                      <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Điểm 10</p>
                      <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">{currentData.d10.toLocaleString('vi-VN')}</p>
                    </div>
                    <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 rounded-2xl text-center shadow-sm col-span-2 sm:col-span-1 lg:col-span-2">
                      <p className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Điểm Liệt ({"<="}1,0)</p>
                      <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1.5">{currentData.liet.toLocaleString('vi-VN')}</p>
                    </div>
                  </div>
                  {currentData.note && (
                    <div className="mt-5 p-5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 rounded-2xl text-xs font-bold text-amber-700 dark:text-amber-500 flex items-start gap-3 shadow-sm">
                      <AlertCircle className="w-5 h-5 shrink-0 text-amber-500"/> <span>{currentData.note}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* PHẢI: BIỂU ĐỒ BẢN FIX CHỐNG LỖI TRẮNG MÀN HÌNH (8 COLUMNS) */}
              <div className="lg:col-span-8 space-y-6">
                <div className={`${mdCard} p-6 md:p-8 min-h-[500px] flex flex-col justify-between`}>
                  <div className="mb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                      <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2"><BarChart3 className="w-5 h-5 text-indigo-500"/> Biểu đồ phân bổ điểm môn {selectedSubject}</h3>
                      <p className="text-xs font-bold text-slate-500 mt-1.5">Mô phỏng đường cong biểu đồ dựa trên cấu trúc dữ liệu gốc 2025.</p>
                    </div>
                    <div className="px-3 py-1.5 bg-slate-100 dark:bg-[#202020] border rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Khoảng chia: {currentData.step.toString().replace('.', ',')}đ
                    </div>
                  </div>

                  {/* 🌟 CHÂN LÝ RENDER BIỂU ĐỒ TRỰC TIẾP LÊN ĐỈNH KHÔNG BAO GIỜ LỖI TRẮNG TRÊN SAFARI */}
                  <div className="w-full h-[350px] mt-6 flex gap-[1px] sm:gap-1 border-b-2 border-l-2 border-slate-200 dark:border-slate-800 pl-1 pb-0">
                    {chartData.map((val, i) => {
                      const rangeStart = (i + 1) * currentData.step
                      const isUserScore = userPercentileInfo && userPercentileInfo.binIndex === i
                      const hPercent = Math.max((val / maxChartVal) * 100, 0.5)
                      
                      return (
                        <div key={i} className="flex-1 h-full flex flex-col justify-end relative group">
                          <div 
                            style={{ height: `${hPercent}%` }}
                            className={`w-full rounded-t-[2px] transition-all duration-700 ease-out ${isUserScore ? 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)] z-10 scale-x-125 origin-bottom' : 'bg-indigo-500 dark:bg-indigo-600 group-hover:bg-indigo-400'}`}
                          ></div>
                          
                          {/* Tooltip ghim đỉnh cột */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black px-3 py-2 rounded-xl shadow-xl z-50 whitespace-nowrap pointer-events-none animate-in zoom-in-95">
                              <span className="text-slate-300 dark:text-slate-500 mb-0.5 border-b border-slate-700 dark:border-slate-200 pb-0.5">Điểm {rangeStart.toFixed(2).replace('.', ',')}</span>
                              <span className="text-xs">{val.toLocaleString('vi-VN')} TS</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  
                  {/* Trục X */}
                  <div className="flex justify-between text-[11px] text-slate-400 font-black mt-4 px-2 uppercase tracking-widest relative">
                    <span>0</span>
                    <span className="absolute left-1/4 -translate-x-1/2">2,5</span>
                    <span className="absolute left-1/2 -translate-x-1/2">5,0</span>
                    <span className="absolute left-[75%] -translate-x-1/2">7,5</span>
                    <span>10</span>
                  </div>
                </div>

                {/* AI MÔ PHỎNG NĂM SẮP TỚI */}
                <div className={`${mdCard} p-6 md:p-8 border-l-4 border-amber-500 bg-gradient-to-r from-amber-50/50 to-transparent dark:from-amber-900/10`}>
                  <h3 className="font-black text-base text-amber-600 dark:text-amber-500 flex items-center gap-2"><Bot className="w-5 h-5"/> Trợ lý AI Phân tích & So sánh phổ điểm</h3>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-2.5 leading-relaxed max-w-3xl">Tính năng phân tích dự đoán chuyên sâu và so sánh độ khó tương đương giữa 2 năm (2025 vs 2026) đang được tạm khóa. Ngay khi có dữ liệu điểm thi chính thức năm 2026, AI sẽ tự động phân tích xem điểm số hiện tại của bạn tương đương với mức điểm chuẩn nào của các trường Đại học năm trước.</p>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  )
}