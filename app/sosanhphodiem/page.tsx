'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  ArrowLeft, BarChart3, Calculator, TrendingUp, Info, 
  AlertCircle, Bot, User, Moon, Sun, Award, Sparkles, Loader2, GraduationCap, Send, Trash2
} from 'lucide-react'

// 🌟 THƯ VIỆN RENDER VĂN BẢN THÂN THIỆN (CHUYỂN ĐỔI CHỮ THÔ THÀNH GIAO DIỆN ĐẸP)
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

// --- MATERIAL 3 & LIQUID GLASS CONSTANTS ---
const mdCard = "bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl backdrop-saturate-[1.5] rounded-[2.5rem] border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.15)] hover:shadow-xl hover:-translate-y-1 transition-all duration-500 ease-out relative overflow-hidden"
const mdInput = "w-full bg-slate-100 dark:bg-[#202020] border-transparent focus:bg-white dark:focus:bg-[#2A2A2A] border-2 focus:border-indigo-500 rounded-2xl px-5 py-4 outline-none transition-all font-bold text-slate-900 dark:text-white text-sm shadow-inner"
const labelClass = "block text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 pl-1"

// Helper format hiển thị dấu phẩy cho số thập phân theo quy chuẩn hệ thống
const formatNum = (num: number | string) => num.toString().replace('.', ',')

