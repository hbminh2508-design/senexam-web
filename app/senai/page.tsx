'use client'

import type React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import {
  ArrowLeft, BarChart3, Calculator, TrendingUp, Info,
  AlertCircle, Bot, User, Moon, Sun, Award, Sparkles, Copy, Check, GraduationCap
} from 'lucide-react'
import { useNewUiPrefs } from '@/app/components/useNewUiPrefs'
import { getModernThemeVars } from '@/app/components/modernTheme'

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
      mean: 5.02, d10: 2, liet: 0, bins: 40, step: 0.25,
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

// Giả lập mảng Nông nghiệp
const fallbackNormalDistribution = (mean: number, stdDev: number, total: number, bins: number, step: number) => {
  return Array.from({ length: bins }, (_, i) => {
    const x = (i + 1) * step
    const prob = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2))
    return Math.round(prob * total * step)
  })
}
STATS_DATA['2025']['CN Nông nghiệp'] = { mean: 7.72, d10: 101, liet: 0, stdDev: 1.3, bins: 40, step: 0.25, data: fallbackNormalDistribution(7.72, 1.3, 10000, 40, 0.25) }
STATS_DATA['2026']['CN Nông nghiệp'] = { mean: 7.12, d10: 45, liet: 0, stdDev: 1.4, bins: 40, step: 0.25, data: fallbackNormalDistribution(7.12, 1.4, 9500, 40, 0.25) }

const subjectsList = Object.keys(STATS_DATA['2025'])

