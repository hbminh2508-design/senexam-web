'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { 
  ArrowLeft, BarChart3, Calculator, TrendingUp, Info, 
  Search, AlertCircle, Bot, Sparkles, Lock, ChevronDown, CheckCircle2, User, Moon, Sun, Download
} from 'lucide-react'

// --- MATERIAL 3 & LIQUID GLASS CONSTANTS ---
const mdCard = "bg-white/70 dark:bg-slate-900/60 backdrop-blur-3xl backdrop-saturate-150 rounded-[2rem] border border-white/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.15)] hover:shadow-xl hover:-translate-y-1 transition-all duration-500 ease-out relative overflow-hidden"
const mdInput = "w-full bg-slate-100 dark:bg-[#202020] border-transparent focus:bg-white dark:focus:bg-[#2A2A2A] border-2 focus:border-indigo-500 rounded-2xl px-5 py-4 outline-none transition-all font-bold text-slate-900 dark:text-white text-sm shadow-inner"

// --- DỮ LIỆU PHỔ ĐIỂM CHÍNH THỨC NĂM 2025 TỪ CHÍNH PHỦ ---
const SUBJECTS_2025: Record<string, { mean: number, d10: number, liet: number, stdDev: number, note?: string }> = {
  'Toán': { mean: 4.78, d10: 513, liet: 777, stdDev: 1.8, note: '513 điểm 10 (Năm 2024 không có điểm 10 nào).' },
  'Ngữ Văn': { mean: 6.50, d10: 0, liet: 87, stdDev: 1.5, note: 'Không có điểm 10 nào trên toàn quốc (Năm 2024 có 2 điểm 10).' },
  'Vật Lí': { mean: 6.99, d10: 3929, liet: 3, stdDev: 1.6, note: 'Hơn 3.900 bài đạt điểm tuyệt đối (Tăng mạnh).' },
  'Hóa Học': { mean: 6.06, d10: 610, liet: 8, stdDev: 1.7, note: 'Điểm trung bình giảm nhẹ so với năm 2024.' },
  'Sinh Học': { mean: 5.78, d10: 82, liet: 1, stdDev: 1.5 },
  'Lịch Sử': { mean: 6.52, d10: 1518, liet: 15, stdDev: 1.6, note: 'Điểm trung bình khá ổn định so với các năm trước.' },
  'Địa Lí': { mean: 6.63, d10: 6907, liet: 19, stdDev: 1.4, note: 'Môn có nhiều điểm 10 nhất toàn quốc.' },
  'Tiếng Anh': { mean: 5.38, d10: 141, liet: 28, stdDev: 2.0, note: 'Phổ điểm đẹp bất ngờ so với các năm trước.' },
  'GDKT&PL': { mean: 7.69, d10: 1451, liet: 0, stdDev: 1.2 },
  'Tin Học': { mean: 6.78, d10: 60, liet: 0, stdDev: 1.5, note: 'Năm đầu tiên thi nhưng kết quả rất khả quan.' },
  'CN Công nghiệp': { mean: 5.79, d10: 4, liet: 0, stdDev: 1.6 },
  'CN Nông nghiệp': { mean: 7.72, d10: 101, liet: 0, stdDev: 1.3, note: 'Môn có điểm trung bình cao nhất hệ thống.' },
}

const subjectsList = Object.keys(SUBJECTS_2025)

// HÀM MÔ PHỎNG ĐƯỜNG CONG GAUSS LÝ THUYẾT (NORMAL DISTRIBUTION)
const normalPDF = (x: number, mean: number, stdDev: number) => {
  return (1 / (stdDev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2))
}