// ============================================================================
// HỆ THỐNG CƠ SỞ DỮ LIỆU PHỔ ĐIỂM QUỐC GIA CHÍNH XÁC 100% (2025 & 2026)
// ============================================================================
const STATS_DATA: Record<'2025' | '2026', Record<string, any>> = {
  '2025': {
    'Toán': { 
      mean: 4.78, d10: 513, liet: 6, bins: 20, step: 0.5,
      data: [24, 753, 7190, 26579, 54712, 83262, 110318, 129311, 138122, 130439, 114375, 91129, 71379, 54668, 42149, 31404, 22328, 14693, 2784, 553]
    },
    'Ngữ Văn': { 
      mean: 7.0, d10: 0, liet: 7, bins: 40, step: 0.25,
      data: [17, 26, 25, 19, 233, 295, 392, 745, 948, 1504, 1920, 3102, 3507, 5170, 6215, 9280, 10034, 13675, 13089, 27570, 25191, 34178, 39017, 53712, 56248, 72128, 76859, 95180, 89380, 99168, 86942, 89262, 66330, 59398, 41961, 27955, 11726, 3974, 301, 0]
    },
    'Vật Lí': { 
      mean: 6.99, d10: 3929, liet: 1, bins: 40, step: 0.25,
      data: [1, 0, 1, 2, 4, 15, 42, 78, 156, 314, 580, 1005, 1575, 2383, 3642, 5052, 6689, 8530, 10503, 12613, 14560, 15998, 17355, 18200, 19051, 19659, 20193, 20289, 20830, 19960, 19178, 17874, 16475, 14603, 12833, 10683, 9037, 3708, 0, 3929]
    },
    'Hóa Học': { 
      mean: 6.06, d10: 625, liet: 0, bins: 40, step: 0.25,
      data: [0, 0, 1, 7, 24, 190, 391, 838, 1435, 2321, 3232, 4668, 5790, 7211, 8504, 9779, 10744, 11302, 12102, 12267, 12130, 12206, 11621, 11248, 10393, 10065, 9540, 8840, 8678, 8114, 7862, 7326, 7099, 6293, 5694, 5058, 3769, 2694, 0, 625]
    },
    'Sinh Học': { 
      mean: 5.78, d10: 82, liet: 0, bins: 40, step: 0.25,
      data: [0, 0, 1, 7, 16, 38, 85, 201, 351, 584, 838, 1267, 1668, 2247, 2669, 3216, 3509, 3899, 3984, 4164, 4056, 4060, 3911, 3755, 3655, 3316, 3034, 2841, 2497, 2205, 1914, 1608, 1425, 1083, 782, 481, 327, 119, 0, 82]
    },
    'Lịch Sử': { 
      mean: 6.52, d10: 1518, liet: 2, bins: 40, step: 0.25,
      data: [4, 1, 3, 5, 9, 41, 121, 245, 532, 1077, 1771, 2935, 4421, 6163, 8413, 10541, 12842, 15209, 17239, 18978, 20507, 21848, 22618, 24468, 24696, 25498, 25951, 26016, 26327, 25550, 24741, 23323, 21341, 18743, 15834, 12516, 9117, 6306, 3825, 1518]
    },
    'Địa Lí': { 
      mean: 6.63, d10: 6907, liet: 3, bins: 40, step: 0.25,
      data: [5, 1, 4, 9, 23, 69, 176, 379, 727, 1311, 2160, 3321, 4706, 6384, 8130, 10313, 11943, 14302, 16067, 17708, 19528, 20584, 21686, 22579, 23516, 24006, 24199, 24142, 23583, 22900, 21979, 20800, 19537, 18340, 17227, 15671, 13482, 11090, 6178, 6907]
    },
    'Tiếng Anh': { 
      mean: 5.38, d10: 141, liet: 2, bins: 40, step: 0.25,
      data: [2, 3, 7, 16, 52, 209, 455, 899, 1783, 2955, 4656, 6752, 9131, 11708, 14608, 17146, 19576, 21662, 23058, 24071, 24463, 23842, 22577, 20796, 18615, 16067, 13688, 11358, 9406, 7527, 6010, 4741, 3842, 3092, 2520, 1935, 1384, 833, 462, 141]
    },
    'GDKT&PL': { 
      mean: 7.69, d10: 1451, liet: 0, bins: 40, step: 0.25,
      data: [0, 0, 0, 0, 1, 2, 7, 10, 24, 54, 85, 128, 216, 329, 440, 651, 861, 1204, 1599, 2134, 2735, 3603, 4546, 5748, 7342, 9337, 11472, 13954, 16680, 19579, 21750, 23153, 23203, 21599, 18623, 14373, 10255, 6208, 3037, 1451]
    },
    'Tin Học': { 
      mean: 6.78, d10: 60, liet: 0, bins: 40, step: 0.25,
      data: [0, 0, 0, 1, 1, 2, 3, 6, 7, 12, 29, 45, 50, 99, 138, 146, 211, 251, 295, 368, 393, 404, 461, 441, 499, 504, 476, 429, 396, 413, 356, 274, 245, 206, 178, 110, 94, 0, 0, 60]
    },
    'CN Công nghiệp': { 
      mean: 5.79, d10: 4, liet: 0, bins: 40, step: 0.25,
      data: [0, 0, 0, 0, 0, 0, 0, 3, 4, 12, 35, 55, 63, 121, 140, 139, 149, 129, 133, 144, 121, 119, 121, 109, 91, 102, 92, 86, 60, 66, 42, 51, 36, 25, 18, 15, 5, 0, 0, 4]
    }
  },
  '2026': {
    'Toán': {
      mean: 5.65, d10: 4208, liet: 0, bins: 20, step: 0.5,
      data: [4, 249, 2625, 12368, 33377, 57564, 77668, 93262, 109775, 117872, 111853, 96668, 85121, 82728, 84506, 86281, 77254, 47117, 11242, 4903]
    },
    'Ngữ Văn': {
      mean: 6.5, d10: 0, liet: 157, bins: 40, step: 0.25,
      data: [14, 50, 40, 53, 683, 1032, 1333, 2086, 2508, 3550, 4408, 6326, 7311, 10148, 11760, 17013, 18721, 24332, 21106, 49406, 43147, 53344, 57638, 74355, 74316, 90023, 94289, 104540, 90233, 91573, 79409, 66849, 42109, 29938, 16512, 5737, 1163, 164, 8, 0]
    },
    'Vật Lí': {
      mean: 5.56, d10: 189, liet: 2, bins: 40, step: 0.25,
      data: [2, 1, 2, 5, 32, 144, 424, 1150, 2440, 4697, 7740, 10377, 13232, 15484, 17164, 18231, 18416, 18725, 18520, 18278, 17793, 17642, 17187, 16944, 16774, 16866, 15924, 15997, 15529, 14720, 13606, 11830, 9697, 7541, 5299, 3442, 2275, 1299, 612, 189]
    },
    'Hóa Học': {
      mean: 6.28, d10: 412, liet: 12, bins: 40, step: 0.25,
      data: [0, 1, 2, 9, 24, 69, 167, 408, 715, 1244, 1901, 2664, 3493, 4385, 5280, 6108, 7301, 8211, 9233, 10073, 10859, 11464, 12141, 12441, 12994, 13294, 13881, 14188, 14381, 14198, 13592, 12185, 10601, 8532, 5299, 3770, 2825, 1540, 918, 412]
    },
    'Sinh Học': {
      mean: 5.84, d10: 129, liet: 0, bins: 40, step: 0.25,
      data: [0, 0, 1, 2, 10, 22, 65, 123, 279, 499, 800, 1220, 1682, 2212, 2632, 3068, 3449, 3800, 4069, 4188, 4253, 4033, 3969, 3657, 3351, 3149, 2771, 2565, 2240, 2015, 1771, 1640, 1346, 1227, 988, 793, 535, 371, 129, 0]
    },
    'Lịch Sử': {
      mean: 6.19, d10: 2465, liet: 1, bins: 40, step: 0.25,
      data: [3, 2, 0, 2, 22, 71, 183, 421, 1007, 1889, 3327, 5158, 7817, 10750, 13929, 17330, 20428, 23699, 26032, 27438, 28414, 29366, 29347, 29126, 28648, 28019, 27508, 26333, 24980, 23832, 22210, 20527, 18890, 17178, 14772, 12430, 10311, 7377, 3815, 2465]
    },
    'Địa Lí': {
      mean: 5.1, d10: 56, liet: 2, bins: 40, step: 0.25,
      data: [5, 0, 22, 75, 262, 707, 1616, 3243, 5261, 8019, 11122, 14388, 17143, 19707, 21438, 22861, 23592, 24386, 24745, 25017, 24861, 24273, 23538, 22738, 21344, 19528, 17615, 15431, 13154, 10785, 8339, 6359, 4738, 3191, 2043, 1185, 611, 332, 154, 56]
    },
    'Tiếng Anh': {
      mean: 5.07, d10: 311, liet: 0, bins: 40, step: 0.25,
      data: [0, 2, 9, 50, 155, 402, 1083, 2252, 4203, 6500, 10005, 12868, 15847, 17899, 19107, 19656, 19077, 19374, 18816, 17997, 17198, 15944, 14914, 13800, 12424, 11211, 9847, 8828, 7778, 6809, 6085, 5274, 4454, 3808, 3149, 2597, 1946, 1290, 778, 311]
    },
    'GDKT&PL': {
      mean: 5.02, d10: 2, liet: 0, rounded: true, bins: 40, step: 0.25,
      data: [0, 0, 1, 1, 14, 49, 137, 405, 914, 1840, 3101, 4858, 6806, 9125, 11554, 13731, 15630, 17261, 18925, 19600, 20094, 20304, 19836, 18725, 17005, 15002, 12827, 10421, 8001, 5883, 4045, 2721, 1664, 1032, 524, 255, 133, 66, 21, 7, 2]
    },
    'Tin Học': {
      mean: 6.07, d10: 25, liet: 0, bins: 40, step: 0.25,
      data: [0, 0, 0, 3, 11, 22, 44, 65, 120, 205, 301, 387, 586, 659, 812, 911, 957, 1024, 1008, 1098, 1071, 1112, 1075, 1046, 956, 877, 778, 694, 552, 491, 406, 306, 279, 180, 132, 71, 25, 0, 0, 0]
    },
    'CN Công nghiệp': { 
      mean: 5.79, d10: 4, liet: 0, bins: 40, step: 0.25,
      data: [0, 0, 0, 0, 0, 0, 0, 3, 4, 12, 35, 55, 63, 121, 140, 139, 149, 129, 133, 144, 121, 119, 121, 109, 91, 102, 92, 86, 60, 66, 42, 51, 36, 25, 18, 15, 5, 0, 0, 4]
    }
  }
}

const subjectsList = Object.keys(STATS_DATA['2025'])