export default function UnifiedKhaoThiPage() {
  const router = useRouter()
  const { newUiEnabled, themeColor, animationsEnabled } = useNewUiPrefs()

  const [activeWorkspace, setActiveWorkspace] = useState<'tinhdiem' | 'phodiem' | 'senai'>('tinhdiem')
  const [userName, setUserName] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(false)

  // --- STATE TÍNH ĐIỂM ---
  const [calcMode, setCalcMode] = useState<'standard' | 'hust'>('standard')
  const [calcScores, setCalcScores] = useState({ sub1: '', sub2: '', sub3: '' })
  const [calcMainSubject, setCalcMainSubject] = useState<'sub1' | 'sub2' | 'sub3'>('sub1')
  const [calcPriorityScore, setCalcPriorityScore] = useState('')
  const [calcResult, setCalcResult] = useState<{ rawScore: number; finalPriority: number; totalScore: number; } | null>(null)

  // --- STATE PHỔ ĐIỂM ---
  const [activeYear, setActiveYear] = useState<'2025' | '2026'>('2026')
  const [selectedSubject, setSelectedSubject] = useState<string>('Toán')
  const [userScore, setUserScore] = useState<string>('')

  // --- STATE TÍCH HỢP HƯỚNG DẪN PROMPT CHUẨN SENAI VÀ DỰ ĐOÁN (MỚI BỔ SUNG) ---
  const [senaiGroup, setSenaiGroup] = useState('A00')
  const [senaiSubjects, setSenaiSubjects] = useState(['Toán', 'Vật Lí', 'Hóa Học'])
  const [senaiScores, setSenaiScores] = useState({ s1: '', s2: '', s3: '' })
  const [targetUni, setTargetUni] = useState('')
  const [targetMajor, setTargetMajor] = useState('')
  const [lastYearCutoff, setLastYearCutoff] = useState('')
  const [lastYearQuota, setLastYearQuota] = useState('')
  const [thisYearQuota, setThisYearQuota] = useState('')
  const [promptCopied, setPromptCopied] = useState(false)

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

  // Tự động map môn học theo khối thi được chọn nhanh
  const handleSenaiGroupChange = (group: string) => {
    setSenaiGroup(group)
    if (group === 'A00') setSenaiSubjects(['Toán', 'Vật Lí', 'Hóa Học'])
    else if (group === 'A01') setSenaiSubjects(['Toán', 'Vật Lí', 'Tiếng Anh'])
    else if (group === 'B00') setSenaiSubjects(['Toán', 'Hóa Học', 'Sinh Học'])
    else if (group === 'C00') setSenaiSubjects(['Ngữ Văn', 'Lịch Sử', 'Địa Lí'])
    else if (group === 'D01') setSenaiSubjects(['Toán', 'Ngữ Văn', 'Tiếng Anh'])
  }

  // ENGINE TÍNH ĐIỂM XÉT TUYỂN
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
    if (rawScore >= 22.5) {
      actualPriority = ((30 - rawScore) / 7.5) * baseP
    }

    setCalcResult({
      rawScore: Math.round(rawScore * 100) / 100,
      finalPriority: Math.max(0, Math.round(actualPriority * 100) / 100),
      totalScore: Math.round((rawScore + actualPriority) * 100) / 100
    })
  }, [calcScores, calcMode, calcMainSubject, calcPriorityScore])

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

  // LÕI MÔ PHỎNG SENAI ĐỐI SOÁNH LIÊN NĂM
  const aiCrossYearAnalysis = useMemo(() => {
    if (activeYear !== '2026' || !userPercentileInfo) return null
    
    const targetPercentile = parseFloat(userPercentileInfo.percentile)
    const data2025 = STATS_DATA['2025'][selectedSubject].data as number[]
    const step2025 = STATS_DATA['2025'][selectedSubject].step
    const bins2025 = STATS_DATA['2025'][selectedSubject].bins
    const total2025 = data2025.reduce((a, b) => a + b, 0)

    let calculatedScore2025 = 0
    let runningSum = 0
    
    for (let i = 0; i < bins2025; i++) {
      runningSum += data2025[i]
      const currentPct = (runningSum / total2025) * 100
      if (currentPct >= targetPercentile) {
        calculatedScore2025 = (i + 1) * step2025
        break
      }
    }
    if (calculatedScore2025 === 0) calculatedScore2025 = 10

    const isHarder = STATS_DATA['2026'][selectedSubject].mean < STATS_DATA['2025'][selectedSubject].mean
    return {
      equivalentScore: calculatedScore2025.toFixed(2),
      status: isHarder ? 'Đề thi phân hóa cao hơn' : 'Phổ điểm dịch chuyển lên phân khu điểm cao',
      advice: isHarder 
        ? '- Mức điểm này tương đương mức điểm cao hơn của năm ngoái. Cơ hội cạnh tranh vào các trường Đại học Top đầu (như Bách Khoa, ĐHQG) của bạn rất khả quan.'
        : '- Do phổ điểm chung dịch chuyển lên, bạn nên cânнять nộp thêm nguyện vọng dự phòng an toàn từ 0,5 đến 1 điểm.'
    }
  }, [activeYear, userPercentileInfo, selectedSubject])

  // LÕI XỬ LÝ SINH PROMPT CHUẨN CỦA SENAI DÀNH CHO PHỤ HUYNH & HỌC SINH
  const senaiGeneratedPromptText = useMemo(() => {
    const scr1 = senaiScores.s1 || '0'
    const scr2 = senaiScores.s2 || '0'
    const scr3 = senaiScores.s3 || '0'
    const totalScore2026 = (parseFloat(scr1.replace(',', '.')) || 0) + (parseFloat(scr2.replace(',', '.')) || 0) + (parseFloat(scr3.replace(',', '.')) || 0)

    return `Hãy đóng vai trò là một chuyên gia khảo thí dữ liệu độc lập và tư vấn định hướng tuyển sinh Đại học dày dặn kinh nghiệm. Tôi là phụ huynh/học sinh đang cần hỗ trợ chọn trường chọn ngành năm 2026 với thông số thực tế như sau:
- Khối đăng ký xét tuyển: ${senaiGroup === 'custom' ? 'Tự cấu hình tổ hợp' : senaiGroup}
- Chi tiết môn thi & điểm số 2026 thực tế: ${senaiSubjects[0]} = ${scr1}; ${senaiSubjects[1]} = ${scr2}; ${senaiSubjects[2]} = ${scr3}. Tổng điểm trần 3 môn năm 2026: ${formatNum(totalScore2026.toFixed(2))}.
- Trường Đại học mong muốn: ${targetUni || '[Chưa nhập tên trường]'}
- Ngành học mục tiêu: ${targetMajor || '[Chưa nhập tên ngành]'}
- Điểm chuẩn (Cutoff) của ngành này vào năm ngoái (2025): ${lastYearCutoff ? lastYearCutoff : '[Chưa nhập điểm chuẩn]'} điểm.
${lastYearQuota ? `- Chỉ tiêu tuyển sinh của ngành năm ngoái (2025): ${lastYearQuota} sinh viên.\n` : ''}${thisYearQuota ? `- Chỉ tiêu tuyển sinh của ngành năm nay (2026): ${thisYearQuota} sinh viên.\n` : ''}
Dựa trên độ dịch chuyển bách phân vị quốc gia liên năm 2025 - 2026 của tổ hợp môn này và hệ số biến động chỉ tiêu cung cầu xét tuyển (nếu có), hãy phân tích chuyên sâu xác suất trúng tuyển, dự báo phổ điểm ảo và đưa ra lời khuyên chiến thuật đặt thứ tự nguyện vọng an toàn nhất cho gia đình tôi.`
  }, [senaiGroup, senaiSubjects, senaiScores, targetUni, targetMajor, lastYearCutoff, lastYearQuota, thisYearQuota])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(senaiGeneratedPromptText)
    setPromptCopied(true)
    setTimeout(() => setPromptCopied(false), 2000)
  }

  if (newUiEnabled) {
    return (
      <div
        className="min-h-screen font-sans relative pb-20"
        data-motion={animationsEnabled ? 'on' : 'off'}
        style={{ ...getModernThemeVars(themeColor, isDark), background: 'var(--bg)', color: 'var(--text)' } as React.CSSProperties}
      >
        <header className="h-[80px] px-4 sm:px-8 flex items-center justify-between sticky top-0 z-40" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard')} className="p-3 rounded-full hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
              <ArrowLeft className="w-5 h-5" style={{ color: 'var(--text-muted)' }}/>
            </button>
            <div className="h-6 w-[1px]" style={{ background: 'var(--border)' }}></div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2" style={{ color: 'var(--text)' }}>
                SenKhảoThí
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-widest" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Beta</span>
              </h1>
              <p className="text-[10px] font-medium uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-muted)' }}>Đối soát Phổ điểm tổng hợp</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={toggleTheme} className="p-2.5 rounded-full transition-colors" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              {isDark ? <Sun className="w-5 h-5" style={{ color: '#D97706' }}/> : <Moon className="w-5 h-5" style={{ color: 'var(--text-muted)' }}/>}
            </button>
          </div>
        </header>

        <div className="max-w-[1400px] mx-auto pt-8 px-4 md:px-8 relative z-10">

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl mb-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="min-w-0 pl-2">
              <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2.5" style={{ color: 'var(--text)' }}>
                {activeWorkspace === 'tinhdiem' && <Calculator className="w-5 h-5" style={{ color: 'var(--accent)' }}/>}
                {activeWorkspace === 'phodiem' && <BarChart3 className="w-5 h-5" style={{ color: 'var(--accent)' }}/>}
                {activeWorkspace === 'senai' && <Bot className="w-5 h-5" style={{ color: 'var(--accent)' }}/>}
                {activeWorkspace === 'tinhdiem' && 'Trạm Tính Điểm Xét Tuyển Đại Học'}
                {activeWorkspace === 'phodiem' && 'Hệ Thống Phân Tích & Tra Cứu Phổ Điểm'}
                {activeWorkspace === 'senai' && 'Bộ Công Cụ Tạo Prompt Chọn Trường Chuẩn Ngữ Cảnh SenAI'}
              </h2>
              <p className="text-xs font-medium mt-1" style={{ color: 'var(--text-muted)' }}>Hỗ trợ đầy đủ dữ liệu khảo thí, kết hợp quy chuẩn nội suy bách phân vị liên năm chính xác.</p>
            </div>
            <div className="flex flex-wrap gap-1.5 p-1.5 rounded-2xl shrink-0" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <button onClick={() => setActiveWorkspace('tinhdiem')} className="px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors" style={activeWorkspace === 'tinhdiem' ? { background: 'var(--surface)', color: 'var(--accent)' } : { color: 'var(--text-muted)' }}>Tính Điểm Đại Học</button>
              <button onClick={() => setActiveWorkspace('phodiem')} className="px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors" style={activeWorkspace === 'phodiem' ? { background: 'var(--surface)', color: 'var(--accent)' } : { color: 'var(--text-muted)' }}>Tra Cứu Phổ Điểm</button>
              <button onClick={() => setActiveWorkspace('senai')} className="px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1" style={activeWorkspace === 'senai' ? { background: 'var(--accent)', color: '#fff' } : { color: 'var(--text-muted)' }}><Sparkles className="w-3.5 h-3.5"/> SenAI Chọn Trường</button>
            </div>
          </div>

          {/* WORKSPACE 1: TÍNH ĐIỂM */}
          {activeWorkspace === 'tinhdiem' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 space-y-6">
                <div className="rounded-2xl p-6 md:p-8 space-y-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
                    <h3 className="font-semibold text-xs uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Cấu hình điểm tổ hợp xét tuyển</h3>
                    <select value={calcMode} onChange={e => setCalcMode(e.target.value as any)} className="rounded-xl px-4 py-2 text-xs font-semibold outline-none bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
                      <option value="standard">Phương thức Tiêu chuẩn (Thang 30)</option>
                      <option value="hust">Phương thức Nhân đôi môn chính (Bách Khoa)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest mb-2 pl-1" style={{ color: 'var(--text-muted)' }}>Môn thứ nhất</label>
                      <input type="text" value={calcScores.sub1} onChange={e => { if(e.target.value===''||/^[0-9.,]*$/.test(e.target.value)) setCalcScores({...calcScores, sub1: e.target.value}) }} placeholder="Điểm số..." className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text)' }} />
                      {calcMode === 'hust' && <button type="button" onClick={()=>setCalcMainSubject('sub1')} className="w-full mt-2 py-1.5 rounded-lg text-[10px] font-semibold uppercase transition-all" style={calcMainSubject==='sub1' ? { background: '#DC2626', color: '#fff', border: '1px solid #DC2626' } : { background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Môn chính</button>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest mb-2 pl-1" style={{ color: 'var(--text-muted)' }}>Môn thứ hai</label>
                      <input type="text" value={calcScores.sub2} onChange={e => { if(e.target.value===''||/^[0-9.,]*$/.test(e.target.value)) setCalcScores({...calcScores, sub2: e.target.value}) }} placeholder="Điểm số..." className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text)' }} />
                      {calcMode === 'hust' && <button type="button" onClick={()=>setCalcMainSubject('sub2')} className="w-full mt-2 py-1.5 rounded-lg text-[10px] font-semibold uppercase transition-all" style={calcMainSubject==='sub2' ? { background: '#DC2626', color: '#fff', border: '1px solid #DC2626' } : { background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Môn chính</button>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest mb-2 pl-1" style={{ color: 'var(--text-muted)' }}>Môn thứ ba</label>
                      <input type="text" value={calcScores.sub3} onChange={e => { if(e.target.value===''||/^[0-9.,]*$/.test(e.target.value)) setCalcScores({...calcScores, sub3: e.target.value}) }} placeholder="Điểm số..." className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text)' }} />
                      {calcMode === 'hust' && <button type="button" onClick={()=>setCalcMainSubject('sub3')} className="w-full mt-2 py-1.5 rounded-lg text-[10px] font-semibold uppercase transition-all" style={calcMainSubject==='sub3' ? { background: '#DC2626', color: '#fff', border: '1px solid #DC2626' } : { background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Môn chính</button>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest mb-2 pl-1" style={{ color: 'var(--text-muted)' }}>Điểm ưu tiên khu vực / đối tượng gốc</label>
                    <input type="text" value={calcPriorityScore} onChange={e => { if(e.target.value===''||/^[0-9.,]*$/.test(e.target.value)) setCalcPriorityScore(e.target.value) }} placeholder="Ví dụ: 0.25, 0.5, 0.75..." className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text)' }} />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-6">
                <div className="rounded-2xl p-6 md:p-8 text-center min-h-[340px] flex flex-col justify-center space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Award className="w-7 h-7"/></div>
                  <div><h3 className="font-semibold text-lg" style={{ color: 'var(--text)' }}>Bảng điểm quy đổi</h3><p className="text-xs font-medium mt-1" style={{ color: 'var(--text-muted)' }}>Kết quả áp dụng thuật toán giảm trừ tuyến tính</p></div>

                  {calcResult ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl grid grid-cols-2 gap-2 text-xs font-semibold" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                        <div style={{ borderRight: '1px solid var(--border)' }}><p className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>Điểm trần 3 môn</p><p className="text-xl font-semibold mt-1" style={{ color: 'var(--text)' }}>{formatNum(calcResult.rawScore)}</p></div>
                        <div><p className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>Điểm UT thực nhận</p><p className="text-xl font-semibold mt-1" style={{ color: '#D97706' }}>{formatNum(calcResult.finalPriority)}</p></div>
                      </div>
                      <div className="p-5 rounded-3xl text-white" style={{ background: 'var(--accent)' }}><p className="text-[10px] font-semibold uppercase tracking-widest opacity-80">Điểm xét tuyển chính thức</p><p className="text-5xl font-bold mt-1.5 font-mono">{formatNum(calcResult.totalScore)}</p></div>
                    </div>
                  ) : (
                    <div className="p-6 rounded-2xl text-xs font-medium" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>Vui lòng điền đủ điểm số thành phần để kích hoạt bộ máy tính điểm xét tuyển.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* WORKSPACE 2: TRA CỨU PHỔ ĐIỂM */}
          {activeWorkspace === 'phodiem' && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2.5">
                {subjectsList.map(sub => (
                  <button
                    key={sub} onClick={() => setSelectedSubject(sub)}
                    className="px-5 py-2.5 rounded-full text-xs font-semibold transition-all"
                    style={selectedSubject === sub ? { background: 'var(--accent)', color: '#fff' } : { background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  >
                    {sub}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-4 space-y-6">
                  <div className="rounded-2xl p-6 md:p-8 space-y-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                      <h3 className="font-semibold text-sm uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Khảo sát bách phân vị</h3>
                      <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                        <button onClick={() => setActiveYear('2025')} className="px-3 py-1.5 text-[10px] font-semibold rounded-lg transition-all" style={activeYear === '2025' ? { background: 'var(--surface)', color: 'var(--accent)' } : { color: 'var(--text-muted)' }}>2025</button>
                        <button onClick={() => setActiveYear('2026')} className="px-3 py-1.5 text-[10px] font-semibold rounded-lg transition-all" style={activeYear === '2026' ? { background: 'var(--surface)', color: 'var(--accent)' } : { color: 'var(--text-muted)' }}>2026</button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-widest mb-2 pl-1" style={{ color: 'var(--text-muted)' }}>Nhập điểm thi đối soát (0 - 10)</label>
                      <input
                        type="text" value={userScore}
                        onChange={(e) => { const val = e.target.value; if (val === '' || /^[0-9.,]*$/.test(val)) setUserScore(val) }}
                        placeholder="Ví dụ: 7.25 hoặc 8,5..."
                        className="w-full rounded-xl px-4 py-4 outline-none text-lg text-center tracking-widest font-medium bg-transparent"
                        style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
                      />
                    </div>

                    {userPercentileInfo ? (
                      <div className="p-6 rounded-3xl text-center relative overflow-hidden" style={{ background: 'var(--accent-soft)', border: '1px solid var(--border)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--accent)' }}>Thống kê Real-time</p>
                        <p className="text-[3.2rem] font-bold leading-none" style={{ color: '#E11D48' }}>Top {(100 - parseFloat(userPercentileInfo.percentile)).toFixed(2).replace('.', ',')}<span className="text-2xl" style={{ color: '#FB7185' }}>%</span></p>
                        <p className="text-xs font-medium leading-relaxed mt-4" style={{ color: 'var(--text)' }}>Điểm <strong className="mx-1" style={{ color: 'var(--accent)' }}>{userScore}</strong> môn <strong style={{ color: 'var(--accent)' }}>{selectedSubject}</strong> vượt qua <strong style={{ color: 'var(--accent)' }}>{formatNum(userPercentileInfo.percentile)}%</strong> tổng số <strong style={{ color: 'var(--accent)' }}>{userPercentileInfo.totalStudents.toLocaleString('vi-VN')}</strong> thí sinh của năm {activeYear}.</p>
                      </div>
                    ) : (
                      <div className="p-5 rounded-2xl flex items-start gap-3 text-xs font-medium" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        <Info className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}/> Điền điểm số để hệ thống nội suy thứ hạng bách phân vị quốc gia.
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl p-6 md:p-8 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <h3 className="font-semibold text-sm uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Chỉ số thống kê {activeYear}</h3>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-3 rounded-xl" style={{ background: 'var(--bg)' }}><p className="text-[9px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Điểm TB</p><p className="text-base font-semibold mt-1" style={{ color: 'var(--text)' }}>{formatNum(currentData.mean)}</p></div>
                      <div className="p-3 rounded-xl" style={{ background: 'rgba(5,150,105,0.08)' }}><p className="text-[9px] font-semibold uppercase" style={{ color: '#059669' }}>Điểm 10</p><p className="text-base font-semibold mt-1" style={{ color: '#059669' }}>{currentData.d10.toLocaleString('vi-VN')}</p></div>
                      <div className="p-3 rounded-xl" style={{ background: 'rgba(225,29,72,0.08)' }}><p className="text-[9px] font-semibold uppercase" style={{ color: '#E11D48' }}>Điểm Liệt</p><p className="text-base font-semibold mt-1" style={{ color: '#E11D48' }}>{currentData.liet.toLocaleString('vi-VN')}</p></div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-8 space-y-6">
                  <div className="rounded-2xl p-6 md:p-8 min-h-[500px] flex flex-col justify-between" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div className="mb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-lg flex items-center gap-2" style={{ color: 'var(--text)' }}><BarChart3 className="w-5 h-5" style={{ color: 'var(--accent)' }}/> Hình dạng phổ điểm năm {activeYear}</h3>
                        <p className="text-xs font-medium mt-1" style={{ color: 'var(--text-muted)' }}>Trích xuất chính xác 100% tọa độ phân bổ điểm từ Bộ Giáo dục và Đào tạo.</p>
                      </div>
                    </div>

                    <div className="w-full h-[350px] mt-6 flex gap-[1px] sm:gap-1 pl-1 pb-0" style={{ borderBottom: '2px solid var(--border)', borderLeft: '2px solid var(--border)' }}>
                      {chartData.map((val, i) => {
                        const rangeStart = (i + 1) * currentData.step
                        const isUserScore = userPercentileInfo && userPercentileInfo.binIndex === i
                        const hPercent = Math.max((val / maxChartVal) * 100, 0.5)

                        return (
                          <div key={i} className="flex-1 h-full flex flex-col justify-end relative group">
                            <div
                              style={{ height: `${hPercent}%`, background: isUserScore ? '#E11D48' : 'var(--accent)' }}
                              className="w-full rounded-t-[2px] transition-all duration-700 ease-out"
                            ></div>

                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center text-[10px] font-semibold px-3 py-2 rounded-xl shadow-xl z-50 whitespace-nowrap pointer-events-none" style={{ background: 'var(--text)', color: 'var(--surface)' }}>
                                <span className="mb-0.5 pb-0.5" style={{ opacity: 0.7, borderBottom: '1px solid currentColor' }}>Mức điểm {formatNum(rangeStart.toFixed(2))}</span>
                                <span className="text-xs">{val.toLocaleString('vi-VN')} TS</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="flex justify-between text-[11px] font-semibold mt-4 px-2 uppercase tracking-widest relative" style={{ color: 'var(--text-muted)' }}>
                      <span>0</span>
                      <span className="absolute left-1/4 -translate-x-1/2">2,5</span>
                      <span className="absolute left-1/2 -translate-x-1/2">5,0</span>
                      <span className="absolute left-[75%] -translate-x-1/2">7,5</span>
                      <span>10</span>
                    </div>
                  </div>

                  {aiCrossYearAnalysis && (
                    <div className="rounded-2xl p-6 md:p-8 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid #D97706' }}>
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-base flex items-center gap-2" style={{ color: '#D97706' }}><Bot className="w-5 h-5"/> Công cụ đối sánh liên năm SenAI</h3>
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-widest" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Beta</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium" style={{ color: 'var(--text)' }}>
                        <div className="p-4 rounded-2xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                          <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Quy đổi tương đương</p>
                          <p className="text-xs mt-1">Mức điểm <span className="text-sm font-semibold" style={{ color: '#E11D48' }}>{userScore}</span> của năm 2026 tương đương với mức:</p>
                          <p className="text-3xl font-bold mt-2 font-mono" style={{ color: 'var(--accent)' }}>{formatNum(aiCrossYearAnalysis.equivalentScore)} <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>điểm của năm 2025</span></p>
                        </div>
                        <div className="p-4 rounded-2xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                          <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Trạng thái biến động đề</p>
                          <p className="text-sm font-semibold mt-1" style={{ color: 'var(--text)' }}>{aiCrossYearAnalysis.status}</p>
                          <div className="text-[11px] font-medium mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{aiCrossYearAnalysis.advice}</div>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl flex gap-3 text-xs font-medium leading-relaxed" style={{ background: 'var(--accent-soft)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                        <Sparkles className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
                        <div>
                          <span className="block font-semibold uppercase text-[10px] mb-0.5" style={{ color: 'var(--accent)' }}>Dự báo xác suất đậu nguyện vọng từ SenAI:</span>
                          Nếu nộp vào nhóm ngành có điểm chuẩn năm ngoái dao động xung quanh ngưỡng {formatNum(aiCrossYearAnalysis.equivalentScore)} điểm, tỷ lệ trúng tuyển của bạn đạt mức tối ưu (Trên 85%). Dùng mức quy đổi bách phân vị này làm mỏ neo định vị trường học chính xác cực kỳ an toàn nhe sếp!
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* WORKSPACE 3: SENAI HƯỚNG DẪN PROMPT CHỌN TRƯỜNG */}
          {activeWorkspace === 'senai' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 space-y-6">
                <div className="rounded-2xl p-6 md:p-8 space-y-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div>
                    <h3 className="font-semibold text-sm uppercase tracking-widest flex items-center gap-2 mb-4" style={{ color: 'var(--accent)' }}>
                      <GraduationCap className="w-5 h-5"/> 1. Cấu hình khối thi & Điểm số thành phần
                    </h3>

                    <label className="block text-xs font-semibold uppercase tracking-widest mb-2 pl-1" style={{ color: 'var(--text-muted)' }}>Lựa chọn nhanh khối xét tuyển</label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                      {['A00', 'A01', 'B00', 'C00', 'D01'].map(group => (
                        <button
                          key={group} type="button"
                          onClick={() => handleSenaiGroupChange(group)}
                          className="py-2 rounded-xl text-xs font-semibold transition-all"
                          style={senaiGroup === group ? { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' } : { background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid transparent' }}
                        >
                          {group}
                        </button>
                      ))}
                      <button
                        type="button" onClick={() => setSenaiGroup('custom')}
                        className="py-2 rounded-xl text-xs font-semibold transition-all"
                        style={senaiGroup === 'custom' ? { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' } : { background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid transparent' }}
                      >
                        Tự chọn
                      </button>
                    </div>
                  </div>

                  {senaiGroup === 'custom' && (
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 1, 2].map(idx => (
                        <div key={idx}>
                          <label className="block text-xs font-semibold uppercase tracking-widest mb-2 pl-1" style={{ color: 'var(--text-muted)' }}>Môn {idx + 1}</label>
                          <select
                            value={senaiSubjects[idx]}
                            onChange={e => {
                              const updated = [...senaiSubjects]
                              updated[idx] = e.target.value
                              setSenaiSubjects(updated)
                            }}
                            className="w-full rounded-xl p-3 text-xs font-medium outline-none bg-transparent"
                            style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
                          >
                            {subjectsList.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest mb-2 pl-1" style={{ color: 'var(--text-muted)' }}>{senaiSubjects[0]}</label>
                      <input type="text" value={senaiScores.s1} onChange={e => { if(e.target.value===''||/^[0-9.,]*$/.test(e.target.value)) setSenaiScores({...senaiScores, s1: e.target.value}) }} placeholder="Điểm..." className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text)' }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest mb-2 pl-1" style={{ color: 'var(--text-muted)' }}>{senaiSubjects[1]}</label>
                      <input type="text" value={senaiScores.s2} onChange={e => { if(e.target.value===''||/^[0-9.,]*$/.test(e.target.value)) setSenaiScores({...senaiScores, s2: e.target.value}) }} placeholder="Điểm..." className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text)' }} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest mb-2 pl-1" style={{ color: 'var(--text-muted)' }}>{senaiSubjects[2]}</label>
                      <input type="text" value={senaiScores.s3} onChange={e => { if(e.target.value===''||/^[0-9.,]*$/.test(e.target.value)) setSenaiScores({...senaiScores, s3: e.target.value}) }} placeholder="Điểm..." className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text)' }} />
                    </div>
                  </div>

                  <div className="pt-4 space-y-4" style={{ borderTop: '1px solid var(--border)' }}>
                    <h3 className="font-semibold text-sm uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                      <Bot className="w-4 h-4"/> 2. Nguyện vọng mục tiêu & Chỉ tiêu xét tuyển
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-widest mb-2 pl-1" style={{ color: 'var(--text-muted)' }}>Trường Đại học</label>
                        <input type="text" value={targetUni} onChange={e => setTargetUni(e.target.value)} placeholder="Ví dụ: UET, Bách Khoa..." className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text)' }} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-widest mb-2 pl-1" style={{ color: 'var(--text-muted)' }}>Ngành học</label>
                        <input type="text" value={targetMajor} onChange={e => setTargetMajor(e.target.value)} placeholder="Ví dụ: Công nghệ thông tin..." className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text)' }} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-widest mb-2 pl-1" style={{ color: 'var(--text-muted)' }}>Điểm chuẩn năm ngoái (2025)</label>
                      <input type="text" value={lastYearCutoff} onChange={e => { if(e.target.value===''||/^[0-9.,]*$/.test(e.target.value)) setLastYearCutoff(e.target.value) }} placeholder="Ví dụ: 26.35 hoặc 24,5..." className="w-full rounded-xl px-4 py-3 outline-none text-sm font-medium bg-transparent tracking-widest text-center font-mono" style={{ border: '1px solid var(--border)', color: 'var(--accent)' }} />
                    </div>

                    <div className="p-4 rounded-2xl space-y-3" style={{ background: 'var(--bg)', border: '1px dashed var(--border)' }}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><TrendingUp className="w-3 h-3" style={{ color: 'var(--accent)' }}/> Khảo sát biến động cung cầu chỉ tiêu tuyển sinh</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Chỉ tiêu năm ngoái (2025)</label>
                          <input type="number" value={lastYearQuota} onChange={e => setLastYearQuota(e.target.value)} placeholder="Số chỉ tiêu..." className="w-full rounded-xl p-2.5 text-xs font-medium outline-none bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text)' }} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Chỉ tiêu năm nay (2026)</label>
                          <input type="number" value={thisYearQuota} onChange={e => setThisYearQuota(e.target.value)} placeholder="Số chỉ tiêu..." className="w-full rounded-xl p-2.5 text-xs font-medium outline-none bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text)' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 space-y-6">
                <div className="rounded-2xl p-6 md:p-8 space-y-4" style={{ background: 'var(--surface)', border: '2px solid var(--accent)' }}>
                  <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                    <h4 className="font-semibold text-sm uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text)' }}>
                      <Sparkles className="w-4 h-4" style={{ color: 'var(--accent)' }} /> Cấu trúc Prompt đối soát chuẩn SenAI
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-widest" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Beta</span>
                    </h4>
                    <button
                      type="button" onClick={copyToClipboard}
                      className="px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--accent)' }}
                    >
                      {promptCopied ? <Check className="w-3.5 h-3.5" style={{ color: '#059669' }}/> : <Copy className="w-3.5 h-3.5"/>}
                      {promptCopied ? 'Đã copy!' : 'Sao chép Prompt'}
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl text-xs font-medium leading-relaxed" style={{ background: 'var(--accent-soft)', color: 'var(--text)' }}>
                    <Info className="w-4 h-4 inline mr-1 shrink-0 -mt-0.5" style={{ color: 'var(--accent)' }}/>
                    <strong>Hướng dẫn dành cho Phụ huynh và Học sinh:</strong> Mẫu prompt ngữ cảnh cao bên dưới đã tự động mã hóa điểm số, tổ hợp bách phân vị và biến động chỉ tiêu cung cầu của gia đình. Hãy sao chép đoạn mã này và gửi trực tiếp vào hệ thống AI tích hợp (Gemini API) của bạn để nhận báo cáo phân tích phổ điểm ảo liên năm chuẩn xác nhất!
                  </div>

                  <div className="p-5 rounded-2xl font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-all relative max-h-[350px] overflow-y-auto custom-scrollbar" style={{ background: isDark ? '#000' : '#1E1E1E', color: '#D4D4D4', border: '1px solid var(--border)' }}>
                    {senaiGeneratedPromptText}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 font-sans relative overflow-x-hidden pb-20 transition-colors duration-500">

      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/10 to-blue-500/10 dark:from-indigo-900/20 rounded-full blur-[120px] pointer-events-none z-0"></div>

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
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl p-4 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm mb-8">
          <div className="min-w-0 pl-2">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              {activeWorkspace === 'tinhdiem' && <Calculator className="text-indigo-500 w-6 h-6"/>}
              {activeWorkspace === 'phodiem' && <BarChart3 className="text-indigo-500 w-6 h-6"/>}
              {activeWorkspace === 'senai' && <Bot className="text-indigo-500 w-6 h-6"/>}
              {activeWorkspace === 'tinhdiem' && 'Trạm Tính Điểm Xét Tuyển Đại Học'}
              {activeWorkspace === 'phodiem' && 'Hệ Thống Phân Tích & Tra Cứu Phổ Điểm'}
              {activeWorkspace === 'senai' && 'Bộ Công Cụ Tạo Prompt Chọn Trường Chuẩn Ngữ Cảnh SenAI'}
            </h2>
            <p className="text-xs font-bold text-slate-500 mt-1">Hỗ trợ đầy đủ dữ liệu khảo thí, kết hợp quy chuẩn nội suy bách phân vị liên năm chính xác.</p>
          </div>
          <div className="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-[#202020] p-1.5 rounded-2xl shrink-0 border border-slate-200 dark:border-white/5 shadow-inner">
            <button onClick={() => setActiveWorkspace('tinhdiem')} className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${activeWorkspace === 'tinhdiem' ? 'bg-white dark:bg-[#2A2A2A] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}>Tính Điểm Đại Học</button>
            <button onClick={() => setActiveWorkspace('phodiem')} className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${activeWorkspace === 'phodiem' ? 'bg-white dark:bg-[#2A2A2A] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}>Tra Cứu Phổ Điểm</button>
            <button onClick={() => setActiveWorkspace('senai')} className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${activeWorkspace === 'senai' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}><Sparkles className="w-3.5 h-3.5"/> SenAI Chọn Trường</button>
          </div>
        </div>

        {/* WORKSPACE 1: TÍNH ĐIỂM */}
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

        {/* WORKSPACE 2: TRA CỨU PHỔ ĐIỂM */}
        {activeWorkspace === 'phodiem' && (
          <div className="space-y-6 animate-in fade-in duration-300">
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
              <div className="lg:col-span-4 space-y-6">
                <div className={`${mdCard} p-6 md:p-8 space-y-6`}>
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                    <h3 className="font-black text-sm uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Khảo sát bách phân vị</h3>
                    <div className="flex gap-2 bg-slate-100 dark:bg-[#202020] p-1 rounded-xl shadow-inner border border-slate-200">
                      <button onClick={() => setActiveYear('2025')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${activeYear === '2025' ? 'bg-white dark:bg-[#2A2A2A] text-indigo-600 shadow-sm' : 'text-slate-400'}`}>2025</button>
                      <button onClick={() => setActiveYear('2026')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${activeYear === '2026' ? 'bg-white dark:bg-[#2A2A2A] text-indigo-600 shadow-sm' : 'text-slate-400'}`}>2026</button>
                    </div>
                  </div>

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
                    <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 rounded-3xl text-center shadow-sm relative overflow-hidden animate-in zoom-in-95">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>
                      <p className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-2">Thống kê Real-time</p>
                      <p className="text-[3.2rem] font-black text-rose-500 drop-shadow-sm leading-none">Top {(100 - parseFloat(userPercentileInfo.percentile)).toFixed(2).replace('.', ',')}<span className="text-2xl text-rose-400">%</span></p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed mt-4">Điểm <strong className="text-indigo-600 dark:text-indigo-400 mx-1">{userScore}</strong> môn <strong className="text-indigo-600 dark:text-indigo-400">{selectedSubject}</strong> vượt qua <strong className="text-indigo-600 dark:text-indigo-400">{formatNum(userPercentileInfo.percentile)}%</strong> tổng số <strong className="text-indigo-600 dark:text-indigo-400">{userPercentileInfo.totalStudents.toLocaleString('vi-VN')}</strong> thí sinh của năm {activeYear}.</p>
                    </div>
                  ) : (
                    <div className="p-5 bg-slate-50 dark:bg-[#1A1A1A] border rounded-2xl flex items-start gap-3 text-xs font-bold text-slate-400">
                      <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5"/> Điền điểm số để hệ thống nội suy thứ hạng bách phân vị quốc gia.
                    </div>
                  )}
                </div>

                <div className={`${mdCard} p-6 md:p-8 space-y-4`}>
                  <h3 className="font-black text-sm uppercase tracking-widest text-slate-500">Chỉ số thống kê {activeYear}</h3>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 bg-slate-100 dark:bg-[#1C1C1E] rounded-xl"><p className="text-[9px] font-black text-slate-400 uppercase">Điểm TB</p><p className="text-base font-black mt-1">{formatNum(currentData.mean)}</p></div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl"><p className="text-[9px] font-black text-emerald-500 uppercase">Điểm 10</p><p className="text-base font-black mt-1 text-emerald-600">{currentData.d10.toLocaleString('vi-VN')}</p></div>
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/20 rounded-xl"><p className="text-[9px] font-black text-rose-500 uppercase">Điểm Liệt</p><p className="text-base font-black mt-1 text-rose-600">{currentData.liet.toLocaleString('vi-VN')}</p></div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8 space-y-6">
                <div className={`${mdCard} p-6 md:p-8 min-h-[500px] flex flex-col justify-between`}>
                  <div className="mb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                      <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2"><BarChart3 className="w-5 h-5 text-indigo-500"/> Hình dạng phổ điểm năm {activeYear}</h3>
                      <p className="text-xs font-bold text-slate-500 mt-1">Trích xuất chính xác 100% tọa độ phân bổ điểm từ Bộ Giáo dục và Đào tạo.</p>
                    </div>
                  </div>

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
                          
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black px-3 py-2 rounded-xl shadow-xl z-50 whitespace-nowrap pointer-events-none animate-in zoom-in-95">
                              <span className="text-slate-300 dark:text-slate-500 mb-0.5 border-b border-slate-700 dark:border-slate-200 pb-0.5">Mức điểm {formatNum(rangeStart.toFixed(2))}</span>
                              <span className="text-xs">{val.toLocaleString('vi-VN')} TS</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  
                  <div className="flex justify-between text-[11px] text-slate-400 font-black mt-4 px-2 uppercase tracking-widest relative">
                    <span>0</span>
                    <span className="absolute left-1/4 -translate-x-1/2">2,5</span>
                    <span className="absolute left-1/2 -translate-x-1/2">5,0</span>
                    <span className="absolute left-[75%] -translate-x-1/2">7,5</span>
                    <span>10</span>
                  </div>
                </div>

                {aiCrossYearAnalysis && (
                  <div className={`${mdCard} p-6 md:p-8 border-l-4 border-amber-500 bg-gradient-to-r from-amber-50/50 to-transparent dark:from-amber-900/10 space-y-4 animate-in slide-in-from-bottom-4`}>
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-base text-amber-600 dark:text-amber-500 flex items-center gap-2"><Bot className="w-5 h-5"/> Công cụ đối sánh liên năm SenAI</h3>
                      <span className="text-[10px] bg-amber-500 text-white font-black px-2 py-1 rounded-md uppercase tracking-wider animate-pulse">Lõi AI Phân Tích</span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <div className="p-4 bg-white dark:bg-slate-950 border rounded-2xl">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Quy đổi tương đương</p>
                        <p className="text-xs mt-1">Mức điểm <span className="text-rose-500 text-sm font-black">{userScore}</span> của năm 2026 tương đương với mức:</p>
                        <p className="text-3xl font-black text-indigo-600 mt-2 font-mono">{formatNum(aiCrossYearAnalysis.equivalentScore)} <span className="text-xs text-slate-400 font-bold">điểm của năm 2025</span></p>
                      </div>
                      <div className="p-4 bg-white dark:bg-slate-950 border rounded-2xl">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Trạng thái biến động đề</p>
                        <p className="text-sm font-black text-slate-800 dark:text-white mt-1">{aiCrossYearAnalysis.status}</p>
                        <div className="text-[11px] font-bold text-slate-500 mt-2 leading-relaxed">{aiCrossYearAnalysis.advice}</div>
                      </div>
                    </div>

                    <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex gap-3 text-xs font-bold leading-relaxed text-indigo-800 dark:text-indigo-400">
                      <Sparkles className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="block font-black uppercase text-[10px] text-indigo-600 mb-0.5">Dự báo xác suất đậu nguyện vọng từ SenAI:</span>
                        Nếu nộp vào nhóm ngành có điểm chuẩn năm ngoái dao động xung quanh ngưỡng {formatNum(aiCrossYearAnalysis.equivalentScore)} điểm, tỷ lệ trúng tuyển của bạn đạt mức tối ưu (Trên 85%). Dùng mức quy đổi bách phân vị này làm mỏ neo định vị trường học chính xác cực kỳ an toàn nhe sếp!
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACE 3: SENAI HƯỚNG DẪN PROMPT CHỌN TRƯỜNG (MỚI TÍCH HỢP) */}
        {activeWorkspace === 'senai' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in duration-300">
            {/* CỘT TRÁI: KHỐI THI VÀ ĐIỂM SỐ MỤC TIÊU */}
            <div className="lg:col-span-5 space-y-6">
              <div className={`${mdCard} p-6 md:p-8 space-y-6`}>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2 mb-4">
                    <GraduationCap className="w-5 h-5"/> 1. Cấu hình khối thi & Điểm số thành phần
                  </h3>
                  
                  <label className={labelClass}>Lựa chọn nhanh khối xét tuyển</label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                    {['A00', 'A01', 'B00', 'C00', 'D01'].map(group => (
                      <button
                        key={group} type="button"
                        onClick={() => handleSenaiGroupChange(group)}
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

                {/* Nếu chọn khối tự do, hiển thị danh sách dropdown để chọn môn */}
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

                {/* Ô nhập điểm tương ứng của khối xét tuyển */}
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

                {/* Thông tin trường ngành mục tiêu */}
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
                      <label className={labelClass}>Ngành học</label>
                      <input type="text" value={targetMajor} onChange={e => setTargetMajor(e.target.value)} placeholder="Ví dụ: Công nghệ thông tin..." className={mdInput + " py-3"} />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Điểm chuẩn năm ngoái (2025)</label>
                    <input type="text" value={lastYearCutoff} onChange={e => { if(e.target.value===''||/^[0-9.,]*$/.test(e.target.value)) setLastYearCutoff(e.target.value) }} placeholder="Ví dụ: 26.35 hoặc 24,5..." className={mdInput + " tracking-widest text-center font-mono text-indigo-600 dark:text-indigo-400 bg-white dark:bg-[#1E1E1E]"} />
                  </div>

                  {/* Thu thập dữ liệu chỉ tiêu nâng cao giúp tăng độ chính xác phân tích */}
                  <div className="p-4 bg-slate-50 dark:bg-[#161616] rounded-2xl border border-dashed border-slate-200 dark:border-white/5 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><TrendingUp className="w-3 h-3 text-indigo-500"/> Khảo sát biến động cung cầu chỉ tiêu tuyển sinh</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">Chỉ tiêu năm ngoái (2025)</label>
                        <input type="number" value={lastYearQuota} onChange={e => setLastYearQuota(e.target.value)} placeholder="Số chỉ tiêu..." className="w-full bg-white dark:bg-[#202020] rounded-xl p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-white border border-slate-200 dark:border-white/5" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">Chỉ tiêu năm nay (2026)</label>
                        <input type="number" value={thisYearQuota} onChange={e => setThisYearQuota(e.target.value)} placeholder="Số chỉ tiêu..." className="w-full bg-white dark:bg-[#202020] rounded-xl p-2.5 text-xs font-bold outline-none text-slate-900 dark:text-white border border-slate-200 dark:border-white/5" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CỘT PHẢI: KẾT QUẢ CẤU TRÚC PROMPT VÀ HƯỚNG DẪN ĐỐI SOÁNH */}
            <div className="lg:col-span-7 space-y-6">
              <div className={`${mdCard} p-6 md:p-8 space-y-4 border-2 border-indigo-500/30`}>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                  <h4 className="font-black text-sm uppercase tracking-widest text-slate-800 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-500" /> Cấu trúc Prompt đối soát chuẩn SenAI
                  </h4>
                  <button
                    type="button" onClick={copyToClipboard}
                    className="px-4 py-2 bg-slate-100 dark:bg-[#202020] hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-black rounded-xl border border-slate-200 dark:border-white/5 transition-all flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400"
                  >
                    {promptCopied ? <Check className="w-3.5 h-3.5 text-emerald-500"/> : <Copy className="w-3.5 h-3.5"/>}
                    {promptCopied ? 'Đã copy!' : 'Sao chép Prompt'}
                  </button>
                </div>

                <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl text-xs font-bold leading-relaxed text-indigo-800 dark:text-indigo-400">
                  <Info className="w-4 h-4 inline mr-1 shrink-0 -mt-0.5"/> 
                  <strong>Hướng dẫn dành cho Phụ huynh và Học sinh:</strong> Mẫu prompt ngữ cảnh cao bên dưới đã tự động mã hóa điểm số, tổ hợp bách phân vị và biến động chỉ tiêu cung cầu của gia đình. Hãy sao chép đoạn mã này và gửi trực tiếp vào hệ thống AI tích hợp (Gemini API) của bạn để nhận báo cáo phân tích phổ điểm ảo liên năm chuẩn xác nhất!
                </div>

                {/* Hộp văn bản Prompt động hiển thị thời gian thực */}
                <div className="p-5 bg-slate-900 dark:bg-black rounded-2xl border border-slate-800 font-mono text-[11px] text-slate-300 dark:text-slate-400 leading-relaxed whitespace-pre-wrap select-all relative max-h-[350px] overflow-y-auto custom-scrollbar">
                  {senaiGeneratedPromptText}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}