export default function SoSanhPhoDiemPage() {
  const router = useRouter()
  
  // --- STATES BẢN LỀ ---
  const [userName, setUserName] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(false)
  const [activeYear, setActiveYear] = useState<'2025' | '2026'>('2025')
  const [selectedSubject, setSelectedSubject] = useState<string>('Toán')
  const [userScore, setUserScore] = useState<string>('')

  // Khởi chạy hệ thống tự do (Không ép đăng nhập)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if(user) {
        supabase.from('profiles').select('full_name').eq('id', user.id).single().then(({data}) => {
          if(data) setUserName(data.full_name)
        })
      }
    })
    
    if (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark') {
      setIsDark(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleTheme = () => {
    if (isDark) { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); setIsDark(false) } 
    else { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); setIsDark(true) }
  }

  // --- TÍNH TOÁN DỮ LIỆU ĐỒ THỊ BÁCH PHÂN VỊ ---
  const labels = useMemo(() => Array.from({length: 41}, (_, i) => i * 0.25), [])
  
  const chartData = useMemo(() => {
    const stats = SUBJECTS_2025[selectedSubject]
    return labels.map(x => normalPDF(x, stats.mean, stats.stdDev))
  }, [selectedSubject, labels])

  const maxChartVal = Math.max(...chartData)

  const userPercentile = useMemo(() => {
    if (!userScore) return null
    const val = parseFloat(userScore.replace(',', '.'))
    if (isNaN(val) || val < 0 || val > 10) return null

    const totalArea = chartData.reduce((a, b) => a + b, 0)
    const userIndex = labels.findIndex(l => l >= val)
    if (userIndex === -1) return 100 // Đạt 10 điểm tuyệt đối
    
    // Tích phân tính tỷ lệ học sinh đạt điểm dưới mức này
    const areaUpTo = chartData.slice(0, userIndex + 1).reduce((a, b) => a + b, 0)
    return ((areaUpTo / totalArea) * 100).toFixed(1)
  }, [userScore, chartData, labels])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 font-sans relative overflow-x-hidden pb-20 transition-colors duration-500">
      
      {/* 🌟 NỀN AMBIENT LIQUID GLASS MỜ ẢO */}
      <div className="fixed top-[-10%] left-[-5%] w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/10 to-blue-500/10 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="fixed top-[40%] right-[-10%] w-[500px] h-[500px] bg-gradient-to-tr from-purple-500/10 to-pink-500/10 dark:from-purple-900/15 dark:to-pink-900/10 rounded-full blur-[100px] pointer-events-none z-0"></div>

      {/* HEADER BAR BỌC THÉP */}
      <header className="h-[80px] px-4 sm:px-8 flex items-center justify-between bg-white/80 dark:bg-[#121212]/80 backdrop-blur-2xl backdrop-saturate-[1.5] border-b border-slate-200 dark:border-white/5 sticky top-0 z-40 transition-colors shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="p-3 bg-slate-100 dark:bg-[#202020] rounded-full hover:scale-105 active:scale-95 transition-transform">
            <ArrowLeft className="w-5 h-5"/>
          </button>
          <div className="h-6 w-[1px] bg-slate-300 dark:bg-slate-700 mx-1"></div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">Phổ Điểm <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded-md uppercase animate-pulse">Quốc Gia</span></h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Đối soát và Phân tích</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button onClick={toggleTheme} className="p-2.5 bg-slate-100 dark:bg-[#202020] rounded-full hover:bg-slate-200 dark:hover:bg-[#2A2A2A] transition-colors">
            {isDark ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
          </button>
          <div className="w-10 h-10 ml-2 bg-indigo-600 rounded-full flex items-center justify-center text-white font-black shadow-md cursor-pointer hover:scale-105 transition-transform">
            {userName ? userName.charAt(0).toUpperCase() : <User className="w-4 h-4"/>}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT WORKSPACE */}
      <div className="max-w-[1400px] mx-auto pt-8 px-4 md:px-8 relative z-10">
        
        {/* THANH ĐIỀU HƯỚNG NĂM THI */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-xl p-4 sm:p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 shadow-sm mb-8">
          <div className="min-w-0">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2"><BarChart3 className="text-indigo-500"/> Đối soát Phổ Điểm Quốc Gia</h2>
            <p className="text-xs font-bold text-slate-400 mt-1.5">Dữ liệu phân tích đa chiều được trích xuất từ dữ liệu của Bộ Giáo dục và Đào tạo.</p>
          </div>
          <div className="flex gap-2 bg-slate-100 dark:bg-[#202020] p-1.5 rounded-2xl shrink-0 border border-slate-200 dark:border-white/5 shadow-inner">
            <button onClick={() => setActiveYear('2025')} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${activeYear === '2025' ? 'bg-white dark:bg-[#2A2A2A] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Kỳ thi năm 2025</button>
            <button onClick={() => setActiveYear('2026')} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${activeYear === '2026' ? 'bg-white dark:bg-[#2A2A2A] text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Năm 2026 (Mới)</button>
          </div>
        </div>

        {/* 🌟 VÙNG RENDER 2026: KHÓA CHỜ DỮ LIỆU */}
        {activeYear === '2026' ? (
          <div className={`${mdCard} flex flex-col items-center justify-center py-32 px-6 text-center relative`}>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 mix-blend-overlay"></div>
            <Lock className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-6 drop-shadow-md"/>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Dữ liệu 2026 đang được cập nhật</h2>
            <p className="text-slate-500 dark:text-slate-400 font-bold mt-3 max-w-lg leading-relaxed text-sm">Phổ điểm kỳ thi THPT Quốc gia năm 2026 sẽ được hệ thống AI tự động đồng bộ và kích hoạt mở khóa ngay sau khi Bộ GD&ĐT chính thức công bố.</p>
            <button onClick={() => setActiveYear('2025')} className="mt-8 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-black shadow-md hover:shadow-lg transition-all active:scale-95 text-sm uppercase tracking-wider">Xem tạm dữ liệu phân tích 2025</button>
          </div>
        ) : (
          
          /* 🌟 VÙNG RENDER 2025: PHÂN TÍCH CHUYÊN SÂU */
          <div className="space-y-6">
            
            {/* Thanh chọn môn học */}
            <div className="flex flex-wrap gap-2.5">
              {subjectsList.map(sub => (
                <button 
                  key={sub}
                  onClick={() => setSelectedSubject(sub)}
                  className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all border ${selectedSubject === sub ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white/50 dark:bg-[#1A1A1A]/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:border-indigo-400'}`}
                >
                  {sub}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* TRÁI: Ô NHẬP ĐIỂM + CHỈ SỐ MÔN HỌC (4 COLUMNS) */}
              <div className="lg:col-span-4 space-y-6">
                <div className={`${mdCard} p-6 md:p-8 space-y-6`}>
                  <h3 className="font-black text-lg text-indigo-600 dark:text-indigo-400 flex items-center gap-2"><TrendingUp className="w-5 h-5"/> Phân tích vị thế bách phân vị</h3>
                  
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2 pl-1">Nhập điểm thi của bạn (0 - 10)</label>
                    <input 
                      type="text" 
                      value={userScore} 
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^[0-9.,]*$/.test(val)) setUserScore(val)
                      }} 
                      placeholder="Ví dụ: 8.5 hoặc 8,5..." 
                      className={mdInput + " text-lg text-center tracking-widest py-4"} 
                    />
                  </div>
                  
                  {userPercentile ? (
                    <div className="p-5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl animate-in zoom-in-95 text-center">
                      <p className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-1.5">Kết quả hệ thống bóc tách</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed">Với mức điểm <strong className="text-indigo-600 dark:text-indigo-400 text-base mx-1">{userScore}</strong>, bạn đang xuất sắc vượt qua</p>
                      <p className="text-5xl font-black text-rose-500 drop-shadow-sm my-3">{userPercentile}%</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed">tổng số thí sinh toàn quốc ở môn <strong className="text-indigo-600 dark:text-indigo-400">{selectedSubject}</strong>.</p>
                    </div>
                  ) : (
                    <div className="p-5 bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/5 rounded-2xl flex items-center gap-3">
                      <Calculator className="w-8 h-8 text-slate-400 shrink-0"/>
                      <p className="text-xs font-bold text-slate-500 leading-relaxed">Nhập điểm thi thực tế hoặc điểm thi thử của bạn vào ô trên để AI phân tích thứ hạng bách phân vị.</p>
                    </div>
                  )}
                </div>

                <div className={`${mdCard} p-6 md:p-8`}>
                  <h3 className="font-black text-base text-slate-800 dark:text-white flex items-center gap-2 mb-5"><AlertCircle className="w-5 h-5 text-rose-500"/> Tổng quan phổ điểm môn {selectedSubject}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-[#1A1A1A] border border-slate-100 dark:border-white/5 rounded-2xl text-center">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Điểm TB</p>
                      <p className="text-2xl font-black text-slate-800 dark:text-white mt-1.5">{SUBJECTS_2025[selectedSubject].mean}</p>
                    </div>
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl text-center">
                      <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Điểm 10</p>
                      <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">{SUBJECTS_2025[selectedSubject].d10.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 rounded-2xl text-center col-span-2 sm:col-span-1 lg:col-span-2">
                      <p className="text-[10px] font-black uppercase text-rose-500 tracking-widest">Điểm Liệt</p>
                      <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1.5">{SUBJECTS_2025[selectedSubject].liet.toLocaleString()}</p>
                    </div>
                  </div>
                  
                  {SUBJECTS_2025[selectedSubject].note && (
                    <div className="mt-5 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-500 flex items-start gap-2 leading-relaxed">
                      <Info className="w-4 h-4 shrink-0 mt-0.5"/> <span>{SUBJECTS_2025[selectedSubject].note}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* PHẢI: BIỂU ĐỒ TRỰC QUAN ĐƯỜNG CONG GAUSS BẰNG HTML/CSS NGUYÊN BẢN (8 COLUMNS) */}
              <div className="lg:col-span-8 space-y-6">
                <div className={`${mdCard} p-6 md:p-8 min-h-[500px] flex flex-col justify-between`}>
                  <div className="mb-4">
                    <h3 className="font-black text-lg text-slate-800 dark:text-white flex items-center gap-2"><BarChart3 className="w-5 h-5 text-indigo-500"/> Biểu đồ phân bổ điểm môn {selectedSubject} toàn quốc</h3>
                    <p className="text-xs font-bold text-slate-500 mt-1">Mô phỏng đường cong tiêu chuẩn (Bell Curve) dựa trên dữ liệu công bố.</p>
                  </div>

                  {/* VÙNG RENDER BIỂU ĐỒ BẰNG LIQUID GLASS CSS TRỰC QUAN KHÔNG CẦN THƯ VIỆN BÊN THỨ 3 */}
                  <div className="flex-1 w-full border-b-2 border-l-2 border-slate-200 dark:border-slate-800 pb-2 pl-2 relative flex items-end h-[350px] gap-[1px] sm:gap-[2px] mt-6 rounded-bl-sm">
                    {chartData.map((val, i) => {
                      const xVal = i * 0.25;
                      const parsedScore = parseFloat(userScore.replace(',', '.'));
                      const isUserScore = !isNaN(parsedScore) && Math.abs(xVal - parsedScore) < 0.125;
                      
                      return (
                        <div key={i} className="relative flex-1 group flex flex-col justify-end h-full">
                          <div 
                            style={{ height: `${Math.max((val / maxChartVal) * 100, 1)}%` }} 
                            className={`w-full rounded-t-sm transition-all duration-700 ease-out ${isUserScore ? 'bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.8)] z-10 scale-x-125 origin-bottom' : 'bg-indigo-400 dark:bg-indigo-600 hover:bg-indigo-300 dark:hover:bg-indigo-400'}`}
                          ></div>
                          
                          {/* Tooltip khi Hover vào cột */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black px-2.5 py-1.5 rounded-lg shadow-xl z-20 whitespace-nowrap animate-in zoom-in-95 pointer-events-none">
                              Điểm {xVal.toFixed(2)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  
                  {/* Trục X hiển thị tọa độ điểm */}
                  <div className="flex justify-between text-[10px] text-slate-400 font-black mt-3 px-2 uppercase tracking-widest">
                    <span>0</span><span>2.5</span><span>5.0</span><span>7.5</span><span>10</span>
                  </div>
                </div>

                {/* PLACEHOLDER AI SO SÁNH NĂM 2026 */}
                <div className={`${mdCard} p-6 border-l-4 border-amber-500`}>
                  <h3 className="font-black text-amber-600 dark:text-amber-500 flex items-center gap-2"><Bot className="w-5 h-5"/> Trợ lý AI Phân tích & So sánh phổ điểm</h3>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-2 leading-relaxed max-w-3xl">Tính năng phân tích dự đoán chuyên sâu và so sánh độ khó tương đương giữa 2 năm (2025 vs 2026) đang tạm khóa chờ dữ liệu điểm thi chính thức năm 2026. Ngay khi có dữ liệu, AI sẽ phân tích xem điểm số hiện tại của bạn tương đương với mức điểm nào của năm trước.</p>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}