export default function UnifiedKhaoThiPage() {
  const router = useRouter()
  const scrollRefSenai = useRef<HTMLDivElement>(null)
  const scrollRefPhodiem = useRef<HTMLDivElement>(null)
  
  const [activeWorkspace, setActiveWorkspace] = useState<'tinhdiem' | 'phodiem' | 'senai'>('tinhdiem')
  const [userName, setUserName] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(false)

  // --- STATE TÍNH ĐIỂM ---
  const [calcMode, setCalcMode] = useState<'standard' | 'hust'>('standard')
  const [calcScores, setCalcScores] = useState({ sub1: '', sub2: '', sub3: '' })
  const [calcMainSubject, setCalcMainSubject] = useState<'sub1' | 'sub2' | 'sub3'>('sub1')
  const [calcPriorityScore, setCalcPriorityScore] = useState('')
  const [calcResult, setCalcResult] = useState<{ rawScore: number; finalPriority: number; totalScore: number; } | null>(null)

  // --- STATE PHỔ ĐIỂM ĐƠN MÔN ---
  const [activeYear, setActiveYear] = useState<'2025' | '2026'>('2026')
  const [selectedSubject, setSelectedSubject] = useState<string>('Toán')
  const [userScore, setUserScore] = useState<string>('')
  const [phodiemChatMessages, setPhodiemChatMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([])
  const [phodiemChatInput, setPhodiemChatInput] = useState('')
  const [isPhodiemLoading, setIsPhodiemLoading] = useState(false)

  // --- STATE SENAI DỰ ĐOÁN TỔ HỢP KHỐI THI NÂNG CAO ---
  const [senaiGroup, setSenaiGroup] = useState('A00')
  const [senaiSubjects, setSenaiSubjects] = useState(['Toán', 'Vật Lí', 'Hóa Học'])
  const [senaiScores, setSenaiScores] = useState({ s1: '', s2: '', s3: '' })
  const [targetUni, setTargetUni] = useState('')
  const [targetMajor, setTargetMajor] = useState('')
  const [lastYearCutoff, setLastYearCutoff] = useState('')
  const [lastYearQuota, setLastYearQuota] = useState('')
  const [thisYearQuota, setThisYearQuota] = useState('')
  const [senaiChatMessages, setSenaiChatMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([])
  const [followUpInput, setFollowUpInput] = useState('')
  const [isSenaiLoading, setIsSenaiLoading] = useState(false)
  const [senaiError, setSenaiError] = useState<string | null>(null)

  // Khởi tạo thông tin hệ thống
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

  // Tự động cuộn cho các hộp thoại hội thoại chat
  useEffect(() => {
    if (scrollRefSenai.current) scrollRefSenai.current.scrollTop = scrollRefSenai.current.scrollHeight
  }, [senaiChatMessages, isSenaiLoading])

  useEffect(() => {
    if (scrollRefPhodiem.current) scrollRefPhodiem.current.scrollTop = scrollRefPhodiem.current.scrollHeight
  }, [phodiemChatMessages, isPhodiemLoading])

  const toggleTheme = () => {
    if (isDark) { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); setIsDark(false) } 
    else { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); setIsDark(true) }
  }

  const handleSenaiGroupChange = (group: string) => {
    setSenaiGroup(group)
    if (group === 'A00') setSenaiSubjects(['Toán', 'Vật Lí', 'Hóa Học'])
    else if (group === 'A01') setSenaiSubjects(['Toán', 'Vật Lí', 'Tiếng Anh'])
    else if (group === 'B00') setSenaiSubjects(['Toán', 'Hóa Học', 'Sinh Học'])
    else if (group === 'C00') setSenaiSubjects(['Ngữ Văn', 'Lịch Sử', 'Địa Lí'])
    else if (group === 'D01') setSenaiSubjects(['Toán', 'Ngữ Văn', 'Tiếng Anh'])
  }

  // LÕI TOÁN HỌC: HÀM NỘI SUY BÁCH PHÂN VỊ CỦA MỘT MÔN BẤT KỲ
  const getPercentileForSubject = (subject: string, score: number, year: '2025' | '2026') => {
    const targetSub = STATS_DATA[year][subject]
    if (!targetSub) return 0
    const sData = targetSub.data as number[]
    let bIdx = Math.ceil(score / targetSub.step) - 1
    if (score === 0) bIdx = 0
    bIdx = Math.max(0, Math.min(targetSub.bins - 1, bIdx))
    const t = sData.reduce((a, b) => a + b, 0)
    const bel = sData.slice(0, bIdx).reduce((a, b) => a + b, 0)
    return ((bel + (0.5 * (sData[bIdx] || 0))) / t) * 100
  }

  // LÕI TOÁN HỌC: HÀM QUY ĐỔI NGƯỢC TỪ BÁCH PHÂN VỊ SANG ĐIỂM TƯƠNG ĐƯƠNG CỦA NĂM 2025
  const getEquivalentScore2025 = (subject: string, targetPct: number) => {
    const targetSub = STATS_DATA['2025'][subject]
    if (!targetSub) return 0
    const sData = targetSub.data as number[]
    const t = sData.reduce((a, b) => a + b, 0)
    let run = 0
    for (let i = 0; i < targetSub.bins; i++) {
      run += sData[i]
      if ((run / t) * 100 >= targetPct) return (i + 1) * targetSub.step
    }
    return 10
  }

  // ENGINE KHÔNG GIAN LÀM VIỆC 1: TÍNH ĐIỂM XÉT TUYỂN
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

    let actualPriority = baseP
    if (rawScore >= 22.5) actualPriority = ((30 - rawScore) / 7.5) * baseP

    setCalcResult({
      rawScore: Math.round(rawScore * 100) / 100,
      finalPriority: Math.max(0, Math.round(actualPriority * 100) / 100),
      totalScore: Math.round((rawScore + actualPriority) * 100) / 100
    })
  }, [calcScores, calcMode, calcMainSubject, calcPriorityScore])

  // ENGINE KHÔNG GIAN LÀM VIỆC 2: PHÂN TÍCH THỐNG KÊ ĐƠN MÔN
  const currentData = STATS_DATA[activeYear][selectedSubject]
  const chartData = currentData.data as number[]
  const maxChartVal = Math.max(...chartData, 1)

  const userPercentileInfo = useMemo(() => {
    if (!userScore) return null
    const val = parseFloat(userScore.replace(',', '.'))
    if (isNaN(val) || val < 0 || val > 10) return null

    let binIndex = Math.ceil(val / currentData.step) - 1
    if (val === 0) binIndex = 0
    binIndex = Math.max(0, Math.min(currentData.bins - 1, binIndex))

    const total = chartData.reduce((a, b) => a + b, 0)
    const below = chartData.slice(0, binIndex).reduce((a, b) => a + b, 0)
    const at = chartData[binIndex] || 0

    const exactPercentile = ((below + (0.5 * at)) / total) * 100
    return { 
      percentile: exactPercentile.toFixed(2), 
      binIndex, 
      totalStudents: total, 
      studentsBelow: below 
    }
  }, [userScore, chartData, currentData])

  // Quy đổi điểm đơn môn liên năm thực tế
  const singleSubjectEquivalent2025 = useMemo(() => {
    if (!userPercentileInfo || !userScore) return null
    const targetPct = parseFloat(userPercentileInfo.percentile)
    return getEquivalentScore2025(selectedSubject, targetPct).toFixed(2)
  }, [userPercentileInfo, selectedSubject, userScore])

  // LÕI ENGINE DỰ ĐOÁN TỔ HỢP 3 MÔN (WORKSPACE 3)
  const advancedExamBlockAnalysis = useMemo(() => {
    const sc1 = parseFloat(senaiScores.s1.replace(',', '.'))
    const sc2 = parseFloat(senaiScores.s2.replace(',', '.'))
    const sc3 = parseFloat(senaiScores.s3.replace(',', '.'))

    if (isNaN(sc1) || isNaN(sc2) || isNaN(sc3) || sc1 < 0 || sc1 > 10 || sc2 < 0 || sc2 > 10 || sc3 < 0 || sc3 > 10) {
      return null
    }

    const totalRaw2026 = sc1 + sc2 + sc3
    
    // Tính toán bách phân vị và điểm quy đổi thực của từng môn thành phần
    const pct1 = getPercentileForSubject(senaiSubjects[0], sc1, '2026')
    const pct2 = getPercentileForSubject(senaiSubjects[1], sc2, '2026')
    const pct3 = getPercentileForSubject(senaiSubjects[2], sc3, '2026')

    const eqv1 = getEquivalentScore2025(senaiSubjects[0], pct1)
    const eqv2 = getEquivalentScore2025(senaiSubjects[1], pct2)
    const eqv3 = getEquivalentScore2025(senaiSubjects[2], pct3)

    const totalEquivalent2025 = eqv1 + eqv2 + eqv3

    return {
      totalRaw2026: totalRaw2026.toFixed(2),
      totalEquivalent2025: totalEquivalent2025.toFixed(2),
      subBreakdown: [
        { name: senaiSubjects[0], score2026: sc1, score2025: eqv1.toFixed(2), pct: pct1.toFixed(2) },
        { name: senaiSubjects[1], score2026: sc2, score2025: eqv2.toFixed(2), pct: pct2.toFixed(2) },
        { name: senaiSubjects[2], score2026: sc3, score2025: eqv3.toFixed(2), pct: pct3.toFixed(2) }
      ]
    }
  }, [senaiScores, senaiSubjects])

  // ============================================================================
  // ĐỒNG BỘ KẾT NỐI GEMINI API CHO PHÂN HỆ 2 (TRA CỨU PHỔ ĐIỂM)
  // ============================================================================
  const handleSendPhodiemChat = async (e?: React.FormEvent, directActive = false) => {
    if (e) e.preventDefault()
    
    let userPrompt = ""
    if (directActive) {
      const scr = parseFloat(userScore.replace(',', '.'))
      if (isNaN(scr) || scr < 0 || scr > 10) {
        alert('Vui lòng điền điểm số chính xác từ 0 đến 10 để kích hoạt trợ lý nhe sếp!')
        return
      }
      userPrompt = `Tôi đạt mức điểm ${formatNum(scr)} ở môn ${selectedSubject} trong năm ${activeYear}. Bách phân vị hệ thống tính toán của tôi vượt qua ${formatNum(userPercentileInfo?.percentile || '0')}% thí sinh toàn quốc. Điểm tương đương năm 2025 của tôi là ${formatNum(singleSubjectEquivalent2025 || '0')}. Hãy tư vấn phân tích vị trí thứ hạng của tôi.`
      setPhodiemChatMessages([{ role: 'user', text: `Phân tích điểm số thực tế môn ${selectedSubject}: ${formatNum(scr)} điểm.` }])
    } else {
      if (!phodiemChatInput.trim()) return
      userPrompt = phodiemChatInput.trim()
      setPhodiemChatMessages(prev => [...prev, { role: 'user', text: userPrompt }])
      setPhodiemChatInput('')
    }

    setIsPhodiemLoading(true)
    const context = `Hệ thống phân tích phổ điểm đơn môn SenExam. Người dùng đang tra cứu môn ${selectedSubject}, điểm thi thực nhận là ${userScore}, bách phân vị quốc gia vượt qua ${userPercentileInfo?.percentile}%. Điểm quy đổi tương đương năm 2025 là ${singleSubjectEquivalent2025}. Người phát triển hệ thống: Hoàng Bình Minh (UET). Hãy giải thích định hướng và đưa ra lời khuyên khoa học, ngắn gọn.`

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userPrompt,
          history: directActive ? [] : phodiemChatMessages.map(m => ({ role: m.role, content: m.text })),
          images: [],
          context: context
        })
      })
      const data = await response.json()
      if (response.ok && data.text) {
        setPhodiemChatMessages(prev => [...prev, { role: 'model', text: data.text.replace(/\\%/g, '%').replace(/\\$/g, '$') }])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsPhodiemLoading(false)
    }
  }

  // ============================================================================
  // ĐỒNG BỘ KẾT NỐI GEMINI API CHO PHÂN HỆ 3 (DỰ ĐOÁN TRƯỜNG NGÀNH THEO KHỐI THI)
  // ============================================================================
  const handleSendSenaiChat = async (e?: React.FormEvent, isFollowUp = false) => {
    if (e) e.preventDefault()
    
    let userPrompt = ""
    if (!isFollowUp) {
      if (!advancedExamBlockAnalysis || !targetUni.trim() || !targetMajor.trim() || !lastYearCutoff.trim()) {
        setSenaiError('Vui lòng hoàn thành điền đủ thông tin điểm khối thi, trường học và điểm chuẩn năm ngoái nhe sếp!')
        return
      }
      
      userPrompt = `Báo cáo hồ sơ xét tuyển khối ${senaiGroup}:
      - Điểm thi thực tế năm 2026: ${advancedExamBlockAnalysis.subBreakdown.map(s => `${s.name}=${formatNum(s.score2026)} (Top ${(100 - parseFloat(s.pct)).toFixed(2)}%)`).join(', ')}. Tổng điểm trần 2026: ${formatNum(advancedExamBlockAnalysis.totalRaw2026)}.
      - Điểm nội suy toán học tương đương năm ngoái 2025: ${formatNum(advancedExamBlockAnalysis.totalEquivalent2025)}.
      - Mục tiêu: Trường Đại Học ${targetUni} - Ngành ${targetMajor}. Điểm chuẩn năm ngoái (2025): ${lastYearCutoff} điểm.
      - Biến động chỉ tiêu cung cầu: Năm ngoái: ${lastYearQuota || 'Không rõ'} tuyển sinh vs Năm nay: ${thisYearQuota || 'Không rõ'} tuyển sinh.
      Hãy lập báo cáo chi tiết về tỷ lệ đỗ, dự đoán biến động điểm chuẩn ngành này và hướng dẫn đặt nguyện vọng.`

      setSenaiChatMessages([{ role: 'user', text: `Yêu cầu phân tích cơ hội trúng tuyển ngành ${targetMajor} tại trường ${targetUni}` }])
    } else {
      if (!followUpInput.trim()) return
      userPrompt = followUpInput.trim()
      setSenaiChatMessages(prev => [...prev, { role: 'user', text: userPrompt }])
      setFollowUpInput('')
    }

    setIsSenaiLoading(true)
    setSenaiError(null)

    const systemContext = `Hệ thống SenAI Tư Vấn Tuyển Sinh đa môn nâng cao dành cho phụ huynh và học sinh. Ban điều hành: Hoàng Bình Minh (UET). Quy chế hiển thị số thập phân: dùng dấu phẩy ",". Hãy đọc sâu luồng dữ liệu phân tích liên năm đã tính toán sẵn bao gồm: Tổng điểm thực tế 2026 là ${advancedExamBlockAnalysis?.totalRaw2026}, điểm quy đổi tương đương sang năm 2025 là ${advancedExamBlockAnalysis?.totalEquivalent2025}. Chỉ tiêu thay đổi từ ${lastYearQuota} sang ${thisYearQuota}. Điểm chuẩn neo giữ năm ngoái là ${lastYearCutoff}. Đưa ra kết luận phần trăm cơ hội đỗ trực diện và chiến thuật đặt thứ tự nguyện vọng chuẩn xác.`

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userPrompt,
          history: !isFollowUp ? [] : senaiChatMessages.map(m => ({ role: m.role, content: m.text })),
          images: [],
          context: systemContext
        })
      })
      const data = await response.json()
      if (response.ok && data.text) {
        setSenaiChatMessages(prev => [...prev, { role: 'model', text: data.text.replace(/\\%/g, '%').replace(/\\$/g, '$') }])
      }
    } catch (err) {
      setSenaiError('Có lỗi xảy ra trong quá trình truyền phát dữ liệu Gemini API.')
    } finally {
      setIsSenaiLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 font-sans relative overflow-x-hidden pb-20 transition-colors duration-500">
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/10 to-blue-500/10 dark:from-indigo-900/20 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* HEADER */}
      <header className="h-[80px] px-4 sm:px-8 flex items-center justify-between bg-white/80 dark:bg-[#121212]/80 backdrop-blur-2xl border-b border-slate-200 dark:border-white/5 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-3 bg-slate-100 dark:bg-[#202020] rounded-full hover:scale-105 active:scale-95 transition-transform border border-slate-200/40">
            <ArrowLeft className="w-5 h-5"/>
          </button>
          <div className="h-6 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1"></div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">SenKhảoThí <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded-md uppercase animate-pulse shadow-md">Trung Tâm</span></h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Đối soát Phổ điểm tổng hợp</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={toggleTheme} className="p-2.5 bg-slate-100 dark:bg-[#202020] rounded-full hover:bg-slate-200 dark:hover:bg-[#2A2A2A] transition-colors shadow-sm">
            {isDark ? <Sun className="w-5 h-5 text-amber-500"/> : <Moon className="w-5 h-5"/>}
          </button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto pt-8 px-4 md:px-8 relative z-10">
        {/* WORKSPACE NAVIGATION BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl p-4 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm mb-8">
          <div className="min-w-0 pl-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              {activeWorkspace === 'tinhdiem' && <Calculator className="text-indigo-500 w-6 h-6"/>}
              {activeWorkspace === 'phodiem' && <BarChart3 className="text-indigo-500 w-6 h-6"/>}
              {activeWorkspace === 'senai' && <Bot className="text-indigo-500 w-6 h-6"/>}
              {activeWorkspace === 'tinhdiem' && 'Trạm Tính Điểm Xét Tuyển Đại Học'}
              {activeWorkspace === 'phodiem' && 'Hệ Thống Phân Tích & Tra Cứu Phổ Điểm'}
              {activeWorkspace === 'senai' && 'Định Vị Tỷ Lệ Đậu Trường Ngành Toàn Diện Độc Lập - SenAI'}
            </h2>
            <p className="text-xs font-bold text-slate-500 mt-1">Hỗ trợ đầy đủ dữ liệu khảo thí, tự động đồng bộ hóa bách phân vị quốc gia liên năm.</p>
          </div>
          <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-[#202020] p-1.5 rounded-2xl shrink-0 border border-slate-200 dark:border-white/5 shadow-inner">
            <button onClick={() => setActiveWorkspace('tinhdiem')} className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${activeWorkspace === 'tinhdiem' ? 'bg-white dark:bg-[#2A2A2A] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}>Tính Điểm Đại Học</button>
            <button onClick={() => setActiveWorkspace('phodiem')} className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${activeWorkspace === 'phodiem' ? 'bg-white dark:bg-[#2A2A2A] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}>Tra Cứu Phổ Điểm</button>
            <button onClick={() => setActiveWorkspace('senai')} className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${activeWorkspace === 'senai' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}><Sparkles className="w-3.5 h-3.5"/> SenAI Dự Đoán</button>
          </div>
        </div>

        {/* WORKSPACE 1: TÍNH ĐIỂM TIÊU CHUẨN */}
        {activeWorkspace === 'tinhdiem' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-300">
            <div className="lg:col-span-7 space-y-6">
              <div className={`${mdCard} p-6 md:p-8 space-y-6`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4 gap-3">
                  <h3 className="font-black text-xs uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Cấu hình điểm tổ hợp xét tuyển</h3>
                  <select value={calcMode} onChange={e => setCalcMode(e.target.value as any)} className="bg-slate-100 dark:bg-[#202020] border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2 text-xs font-black outline-none">
                    <option value="standard">Phương thức Tiêu chuẩn (Thang 30)</option>
                    <option value="hust">Phương thức Nhân đôi môn chính (Bách Khoa)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Môn thứ nhất</label>
                    <input type="text" value={calcScores.sub1} onChange={e => { if(e.target.value===''||/^[0-9.,]*$/.test(e.target.value)) setCalcScores({...calcScores, sub1: e.target.value}) }} placeholder="Điểm số..." className={mdInput} />
                    {calcMode === 'hust' && <button type="button" onClick={()=>setCalcMainSubject('sub1')} className={`w-full mt-2 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border ${calcMainSubject==='sub1'?'bg-rose-500 text-white border-rose-500':'bg-slate-50 dark:bg-[#1E1E1E] text-slate-400'}`}>Môn chính</button>}
                  </div>
                  <div>
                    <label className={labelClass}>Môn thứ hai</label>
                    <input type="text" value={calcScores.sub2} onChange={e => { if(e.target.value===''||/^[0-9.,]*$/.test(e.target.value)) setCalcScores({...calcScores, sub2: e.target.value}) }} placeholder="Điểm số..." className={mdInput} />
                    {calcMode === 'hust' && <button type="button" onClick={()=>setCalcMainSubject('sub2')} className={`w-full mt-2 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border ${calcMainSubject==='sub2'?'bg-rose-500 text-white border-rose-500':'bg-slate-50 dark:bg-[#1E1E1E] text-slate-400'}`}>Môn chính</button>}
                  </div>
                  <div>
                    <label className={labelClass}>Môn thứ ba</label>
                    <input type="text" value={calcScores.sub3} onChange={e => { if(e.target.value===''||/^[0-9.,]*$/.test(e.target.value)) setCalcScores({...calcScores, sub3: e.target.value}) }} placeholder="Điểm số..." className={mdInput} />
                    {calcMode === 'hust' && <button type="button" onClick={()=>setCalcMainSubject('sub3')} className={`w-full mt-2 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border ${calcMainSubject==='sub3'?'bg-rose-500 text-white border-rose-500':'bg-slate-50 dark:bg-[#1E1E1E] text-slate-400'}`}>Môn chính</button>}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Điểm ưu tiên khu vực / đối tượng gốc</label>
                  <input type="text" value={calcPriorityScore} onChange={e => { if(e.target.value===''||/^[0-9.,]*$/.test(e.target.value)) setCalcPriorityScore(e.target.value) }} placeholder="Ví dụ: 0.25, 0.5, 0.75..." className={mdInput} />
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className={`${mdCard} p-6 md:p-8 text-center min-h-[340px] flex flex-col justify-center space-y-4`}>
                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto border border-indigo-100 shadow-inner"><Award className="w-7 h-7"/></div>
                <div><h3 className="font-black text-lg">Bảng điểm quy đổi</h3><p className="text-xs font-bold text-slate-400 mt-1">Kết quả áp dụng thuật toán giảm trừ tuyến tính</p></div>

                {calcResult ? (
                  <div className="space-y-4 animate-in zoom-in-95">
                    <div className="p-4 bg-slate-50 dark:bg-[#1A1A1A] border rounded-2xl grid grid-cols-2 gap-2 text-xs font-black">
                      <div className="border-r border-slate-200 dark:border-slate-800"><p className="text-slate-400 text-[10px] uppercase">Điểm trần 3 môn</p><p className="text-xl font-black mt-1 text-slate-800 dark:text-white">{formatNum(calcResult.rawScore)}</p></div>
                      <div><p className="text-slate-400 text-[10px] uppercase">Điểm UT thực nhận</p><p className="text-xl font-black mt-1 text-amber-500">{formatNum(calcResult.finalPriority)}</p></div>
                    </div>
                    <div className="p-5 bg-indigo-600 text-white rounded-3xl shadow-sm"><p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Điểm xét tuyển chính thức</p><p className="text-5xl font-black mt-1.5 font-mono">{formatNum(calcResult.totalScore)}</p></div>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 dark:bg-[#1A1A1A] rounded-2xl border border-slate-100 text-xs font-bold text-slate-400">Vui lòng điền đủ điểm số thành phần để kích hoạt bộ máy tính điểm xét tuyển.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACE 2: TRA CỨU PHỔ ĐIỂM ĐƠN MÔN KÈM CHAT INTERACTIVE */}
        {activeWorkspace === 'phodiem' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-300">
            {/* Cột trái: Đồ thị và điều khiển phổ điểm */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex flex-wrap gap-2">
                {subjectsList.map(sub => (
                  <button 
                    key={sub} onClick={() => setSelectedSubject(sub)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all border shadow-sm ${selectedSubject === sub ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white/70 dark:bg-[#1A1A1A]/70 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:border-indigo-400'}`}
                  >
                    {sub}
                  </button>
                ))}
              </div>

              <div className={`${mdCard} p-6 md:p-8 min-h-[460px] flex flex-col justify-between`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-4">
                  <div>
                    <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2"><BarChart3 className="w-5 h-5 text-indigo-500"/> Hình dạng phổ điểm môn {selectedSubject}</h3>
                    <p className="text-xs font-bold text-slate-500 mt-0.5">Dữ liệu bách phân vị chuẩn hóa liên năm từ Bộ GD&ĐT.</p>
                  </div>
                  <div className="flex gap-1.5 bg-slate-100 dark:bg-[#202020] p-1 rounded-xl shadow-inner border border-slate-200/50">
                    <button onClick={() => setActiveYear('2025')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${activeYear === '2025' ? 'bg-white dark:bg-[#2A2A2A] text-indigo-600 shadow-sm' : 'text-slate-400'}`}>2025</button>
                    <button onClick={() => setActiveYear('2026')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${activeYear === '2026' ? 'bg-white dark:bg-[#2A2A2A] text-indigo-600 shadow-sm' : 'text-slate-400'}`}>2026</button>
                  </div>
                </div>

                <div className="w-full h-[280px] mt-6 flex gap-[1px] sm:gap-1 border-b-2 border-l-2 border-slate-200 dark:border-slate-800 pl-1 pb-0">
                  {chartData.map((val, i) => {
                    const rangeStart = (i + 1) * currentData.step
                    const isUserScore = userPercentileInfo && userPercentileInfo.binIndex === i
                    const hPercent = Math.max((val / maxChartVal) * 100, 0.5)
                    
                    return (
                      <div key={i} className="flex-1 h-full flex flex-col justify-end relative group">
                        <div 
                          style={{ height: `${hPercent}%` }}
                          className={`w-full rounded-t-[2px] transition-all duration-700 ease-out ${isUserScore ? 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)] z-10 scale-x-125' : 'bg-indigo-500 dark:bg-indigo-600 group-hover:bg-indigo-400'}`}
                        ></div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 font-black mt-4 px-2 uppercase tracking-widest">
                  <span>0</span><span>2,5</span><span>5,0</span><span>7,5</span><span>10</span>
                </div>
              </div>

              {/* Hộp cấu hình điểm số tra cứu bách phân vị và quy đổi nhanh */}
              <div className={`${mdCard} p-6 space-y-4`}>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Nhập điểm thi môn {selectedSubject} để đối soát bách phân vị</label>
                  <input 
                    type="text" value={userScore} 
                    onChange={(e) => { const val = e.target.value; if (val === '' || /^[0-9.,]*$/.test(val)) setUserScore(val) }} 
                    placeholder="Ví dụ: 7.25 hoặc 8,5..." 
                    className={mdInput + " text-lg text-center tracking-widest py-4 bg-white dark:bg-[#1E1E1E]"} 
                  />
                </div>

                {userPercentileInfo && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in zoom-in-95">
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl text-center">
                      <p className="text-[10px] font-black text-indigo-500 uppercase">Thứ hạng quốc gia ước tính</p>
                      <p className="text-2xl font-black text-rose-500 mt-1">Top {(100 - parseFloat(userPercentileInfo.percentile)).toFixed(2).replace('.', ',')}%</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">Vượt qua {formatNum(userPercentileInfo.percentile)}% thí sinh toàn quốc</p>
                    </div>
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl text-center">
                      <p className="text-[10px] font-black text-emerald-500 uppercase">Quy đổi tương đương sang năm 2025</p>
                      <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{formatNum(singleSubjectEquivalent2025 || '0')} điểm</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">Nội suy dựa trên phân bố mẫu phổ điểm</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Cột phải: SenAI Chat đơn môn hỗ trợ phụ huynh học sinh chất vấn sâu */}
            <div className="lg:col-span-5 space-y-6">
              <div className={`${mdCard} p-0 flex flex-col h-[640px] border-2 border-indigo-500/10`}>
                <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-[#141414]/50 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-950 rounded-xl text-indigo-600 dark:text-indigo-400"><Bot className="w-4 h-4"/></div>
                    <div>
                      <h4 className="font-black text-xs uppercase tracking-widest text-slate-800 dark:text-white">Trợ lý phổ điểm đơn môn</h4>
                      <p className="text-[10px] font-bold text-slate-400">Giải đáp thế học, độ phân hóa đề thi</p>
                    </div>
                  </div>
                  {userPercentileInfo && (
                    <button 
                      onClick={() => handleSendPhodiemChat(undefined, true)}
                      className="text-[10px] bg-indigo-600 text-white font-black px-2.5 py-1.5 rounded-lg uppercase tracking-wider hover:bg-indigo-700"
                    >
                      Kích hoạt phân tích
                    </button>
                  )}
                </div>

                {/* Danh sách hội thoại đơn môn */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={scrollRefPhodiem}>
                  {phodiemChatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60">
                      <GraduationCap className="w-10 h-10 text-slate-400 mb-2"/>
                      <p className="text-xs font-bold max-w-xs leading-relaxed">Ph phụ huynh & các em học sinh nhập điểm bên trái sau đó nhấn nút "Kích hoạt phân tích" hoặc đặt câu hỏi ở thanh dưới chân để SenAI giải đáp phổ điểm ảo.</p>
                    </div>
                  ) : (
                    phodiemChatMessages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[90%] px-4 py-3 rounded-[1.3rem] text-xs shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm font-bold' : 'bg-white dark:bg-[#1E1E1E] text-slate-800 dark:text-slate-200 border rounded-bl-sm font-medium leading-relaxed'}`}>
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {msg.text}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ))
                  )}
                  {isPhodiemLoading && (
                    <div className="flex justify-start items-center gap-2 animate-pulse text-[11px] font-bold text-slate-400 italic">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500"/> SenAI đang phân tích phổ điểm ảo...
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-50/80 dark:bg-[#121212]/80 border-t shrink-0">
                  <form onSubmit={(e) => handleSendPhodiemChat(e, false)} className="relative flex items-center bg-white dark:bg-[#202020] border rounded-2xl px-2 py-1.5 shadow-inner">
                    <input 
                      type="text" value={phodiemChatInput} onChange={e => setPhodiemChatInput(e.target.value)}
                      placeholder="Mức điểm này có dễ đỗ đại học top đầu không?..."
                      className="flex-1 bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none px-2"
                      disabled={isPhodiemLoading}
                    />
                    <button type="submit" disabled={isPhodiemLoading || !phodiemChatInput.trim()} className="p-2 bg-indigo-600 text-white rounded-xl disabled:opacity-40">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACE 3: KHÔNG GIAN TỰ ĐỘNG NỘI SUY TOÁN HỌC KHỐI THI & CHAT DỰ ĐOÁN ĐẬU TRỰC TIẾP */}
        {activeWorkspace === 'senai' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-300">
            {/* Cột trái: Bảng nhập thông số tổ hợp, nguyện vọng mục tiêu */}
            <div className="lg:col-span-5 space-y-6">
              <div className={`${mdCard} p-6 md:p-8 space-y-6`}>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2 mb-4">
                    <GraduationCap className="w-5 h-5"/> 1. Thiết lập tổ hợp xét tuyển & Điểm 2026
                  </h3>
                  
                  <label className={labelClass}>Lựa chọn nhanh khối thi</label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                    {['A00', 'A01', 'B00', 'C00', 'D01'].map(group => (
                      <button
                        key={group} type="button" onClick={() => handleSenaiGroupChange(group)}
                        className={`py-2 rounded-xl text-xs font-black border transition-all ${senaiGroup === group ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-slate-100 dark:bg-[#1C1C1E] text-slate-600 dark:text-slate-400 border-transparent hover:border-slate-300'}`}
                      >
                        {group}
                      </button>
                    ))}
                    <button
                      type="button" onClick={() => setSenaiGroup('custom')}
                      className={`py-2 rounded-xl text-xs font-black border transition-all ${senaiGroup === 'custom' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-slate-100 dark:bg-[#1C1C1E] text-slate-600 dark:text-slate-400 border-transparent hover:border-slate-300'}`}
                    >
                      Tự chọn
                    </button>
                  </div>
                </div>

                {senaiGroup === 'custom' && (
                  <div className="grid grid-cols-3 gap-2 animate-in fade-in duration-200">
                    {[0, 1, 2].map(idx => (
                      <div key={idx}>
                        <label className={labelClass}>Môn {idx + 1}</label>
                        <select
                          value={senaiSubjects[idx]}
                          onChange={e => {
                            const updated = [...senaiSubjects]
                            updated[idx] = e.target.value
                            setSenaiSubjects(updated)
                          }}
                          className="w-full bg-slate-100 dark:bg-[#202020] border-2 border-transparent rounded-xl p-3 text-xs font-bold outline-none text-slate-900 dark:text-white focus:border-indigo-500"
                        >
                          {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelClass}>{senaiSubjects[0]}</label>
                    <input type="text" value={senaiScores.s1} onChange={e => { if(e.target.value===''||/^[0-9.,]*$/.test(e.target.value)) setSenaiScores({...senaiScores, s1: e.target.value}) }} placeholder="Điểm..." className={mdInput} />
                  </div>
                  <div>
                    <label className={labelClass}>{senaiSubjects[1]}</label>
                    <input type="text" value={senaiScores.s2} onChange={e => { if(e.target.value===''||/^[0-9.,]*$/.test(e.target.value)) setSenaiScores({...senaiScores, s2: e.target.value}) }} placeholder="Điểm..." className={mdInput} />
                  </div>
                  <div>
                    <label className={labelClass}>{senaiSubjects[2]}</label>
                    <input type="text" value={senaiScores.s3} onChange={e => { if(e.target.value===''||/^[0-9.,]*$/.test(e.target.value)) setSenaiScores({...senaiScores, s3: e.target.value}) }} placeholder="Điểm..." className={mdInput} />
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-white/5 pt-4 space-y-4">
                  <h3 className="font-black text-sm uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                    <Bot className="w-4 h-4"/> 2. Nguyện vọng mục tiêu & Chỉ tiêu xét tuyển
                  </h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Trường Đại học</label>
                      <input type="text" value={targetUni} onChange={e => setTargetUni(e.target.value)} placeholder="Ví dụ: UET, Bách Khoa..." className={mdInput + " py-3"} />
                    </div>
                    <div>
                      <label className={labelClass}>Ngành đăng ký</label>
                      <input type="text" value={targetMajor} onChange={e => setTargetMajor(e.target.value)} placeholder="Ví dụ: Khoa học máy tính..." className={mdInput + " py-3"} />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Điểm chuẩn năm ngoái (2025)</label>
                    <input type="text" value={lastYearCutoff} onChange={e => { if(e.target.value===''||/^[0-9.,]*$/.test(e.target.value)) setLastYearCutoff(e.target.value) }} placeholder="Điểm trúng tuyển 2025..." className={mdInput + " tracking-widest text-center font-mono text-indigo-600 dark:text-indigo-400 bg-white dark:bg-[#1E1E1E]"} />
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-[#161616] rounded-2xl border border-dashed border-slate-200 dark:border-white/5 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><TrendingUp className="w-3 h-3 text-indigo-500"/> Khảo sát biến động tổng chỉ tiêu (Cung / Cầu)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">Chỉ tiêu năm ngoái (2025)</label>
                        <input type="number" value={lastYearQuota} onChange={e => setLastYearQuota(e.target.value)} placeholder="Năm ngoái..." className="w-full bg-white dark:bg-[#202020] rounded-xl p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-white border border-slate-200" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">Chỉ tiêu năm nay (2026)</label>
                        <input type="number" value={thisYearQuota} onChange={e => setThisYearQuota(e.target.value)} placeholder="Năm nay..." className="w-full bg-white dark:bg-[#202020] rounded-xl p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-white border border-slate-200" />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button" onClick={() => handleSendSenaiChat()} disabled={isSenaiLoading}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-[#202020] text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    {isSenaiLoading && senaiChatMessages.length === 0 ? <Loader2 className="w-5 h-5 animate-spin"/> : <Sparkles className="w-4 h-4"/>}
                    Kích hoạt SenAI dự đoán tỷ lệ đậu
                  </button>
                </div>
              </div>
            </div>

            {/* Cột phải: Giao diện Interactive Chat hiển thị kết quả quy đổi toán học chuẩn bách phân vị */}
            <div className="lg:col-span-7 space-y-6">
              {/* Thống kê quy đổi điểm toán học hiển thị động ngay trên đầu cột phải nếu có dữ liệu */}
              {advancedExamBlockAnalysis && (
                <div className={`${mdCard} p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gradient-to-r from-indigo-500/5 to-transparent border-dashed`}>
                  <div className="p-4 bg-white dark:bg-slate-950 border rounded-2xl text-center shadow-inner">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Tổng điểm thực tế khối {senaiGroup} (2026)</p>
                    <p className="text-3xl font-black text-indigo-600 mt-1 font-mono">{formatNum(advancedExamBlockAnalysis.totalRaw2026)}</p>
                  </div>
                  <div className="p-4 bg-white dark:bg-slate-950 border rounded-2xl text-center shadow-inner border-emerald-500/30">
                    <p className="text-[10px] font-black text-emerald-500 uppercase">Quy đổi bách phân vị tương đương sang năm 2025</p>
                    <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">{formatNum(advancedExamBlockAnalysis.totalEquivalent2025)}</p>
                  </div>
                </div>
              )}

              {senaiChatMessages.length > 0 ? (
                <div className={`${mdCard} p-0 flex flex-col h-[580px] border-2 border-indigo-500/20 relative animate-in zoom-in-98 duration-300`}>
                  {/* Vùng luồng hội thoại chat cuộn */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar" ref={scrollRefSenai}>
                    {senaiChatMessages.map((msg, index) => (
                      <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in`}>
                        <div className={`max-w-[85%] px-5 py-3.5 rounded-[1.5rem] text-xs shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm font-bold' : 'bg-white dark:bg-[#1E1E1E] border text-slate-800 dark:text-slate-200 rounded-bl-sm font-medium leading-relaxed'}`}>
                          {/* Render văn bản cực kỳ thân thiện qua react-markdown */}
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                              strong: ({node, ...props}) => <strong className={`font-black ${msg.role === 'user' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />,
                              li: ({node, ...props}) => <li className="pl-0.5" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-sm font-black border-b pb-1 mb-2 mt-3 text-indigo-600 dark:text-indigo-400" {...props} />,
                            }}
                          >
                            {msg.text}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ))}
                    {isSenaiLoading && (
                      <div className="flex justify-start items-center gap-2 text-xs font-bold text-slate-400 italic">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-500"/> SenAI đang tính toán xác suất phân phối điểm chuẩn ảo...
                      </div>
                    )}
                  </div>

                  {/* Thanh Chat tương tác chân trang */}
                  <div className="p-3 bg-slate-50/80 dark:bg-[#121212]/80 border-t shrink-0">
                    <form onSubmit={(e) => handleSendSenaiChat(e, true)} className="relative flex items-center bg-white dark:bg-[#202020] border rounded-2xl px-2 py-1.5 shadow-inner">
                      <input 
                        type="text" value={followUpInput} onChange={(e) => setFollowUpInput(e.target.value)}
                        placeholder="Hỏi thêm SenAI về cơ hội việc làm, học phí, hoặc trường đại học dự phòng an toàn..."
                        className="flex-1 bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none px-3 py-2"
                        disabled={isSenaiLoading}
                      />
                      <button type="submit" disabled={isSenaiLoading || !followUpInput.trim()} className="p-2.5 bg-indigo-600 text-white rounded-xl">
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className={`${mdCard} p-8 text-center flex flex-col justify-center items-center space-y-4 min-h-[500px]`}>
                  <div className="w-16 h-16 bg-slate-100 dark:bg-[#1E1E1E] text-slate-400 dark:text-slate-600 rounded-full flex items-center justify-center border border-dashed border-slate-300">
                    <Bot className="w-8 h-8"/>
                  </div>
                  <div>
                    <h4 className="font-black text-lg">Không gian tư vấn trúng tuyển thông minh</h4>
                    <p className="text-xs font-bold text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
                      Điền thông số điểm số khối thi năm 2026 và nguyện vọng mục tiêu ở bảng bên trái, hệ thống sẽ tự động tổng hợp dữ liệu cung cầu chỉ tiêu và mở không gian đối thoại thông minh trực tiếp tại đây.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}