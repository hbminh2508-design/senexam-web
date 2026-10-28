'use client'

import React, { useState, useEffect, useMemo, useDeferredValue, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import { isExamInFolder, SebFolderLike } from '@/lib/sebFolderUtils'
import type { ExamCollection } from '@/lib/examCollectionStore'
import ProtectedExamPdfViewer from '@/app/components/ProtectedExamPdfViewer'

import {
  ArrowLeft,
  Search,
  Clock,
  BookOpen,
  Rocket,
  Crown,
  KeyRound,
  FileText,
  Download,
  Sparkles,
  Loader2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  History,
  ShieldCheck,
  Folder,
  FolderOpen,
  FolderPlus,
  Video,
  Layers,
  Filter,
  X,
  Award,
  Package,
  Shuffle,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Edit,
  SlidersHorizontal,
  CheckCircle2,
  ListOrdered,
  AlertCircle,
  HelpCircle,
  Play,
  RotateCcw,
  BarChart3,
  TrendingUp,
  TrendingDown,
  FileCheck,
  Zap,
  Target,
  Trophy,
  Flame,
  Eye,
  Calendar,
  LayoutDashboard,
  Users,
  XCircle,
  Copy,
  Check,
  Lock,
  Unlock,
  UploadCloud,
  Calculator,
  Compass,
  Edit3,
  Sliders,
  Settings,
  GraduationCap,
  Brain,
  Hash,
  FileUp,
  FileCode,
  Code,
  ImageIcon,
  Maximize2,
  Menu,
  ExternalLink,
  GripVertical,
  Mic,
  MicOff,
  FolderTree,
} from 'lucide-react'
import { getModernThemeVars } from '@/app/components/modernTheme'
import ModernLoading from '@/app/components/ModernLoading'


import { useRef, Component } from 'react'
import { initGoogleDriveUpload, uploadFileToGoogleDrive } from '@/app/components/googleDriveUpload'
import ExamStudentProctorModal from '@/app/components/ExamStudentProctorModal'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import 'katex/dist/katex.min.css'
import { parseLatexExamCode, preprocessLatexContent } from '@/lib/latexExamParser'
import TikzRenderer from '@/app/components/TikzRenderer'


const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-hub-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-hub-body' })

interface ErrorBoundaryProps {
  fallback?: React.ReactNode
  children: React.ReactNode
  resetKey?: any
}

interface ErrorBoundaryState {
  hasError: boolean
}

class MarkdownErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: any) {
    console.warn('LaTeX Markdown render error caught:', error)
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <span className="text-rose-500 text-xs italic">[Lỗi hiển thị công thức toán]</span>
        )
      )
    }
    return this.props.children
  }
}

const SafeMathRenderer = React.memo(
  ({
    content,
    className,
    gfm = true,
  }: {
    content: string
    className?: string
    gfm?: boolean
  }) => {
    const rawStr = typeof content === 'string' ? content : String(content ?? '')
    const safeContent = preprocessLatexContent(rawStr)
    const remarkPlugins = gfm ? [remarkMath, remarkGfm] : [remarkMath]
    const rehypePlugins: any[] = [
      [
        rehypeKatex,
        {
          throwOnError: false,
          errorColor: '#ef4444',
          strict: false,
        },
      ],
    ]

    return (
      <MarkdownErrorBoundary resetKey={safeContent} fallback={<span className="text-xs font-mono">{safeContent}</span>}>
        <div className={className}>
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            rehypePlugins={rehypePlugins}
            components={{
              code: ({ className: codeClass, children, ...props }: any) => {
                const isTikz = /language-tikz/i.test(codeClass || '')
                if (isTikz) {
                  return <TikzRenderer code={String(children).trim()} />
                }
                return (
                  <code className={codeClass} {...props}>
                    {children}
                  </code>
                )
              },
              img: ({ node, ...props }) => (
                <span className="block my-3 text-center">
                  <img
                    {...props}
                    alt={props.alt || 'Hình minh họa đề thi'}
                    className="max-h-[380px] max-w-full rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm mx-auto object-contain cursor-zoom-in hover:shadow-md transition bg-white"
                    onClick={() => {
                      if (props.src) window.open(props.src, '_blank')
                    }}
                  />
                  {props.alt && props.alt !== 'Hình minh họa đề thi' && (
                    <span className="block text-[11px] text-slate-400 italic mt-1 font-sans">
                      {props.alt}
                    </span>
                  )}
                </span>
              ),
            }}
          >
            {safeContent}
          </ReactMarkdown>
        </div>
      </MarkdownErrorBoundary>
    )
  }
)
SafeMathRenderer.displayName = 'SafeMathRenderer'

const MathKeyButton = React.memo(
  ({ k, onInsert }: { k: any; onInsert: (val: string) => void }) => {
    return (
      <button
        type="button"
        onClick={() => onInsert(k.insert)}
        className="h-10 min-w-10 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:border-indigo-400 text-xs font-bold transition flex items-center justify-center shadow-sm active:scale-95 cursor-pointer"
        title={`Chèn: ${k.insert}`}
      >
        <SafeMathRenderer content={`$${k.display}$`} gfm={false} />
      </button>
    )
  }
)
MathKeyButton.displayName = 'MathKeyButton'

function getExamQuestionCount(exam: any): number {
  if (!exam) return 0
  try {
    let struct = exam.exam_structure
    if (typeof struct === 'string') {
      try {
        struct = JSON.parse(struct)
      } catch {
        struct = []
      }
    }
    if (Array.isArray(struct)) {
      return struct.reduce((acc: number, s: any) => {
        const count =
          parseInt(s?.questionCount) ||
          (Array.isArray(s?.questions) ? s.questions.length : 0) ||
          0
        return acc + count
      }, 0)
    }
    if (struct && typeof struct === 'object') {
      if (Array.isArray(struct.sections)) {
        return struct.sections.reduce((acc: number, s: any) => {
          const count =
            parseInt(s?.questionCount) ||
            (Array.isArray(s?.questions) ? s.questions.length : 0) ||
            0
          return acc + count
        }, 0)
      }
    }
  } catch {
    return 0
  }
  return 0
}

// setup fonts use the unified hub headingFont and bodyFont

interface KatexQuestion {
  id: string
  type: 'single_choice' | 'true_false' | 'short_answer' | 'essay'
  text: string
  options: string[]
  correctAnswer: any
  explanation: string
  points: number
}


function normalizeQuestionType(
  rawType: any,
  section?: any,
  qIdx?: number
): 'single_choice' | 'true_false' | 'short_answer' | 'essay' {
  // 1. Kiểm tra nếu có dải câu mixedRanges
  if (section?.mixedRanges && Array.isArray(section.mixedRanges) && qIdx !== undefined) {
    const range = section.mixedRanges.find(
      (r: any) => (qIdx + 1) >= (Number(r.start) || 1) && (qIdx + 1) <= (Number(r.end) || 999)
    )
    if (range?.type) {
      return normalizeQuestionType(range.type)
    }
  }

  // 2. Kiểm tra tùy chỉnh từng câu (custom questionTypes)
  if (section?.questionTypeMode === 'custom' && section?.questionTypes && qIdx !== undefined) {
    if (section.questionTypes[qIdx]) {
      return normalizeQuestionType(section.questionTypes[qIdx])
    }
  }

  // 3. Tự động nhận diện từ đáp án đúng (correctAnswers) nếu có
  if (section?.correctAnswers && qIdx !== undefined) {
    const ans = section.correctAnswers[qIdx] ?? section.correctAnswers[String(qIdx)]
    if (ans !== undefined && ans !== null) {
      if (typeof ans === 'object' && !Array.isArray(ans)) {
        const keys = Object.keys(ans)
        if (keys.some((k) => ['a', 'b', 'c', 'd'].includes(k.toLowerCase()))) {
          return 'true_false'
        }
      }
      if (typeof ans === 'string') {
        const trimmed = ans.trim()
        if (/^[A-D]$/i.test(trimmed)) {
          return 'single_choice'
        }
        if (/^[\d.,+-]+$/.test(trimmed) && trimmed.length > 0) {
          return 'short_answer'
        }
        if (trimmed.length > 30) {
          return 'essay'
        }
      }
    }
  }

  let type = (rawType || section?.type || '').toString().toLowerCase().trim()

  if (
    type.includes('true') ||
    type.includes('tf') ||
    type.includes('dung_sai') ||
    type.includes('đúng') ||
    type.includes('sai')
  ) {
    return 'true_false'
  }

  if (
    type.includes('short') ||
    type.includes('ngắn') ||
    type.includes('điền') ||
    type.includes('fill') ||
    type.includes('dien_so') ||
    type === 'sa'
  ) {
    return 'short_answer'
  }

  if (
    type.includes('essay') ||
    type.includes('luận') ||
    type.includes('tu_luan')
  ) {
    return 'essay'
  }

  const secName = (section?.name || '').toLowerCase()
  if (secName.includes('đúng') || secName.includes('sai') || secName.includes('phần ii') || secName.includes('phần 2')) {
    return 'true_false'
  }
  if (secName.includes('ngắn') || secName.includes('điền số') || secName.includes('phần iii') || secName.includes('phần 3')) {
    return 'short_answer'
  }
  if (secName.includes('tự luận')) {
    return 'essay'
  }

  return 'single_choice'
}

export interface SectionItem {
  id: string
  name: string
  totalPoints: number
  scoringMode: 'auto_divide' | 'custom_points'
  pointsPerQuestion?: Record<number, number>
  questionCount: number
  questionTypeMode: 'uniform' | 'custom' | 'mixed'
  type: 'single_choice' | 'true_false' | 'short_answer' | 'essay' | 'mixed'
  questionTypes?: Record<number, string>
  instructions: string
  instructionImage?: string
  correctAnswers: Record<string, any>
  optionsCount?: number
  mixedRanges?: Array<{
    start: number
    end: number
    type: 'single_choice' | 'true_false' | 'short_answer' | 'essay'
    optionsCount?: number
  }>
}

const SETUP_EXAM_TYPES = ['THPTQG', 'HSA', 'TSA', 'SPT', 'ĐGNL', 'Kiểm tra 1 tiết', 'Học kỳ']
const EXAM_BLOCKS = [
  { code: 'A00', name: 'Toán, Vật lí, Hóa học' },
  { code: 'A01', name: 'Toán, Vật lí, Tiếng Anh' },
  { code: 'B00', name: 'Toán, Hóa học, Sinh học' },
  { code: 'C00', name: 'Ngữ văn, Lịch sử, Địa lí' },
  { code: 'D01', name: 'Ngữ văn, Toán, Tiếng Anh' },
  { code: 'HSA', name: 'Đánh giá năng lực (HSA)' },
  { code: 'TSA', name: 'Đánh giá tư duy (TSA)' },
]

// BÀN PHÍM ẢO TOÁN HỌC (VIRTUAL MATH KEYBOARD) VỚI CÔNG THỨC RENDER ĐẸP
const MATH_KEYBOARD_TABS = [
  {
    id: 'basic',
    name: 'Cơ bản',
    keys: [
      { label: '\\frac{a}{b}', insert: '\\frac{a}{b}', display: '\\frac{a}{b}' },
      { label: '\\sqrt{x}', insert: '\\sqrt{x}', display: '\\sqrt{x}' },
      { label: '\\sqrt[n]{x}', insert: '\\sqrt[n]{x}', display: '\\sqrt[n]{x}' },
      { label: 'x^2', insert: '^{2}', display: 'x^2' },
      { label: 'x^n', insert: '^{n}', display: 'x^n' },
      { label: 'x_n', insert: '_{n}', display: 'x_n' },
      { label: '\\pm', insert: '\\pm', display: '\\pm' },
      { label: '\\times', insert: '\\times', display: '\\times' },
      { label: '\\div', insert: '\\div', display: '\\div' },
      { label: '\\ne', insert: '\\neq', display: '\\neq' },
      { label: '\\le', insert: '\\le', display: '\\le' },
      { label: '\\ge', insert: '\\ge', display: '\\ge' },
      { label: '\\approx', insert: '\\approx', display: '\\approx' },
      { label: '\\infty', insert: '\\infty', display: '\\infty' },
      { label: '\\pi', insert: '\\pi', display: '\\pi' },
    ],
  },
  {
    id: 'calculus',
    name: 'Giải tích',
    keys: [
      { label: '\\int', insert: '\\int_{a}^{b} f(x)dx', display: '\\int_a^b' },
      { label: '\\int f(x)', insert: '\\int f(x)dx', display: '\\int f(x)' },
      { label: '\\sum', insert: '\\sum_{i=1}^{n}', display: '\\sum_{i=1}^n' },
      { label: '\\lim', insert: '\\lim_{x \\to x_0}', display: '\\lim_{x\\to x_0}' },
      { label: 'f\'(x)', insert: 'f\'(x)', display: 'f\'(x)' },
      { label: '\\frac{dy}{dx}', insert: '\\frac{dy}{dx}', display: '\\frac{dy}{dx}' },
      { label: '\\in', insert: '\\in', display: '\\in' },
      { label: '\\notin', insert: '\\notin', display: '\\notin' },
      { label: '\\subset', insert: '\\subset', display: '\\subset' },
      { label: '\\cup', insert: '\\cup', display: '\\cup' },
      { label: '\\cap', insert: '\\cap', display: '\\cap' },
      { label: '\\varnothing', insert: '\\emptyset', display: '\\emptyset' },
      { label: '\\mathbb{R}', insert: '\\mathbb{R}', display: '\\mathbb{R}' },
    ],
  },
  {
    id: 'trig',
    name: 'Lượng giác & Ký hiệu',
    keys: [
      { label: '\\sin', insert: '\\sin(x)', display: '\\sin(x)' },
      { label: '\\cos', insert: '\\cos(x)', display: '\\cos(x)' },
      { label: '\\tan', insert: '\\tan(x)', display: '\\tan(x)' },
      { label: '\\cot', insert: '\\cot(x)', display: '\\cot(x)' },
      { label: '\\alpha', insert: '\\alpha', display: '\\alpha' },
      { label: '\\beta', insert: '\\beta', display: '\\beta' },
      { label: '\\gamma', insert: '\\gamma', display: '\\gamma' },
      { label: '\\theta', insert: '\\theta', display: '\\theta' },
      { label: '\\Delta', insert: '\\Delta', display: '\\Delta' },
      { label: '\\lambda', insert: '\\lambda', display: '\\lambda' },
      { label: '\\omega', insert: '\\omega', display: '\\omega' },
      { label: '^{\\circ}', insert: '^{\\circ}', display: '30^{\\circ}' },
    ],
  },
  {
    id: 'geometry',
    name: 'Hình học & Vector',
    keys: [
      { label: '\\vec{v}', insert: '\\vec{v}', display: '\\vec{v}' },
      { label: '\\vec{AB}', insert: '\\vec{AB}', display: '\\vec{AB}' },
      { label: '|\\vec{a}|', insert: '|\\vec{a}|', display: '|\\vec{a}|' },
      { label: '\\Delta ABC', insert: '\\Delta ABC', display: '\\Delta ABC' },
      { label: '\\widehat{A}', insert: '\\widehat{ABC}', display: '\\widehat{ABC}' },
      { label: '\\perp', insert: '\\perp', display: '\\perp' },
      { label: '\\parallel', insert: '\\parallel', display: '\\parallel' },
      { label: '\\equiv', insert: '\\equiv', display: '\\equiv' },
    ],
  },
  {
    id: 'graphics',
    name: '📐 Vẽ hình & Đồ thị',
    keys: [
      { label: 'Vẽ Oxy & Hàm số', insert: '\n\\begin{tikzpicture}[scale=0.8]\n\\draw[->] (-3,0) -- (3,0) node[right]{$x$};\n\\draw[->] (0,-3) -- (0,3) node[above]{$y$};\n\\draw[domain=-2:2,smooth,variable=\\x,blue,thick] plot ({\\x},{\\x*\\x - 2});\n\\end{tikzpicture}\n', display: '\\text{Vẽ Oxy}' },
      { label: 'Đường tròn Lượng giác', insert: '\n\\begin{tikzpicture}[scale=1]\n\\draw[->] (-1.5,0) -- (1.5,0) node[right]{$x$};\n\\draw[->] (0,-1.5) -- (0,1.5) node[above]{$y$};\n\\draw (0,0) circle (1);\n\\node[below right] at (0,0) {$O$};\n\\end{tikzpicture}\n', display: '\\text{Đường tròn}' },
      { label: 'Hình chóp S.ABCD', insert: '\n\\begin{tikzpicture}[scale=0.8]\n\\coordinate (A) at (0,0); \\coordinate (B) at (4,-1); \\coordinate (C) at (2,-2); \\coordinate (S) at (2,3.5);\n\\draw[thick] (S)--(A) (S)--(B) (S)--(C) (A)--(C)--(B);\n\\draw[dashed] (A)--(B);\n\\node[above] at (S){$S$};\n\\node[left] at (A){$A$};\n\\node[right] at (B){$B$};\n\\node[below] at (C){$C$};\n\\end{tikzpicture}\n', display: '\\text{Hình chóp}' },
      { label: 'Biểu đồ cột', insert: '\n\\begin{tikzpicture}[scale=0.8]\n\\draw[->] (0,0) -- (4.5,0) node[right]{$x$};\n\\draw[->] (0,0) -- (0,3.5) node[above]{$y$};\n\\draw[fill=blue!40] (0.4,0) rectangle (1.1,2.5);\n\\draw[fill=green!40] (1.5,0) rectangle (2.2,1.8);\n\\draw[fill=orange!40] (2.6,0) rectangle (3.3,3);\n\\end{tikzpicture}\n', display: '\\text{Cột}' },
      { label: 'Trục số', insert: '\n\\begin{tikzpicture}\n\\draw[<->,thick] (-3,0) -- (3,0);\n\\foreach \\x in {-2,-1,0,1,2} \\draw (\\x,0.1) -- (\\x,-0.1) node[below]{$\\x$};\n\\end{tikzpicture}\n', display: '\\text{Trục số}' },
      { label: '\\includegraphics{URL}', insert: '\n\\begin{center}\n\\includegraphics{https://}\n\\end{center}\n', display: '\\text{Ảnh}' },
      { label: '\\includegraphics[80%]{URL}', insert: '\n\\begin{center}\n\\includegraphics[width=0.8\\linewidth]{https://}\n\\end{center}\n', display: '\\text{Ảnh 80\\%}' },
      { label: 'Căn giữa ảnh', insert: '\n\\begin{center}\n\\includegraphics{https://}\n\\end{center}\n', display: '\\text{Giữa ảnh}' },
      { label: '\\caption{...}', insert: '\n\\caption{Hình 1: Đồ thị minh họa}\n', display: '\\text{Chú thích}' },
      { label: 'Bảng dữ liệu', insert: '\n\\begin{tabular}{|c|c|}\n\\hline\nx & y \\\\\n\\hline\n0 & 1 \\\\\n\\hline\n\\end{tabular}\n', display: '\\text{Bảng}' },
      { label: '\\img{URL}', insert: '\n\\img{https://}\n', display: '\\text{\\img}' },
      { label: '![Ảnh](URL)', insert: '\n![Hình minh họa](https://)\n', display: '\\text{MD Ảnh}' },
    ],
  },
]

const SAMPLE_LATEX_EXAM = `\\documentclass{article}
\\usepackage[utf8]{vietnam}
\\usepackage{amsmath,amssymb}
\\begin{document}

\\title{ĐỀ ÔN TẬP TOÁN HỌC CHUẨN 2026}
\\author{SenExam KaTeX Compiler}
\\date{Thời gian: 50 phút}

% ========================================================
% PHẦN 1: CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN
% ========================================================
\\begin{ex}
Cho hàm số $y = f(x)$ có đạo hàm $f'(x) = (x - 1)^2(x + 2)$. Điểm cực tiểu của hàm số đã cho là:
\\choice
{\\True $x = -2$}
{$x = 1$}
{$x = 2$}
{$x = -1$}
\\loigiai{
Đạo hàm $f'(x)$ đổi dấu từ âm sang dương khi qua $x = -2$ (nghiệm bội lẻ) và không đổi dấu khi qua $x = 1$ (nghiệm bội chẵn). Do đó $x = -2$ là điểm cực tiểu của hàm số.
}
\\end{ex}

\\begin{ex}
Tập nghiệm của bất phương trình $\\log_2(x - 1) < 3$ là:
\\choice
{$(-\\infty; 9)$}
{\\True $(1; 9)$}
{$(9; +\\infty)$}
{$(0; 9)$}
\\loigiai{
Điều kiện: $x - 1 > 0 \\Leftrightarrow x > 1$.
Bất phương trình $\\Leftrightarrow x - 1 < 2^3 = 8 \\Leftrightarrow x < 9$. Kết hợp điều kiện ta có $S = (1; 9)$.
}
\\end{ex}

% ========================================================
% PHẦN 2: CÂU TRẮC NGHIỆM ĐÚNG / SAI (4 Ý a, b, c, d)
% ========================================================
\\begin{ex}
Cho hàm số $f(x) = x^3 - 3x + 2$. Xét tính Đúng/Sai của các mệnh đề sau:
\\choiceTF
{\\True a) Hàm số đã cho đồng biến trên khoảng $(1; +\\infty)$.}
{\\True b) Điểm cực đại của đồ thị hàm số là $M(-1; 4)$.}
{c) Giá trị nhỏ nhất của hàm số trên đoạn $[0; 2]$ bằng $2$.}
{\\True d) Đường thẳng $y = m$ cắt đồ thị tại 3 điểm phân biệt khi $0 < m < 4$.}
\\loigiai{
Ta có $f'(x) = 3x^2 - 3 = 0 \\Leftrightarrow x = \\pm 1$.
- Ý a ĐÚNG vì $f'(x) > 0$ trên $(1; +\\infty)$.
- Ý b ĐÚNG vì $f(-1) = 4$, $f'(-1) = 0$.
- Ý c SAI vì $f(1) = 0 \\le f(x)$ với mọi $x \\in [0; 2]$.
- Ý d ĐÚNG vì $y_{CT} = 0 < m < 4 = y_{CD}$.
}
\\end{ex}

% ========================================================
% PHẦN 3: CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN / ĐIỀN SỐ
% ========================================================
\\begin{ex}
Biết $\\int_0^1 (2x + 1)e^x dx = a \\cdot e + b$ với $a, b \\in \\mathbb{Z}$. Tính $T = a + b$.
\\shortans{2}
\\loigiai{
Tích phân từng phần: $u = 2x + 1, dv = e^x dx \\Rightarrow du = 2dx, v = e^x$.
$I = [(2x + 1)e^x]_0^1 - \\int_0^1 2e^x dx = (3e - 1) - (2e - 2) = e + 1$.
Do đó $a = 1, b = 1 \\Rightarrow T = a + b = 2$.
}
\\end{ex}

\\end{document}`

export function SetupCourseMainContent({
  embedded = false,
  isParentDark,
}: {
  embedded?: boolean
  isParentDark?: boolean
} = {}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<'admin' | 'collab' | 'teacher' | 'student'>('student')

  useEffect(() => {
    if (isParentDark !== undefined) {
      setIsDark(isParentDark)
    }
  }, [isParentDark])

  // Tabs: 'manage' (Quản lý đề) | 'create_katex' (Tạo đề KaTeX) | 'create_pdf' (Soạn đề PDF/SEB)
  const [activeTab, setActiveTab] = useState<'manage' | 'create_katex' | 'create_pdf'>('manage')

  // Danh sách đề thi
  const [examsList, setExamsList] = useState<any[]>([])
  const [examSearch, setExamSearch] = useState('')
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)
  const [managingExamStudents, setManagingExamStudents] = useState<any | null>(null)

  // ==========================================
  // STATE: TẠO ĐỀ KATEX TRỰC TIẾP
  // ==========================================
  const [katexTitle, setKatexTitle] = useState('')
  const [katexSubject, setKatexSubject] = useState('Toán học')
  const [katexExamType, setKatexExamType] = useState('THPTQG')
  const [katexDuration, setKatexDuration] = useState('50')
  const [katexMaxScore, setKatexMaxScore] = useState('10')
  const [katexAllowReview, setKatexAllowReview] = useState(true)
  const [katexIsHidden, setKatexIsHidden] = useState(false)
  const [katexIsVip, setKatexIsVip] = useState(false)
  const [katexShuffleQuestions, setKatexShuffleQuestions] = useState(false)
  const [katexShuffleOptions, setKatexShuffleOptions] = useState(false)

  // ==========================================
  // STATE: MODAL CÀI ĐẶT ĐỀ THI (NÚT SLIDERS CẠNH THÙNG RÁC)
  // ==========================================
  const [editingExamSettings, setEditingExamSettings] = useState<any | null>(null)
  const [settingsTitle, setSettingsTitle] = useState('')
  const [settingsSubject, setSettingsSubject] = useState('Toán học')
  const [settingsExamType, setSettingsExamType] = useState('THPTQG')
  const [settingsDuration, setSettingsDuration] = useState('50')
  const [settingsMaxScore, setSettingsMaxScore] = useState('10')
  const [settingsAllowReview, setSettingsAllowReview] = useState(true)
  const [settingsIsHidden, setSettingsIsHidden] = useState(false)
  const [settingsIsVip, setSettingsIsVip] = useState(false)
  const [settingsAccessCode, setSettingsAccessCode] = useState('')
  const [settingsRequireSeb, setSettingsRequireSeb] = useState(false)
  const [settingsRequireProctoring, setSettingsRequireProctoring] = useState(false)
  const [settingsShuffleQuestions, setSettingsShuffleQuestions] = useState(false)
  const [settingsShuffleOptions, setSettingsShuffleOptions] = useState(false)
  const [savingExamSettings, setSavingExamSettings] = useState(false)
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState('')
  const [katexQuestions, setKatexQuestions] = useState<KatexQuestion[]>([
    {
      id: 'q-1',
      type: 'single_choice',
      text: 'Cho hàm số $y = f(x)$ có đạo hàm $f\'(x) = (x-1)^2(x+2)$. Điểm cực tiểu của hàm số đã cho là:',
      options: [
        '$x = -2$',
        '$x = 1$',
        '$x = 2$',
        '$x = -1$',
      ],
      correctAnswer: 'A',
      explanation: 'Ta có bảng biến thiên: đạo hàm $f\'(x)$ đổi dấu từ âm sang dương khi qua $x = -2$ (nghiệm bội lẻ) và không đổi dấu khi qua $x = 1$ (nghiệm bội chẵn). Do đó $x = -2$ là điểm cực tiểu của hàm số.',
      points: 1,
    },
  ])

  // Focus tracking cho Bàn phím ảo toán học
  const [focusedField, setFocusedField] = useState<{
    qIdx: number
    field: 'text' | 'explanation' | 'option'
    optIdx?: number
  } | null>(null)
  const [activeKeyboardTab, setActiveKeyboardTab] = useState('basic')
  const [savingKatexExam, setSavingKatexExam] = useState(false)

  // AI Generator Modal State (Gemini Đa tầng)
  const [showAiModal, setShowAiModal] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('Khảo sát hàm số, cực trị và tiệm cận đồ thị hàm số Toán 12 chương 1')
  const [aiQuestionCount, setAiQuestionCount] = useState(5)
  const [aiDifficulty, setAiDifficulty] = useState('Vận dụng')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiModelUsed, setAiModelUsed] = useState<string | null>(null)
  const [aiStatusMessage, setAiStatusMessage] = useState('')

  // LaTeX Import & Parser State
  const [showLatexHelpModal, setShowLatexHelpModal] = useState(false)
  const [latexInputMode, setLatexInputMode] = useState<'file' | 'code'>('file')
  const [latexFile, setLatexFile] = useState<File | null>(null)
  const [latexCode, setLatexCode] = useState('')
  const [latexHasAnswerFile, setLatexHasAnswerFile] = useState(false)
  const [latexAnswerType, setLatexAnswerType] = useState<'text' | 'file'>('text')
  const [latexAnswerFile, setLatexAnswerFile] = useState<File | null>(null)
  const [latexAnswerText, setLatexAnswerText] = useState('')
  const [parsingLatex, setParsingLatex] = useState(false)
  const [parseLatexStatus, setParseLatexStatus] = useState('')
  const [parseLatexSuccessMsg, setParseLatexSuccessMsg] = useState<string | null>(null)
  const [copiedLatexSample, setCopiedLatexSample] = useState(false)
  const [verifyingWithAi, setVerifyingWithAi] = useState(false)
  const [aiVerifyStatus, setAiVerifyStatus] = useState('')

    // ==========================================
  // STATE: SOẠN ĐỀ PDF & SEB (PRO MULTI-SECTION BUILDER TỪ NEW-ADMIN)
  // ==========================================
  const currentUserId = currentUser?.id || ''
  const [examTitle, setExamTitle] = useState('')
  const [examTypeVal, setExamTypeVal] = useState('THPTQG')
  const [examDuration, setExamDuration] = useState('50')
  const [examMaxScore, setExamMaxScore] = useState('10')
  const [examAllowReview, setExamAllowReview] = useState(true)
  const [examIsHidden, setExamIsHidden] = useState(false)
  const [examCustomCode, setExamCustomCode] = useState('')
  const [examBlock, setExamBlock] = useState('A00')
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(['Toán học'])
  const [maxAttempts, setMaxAttempts] = useState('1')
  const [gradingMethod, setGradingMethod] = useState('highest')
  const [requireProctoring, setRequireProctoring] = useState(false)
  const [examPdfFile, setExamPdfFile] = useState<File | null>(null)
  const [hasSeparateAnswerFile, setHasSeparateAnswerFile] = useState(false)
  const [answerPdfFile, setAnswerPdfFile] = useState<File | null>(null)
  const [creatingExam, setCreatingExam] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState('')
  const [folders, setFolders] = useState<any[]>([])
  const [requireSeb, setRequireSeb] = useState(false)
  const [analyzingWithAi, setAnalyzingWithAi] = useState(false)
  const [examSections, setExamSections] = useState<SectionItem[]>([
    {
      id: 'sec-1',
      name: 'Phần 1: Câu trắc nghiệm nhiều phương án lựa chọn',
      totalPoints: 4.5,
      scoringMode: 'auto_divide',
      questionCount: 18,
      questionTypeMode: 'uniform',
      type: 'single_choice',
      instructions: 'Thí sinh chọn duy nhất một phương án trả lời đúng trong số 4 phương án A, B, C, D.',
      instructionImage: '',
      correctAnswers: {},
      pointsPerQuestion: {},
    },
    {
      id: 'sec-2',
      name: 'Phần 2: Câu trắc nghiệm Đúng / Sai (4 ý a, b, c, d)',
      totalPoints: 4.0,
      scoringMode: 'auto_divide',
      questionCount: 4,
      questionTypeMode: 'uniform',
      type: 'true_false',
      instructions: 'Trong mỗi câu có 4 ý a, b, c, d. Thí sinh chọn Đúng hoặc Sai cho từng ý. Điểm số tính lũy tiến theo số ý đúng.',
      instructionImage: '',
      correctAnswers: {},
      pointsPerQuestion: {},
    },
    {
      id: 'sec-3',
      name: 'Phần 3: Câu trắc nghiệm trả lời ngắn / Điền số',
      totalPoints: 1.5,
      scoringMode: 'auto_divide',
      questionCount: 6,
      questionTypeMode: 'uniform',
      type: 'short_answer',
      instructions: 'Thí sinh tính toán và nhập đáp số chính xác vào ô trống (dạng số thập phân hoặc số nguyên, ví dụ: 2.5 hoặc -4).',
      instructionImage: '',
      correctAnswers: {},
      pointsPerQuestion: {},
    },
  ])
  const [quickAnswersModalSecId, setQuickAnswersModalSecId] = useState<string | null>(null)
  const [quickAnswersText, setQuickAnswersText] = useState('')

  // Danh sách các Thư Mục Con để gán đề
  const allChildFolders = useMemo(() => {
    if (!Array.isArray(folders)) return []
    const list: any[] = []
    folders.forEach((parent: any) => {
      if (parent && Array.isArray(parent.children)) {
        parent.children.forEach((child: any) => {
          list.push({ ...child, parentName: parent.name || 'Thư mục' })
        })
      }
    })
    return list
  }, [folders])

  // Thống kê tổng điểm và tổng số câu của toàn đề
  const totalExamPoints = useMemo(() => {
    if (!Array.isArray(examSections)) return 0
    return examSections.reduce((acc, sec) => acc + (Number(sec?.totalPoints) || 0), 0)
  }, [examSections])

  const totalQuestionCount = useMemo(() => {
    if (!Array.isArray(examSections)) return 0
    return examSections.reduce((acc, sec) => acc + (parseInt(String(sec?.questionCount)) || 0), 0)
  }, [examSections])

  const themeVars = useMemo(() => getModernThemeVars('emerald', isDark), [isDark])

  // Kiểm tra quyền và tải danh sách đề
  useEffect(() => {
    let isMounted = true

    const dark =
      typeof window !== 'undefined' &&
      (document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark')
    if (dark && typeof document !== 'undefined') document.documentElement.classList.add('dark')
    setIsDark(Boolean(dark))

    const initPage = async () => {
      try {
        const { data: sessionRes } = await supabase.auth.getSession()
        let user = sessionRes?.session?.user || null
        if (!user) {
          try {
            const { data: authData } = await supabase.auth.getUser()
            user = authData?.user || null
          } catch {}
        }
        if (!isMounted) return

        if (!user) {
          router.replace('/new-idp')
          return
        }

        setCurrentUser(user)

        try {
          await ensureStudentProfile(user.id)
        } catch (e) {
          console.warn('ensureStudentProfile warning:', e)
        }
        if (!isMounted) return

        // Kiểm tra role người dùng an toàn (tránh văng lỗi single())
        let role: 'admin' | 'collab' | 'teacher' | 'student' = 'student'
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle()
          if (profile?.role) {
            role = profile.role as 'admin' | 'collab' | 'teacher' | 'student'
          }
        } catch (e) {
          console.warn('Lỗi lấy role profile:', e)
        }
        if (!isMounted) return
        setUserRole(role)

        // Tải danh sách đề thi:
        // - Admin/Colab/Teacher: tải toàn bộ đề thi trong hệ thống
        // - Student: chỉ tải các đề thi do chính sinh viên đó tạo ra (created_by === user.id)
        let query = supabase.from('exams').select('*').order('created_at', { ascending: false })
        if (role === 'student') {
          query = query.eq('created_by', user.id)
        }

        try {
          const { data: exData, error: exErr } = await query
          if (isMounted) {
            if (!exErr && Array.isArray(exData)) {
              setExamsList(exData)
            } else {
              setExamsList([])
            }
          }
        } catch (e) {
          if (isMounted) setExamsList([])
        }
        if (!isMounted) return

        // Tải danh sách thư mục SEB
        try {
          const fRes = await fetch('/api/seb/folders')
          if (fRes.ok) {
            const fData = await fRes.json()
            if (isMounted && fData?.folders && Array.isArray(fData.folders)) {
              setFolders(fData.folders)
            }
          }
        } catch (e) {
          console.warn('Lỗi tải folders:', e)
        }
      } catch (err: any) {
        if (err?.name === 'AbortError' || String(err).includes('aborted')) return
        console.error('Lỗi khởi tạo Setup Course:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initPage()

    return () => {
      isMounted = false
    }
  }, [router])

  // Lọc đề thi hiển thị an toàn
  const filteredExams = useMemo(() => {
    if (!Array.isArray(examsList)) return []
    const q = examSearch.trim().toLowerCase()
    if (!q) return examsList
    return examsList.filter((e) => {
      if (!e) return false
      const titleMatch = e.title ? String(e.title).toLowerCase().includes(q) : false
      const typeMatch = e.exam_type ? String(e.exam_type).toLowerCase().includes(q) : false
      const codeMatch = e.access_code ? String(e.access_code).toLowerCase().includes(q) : false
      return titleMatch || typeMatch || codeMatch
    })
  }, [examsList, examSearch])

  // Toggle Dark Mode
  const toggleDarkMode = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  // ==========================================
  // XỬ LÝ CHÈN KÝ HIỆU TỪ BÀN PHÍM ẢO TOÁN HỌC
  // ==========================================
  const handleInsertMathKey = (insertText: string) => {
    if (!focusedField) {
      alert('Vui lòng nhấp vào ô văn bản (Nội dung câu hỏi, Phương án, hoặc Lời giải) trước khi bấm phím toán học!')
      return
    }

    setKatexQuestions((prev) => {
      const next = [...prev]
      const targetQ = { ...next[focusedField.qIdx] }

      if (focusedField.field === 'text') {
        targetQ.text = (targetQ.text || '') + (targetQ.text?.endsWith('$') ? insertText : ` $${insertText}$ `)
      } else if (focusedField.field === 'explanation') {
        targetQ.explanation = (targetQ.explanation || '') + (targetQ.explanation?.endsWith('$') ? insertText : ` $${insertText}$ `)
      } else if (focusedField.field === 'option' && focusedField.optIdx !== undefined) {
        const nextOpts = [...targetQ.options]
        const currentOpt = nextOpts[focusedField.optIdx] || ''
        nextOpts[focusedField.optIdx] = currentOpt + (currentOpt.endsWith('$') ? insertText : ` $${insertText}$ `)
        targetQ.options = nextOpts
      }

      next[focusedField.qIdx] = targetQ
      return next
    })
  }

  // ==========================================
  // XỬ LÝ SOẠN ĐỀ BẰNG AI GEMINI ĐA TẦNG
  // ==========================================
  const handleGenerateAiKatexExam = async () => {
    if (!aiPrompt.trim()) {
      alert('Vui lòng nhập chủ đề hoặc nội dung cần AI soạn đề!')
      return
    }

    setAiLoading(true)
    setAiStatusMessage('Đang kết nối Gemini AI (Ưu tiên gemini-3.8-flash)...')

    try {
      const res = await fetch('/api/generate-katex-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          subject: katexSubject,
          grade: 'Lớp 12',
          questionCount: aiQuestionCount,
          difficulty: aiDifficulty,
          questionType: 'single_choice',
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Lỗi xử lý từ hệ thống AI.')
      }

      const generated = json.data
      setAiModelUsed(json.usedModel)

      if (generated.title) {
        setKatexTitle(generated.title)
      }
      if (generated.duration) {
        setKatexDuration(String(generated.duration))
      }

      if (Array.isArray(generated.questions) && generated.questions.length > 0) {
        const formattedQuestions: KatexQuestion[] = generated.questions.map((q: any, idx: number) => ({
          id: `q-${Date.now()}-${idx}`,
          type: q.type || 'single_choice',
          text: q.text || `Câu hỏi ${idx + 1}`,
          options: Array.isArray(q.options) ? q.options : ['A. Phương án 1', 'B. Phương án 2', 'C. Phương án 3', 'D. Phương án 4'],
          correctAnswer: q.correctAnswer || 'A',
          explanation: q.explanation || 'Lời giải chi tiết đang được cập nhật.',
          points: 1,
        }))

        setKatexQuestions(formattedQuestions)
        setShowAiModal(false)
        alert(
          `🎉 AI đã soạn thành công ${formattedQuestions.length} câu hỏi KaTeX chuẩn xác!\n(Mô hình sử dụng: ${json.usedModel || 'Gemini'})`
        )
      }
    } catch (err: any) {
      console.error('Lỗi AI soạn đề KaTeX:', err)
      alert(err.message || 'Không thể kết nối đến Gemini. Vui lòng thử lại!')
    } finally {
      setAiLoading(false)
      setAiStatusMessage('')
    }
  }

  // ==========================================
  // XỬ LÝ BIÊN SOẠN ĐỀ LATEX TỰ ĐỘNG (DETERMINISTIC ENGINE + AI THẨM ĐỊNH)
  // ==========================================
  const handleCompileLatexExam = async () => {
    let code = latexCode.trim()
    if (!code && latexFile) {
      try {
        code = await latexFile.text()
        setLatexCode(code)
      } catch (err: any) {
        alert('Không thể đọc file LaTeX: ' + (err?.message || 'Lỗi đọc file'))
        return
      }
    }

    if (!code) {
      alert('Vui lòng chọn file LaTeX (.tex, .txt) hoặc dán mã nguồn LaTeX vào khung soạn thảo!')
      return
    }

    if (latexHasAnswerFile && !latexAnswerText.trim() && !latexAnswerFile) {
      const confirmNoAnswer = window.confirm(
        'Bạn đang chọn chế độ "Đã có file/bảng đáp án riêng" nhưng chưa chọn file hoặc nhập đáp án.\n\nBấm OK để chuyển sang chế độ "Chưa có file đáp án (AI tự giải)", hoặc bấm Cancel để bổ sung đáp án.'
      )
      if (confirmNoAnswer) {
        setLatexHasAnswerFile(false)
      } else {
        return
      }
    }

    setParsingLatex(true)
    setParseLatexStatus('⚡ Hệ thống đang tự động bóc tách cấu trúc câu hỏi KaTeX siêu tốc...')
    setParseLatexSuccessMsg(null)

    try {
      // Đọc bảng đáp án text nếu có
      let answerKeyStr = latexHasAnswerFile ? latexAnswerText.trim() : ''
      if (latexHasAnswerFile && !answerKeyStr && latexAnswerFile) {
        if (
          latexAnswerFile.type?.includes('text') ||
          latexAnswerFile.name?.endsWith('.txt') ||
          latexAnswerFile.name?.endsWith('.tex')
        ) {
          answerKeyStr = await latexAnswerFile.text()
        }
      }

      // BƯỚC 1: BIÊN SOẠN THUẦN SIÊU TỐC TRÊN CLIENT (< 20ms, KHÔNG GIỚI HẠN DUNG LƯỢNG FILE)
      const localParsed = parseLatexExamCode(code, answerKeyStr)

      if (localParsed.questions && localParsed.questions.length > 0) {
        if (localParsed.title) setKatexTitle(localParsed.title)
        if (localParsed.subject) setKatexSubject(localParsed.subject)
        if (localParsed.duration) setKatexDuration(String(localParsed.duration))
        if (localParsed.exam_type) setKatexExamType(localParsed.exam_type)

        // Cập nhật ngay câu hỏi lên màn hình để người dùng không phải chờ đợi!
        setKatexQuestions(localParsed.questions)

        // BƯỚC 2: NẾU THIẾU ĐÁP ÁN VÀ NGƯỜI DÙNG CHỌN "AI TỰ GIẢI", GỌI AI GIẢI CÁC CÂU CÒN THIẾU
        if (!latexHasAnswerFile && localParsed.missingAnswersCount > 0) {
          setParseLatexStatus(
            `Đã nhận diện ${localParsed.questions.length} câu (${localParsed.parseTimeMs}ms). Đang giao AI giải & hoàn thiện ${localParsed.missingAnswersCount} câu chưa có đáp án...`
          )

          try {
            const aiRes = await fetch('/api/parse-latex-exam', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'ai_verify_answers',
                questions: localParsed.questions.filter((q) => !q.hasAnswerInLatex),
                subject: localParsed.subject || katexSubject,
              }),
            })

            const aiJson = await aiRes.json()
            if (aiJson.success && Array.isArray(aiJson.questions)) {
              const aiMap = new Map<string, any>(aiJson.questions.map((q: any) => [q.id, q]))
              const enrichedQuestions = localParsed.questions.map((q) => {
                const updated = aiMap.get(q.id)
                return updated || q
              })
              setKatexQuestions(enrichedQuestions)
              setParseLatexSuccessMsg(
                `⚡ Hệ thống nhận diện ${localParsed.questions.length} câu (${localParsed.parseTimeMs}ms)! AI đã thẩm định & giải thành công ${aiJson.verifiedCount || 0} câu.`
              )
            } else {
              setParseLatexSuccessMsg(
                `⚡ Hệ thống nhận diện thành công ${localParsed.questions.length} câu hỏi KaTeX (${localParsed.parseTimeMs}ms)! Bạn có thể chỉnh sửa đáp án trực tiếp.`
              )
            }
          } catch (aiErr) {
            console.warn('AI giải bổ sung gặp sự cố nhỏ:', aiErr)
            setParseLatexSuccessMsg(
              `⚡ Hệ thống nhận diện thành công ${localParsed.questions.length} câu hỏi KaTeX (${localParsed.parseTimeMs}ms)! Toàn bộ công thức đã sẵn sàng.`
            )
          }
        } else {
          setParseLatexSuccessMsg(
            `🎉 Đã nhận diện siêu tốc ${localParsed.questions.length} câu hỏi KaTeX (${localParsed.parseTimeMs}ms)! Khớp ${localParsed.matchedAnswersCount}/${localParsed.questions.length} câu có đáp án chuẩn.`
          )
        }

        setTimeout(() => {
          const el = document.getElementById('katex-questions-section')
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 200)

        return
      }

      // BƯỚC 3: NẾU BỘ BÓC TÁCH KHÔNG TÌM THẤY DẤU HIỆU CÂU HỎI TIÊU CHUẨN, GỬI LÊN SERVER
      setParseLatexStatus('Đang gửi lên máy chủ để phân tích sâu...')
      const formData = new FormData()
      formData.append('action', 'parse')
      formData.append('latexCode', code)
      formData.append('subject', katexSubject)
      formData.append('hasSeparateAnswer', latexHasAnswerFile ? '1' : '0')

      if (latexHasAnswerFile) {
        if (answerKeyStr) formData.append('answerText', answerKeyStr)
        if (latexAnswerFile) formData.append('answerFile', latexAnswerFile)
      }

      const res = await fetch('/api/parse-latex-exam', {
        method: 'POST',
        body: formData,
      })

      const result = await res.json()
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Biên soạn đề LaTeX thất bại.')
      }

      const { data } = result
      if (data.title) setKatexTitle(data.title)
      if (data.subject) setKatexSubject(data.subject)
      if (data.duration) setKatexDuration(String(data.duration))
      if (data.exam_type) setKatexExamType(data.exam_type)

      if (Array.isArray(data.questions) && data.questions.length > 0) {
        setKatexQuestions(data.questions)
        setParseLatexSuccessMsg(
          `🎉 Đã nhận diện thành công ${data.questions.length} câu hỏi KaTeX từ mã nguồn!`
        )
        setTimeout(() => {
          const el = document.getElementById('katex-questions-section')
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 200)
      }
    } catch (err: any) {
      console.error('Lỗi biên soạn LaTeX:', err)
      alert(`Lỗi biên soạn LaTeX: ${err.message || 'Vui lòng kiểm tra lại file LaTeX.'}`)
    } finally {
      setParsingLatex(false)
      setParseLatexStatus('')
    }
  }

  // ==========================================
  // XỬ LÝ GIAO CHO AI KIỂM TRA & THẨM ĐỊNH LẠI ĐÁP ÁN
  // ==========================================
  const handleAiVerifyAllAnswers = async () => {
    if (!katexQuestions || katexQuestions.length === 0) {
      alert('Chưa có câu hỏi nào trong đề để AI kiểm tra đáp án!')
      return
    }

    setVerifyingWithAi(true)
    setAiVerifyStatus(`AI Gemini đang giải toán & thẩm định ${katexQuestions.length} câu hỏi...`)

    try {
      const res = await fetch('/api/parse-latex-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ai_verify_answers',
          questions: katexQuestions,
          subject: katexSubject,
        }),
      })

      const result = await res.json()
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'AI thẩm định đáp án thất bại.')
      }

      if (Array.isArray(result.questions) && result.questions.length > 0) {
        setKatexQuestions(result.questions)
        alert(
          `🎉 AI đã thẩm định & kiểm tra thành công ${result.verifiedCount || result.questions.length}/${result.totalCount || katexQuestions.length} câu hỏi!\nToàn bộ đáp án và lời giải KaTeX đã được hoàn thiện chuẩn xác.`
        )
      }
    } catch (err: any) {
      console.error('Lỗi AI thẩm định:', err)
      alert(`Lỗi AI kiểm tra đáp án: ${err.message || 'Vui lòng thử lại sau.'}`)
    } finally {
      setVerifyingWithAi(false)
      setAiVerifyStatus('')
    }
  }


  // ==========================================
  // XỬ LÝ LƯU ĐỀ THI KATEX VÀO SUPABASE
  // ==========================================
  const handleSaveKatexExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!katexTitle.trim()) {
      alert('Vui lòng nhập tên đề thi KaTeX!')
      return
    }

    if (katexQuestions.length === 0) {
      alert('Vui lòng thêm ít nhất 1 câu hỏi vào đề!')
      return
    }

    setSavingKatexExam(true)
    try {
      const isStudent = userRole === 'student'
      // 2 CHẾ ĐỘ NGẦM (STEALTH MODE):
      // - Admin/Colab/Teacher: is_hidden = false (Hiện trên toàn bộ hệ thống cho mọi học sinh xem)
      // - Student: is_hidden = true (Chỉ mình học sinh tạo đề đó thấy trong kho đề và phòng thi của mình)
      const isHiddenEffective = isStudent ? true : katexIsHidden

      const accessCode = isHiddenEffective
        ? Math.random().toString(36).substring(2, 8).toUpperCase()
        : null

      // Đóng gói cấu trúc Sections chuẩn để new-exams/[id] đọc mượt mà
      const parsedMaxScore = parseFloat(katexMaxScore) || 10
      const correctAnswersMap: Record<string, any> = {}
      katexQuestions.forEach((q, idx) => {
        correctAnswersMap[idx] = q.correctAnswer
      })

      const distinctTypes = Array.from(new Set(katexQuestions.map((q) => q.type)))
      const isMixed = distinctTypes.length > 1
      const defaultSecType = isMixed ? 'mixed' : (distinctTypes[0] || 'single_choice')

      const examSections: SectionItem[] = [
        {
          id: 'sec-katex-main',
          name: 'Phần thi KaTeX trực tiếp',
          totalPoints: parsedMaxScore,
          scoringMode: 'auto_divide',
          questionCount: katexQuestions.length,
          questionTypeMode: isMixed ? 'mixed' : 'uniform',
          type: defaultSecType as any,
          format: 'katex',
          is_katex: true,
          is_vip: katexIsVip,
          shuffle_questions: katexShuffleQuestions,
          shuffle_options: katexShuffleOptions,
          instructions: 'Đề thi được soạn trực tiếp bằng KaTeX sắc nét, không dùng file PDF.',
          correctAnswers: correctAnswersMap,
          // Đính kèm danh sách câu hỏi KaTeX chi tiết
          questions: katexQuestions as any,
        } as any,
      ]

      const basePayload: any = {
        title: katexTitle.trim(),
        exam_type: katexExamType,
        duration: parseInt(katexDuration) || 50,
        drive_file_id: null,
        format: 'katex',
        is_vip: katexIsVip,
        shuffle_questions: katexShuffleQuestions,
        shuffle_options: katexShuffleOptions,
        exam_structure: examSections,
        allow_review: katexAllowReview,
        is_hidden: isHiddenEffective,
        access_code: accessCode,
        subjects: [katexSubject],
        max_attempts: 1,
        grading_method: 'highest',
        require_proctoring: false,
        require_seb: false,
        created_by: currentUser?.id,
      }

      // Hàm chuẩn hóa an toàn exam_type phòng trường hợp DB có check constraint cũ (chỉ cho phép THPTQG, HSA, TSA, SPT)
      const getSafeExamType = (val: string) => {
        const upper = (val || '').toUpperCase().trim()
        if (upper.includes('HSA')) return 'HSA'
        if (upper.includes('TSA')) return 'TSA'
        if (upper.includes('SPT')) return 'SPT'
        if (upper.includes('THPT')) return 'THPTQG'
        return 'THPTQG'
      }

      // Thử lưu với max_score, nếu bảng exams chưa có cột max_score hoặc vướng check constraint exam_type
      let data: any = null
      let { data: firstData, error: firstError } = await supabase
        .from('exams')
        .insert({ ...basePayload, max_score: parsedMaxScore })
        .select('*')
        .single()

      // Nếu lỗi do ràng buộc exams_exam_type_check
      if (firstError && firstError.message?.includes('exams_exam_type_check')) {
        const safeType = getSafeExamType(katexExamType)
        const retryRes = await supabase
          .from('exams')
          .insert({ ...basePayload, exam_type: safeType, max_score: parsedMaxScore })
          .select('*')
          .single()
        firstData = retryRes.data
        firstError = retryRes.error
      }

      if (firstError) {
        console.warn('Lỗi lưu đề có max_score / shuffle / is_vip columns, thử fallback lưu cơ bản:', firstError.message)
        const safePayload = { ...basePayload }
        if (firstError.message?.includes('shuffle_questions') || firstError.message?.includes('shuffle_options')) {
          delete safePayload.shuffle_questions
          delete safePayload.shuffle_options
        }
        if (firstError.message?.includes('is_vip')) {
          delete safePayload.is_vip
        }

        let { data: fallbackData, error: fallbackError } = await supabase
          .from('exams')
          .insert(safePayload)
          .select('*')
          .single()

        if (fallbackError && fallbackError.message?.includes('exams_exam_type_check')) {
          const safeType = getSafeExamType(katexExamType)
          const retryRes2 = await supabase
            .from('exams')
            .insert({ ...safePayload, exam_type: safeType })
            .select('*')
            .single()
          fallbackData = retryRes2.data
          fallbackError = retryRes2.error
        }

        if (fallbackError && (fallbackError.message?.includes('shuffle_questions') || fallbackError.message?.includes('shuffle_options'))) {
          delete safePayload.shuffle_questions
          delete safePayload.shuffle_options
          const retryRes3 = await supabase
            .from('exams')
            .insert(safePayload)
            .select('*')
            .single()
          fallbackData = retryRes3.data
          fallbackError = retryRes3.error
        }

        if (fallbackError) throw fallbackError
        data = fallbackData
      } else {
        data = firstData
      }



      setExamsList([data, ...examsList])
      setActiveTab('manage')
      alert(
        isStudent
          ? `🎉 Đã tạo đề thi KaTeX cá nhân thành công!\n(Đề được lưu riêng cho tài khoản của bạn tại mục Quản lý đề và Kho đề)`
          : `🎉 Xuất bản đề thi KaTeX toàn hệ thống thành công!\n(Tất cả học sinh có thể truy cập vào thi tại Kho đề mới)`
      )
    } catch (err: any) {
      console.error('Lỗi lưu đề KaTeX:', err)
      alert('Lỗi lưu đề thi: ' + (err.message || 'Vui lòng thử lại.'))
    } finally {
      setSavingKatexExam(false)
    }
  }

  const handleLoadPresetTHPT2026 = () => {
    setExamSections([
      {
        id: 'sec_1',
        name: 'Phần I: Câu trắc nghiệm nhiều phương án lựa chọn (A, B, C, D)',
        totalPoints: 4.5,
        scoringMode: 'auto_divide',
        questionCount: 18,
        questionTypeMode: 'uniform',
        type: 'single_choice',
        instructions: 'Thí sinh chọn duy nhất một phương án trả lời đúng trong số 4 phương án A, B, C, D.',
        instructionImage: '',
        correctAnswers: {},
        pointsPerQuestion: {},
      },
      {
        id: 'sec_2',
        name: 'Phần II: Câu trắc nghiệm Đúng / Sai (Mỗi câu gồm 4 ý a, b, c, d)',
        totalPoints: 4.0,
        scoringMode: 'auto_divide',
        questionCount: 4,
        questionTypeMode: 'uniform',
        type: 'true_false',
        instructions: 'Trong mỗi câu có 4 ý a, b, c, d. Thí sinh chọn Đúng hoặc Sai cho từng ý. Điểm số tính lũy tiến theo số ý đúng.',
        instructionImage: '',
        correctAnswers: {},
        pointsPerQuestion: {},
      },
      {
        id: 'sec_3',
        name: 'Phần III: Câu trắc nghiệm Trả lời ngắn / Điền số',
        totalPoints: 1.5,
        scoringMode: 'auto_divide',
        questionCount: 6,
        questionTypeMode: 'uniform',
        type: 'short_answer',
        instructions: 'Thí sinh tính toán và nhập đáp số chính xác vào ô trống (dạng số thập phân hoặc số nguyên, ví dụ: 2.5 hoặc -4).',
        instructionImage: '',
        correctAnswers: {},
        pointsPerQuestion: {},
      },
    ])
  }

  const handleLoadPresetHSA = () => {
    setExamSections([
      {
        id: 'sec_1',
        name: 'Phần I: Định lượng & Toán học',
        totalPoints: 7.0,
        scoringMode: 'auto_divide',
        questionCount: 35,
        questionTypeMode: 'uniform',
        type: 'single_choice',
        instructions: 'Thí sinh chọn 1 phương án đúng.',
        instructionImage: '',
        correctAnswers: {},
        pointsPerQuestion: {},
      },
      {
        id: 'sec_2',
        name: 'Phần II: Điền đáp án ngắn',
        totalPoints: 3.0,
        scoringMode: 'auto_divide',
        questionCount: 15,
        questionTypeMode: 'uniform',
        type: 'short_answer',
        instructions: 'Thí sinh nhập đáp số tính toán.',
        instructionImage: '',
        correctAnswers: {},
        pointsPerQuestion: {},
      },
    ])
  }

  // Thêm một phần thi mới
  const handleAddSection = () => {
    const newIdx = examSections.length + 1
    const newSec: SectionItem = {
      id: `sec-${Date.now()}`,
      name: `Phần ${newIdx}: Phần thi mới`,
      totalPoints: 2.0,
      scoringMode: 'auto_divide',
      questionCount: 5,
      questionTypeMode: 'uniform',
      type: 'single_choice',
      instructions: 'Thí sinh đọc kỹ đề bài và chọn đáp án chính xác.',
      instructionImage: '',
      correctAnswers: {},
      pointsPerQuestion: {},
    }
    setExamSections((prev) => [...prev, newSec])
  }

  // Xóa một phần thi
  const handleRemoveSection = (secIdx: number) => {
    if (examSections.length <= 1) {
      alert('Đề thi phải có ít nhất 1 phần thi!')
      return
    }
    if (!confirm(`Bạn có chắc muốn xóa "${examSections[secIdx].name}"?`)) return
    setExamSections((prev) => prev.filter((_, idx) => idx !== secIdx))
  }

  // Cập nhật thông tin chung của phần thi
  const handleUpdateSectionField = (secIdx: number, field: keyof SectionItem, value: any) => {
    setExamSections((prev) => {
      const next = [...prev]
      next[secIdx] = { ...next[secIdx], [field]: value }
      return next
    })
  }

  // Cập nhật điểm tùy chỉnh cho từng câu
  const handleSetQuestionPoint = (secIdx: number, qIdx: number, points: number) => {
    setExamSections((prev) => {
      const next = [...prev]
      const sec = { ...next[secIdx] }
      sec.pointsPerQuestion = { ...sec.pointsPerQuestion, [qIdx]: points }
      next[secIdx] = sec
      return next
    })
  }

  // Cập nhật thể loại câu hỏi khi ở chế độ tùy ý từng câu
  const handleSetQuestionType = (secIdx: number, qIdx: number, type: any) => {
    setExamSections((prev) => {
      const next = [...prev]
      const sec = { ...next[secIdx] }
      sec.questionTypes = { ...sec.questionTypes, [qIdx]: type }
      next[secIdx] = sec
      return next
    })
  }

  // Thêm một dải câu hỏi mới cho phần thi hỗn hợp
  const handleAddMixedRange = (secIdx: number) => {
    setExamSections((prev) => {
      const next = [...prev]
      const sec = { ...next[secIdx] }
      const ranges = sec.mixedRanges ? [...sec.mixedRanges] : []
      const lastEnd = ranges.length > 0 ? ranges[ranges.length - 1].end : 0
      const totalQ = sec.questionCount || 10
      const start = lastEnd + 1 <= totalQ ? lastEnd + 1 : totalQ
      const end = Math.min(totalQ, start + 4)
      ranges.push({
        start,
        end,
        type: 'single_choice',
        optionsCount: 4,
      })
      sec.mixedRanges = ranges
      next[secIdx] = sec
      return next
    })
  }

  // Cập nhật một dải câu hỏi trong phần thi hỗn hợp
  const handleUpdateMixedRange = (secIdx: number, rIdx: number, field: string, value: any) => {
    setExamSections((prev) => {
      const next = [...prev]
      const sec = { ...next[secIdx] }
      if (!sec.mixedRanges) return prev
      const ranges = [...sec.mixedRanges]
      ranges[rIdx] = { ...ranges[rIdx], [field]: value }
      sec.mixedRanges = ranges
      next[secIdx] = sec
      return next
    })
  }

  // Xóa một dải câu hỏi trong phần thi hỗn hợp
  const handleRemoveMixedRange = (secIdx: number, rIdx: number) => {
    setExamSections((prev) => {
      const next = [...prev]
      const sec = { ...next[secIdx] }
      if (!sec.mixedRanges) return prev
      const ranges = sec.mixedRanges.filter((_, idx) => idx !== rIdx)
      sec.mixedRanges = ranges
      next[secIdx] = sec
      return next
    })
  }

  // Áp dụng nhanh cấu trúc mẫu cho phần thi hỗn hợp
  const handleApplyMixedPreset = (secIdx: number, preset: 'thptqg' | 'hsa' | 'tsa') => {
    setExamSections((prev) => {
      const next = [...prev]
      const sec = { ...next[secIdx] }
      if (preset === 'thptqg') {
        sec.questionCount = 28
        sec.totalPoints = 10
        sec.mixedRanges = [
          { start: 1, end: 18, type: 'single_choice', optionsCount: 4 },
          { start: 19, end: 22, type: 'true_false', optionsCount: 4 },
          { start: 23, end: 28, type: 'short_answer', optionsCount: 4 },
        ]
      } else if (preset === 'hsa') {
        sec.questionCount = 50
        sec.totalPoints = 50
        sec.mixedRanges = [
          { start: 1, end: 40, type: 'single_choice', optionsCount: 4 },
          { start: 41, end: 50, type: 'short_answer', optionsCount: 4 },
        ]
      } else if (preset === 'tsa') {
        sec.questionCount = 40
        sec.totalPoints = 40
        sec.mixedRanges = [
          { start: 1, end: 30, type: 'single_choice', optionsCount: 4 },
          { start: 31, end: 36, type: 'true_false', optionsCount: 4 },
          { start: 37, end: 40, type: 'short_answer', optionsCount: 4 },
        ]
      }
      next[secIdx] = sec
      return next
    })
  }

  // Xử lý upload ảnh hướng dẫn làm bài cho phần thi
  const handleUploadInstructionImage = (secIdx: number, file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      handleUpdateSectionField(secIdx, 'instructionImage', dataUrl)
    }
    reader.readAsDataURL(file)
  }

  // Helper chuyển file sang Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (error) => reject(error)
    })
  }

  // Trích xuất toàn bộ văn bản từ file PDF trên client bằng pdfjs-dist
  const extractTextFromPdf = async (file: File): Promise<string> => {
    try {
      const pdfjsLib = await import('pdfjs-dist')
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
      }

      const fileToArrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: fileToArrayBuffer }).promise

      let fullTextContent = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map((item: any) => ('str' in item ? item.str : ''))
          .join(' ')
        fullTextContent += `\n[--- TRANG ${i} ---]\n` + pageText
      }

      return fullTextContent.trim()
    } catch (err: any) {
      console.warn('Không thể trích xuất văn bản từ PDF qua pdfjs:', err)
      return ''
    }
  }

  // Kích hoạt Gemini phân tích file PDF & đối chiếu đáp án nếu có
  const handleAiAnalyze = async (fileToAnalyze?: File, answerFileToAnalyze?: File | null) => {
    const targetFile = fileToAnalyze || examPdfFile
    const targetAnswerFile = answerFileToAnalyze !== undefined ? answerFileToAnalyze : answerPdfFile

    if (!targetFile) {
      alert('Vui lòng chọn hoặc kéo thả file PDF đề thi!')
      return
    }

    if (hasSeparateAnswerFile && !targetAnswerFile) {
      alert('Bạn đã chọn chế độ "Đã có file đáp án riêng", vui lòng tải lên file đáp án (PDF hoặc ảnh) ở cột bên phải!')
      return
    }

    setAnalyzingWithAi(true)
    setAiStatusMessage('Đang quét và bóc tách nội dung văn bản từ file PDF đề thi...')

    try {
      // 1. Thử trích xuất văn bản đề thi trên client bằng PDF.js
      const extractedExamText = await extractTextFromPdf(targetFile)

      // 2. Thử trích xuất văn bản file đáp án nếu có
      let extractedAnswerText = ''
      let answerFileBase64 = ''
      let answerMimeType = ''

      if (targetAnswerFile) {
        setAiStatusMessage('Đang đọc và xử lý file đáp án...')
        if (targetAnswerFile.type.includes('pdf') || targetAnswerFile.name.toLowerCase().endsWith('.pdf')) {
          extractedAnswerText = await extractTextFromPdf(targetAnswerFile)
        } else {
          answerFileBase64 = await fileToBase64(targetAnswerFile)
          answerMimeType = targetAnswerFile.type || 'image/jpeg'
        }
      }

      let res: Response

      const canSendJson =
        extractedExamText && extractedExamText.length > 50 &&
        (!targetAnswerFile || extractedAnswerText.length > 10 || answerFileBase64)

      if (canSendJson) {
        setAiStatusMessage(
          targetAnswerFile
            ? 'Đã bóc tách dữ liệu! AI đang phân tích cấu trúc đề và đối chiếu bảng đáp án chính thức...'
            : 'Đã trích xuất xong đề thi! AI đang phân tích các phần thi và giải ma trận đáp án...'
        )
        res = await fetch('/api/seb/ai-analyze-exam', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            examText: extractedExamText,
            answerText: extractedAnswerText,
            answerFileBase64: answerFileBase64 || undefined,
            answerMimeType: answerMimeType || undefined,
            hasSeparateAnswer: Boolean(targetAnswerFile),
          }),
        })
      } else {
        setAiStatusMessage('Đang tải các file lên và gửi tới AI để nhận diện nội dung...')
        const formData = new FormData()
        if (extractedExamText && extractedExamText.length > 50) {
          formData.append('examText', extractedExamText)
        } else {
          formData.append('file', targetFile)
        }

        if (targetAnswerFile) {
          if (extractedAnswerText && extractedAnswerText.length > 10) {
            formData.append('answerText', extractedAnswerText)
          } else {
            formData.append('answerFile', targetAnswerFile)
          }
        }
        formData.append('hasSeparateAnswer', targetAnswerFile ? '1' : '0')

        res = await fetch('/api/seb/ai-analyze-exam', {
          method: 'POST',
          body: formData,
        })
      }

      const resText = await res.text()
      let json: any = null
      try {
        json = JSON.parse(resText)
      } catch {
        if (res.status === 413) {
          throw new Error('Dung lượng file đề thi vượt quá giới hạn máy chủ (413 Payload Too Large). Vui lòng thử nén file hoặc dùng file PDF có lớp văn bản.')
        }
        if (res.status === 504 || res.status === 502) {
          throw new Error('Quá thời gian phản hồi từ máy chủ (Gateway Timeout). Vui lòng thử lại.')
        }
        throw new Error(`Máy chủ trả về phản hồi không hợp lệ (${res.status}): ${resText.slice(0, 100)}...`)
      }

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Không thể phân tích đề thi bằng AI.')
      }

      const data = json.data
      if (data.title) {
        setExamTitle(data.title)
      }
      if (data.duration) {
        setExamDuration(String(data.duration))
      }
      if (data.exam_type) {
        setExamTypeVal(data.exam_type)
      }

      if (Array.isArray(data.sections) && data.sections.length > 0) {
        const mappedSections: SectionItem[] = data.sections.map((s: any, idx: number) => ({
          id: s.id || `sec-${Date.now()}-${idx}`,
          name: s.name || `Phần ${idx + 1}`,
          totalPoints: Number(s.totalPoints) || 0,
          scoringMode: s.scoringMode || 'auto_divide',
          pointsPerQuestion: s.pointsPerQuestion || {},
          questionCount: parseInt(s.questionCount) || 1,
          questionTypeMode: s.questionTypeMode || 'uniform',
          type: normalizeQuestionType(s.type, s, idx),
          questionTypes: s.questionTypes || {},
          instructions: s.instructions || '',
          instructionImage: s.instructionImage || '',
          correctAnswers: s.correctAnswers || {},
        }))

        setExamSections(mappedSections)
        alert(
          targetAnswerFile
            ? `🎉 Phân tích đề và đối chiếu đáp án thành công!\nĐã nhận diện ${mappedSections.length} phần thi và nạp chuẩn xác 100% bảng đáp án từ tài liệu bạn cung cấp.`
            : `🎉 Phân tích file PDF thành công bằng Gemini!\nĐã nhận diện ${mappedSections.length} phần thi và tự động giải sẵn bảng đáp án. Bạn có thể kiểm tra lại thông tin và bảng đáp án bên dưới.`
        )
      }
    } catch (err: any) {
      console.error('Lỗi phân tích AI:', err)
      alert('Lỗi phân tích file đề thi: ' + (err.message || 'Vui lòng kiểm tra lại file.'))
    } finally {
      setAnalyzingWithAi(false)
      setAiStatusMessage('')
    }
  }

  // Cập nhật câu trả lời đúng cho một câu hỏi
  const handleSetCorrectAnswer = (secIdx: number, qIdx: number, value: any) => {
    setExamSections((prev) => {
      const next = [...prev]
      const targetSec = { ...next[secIdx] }
      targetSec.correctAnswers = { ...targetSec.correctAnswers, [qIdx]: value }
      next[secIdx] = targetSec
      return next
    })
  }

  // Cập nhật câu trả lời Đúng/Sai 4 ý
  const handleSetCorrectAnswerTF = (secIdx: number, qIdx: number, subLabel: string, val: string) => {
    setExamSections((prev) => {
      const next = [...prev]
      const targetSec = { ...next[secIdx] }
      const currentQ = { ...(targetSec.correctAnswers?.[qIdx] || {}) }
      currentQ[subLabel] = val
      targetSec.correctAnswers = { ...targetSec.correctAnswers, [qIdx]: currentQ }
      next[secIdx] = targetSec
      return next
    })
  }

  const handleApplyQuickAnswers = (sectionId: string, text: string) => {
    const secIdx = examSections.findIndex((s) => s.id === sectionId)
    if (secIdx === -1) return
    const sec = examSections[secIdx]

    const answers: Record<number, any> = { ...(sec.correctAnswers || {}) }

    if (sec.type === 'single_choice') {
      const matches = Array.from(text.matchAll(/(\d+)[\s.:)]*([A-D])/gi))
      if (matches.length > 0) {
        matches.forEach((m) => {
          const qNum = parseInt(m[1]) - 1
          if (qNum >= 0 && qNum < sec.questionCount) {
            answers[qNum] = m[2].toUpperCase()
          }
        })
      } else {
        const letters = text.replace(/[^a-dA-D]/g, '').toUpperCase().split('')
        letters.forEach((l, idx) => {
          if (idx < sec.questionCount) answers[idx] = l
        })
      }
    } else if (sec.type === 'true_false') {
      const lines = text.split('\n')
      lines.forEach((line) => {
        const m = line.match(/(\d+)[\s.:)]*([ĐDSđds\-\/]+)/i)
        if (m) {
          const qNum = parseInt(m[1]) - 1
          const raw = m[2].replace(/[^ĐDSđds]/gi, '').toUpperCase()
          const tfObj: any = {}
          ;['a', 'b', 'c', 'd'].forEach((sub, subIdx) => {
            const ch = raw[subIdx]
            tfObj[sub] = ch === 'Đ' || ch === 'D' ? 'D' : 'S'
          })
          if (qNum >= 0 && qNum < sec.questionCount) answers[qNum] = tfObj
        }
      })
    } else if (sec.type === 'short_answer') {
      const matches = Array.from(text.matchAll(/(\d+)[\s.:)]*([-\d.,]+)/g))
      matches.forEach((m) => {
        const qNum = parseInt(m[1]) - 1
        if (qNum >= 0 && qNum < sec.questionCount) {
          answers[qNum] = m[2].trim()
        }
      })
    }

    handleUpdateSectionField(secIdx, 'correctAnswers', answers)
    setQuickAnswersModalSecId(null)
    setQuickAnswersText('')
    alert(`Đã nạp nhanh đáp án cho ${Object.keys(answers).length} câu hỏi!`)
  }

  // TẠO ĐỀ THI ĐẦY ĐỦ VỚI THANH GẠT SEB & GOOGLE DRIVE
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!examTitle.trim() || !examPdfFile) {
      alert('Vui lòng nhập tên đề thi và đính kèm file PDF đề thi!')
      return
    }

    if (examSections.length === 0) {
      alert('Vui lòng tạo ít nhất 1 phần thi cho đề thi!')
      return
    }

    setCreatingExam(true)
    try {
      // 1. Upload file PDF lên Google Drive qua Resumable Upload
      const uploadUrl = await initGoogleDriveUpload(examPdfFile.name, 'application/pdf')
      const uploaded = await uploadFileToGoogleDrive(uploadUrl, examPdfFile, examTitle)
      const driveFileId = typeof uploaded === 'string' ? uploaded : uploaded.id

      // 2. Chế độ ngầm: Học sinh tạo đề -> tự động là đề ẩn (chỉ mình học sinh thấy), Admin/Colab -> công khai hoặc theo tùy chọn
      const isStudent = userRole === 'student'
      const isHiddenEffective = isStudent ? true : examIsHidden
      const accessCode = isHiddenEffective
        ? examCustomCode.trim().toUpperCase() || Math.random().toString(36).substring(2, 8).toUpperCase()
        : null

      // Đồng bộ cấu trúc đề thi để cả SenExam lẫn SEB đều đọc được chuẩn xác
      const parsedMaxScore = parseFloat(examMaxScore) || 10
      const synchronizedSections = examSections.map((s) => {
        const pts = Number(s.totalPoints) || 10
        return {
          ...s,
          totalPoints: pts,
          sectionTotalPoints: pts,
          scoringMode: s.scoringMode || 'auto_divide',
          pointsPerQuestion: s.pointsPerQuestion || {},
          customPoints: s.pointsPerQuestion || {},
          custom_max_score: parsedMaxScore,
        }
      })

      const totalQs = examSections.reduce((sum, s) => sum + (parseInt(String(s.questionCount)) || 0), 0)

      const examPayload: any = {
        title: examTitle.trim(),
        exam_type: examTypeVal,
        duration: parseInt(examDuration) || 50,
        drive_file_id: driveFileId,
        exam_structure: synchronizedSections,
        allow_review: examAllowReview,
        is_hidden: isHiddenEffective,
        access_code: accessCode,
        subjects: selectedSubjects,
        max_attempts: parseInt(maxAttempts) || 1,
        grading_method: gradingMethod,
        require_proctoring: requireProctoring,
        folder_id: selectedFolderId || null,
        require_seb: requireSeb, // THANH GẠT YÊU CẦU SEB
        part_instructions: examSections.map((s) => ({
          id: s.id,
          name: s.name,
          instructions: s.instructions,
          instructionImage: s.instructionImage,
        })),
        created_by: currentUserId,
      }

      let newExam: any = null
      const { data: firstTryData, error: firstTryErr } = await supabase
        .from('exams')
        .insert({ ...examPayload, max_score: parsedMaxScore })
        .select('*')
        .single()

      if (firstTryErr) {
        const { data: fallbackData, error: fallbackErr } = await supabase
          .from('exams')
          .insert(examPayload)
          .select('*')
          .single()
        if (fallbackErr) throw fallbackErr
        newExam = fallbackData
      } else {
        newExam = firstTryData
      }

      setExamsList([newExam, ...examsList])
      setExamTitle('')
      setExamPdfFile(null)
      setAnswerPdfFile(null)
      setHasSeparateAnswerFile(false)
      setExamIsHidden(false)
      setExamCustomCode('')
      setActiveTab('manage')
      alert(
        isStudent
          ? `🎉 Đã xuất bản đề thi PDF của bạn thành công (${totalQs} câu hỏi)!\n(Chế độ cá nhân: chỉ bạn thấy đề thi này trong danh sách đề của bạn)`
          : `🎉 Đã xuất bản đề thi thành công (${totalQs} câu hỏi)! ${accessCode ? `Mã code: ${accessCode}` : ''} ${requireSeb ? '(Yêu cầu Safe Exam Browser)' : '(Web trực tuyến)'}`
      )
    } catch (err: any) {
      alert(`Lỗi xuất bản đề thi: ${err.message}`)
    } finally {
      setCreatingExam(false)
    }
  }

  // TẠO THÔNG BÁO MỚI CHO NGƯỜI DÙNG

  // Xóa đề thi
  const handleDeleteExam = async (examId: string, title: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa đề thi: "${title}" không? Hành động này không thể hoàn tác.`)) {
      return
    }

    try {
      const { error } = await supabase.from('exams').delete().eq('id', examId)
      if (error) throw error
      setExamsList((prev) => prev.filter((e) => e.id !== examId))
      alert('Đã xóa đề thi thành công!')
    } catch (err: any) {
      alert('Lỗi xóa đề thi: ' + err.message)
    }
  }

  // Bật/tắt allow_review nhanh
  const handleToggleReview = async (examId: string, currentVal: boolean) => {
    try {
      const nextVal = !currentVal
      const { error } = await supabase.from('exams').update({ allow_review: nextVal }).eq('id', examId)
      if (error) throw error
      setExamsList((prev) => prev.map((e) => (e.id === examId ? { ...e, allow_review: nextVal } : e)))
    } catch (err: any) {
      alert('Lỗi cập nhật: ' + err.message)
    }
  }

  // Helper kiểm tra đề có phải KaTeX trực tiếp không
  const checkIsKatexExam = (ex: any) => {
    if (!ex) return false
    if (ex.format === 'katex') return true
    let struct = ex.exam_structure
    if (typeof struct === 'string') {
      try { struct = JSON.parse(struct) } catch { struct = [] }
    }
    if (struct && typeof struct === 'object' && !Array.isArray(struct) && Array.isArray((struct as any).sections)) {
      struct = (struct as any).sections
    }
    const hasQuestions =
      Array.isArray(struct) &&
      struct.some(
        (s: any) =>
          (Array.isArray(s?.questions) && s.questions.length > 0) ||
          s?.format === 'katex' ||
          s?.is_katex === true ||
          s?.id === 'sec-katex-main'
      )
    const isValidDrive = typeof ex.drive_file_id === 'string' && ex.drive_file_id.trim().length > 10 && !ex.drive_file_id.includes('null')
    const isValidPdf = typeof ex.pdf_url === 'string' && ex.pdf_url.trim().length > 10 && !ex.pdf_url.includes('null')
    return hasQuestions || (!isValidDrive && !isValidPdf)
  }

  // Mở modal cấu hình đề thi (Nút Sliders cạnh thùng rác)
  const openExamSettingsModal = (exam: any) => {
    setEditingExamSettings(exam)
    setSettingsTitle(exam.title || '')
    setSettingsSubject(
      Array.isArray(exam.subjects) && exam.subjects.length > 0
        ? exam.subjects[0]
        : (exam.subject || 'Toán học')
    )
    setSettingsExamType(exam.exam_type || 'THPTQG')
    setSettingsDuration(String(exam.duration || 50))
    setSettingsMaxScore(String(exam.max_score || 10))
    setSettingsAllowReview(exam.allow_review !== false)
    setSettingsIsHidden(Boolean(exam.is_hidden))
    setSettingsAccessCode(exam.access_code || '')
    setSettingsRequireSeb(Boolean(exam.require_seb))
    setSettingsRequireProctoring(Boolean(exam.require_proctoring))

    let struct = exam.exam_structure
    if (typeof struct === 'string') {
      try { struct = JSON.parse(struct) } catch { struct = [] }
    }
    if (struct && typeof struct === 'object' && !Array.isArray(struct) && Array.isArray((struct as any).sections)) {
      struct = (struct as any).sections
    }
    const firstSec = Array.isArray(struct) && struct.length > 0 ? struct[0] : null
    setSettingsIsVip(Boolean(exam.is_vip || firstSec?.is_vip))
    setSettingsShuffleQuestions(Boolean(exam.shuffle_questions || firstSec?.shuffle_questions))
    setSettingsShuffleOptions(Boolean(exam.shuffle_options || firstSec?.shuffle_options))
    setSettingsSuccessMsg('')
  }

  // Lưu thay đổi cài đặt đề thi
  const handleSaveExamSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingExamSettings) return
    setSavingExamSettings(true)
    setSettingsSuccessMsg('')

    try {
      const isKatex = checkIsKatexExam(editingExamSettings)
      let struct = editingExamSettings.exam_structure
      if (typeof struct === 'string') {
        try { struct = JSON.parse(struct) } catch { struct = [] }
      }
      if (struct && typeof struct === 'object' && !Array.isArray(struct) && Array.isArray((struct as any).sections)) {
        struct = (struct as any).sections
      }

      if (Array.isArray(struct)) {
        struct = struct.map((s: any) => ({
          ...s,
          is_vip: settingsIsVip,
          shuffle_questions: isKatex ? settingsShuffleQuestions : s?.shuffle_questions,
          shuffle_options: isKatex ? settingsShuffleOptions : s?.shuffle_options,
        }))
      }

      const generatedCode = settingsIsHidden
        ? (settingsAccessCode.trim() || Math.random().toString(36).substring(2, 8).toUpperCase())
        : null

      const updates: any = {
        title: settingsTitle.trim() || editingExamSettings.title,
        subjects: [settingsSubject],
        exam_type: settingsExamType,
        duration: parseInt(settingsDuration) || 50,
        max_score: parseFloat(settingsMaxScore) || 10,
        allow_review: settingsAllowReview,
        is_hidden: settingsIsHidden,
        is_vip: settingsIsVip,
        access_code: generatedCode,
        require_seb: settingsRequireSeb,
        require_proctoring: settingsRequireProctoring,
      }

      if (isKatex) {
        updates.shuffle_questions = settingsShuffleQuestions
        updates.shuffle_options = settingsShuffleOptions
        if (struct) {
          updates.exam_structure = struct
        }
      }

      // 1. Thử cập nhật toàn diện
      let { error } = await supabase
        .from('exams')
        .update(updates)
        .eq('id', editingExamSettings.id)

      // Fallback nếu thiếu cột is_vip
      if (error && error.message?.includes('is_vip')) {
        const fallbackUpdatesVip = { ...updates }
        delete fallbackUpdatesVip.is_vip
        const retryVip = await supabase
          .from('exams')
          .update(fallbackUpdatesVip)
          .eq('id', editingExamSettings.id)
        error = retryVip.error
      }

      // Fallback nếu thiếu cột shuffle_questions / shuffle_options
      if (error && (error.message?.includes('shuffle_questions') || error.message?.includes('shuffle_options'))) {
        const fallbackUpdates = { ...updates }
        delete fallbackUpdates.shuffle_questions
        delete fallbackUpdates.shuffle_options
        delete fallbackUpdates.is_vip
        const retry = await supabase
          .from('exams')
          .update(fallbackUpdates)
          .eq('id', editingExamSettings.id)
        error = retry.error
      }

      // Fallback nếu thiếu cột max_score
      if (error && error.message?.includes('max_score')) {
        const fallbackUpdates2 = { ...updates }
        delete fallbackUpdates2.max_score
        delete fallbackUpdates2.shuffle_questions
        delete fallbackUpdates2.shuffle_options
        delete fallbackUpdates2.is_vip
        const retry2 = await supabase
          .from('exams')
          .update(fallbackUpdates2)
          .eq('id', editingExamSettings.id)
        error = retry2.error
      }

      if (error) throw error

      // 2. Cập nhật state local examsList
      setExamsList((prev) =>
        prev.map((ex) =>
          ex.id === editingExamSettings.id
            ? {
                ...ex,
                ...updates,
                is_vip: settingsIsVip,
                shuffle_questions: isKatex ? settingsShuffleQuestions : false,
                shuffle_options: isKatex ? settingsShuffleOptions : false,
                exam_structure: struct || ex.exam_structure,
              }
            : ex
        )
      )

      setSettingsSuccessMsg('Đã lưu cấu hình đề thi thành công!')
      setTimeout(() => {
        setEditingExamSettings(null)
        setSettingsSuccessMsg('')
      }, 700)
    } catch (err: any) {
      alert('Lỗi lưu cài đặt: ' + (err.message || 'Không thể cập nhật đề thi'))
    } finally {
      setSavingExamSettings(false)
    }
  }

  if (loading) {
    if (embedded) {
      return (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-sm font-bold text-slate-500">Đang tải hệ thống biên soạn đề KaTeX & ngân hàng câu hỏi...</p>
        </div>
      )
    }
    return (
      <ModernLoading
        isDark={isDark}
        themeColor="emerald"
        title="SenExam Quản Trị Khóa Học & Soạn Đề"
        subtitle="Đang tải hệ thống biên soạn đề KaTeX & ngân hàng câu hỏi..."
      />
    )
  }

  const bodyContent = (
    <div className="w-full">
      {/* SUB-NAV TABS */}
      <div className="border-b border-black/5 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 px-4 sm:px-8 py-2">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
          <button
            type="button"
            onClick={() => setActiveTab('manage')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 active:scale-95 ${
              activeTab === 'manage'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Layers className="h-4 w-4" /> Quản lý đề thi ({examsList.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('create_katex')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 active:scale-95 ${
              activeTab === 'create_katex'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Sparkles className="h-4 w-4 text-amber-300" /> Tạo đề KaTeX (Không cần PDF)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('create_pdf')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 active:scale-95 ${
              activeTab === 'create_pdf'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <UploadCloud className="h-4 w-4" /> Soạn đề PDF & SEB
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-8">
        {/* ==================================================== */}
        {/* TAB 1: QUẢN LÝ ĐỀ THI */}
        {/* ==================================================== */}
        {activeTab === 'manage' && (
          <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm đề thi theo tên, loại đề hoặc mã code..."
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 pl-10 pr-4 py-2.5 text-xs font-bold outline-none focus:border-emerald-500 shadow-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('create_katex')}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2.5 text-xs font-black shadow-md hover:opacity-95 transition"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Tạo đề KaTeX mới
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('create_pdf')}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 text-xs font-black shadow-md transition"
                >
                  <Plus className="h-3.5 w-3.5" /> Tải đề PDF lên
                </button>
              </div>
            </div>

            {/* Danh sách đề thi */}
            {filteredExams.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center bg-white/40 dark:bg-slate-900/40">
                <FileText className="h-12 w-12 mx-auto text-slate-400 mb-3 opacity-60" />
                <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Chưa có đề thi nào phù hợp</h3>
                <p className="text-xs text-slate-500 mt-1">Bấm nút "Tạo đề KaTeX mới" hoặc "Tải đề PDF lên" để bắt đầu soạn đề thi.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredExams.map((exam, idx) => {
                  if (!exam) return null
                  const isKatexFormat = !exam.drive_file_id && !exam.pdf_url
                  const questionCount = getExamQuestionCount(exam)

                  return (
                    <div
                      key={exam.id || `exam-${idx}`}
                      className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between transform-gpu"
                    >
                      <div>
                        {/* Tags */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-black px-2.5 py-1 border border-slate-200 dark:border-slate-700">
                            {exam.exam_type}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {isKatexFormat ? (
                              <span className="rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 text-[9px] font-black px-2 py-0.5">
                                KaTeX Live
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[9px] font-black px-2 py-0.5">
                                PDF Drive
                              </span>
                            )}

                            {exam.require_seb && (
                              <span className="rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[9px] font-black px-2 py-0.5">
                                SEB Lock
                              </span>
                            )}

                            {exam.is_vip && (
                              <span className="rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 text-[9px] font-black px-2 py-0.5 flex items-center gap-1 shadow-2xs">
                                <Crown className="h-2.5 w-2.5" /> VIP
                              </span>
                            )}

                            {exam.is_hidden ? (
                              <span className="rounded-full bg-slate-500/10 text-slate-500 text-[9px] font-bold px-2 py-0.5 flex items-center gap-0.5">
                                <Lock className="h-2.5 w-2.5" /> Riêng tư
                              </span>
                            ) : (
                              <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold px-2 py-0.5 flex items-center gap-0.5">
                                <Unlock className="h-2.5 w-2.5" /> Công khai
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="font-black text-sm line-clamp-2 mb-2" style={{ fontFamily: 'var(--font-setup-heading)' }}>
                          {exam.title}
                        </h3>

                        {/* Meta info */}
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1 font-semibold">
                          <p className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-slate-400" /> Thời gian: {exam.duration} phút • {questionCount} câu hỏi
                          </p>
                          {exam.access_code && (
                            <p className="flex items-center gap-1.5 font-mono text-emerald-600 dark:text-emerald-400">
                              <Hash className="h-3 w-3" /> Mã truy cập: <strong>{exam.access_code}</strong>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-5 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/new-exams/${exam.id}`}
                            prefetch={false}
                            className="inline-flex items-center gap-1 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            <Eye className="h-3.5 w-3.5" /> Xem đề thi
                          </Link>

                          <button
                            type="button"
                            onClick={() => setManagingExamStudents(exam)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold transition shadow-xs cursor-pointer active:scale-95"
                            title="Quản lý học sinh làm bài & Giám sát vi phạm"
                          >
                            <Users className="h-3.5 w-3.5" />
                            <span>Thí sinh</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openExamSettingsModal(exam)}
                            className="p-1.5 rounded-lg text-xs font-bold transition bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900 shadow-xs cursor-pointer active:scale-95"
                            title="Cài đặt cấu hình đề thi"
                          >
                            <Sliders className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteExam(exam.id, exam.title)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 transition"
                            title="Xóa đề thi"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 2: TẠO ĐỀ KATEX TRỰC TIẾP & BÀN PHÍM ẢO TOÁN HỌC */}
        {/* ==================================================== */}
        {activeTab === 'create_katex' && (
          <form onSubmit={handleSaveKatexExam} className="space-y-8">
            {/* Top Banner AI Assistant & Nút Hướng Dẫn LaTeX (?) */}
            <div className="rounded-3xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-md">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-setup-heading)' }}>
                    AI Gemini Soạn Đề KaTeX Đa Tầng
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    Tự động tạo câu hỏi trắc nghiệm kèm công thức toán học KaTeX và lời giải chi tiết (Hỗ trợ dự phòng thông minh)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowLatexHelpModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 px-4 py-3 text-xs font-black uppercase tracking-wider backdrop-blur-md shadow-xs transition hover:scale-105 active:scale-95 cursor-pointer"
                  title="Xem hướng dẫn định dạng file LaTeX để hệ thống tự động nhận diện câu hỏi"
                >
                  <HelpCircle className="h-4 w-4 text-amber-500" />
                  <span>Hướng Dẫn Định Dạng LaTeX (?)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAiModal(true)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 py-3 text-xs font-black uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" /> Mở AI Soạn Đề Tự Động
                </button>
              </div>
            </div>

            {/* KHU VỰC TẢI FILE / NHẬP MÃ CODE LATEX ĐỂ BIÊN SOẠN TỰ ĐỘNG */}
            <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-3 border-b border-black/5 dark:border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-sm">
                    <FileCode className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100" style={{ fontFamily: 'var(--font-setup-heading)' }}>
                        Nhập File / Mã Code LaTeX Để Tự Động Biên Soạn
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        Chuẩn KaTeX 2026
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                      Tải file .tex hoặc dán mã code để hệ thống tự động bóc tách từng câu hỏi, công thức toán và lời giải
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLatexHelpModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-black transition cursor-pointer"
                  >
                    <HelpCircle className="h-4 w-4 text-amber-500" />
                    <span>Quy ước định dạng (?)</span>
                  </button>
                </div>
              </div>

              {/* Tabs phương thức nhập: Tải file .tex vs Dán mã code LaTeX */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLatexInputMode('file')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                      latexInputMode === 'file'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    <UploadCloud className="h-4 w-4" />
                    <span>Tải File .tex / .txt</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLatexInputMode('code')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                      latexInputMode === 'code'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    <Code className="h-4 w-4" />
                    <span>Dán Mã Code LaTeX Trực Tiếp</span>
                  </button>
                </div>

                {/* Khung tải file */}
                {latexInputMode === 'file' ? (
                  <div className="rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/20 dark:bg-indigo-950/20 p-6 flex flex-col items-center justify-center text-center gap-3">
                    <input
                      type="file"
                      id="latex-file-input"
                      accept=".tex,.txt,.latex"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setLatexFile(file)
                          try {
                            const text = await file.text()
                            setLatexCode(text)
                          } catch (err: any) {
                            console.error('Lỗi đọc file:', err)
                          }
                        }
                      }}
                    />
                    <label
                      htmlFor="latex-file-input"
                      className="cursor-pointer flex flex-col items-center gap-2 group"
                    >
                      <div className="h-12 w-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition shadow-xs">
                        <UploadCloud className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-900 dark:text-white block">
                          {latexFile ? `Đã chọn: ${latexFile.name} (${(latexFile.size / 1024).toFixed(1)} KB)` : 'Nhấp để chọn file .tex hoặc .txt từ máy tính'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Hỗ trợ định dạng file mã nguồn LaTeX chuẩn UTF-8
                        </span>
                      </div>
                    </label>

                    {latexFile && (
                      <div className="flex items-center gap-2 pt-2">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="h-3.5 w-3.5" /> File sẵn sàng ({latexCode.length} ký tự)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setLatexFile(null)
                            setLatexCode('')
                          }}
                          className="text-xs text-rose-500 hover:underline font-bold"
                        >
                          Xóa file
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Khung dán mã code */
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        Nội dung mã nguồn LaTeX ({latexCode.length} ký tự):
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setLatexCode(SAMPLE_LATEX_EXAM)}
                          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          Dán mẫu thử nghiệm chuẩn 2026
                        </button>
                        {latexCode && (
                          <button
                            type="button"
                            onClick={() => setLatexCode('')}
                            className="text-xs font-bold text-rose-500 hover:underline cursor-pointer"
                          >
                            Xóa trắng
                          </button>
                        )}
                      </div>
                    </div>
                    <textarea
                      rows={8}
                      value={latexCode}
                      onChange={(e) => setLatexCode(e.target.value)}
                      placeholder={`% Dán mã nguồn LaTeX đề thi vào đây...\n\\begin{ex}\nCho hàm số $y = f(x)$...\n\\choice\n{$A$}\n{$B$}\n{$C$}\n{$D$}\n\\end{ex}`}
                      className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/60 p-4 font-mono text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 leading-relaxed"
                    />
                  </div>
                )}
              </div>

              {/* TÙY CHỌN BẢNG / FILE ĐÁP ÁN (TƯƠNG TỰ BÊN SOẠN ĐỀ PDF & SEB) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      Bạn đã có sẵn file hoặc bảng đáp án riêng của đề này chưa?
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setLatexHasAnswerFile(false)}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                        !latexHasAnswerFile
                          ? 'bg-indigo-600 text-white font-black shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Chưa có (AI tự giải)
                    </button>
                    <button
                      type="button"
                      onClick={() => setLatexHasAnswerFile(true)}
                      className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                        latexHasAnswerFile
                          ? 'bg-indigo-600 text-white font-black shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Đã có file/bảng đáp án (Khuyên dùng)</span>
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {latexHasAnswerFile
                    ? '💡 Bạn tải file đáp án (PDF/Ảnh/Tex) hoặc nhập bảng đáp án text. Hệ thống sẽ đối chiếu trực tiếp để nạp đúng 100% đáp án chuẩn, và AI chỉ hỗ trợ giải thêm lời giải chi tiết cho từng câu.'
                    : '💡 Hệ thống sẽ bóc tách câu hỏi từ LaTeX. Nếu câu nào chưa có đáp án, Gemini sẽ tự động giải toán, tìm đáp án đúng và viết lời giải chi tiết KaTeX.'}
                </p>

                {/* Khu vực nạp đáp án riêng */}
                {latexHasAnswerFile && (
                  <div className="pt-2 space-y-3 border-t border-slate-200 dark:border-white/10 animate-in fade-in">
                    <div className="flex items-center gap-3 text-xs font-bold">
                      <span className="text-slate-700 dark:text-slate-300">Phương thức nạp đáp án:</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setLatexAnswerType('text')}
                          className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                            latexAnswerType === 'text'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-black/5 dark:bg-white/5 text-slate-600 hover:bg-black/10'
                          }`}
                        >
                          Nhập bảng text (1A 2B 3C...)
                        </button>
                        <button
                          type="button"
                          onClick={() => setLatexAnswerType('file')}
                          className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                            latexAnswerType === 'file'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-black/5 dark:bg-white/5 text-slate-600 hover:bg-black/10'
                          }`}
                        >
                          Tải file đáp án (PDF/Ảnh/Text)
                        </button>
                      </div>
                    </div>

                    {latexAnswerType === 'text' ? (
                      <textarea
                        rows={3}
                        value={latexAnswerText}
                        onChange={(e) => setLatexAnswerText(e.target.value)}
                        placeholder="Nhập bảng đáp án nhanh, ví dụ:&#10;1A 2B 3C 4D 5: a-Đ, b-S, c-Đ, d-S 6: 2.5&#10;Hoặc dán bảng đáp án LaTeX..."
                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-3 text-xs font-mono font-bold outline-none focus:border-indigo-500"
                      />
                    ) : (
                      <div className="rounded-xl border border-dashed border-indigo-300 dark:border-indigo-500/40 p-4 bg-white dark:bg-slate-900 text-center">
                        <input
                          type="file"
                          id="latex-answer-file"
                          accept=".pdf,.png,.jpg,.jpeg,.txt,.tex"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) setLatexAnswerFile(f)
                          }}
                        />
                        <label htmlFor="latex-answer-file" className="cursor-pointer block">
                          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 block mb-1">
                            {latexAnswerFile ? `✓ Đã chọn file đáp án: ${latexAnswerFile.name}` : 'Bấm để tải file đáp án (PDF, Ảnh hoặc Văn bản)'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Hệ thống sẽ đối chiếu tự động với đề thi
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Nút hành động Bắt đầu biên soạn */}
              <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleCompileLatexExam}
                  disabled={parsingLatex}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white font-black text-xs uppercase tracking-wider shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {parsingLatex ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{parseLatexStatus || 'Đang biên soạn đề KaTeX...'}</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 text-amber-300" />
                      <span>Tự Động Nhận Diện & Biên Soạn Đề LaTeX (Siêu Tốc)</span>
                    </>

                  )}
                </button>

                {parseLatexSuccessMsg && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3.5 py-2 rounded-xl border border-emerald-500/20 animate-in fade-in">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{parseLatexSuccessMsg}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Thông tin chung của đề */}
            <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400" style={{ fontFamily: 'var(--font-setup-heading)' }}>
                1. Thông tin tổng quan đề thi
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">Tên đề thi KaTeX *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Đề Ôn Tập Tích Phân & Ứng Dụng (Chuẩn KaTeX 2026)"
                    value={katexTitle}
                    onChange={(e) => setKatexTitle(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">Môn học</label>
                  <select
                    value={katexExamType === 'HSA' ? 'Đa môn HSA' : katexSubject}
                    onChange={(e) => setKatexSubject(e.target.value)}
                    disabled={katexExamType === 'HSA'}
                    className={`w-full rounded-2xl border px-4 py-2.5 text-xs font-bold outline-none ${
                      katexExamType === 'HSA'
                        ? 'bg-slate-200/80 dark:bg-slate-800 text-slate-500 border-slate-300 dark:border-white/5 cursor-not-allowed select-none opacity-80'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 focus:border-indigo-500'
                    }`}
                  >
                    {katexExamType === 'HSA' ? (
                      <option value="Đa môn HSA">Đa môn HSA (Toán, Văn, KHTN, KHXH)</option>
                    ) : (
                      <>
                        <option value="Toán học">Toán học</option>
                        <option value="Vật lí">Vật lí</option>
                        <option value="Hóa học">Hóa học</option>
                        <option value="Sinh học">Sinh học</option>
                        <option value="Tin học">Tin học</option>
                        <option value="Ngữ văn">Ngữ văn</option>
                        <option value="Tiếng Anh">Tiếng Anh</option>
                        <option value="Lịch sử">Lịch sử</option>
                        <option value="Địa lí">Địa lí</option>
                      </>
                    )}
                  </select>
                  {katexExamType === 'HSA' && (
                    <span className="block text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-bold">
                      🔒 Môn học bị khóa: HSA là kỳ thi đánh giá năng lực đa môn riêng biệt.
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">Loại kỳ thi</label>
                  <select
                    value={katexExamType}
                    onChange={(e) => {
                      const val = e.target.value
                      setKatexExamType(val)
                      if (val === 'HSA') {
                        setKatexSubject('Đa môn HSA')
                        setKatexDuration('195')
                      }
                    }}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500"
                  >
                    {SETUP_EXAM_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                    Thời gian làm bài
                  </label>
                  {katexExamType === 'HSA' ? (
                    <div className="w-full rounded-2xl border border-slate-300 dark:border-white/5 bg-slate-200/80 dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-500 cursor-not-allowed select-none opacity-80">
                      ⏱ Cố định chuẩn HSA: 195 phút (P1 75p, P2 60p, P3 60p)
                    </div>
                  ) : (
                    <input
                      type="number"
                      min="5"
                      max="180"
                      value={katexDuration}
                      onChange={(e) => setKatexDuration(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">Thang điểm tối đa</label>
                  <input
                    type="number"
                    value={katexMaxScore}
                    onChange={(e) => setKatexMaxScore(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="katexAllowReview"
                    checked={katexAllowReview}
                    onChange={(e) => setKatexAllowReview(e.target.checked)}
                    className="h-4 w-4 rounded accent-indigo-600"
                  />
                  <label htmlFor="katexAllowReview" className="text-xs font-bold cursor-pointer select-none">
                    Cho phép học sinh xem lại lời giải chi tiết
                  </label>
                </div>

                {userRole !== 'student' && (
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="katexIsHidden"
                      checked={katexIsHidden}
                      onChange={(e) => setKatexIsHidden(e.target.checked)}
                      className="h-4 w-4 rounded accent-indigo-600"
                    />
                    <label htmlFor="katexIsHidden" className="text-xs font-bold cursor-pointer select-none">
                      Đặt đề thi ẩn (yêu cầu mã code)
                    </label>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="katexIsVip"
                    checked={katexIsVip}
                    onChange={(e) => setKatexIsVip(e.target.checked)}
                    className="h-4 w-4 rounded accent-amber-500 cursor-pointer"
                  />
                  <label htmlFor="katexIsVip" className="text-xs font-black text-amber-700 dark:text-amber-400 flex items-center gap-1 cursor-pointer select-none">
                    <Crown className="h-3.5 w-3.5 text-amber-500" /> Đề thi dành riêng cho VIP
                  </label>
                </div>

                {/* ĐẢO CÂU & ĐẢO ĐÁP ÁN (DÀNH RIÊNG CHO KATEX) */}
                <div className="sm:col-span-2 lg:col-span-4 mt-2 p-4 rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-pink-50/40 dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-pink-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-md">
                      <Shuffle className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
                        Xáo Trộn Đề KaTeX Chống Gian Lận & Học Vẹt
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                        Tự động đổi thứ tự câu và đáp án mỗi lần thí sinh làm bài để chống ghi nhớ đáp án cũ.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 flex-wrap">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={katexShuffleQuestions}
                        onChange={(e) => setKatexShuffleQuestions(e.target.checked)}
                        className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        Đảo thứ tự câu hỏi
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={katexShuffleOptions}
                        onChange={(e) => setKatexShuffleOptions(e.target.checked)}
                        className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        Đảo các đáp án (A, B, C, D)
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* HƯỚNG DẪN ĐỊNH DẠNG ĐỀ THI CHUẨN HSA CHO GEMINI / AI GEN ĐỀ */}
            {katexExamType === 'HSA' && (
              <div className="rounded-3xl border border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <h3 className="text-xs sm:text-sm font-black uppercase text-amber-900 dark:text-amber-200">
                      Cẩm nang nhận dạng tất cả các loại câu hỏi HSA ĐHQGHN (Dùng cho Gemini gen đề)
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const promptText = `Hãy tạo cho tôi đề thi chuẩn cấu trúc Đánh giá Năng lực HSA của Đại học Quốc gia Hà Nội (ĐHQGHN) định dạng LaTeX/KaTeX:
- PHẦN 1 (Câu 1 - 50): Tư duy Định lượng (Toán học & Xử lý số liệu). Gồm 35 câu trắc nghiệm 4 lựa chọn (\\choice{A}{B}{C}{D}) và 15 câu điền số/trả lời ngắn (\\type{short_answer} hoặc \\ans{con_so}).
- PHẦN 2 (Câu 51 - 100): Tư duy Định tính (Ngôn ngữ - Văn học). Gồm câu hỏi chọn từ không cùng nhóm, lỗi ngữ pháp, và các chùm bài đọc hiểu 5 câu (câu 81-85, 86-90) đặt trong môi trường \\begin{passage}...\\end{passage}.
- PHẦN 3 (Câu 101 - 150): Khoa học hoặc Tiếng Anh (Vật lí, Hóa học, Sinh học, Lịch sử, Địa lí). Mỗi môn phân tách bằng chú thích % MÔN: VẬT LÍ (CÂU 101-110), % MÔN: HÓA HỌC (CÂU 111-120), v.v.
Mỗi câu hỏi đặt trong \\begin{ex}...\\end{ex}, công thức toán đặt trong $...$, hình vẽ TikZ đặt trong \\begin{tikzpicture}...\\end{tikzpicture}.`
                      navigator.clipboard.writeText(promptText)
                      alert('Đã sao chép prompt mẫu HSA cho Gemini vào bộ nhớ tạm! Bạn chỉ cần dán vào Gemini để tạo đề chuẩn 100%.')
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" /> Sao chép Prompt mẫu cho Gemini
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-700 dark:text-slate-300">
                  <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-2xl border border-amber-200 dark:border-amber-900/40 space-y-1.5">
                    <span className="font-black text-indigo-700 dark:text-indigo-400 block uppercase">
                      1. Định lượng (Câu 1 - 50)
                    </span>
                    <p className="text-[11px] leading-relaxed">
                      • <strong>35 câu trắc nghiệm</strong>: Sử dụng lệnh <code className="text-amber-700">\choice&#123;A&#125;&#123;B&#125;&#123;C&#125;&#123;D&#125;</code>.<br />
                      • <strong>15 câu điền số</strong>: Sử dụng <code className="text-amber-700">\type&#123;short_answer&#125;</code> hoặc <code className="text-amber-700">\ans&#123;3.5&#125;</code>.
                    </p>
                  </div>

                  <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-2xl border border-amber-200 dark:border-amber-900/40 space-y-1.5">
                    <span className="font-black text-emerald-700 dark:text-emerald-400 block uppercase">
                      2. Định tính (Câu 51 - 100)
                    </span>
                    <p className="text-[11px] leading-relaxed">
                      • <strong>Từ ngữ & Ngữ pháp (51 - 70)</strong>: Tìm từ không cùng nhóm, câu lỗi cú pháp.<br />
                      • <strong>Chùm đọc hiểu (81 - 85, 86 - 90)</strong>: Đặt ngữ liệu trong <code className="text-emerald-700">\begin&#123;passage&#125;...\\end&#123;passage&#125;</code> để chia 2 cột.
                    </p>
                  </div>

                  <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-2xl border border-amber-200 dark:border-amber-900/40 space-y-1.5">
                    <span className="font-black text-rose-700 dark:text-rose-400 block uppercase">
                      3. Khoa học / Tự chọn (101 - 150)
                    </span>
                    <p className="text-[11px] leading-relaxed">
                      • <strong>Phân môn nhận dạng</strong>: Ghi rõ <code className="text-rose-700">% MÔN: VẬT LÍ</code>, <code className="text-rose-700">% MÔN: HÓA HỌC</code>, <code className="text-rose-700">% MÔN: LỊCH SỬ</code> để hệ thống tự động gán môn học vào câu hỏi.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* BÀN PHÍM ẢO TOÁN HỌC TRỰC QUAN (VIRTUAL MATH KEYBOARD) */}
            <div className="sticky top-16 z-20 rounded-3xl border border-indigo-500/30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl p-4 shadow-xl">
              <div className="flex items-center justify-between mb-3 border-b border-black/5 dark:border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-indigo-500" />
                  <span className="text-xs font-black uppercase tracking-wider">
                    Bàn phím ảo toán học KaTeX
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline">
                    (Nhấp vào ô soạn thảo rồi bấm phím để chèn công thức chuẩn)
                  </span>
                </div>

                {/* Tabs bàn phím */}
                <div className="flex items-center gap-1 overflow-x-auto">
                  {MATH_KEYBOARD_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveKeyboardTab(tab.id)}
                      className={`px-3 py-1 rounded-xl text-[11px] font-bold transition ${
                        activeKeyboardTab === tab.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {tab.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lưới các nút phím render bằng KaTeX chuẩn xịn */}
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                {(MATH_KEYBOARD_TABS.find((t) => t.id === activeKeyboardTab)?.keys || []).map((k, kIdx) => (
                  <MathKeyButton
                    key={k.insert + '-' + kIdx}
                    k={k}
                    onInsert={handleInsertMathKey}
                  />
                ))}
              </div>
            </div>

            {/* DANH SÁCH CÂU HỎI SOẠN TRỰC TIẾP */}
            <div id="katex-questions-section" className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-400" style={{ fontFamily: 'var(--font-setup-heading)' }}>
                    2. Danh sách câu hỏi ({katexQuestions?.length || 0} câu)
                  </h2>
                  {katexQuestions?.length > 0 && (
                    <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      ⚡ KaTeX Engine Siêu Tốc
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {katexQuestions?.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAiVerifyAllAnswers}
                      disabled={verifyingWithAi}
                      className="inline-flex items-center gap-1.5 text-xs font-black px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md transition hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
                      title="Giao cho AI giải toán và thẩm định toàn bộ đáp án & lời giải chi tiết"
                    >
                      {verifyingWithAi ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-300" />
                          <span>{aiVerifyStatus || 'AI đang thẩm định...'}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                          <span>AI Thẩm Định & Kiểm Tra Đáp Án</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const newId = `q-${Date.now()}`
                      setKatexQuestions([
                        ...katexQuestions,
                        {
                          id: newId,
                          type: 'single_choice',
                          text: 'Câu hỏi mới $y = f(x)$...',
                          options: ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D'],
                          correctAnswer: 'A',
                          explanation: 'Lời giải chi tiết...',
                          points: 1,
                        },
                      ])
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    <Plus className="h-4 w-4" /> Thêm câu hỏi
                  </button>
                </div>
              </div>


              {(katexQuestions || []).map((q, qIdx) => (
                <div
                  key={q.id}
                  className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4"
                >
                  {/* Question header */}
                  <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-600 text-white font-black text-xs">
                        {qIdx + 1}
                      </span>
                      <span className="text-xs font-black">Câu hỏi {qIdx + 1}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={q.type}
                        onChange={(e) => {
                          const nextType = e.target.value as any
                          setKatexQuestions((prev) => {
                            const next = [...prev]
                            next[qIdx].type = nextType
                            return next
                          })
                        }}
                        className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 px-3 py-1 text-xs font-bold outline-none"
                      >
                        <option value="single_choice">Trắc nghiệm (1 đáp án)</option>
                        <option value="true_false">Đúng / Sai</option>
                        <option value="short_answer">Điền số / Trả lời ngắn</option>
                        <option value="essay">Tự luận</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          if (katexQuestions.length <= 1) {
                            alert('Đề thi phải có ít nhất 1 câu hỏi!')
                            return
                          }
                          setKatexQuestions(katexQuestions.filter((_, idx) => idx !== qIdx))
                        }}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 transition"
                        title="Xóa câu hỏi này"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Nội dung câu hỏi & Xem trước trực tiếp (Live KaTeX Preview) */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          Nội dung câu hỏi (hỗ trợ công thức $...$)
                        </label>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* File input ẩn */}
                          <input
                            type="file"
                            accept="image/*"
                            id={`q-img-upload-${qIdx}`}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              const reader = new FileReader()
                              reader.onload = (ev) => {
                                const dataUrl = ev.target?.result as string
                                if (!dataUrl) return
                                setKatexQuestions((prev) => {
                                  const next = [...prev]
                                  const curText = next[qIdx].text || ''
                                  // Nếu câu hỏi có tikz, hỏi người dùng có muốn thay thế tikz không
                                  if (/\\begin\{tikzpicture\}/i.test(curText)) {
                                    const tikzCenterRegex = /\\begin\{center\}\s*\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}\s*\\end\{center\}/i
                                    const tikzOnlyRegex = /\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/i
                                    const imgTag = `\n\\begin{center}\n\\includegraphics{${dataUrl}}\n\\end{center}\n`
                                    if (tikzCenterRegex.test(curText)) {
                                      next[qIdx].text = curText.replace(tikzCenterRegex, imgTag)
                                    } else if (tikzOnlyRegex.test(curText)) {
                                      next[qIdx].text = curText.replace(tikzOnlyRegex, imgTag)
                                    } else {
                                      next[qIdx].text = curText + imgTag
                                    }
                                  } else {
                                    next[qIdx].text = curText + `\n\\begin{center}\n\\includegraphics{${dataUrl}}\n\\end{center}\n`
                                  }
                                  return next
                                })
                              }
                              reader.readAsDataURL(file)
                              e.target.value = ''
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              document.getElementById(`q-img-upload-${qIdx}`)?.click()
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 transition border border-black/5 dark:border-white/5 cursor-pointer"
                            title="Tải ảnh đồ thị / hình vẽ từ máy tính"
                          >
                            <ImageIcon className="h-3 w-3 text-indigo-500" /> + Tải ảnh
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const url = window.prompt('Nhập URL hình ảnh (https://...):')
                              if (!url || !url.trim()) return
                              setKatexQuestions((prev) => {
                                const next = [...prev]
                                const curText = next[qIdx].text || ''
                                const imgTag = `\n\\begin{center}\n\\includegraphics{${url.trim()}}\n\\end{center}\n`
                                if (/\\begin\{tikzpicture\}/i.test(curText)) {
                                  const tikzCenterRegex = /\\begin\{center\}\s*\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}\s*\\end\{center\}/i
                                  const tikzOnlyRegex = /\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/i
                                  if (tikzCenterRegex.test(curText)) {
                                    next[qIdx].text = curText.replace(tikzCenterRegex, imgTag)
                                  } else if (tikzOnlyRegex.test(curText)) {
                                    next[qIdx].text = curText.replace(tikzOnlyRegex, imgTag)
                                  } else {
                                    next[qIdx].text = curText + imgTag
                                  }
                                } else {
                                  next[qIdx].text = curText + imgTag
                                }
                                return next
                              })
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 transition border border-black/5 dark:border-white/5 cursor-pointer"
                            title="Chèn link hình ảnh URL"
                          >
                            <Code className="h-3 w-3 text-emerald-500" /> Link ảnh
                          </button>

                          {/* Nút dọn TikZ hoặc sourcepage nếu có */}
                          {/\\begin\{tikzpicture\}/i.test(q.text || '') && (
                            <button
                              type="button"
                              onClick={() => {
                                document.getElementById(`q-img-upload-${qIdx}`)?.click()
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition cursor-pointer animate-pulse"
                              title="Câu hỏi này chứa mã TikZ. Bấm để chọn ảnh thay thế đồ thị này."
                            >
                              <Zap className="h-3 w-3" /> Thay TikZ bằng ảnh
                            </button>
                          )}
                        </div>
                      </div>
                      <textarea
                        rows={4}
                        value={q.text}
                        onFocus={() => setFocusedField({ qIdx, field: 'text' })}
                        onChange={(e) => {
                          const val = e.target.value
                          setKatexQuestions((prev) => {
                            const next = [...prev]
                            next[qIdx].text = val
                            return next
                          })
                        }}
                        placeholder="Nhập nội dung câu hỏi, ví dụ: Tính tích phân $I = \int_0^1 x^2 dx$..."
                        className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 p-3.5 text-xs font-mono outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* LIVE KATEX PREVIEW BOX */}
                    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/20 p-4">
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 mb-2">
                        <Eye className="h-3 w-3" /> Xem trước KaTeX trực tiếp
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed">
                        <SafeMathRenderer content={q.text || '*(Chưa có nội dung câu hỏi)*'} />
                      </div>
                    </div>
                  </div>

                  {/* Các phương án lựa chọn (cho trắc nghiệm single_choice) */}
                  {q.type === 'single_choice' && (
                    <div className="space-y-3 pt-2">
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                        Phương án lựa chọn & Đáp án đúng:
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {['A', 'B', 'C', 'D'].map((letter, optIdx) => {
                          const isSelected = q.correctAnswer === letter
                          const optText = q.options[optIdx] || ''

                          return (
                            <div
                              key={letter}
                              className={`rounded-2xl border p-3 transition flex items-start gap-2.5 ${
                                isSelected
                                  ? 'border-emerald-500 bg-emerald-500/10'
                                  : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/30'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setKatexQuestions((prev) => {
                                    const next = [...prev]
                                    next[qIdx].correctAnswer = letter
                                    return next
                                  })
                                }}
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-black transition ${
                                  isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {letter}
                              </button>

                              <div className="flex-1">
                                <input
                                  type="text"
                                  value={optText}
                                  onFocus={() => setFocusedField({ qIdx, field: 'option', optIdx })}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setKatexQuestions((prev) => {
                                      const next = [...prev]
                                      const nextOpts = [...next[qIdx].options]
                                      nextOpts[optIdx] = val
                                      next[qIdx].options = nextOpts
                                      return next
                                    })
                                  }}
                                  placeholder={`Nội dung phương án ${letter}...`}
                                  className="w-full bg-transparent text-xs font-medium outline-none"
                                />

                                {optText && (
                                  <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 border-t border-black/5 dark:border-white/5 pt-1">
                                    <SafeMathRenderer content={optText} gfm={false} />
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Các mệnh đề và đáp án Đúng / Sai (cho dạng true_false 4 ý) */}
                  {q.type === 'true_false' && (
                    <div className="space-y-3 pt-2">
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">
                        Nội dung 4 mệnh đề a, b, c, d & Đáp án Đúng / Sai:
                      </label>

                      <div className="space-y-2.5">
                        {['a', 'b', 'c', 'd'].map((sub, optIdx) => {
                          const rawOpts = q.options
                          let optText = ''
                          if (Array.isArray(rawOpts)) {
                            optText = rawOpts[optIdx] || ''
                          } else if (rawOpts && typeof rawOpts === 'object') {
                            optText =
                              (rawOpts as any)[sub] ||
                              (rawOpts as any)[sub.toUpperCase()] ||
                              (rawOpts as any)[optIdx] ||
                              ''
                          }

                          let tfAns = 'Đ'
                          if (
                            q.correctAnswer &&
                            typeof q.correctAnswer === 'object' &&
                            !Array.isArray(q.correctAnswer)
                          ) {
                            tfAns =
                              (q.correctAnswer as any)[sub] ||
                              (q.correctAnswer as any)[sub.toUpperCase()] ||
                              'Đ'
                          } else if (Array.isArray(q.correctAnswer)) {
                            tfAns = q.correctAnswer[optIdx] || 'Đ'
                          }

                          return (
                            <div
                              key={sub}
                              className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/30 p-3 flex items-start gap-2.5"
                            >
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase">
                                {sub}
                              </span>

                              <div className="flex-1">
                                <input
                                  type="text"
                                  value={optText}
                                  onFocus={() => setFocusedField({ qIdx, field: 'option', optIdx })}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setKatexQuestions((prev) => {
                                      const next = [...prev]
                                      const curOpts = Array.isArray(next[qIdx].options)
                                        ? [...next[qIdx].options]
                                        : ['', '', '', '']
                                      while (curOpts.length < 4) curOpts.push('')
                                      curOpts[optIdx] = val
                                      next[qIdx].options = curOpts
                                      return next
                                    })
                                  }}
                                  placeholder={`Nội dung mệnh đề ${sub})...`}
                                  className="w-full bg-transparent text-xs font-medium outline-none"
                                />

                                {optText && (
                                  <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 border-t border-black/5 dark:border-white/5 pt-1">
                                    <SafeMathRenderer content={optText} gfm={false} />
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setKatexQuestions((prev) => {
                                      const next = [...prev]
                                      const curCA =
                                        typeof next[qIdx].correctAnswer === 'object' &&
                                        next[qIdx].correctAnswer !== null &&
                                        !Array.isArray(next[qIdx].correctAnswer)
                                          ? { ...next[qIdx].correctAnswer }
                                          : { a: 'Đ', b: 'S', c: 'Đ', d: 'S' }
                                      curCA[sub] = 'Đ'
                                      next[qIdx].correctAnswer = curCA
                                      return next
                                    })
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                                    tfAns === 'Đ' || tfAns === 'D' || tfAns === 'T'
                                      ? 'bg-emerald-600 text-white shadow-xs'
                                      : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-black/10'
                                  }`}
                                >
                                  Đúng
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setKatexQuestions((prev) => {
                                      const next = [...prev]
                                      const curCA =
                                        typeof next[qIdx].correctAnswer === 'object' &&
                                        next[qIdx].correctAnswer !== null &&
                                        !Array.isArray(next[qIdx].correctAnswer)
                                          ? { ...next[qIdx].correctAnswer }
                                          : { a: 'Đ', b: 'S', c: 'Đ', d: 'S' }
                                      curCA[sub] = 'S'
                                      next[qIdx].correctAnswer = curCA
                                      return next
                                    })
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                                    tfAns === 'S' || tfAns === 'F'
                                      ? 'bg-rose-600 text-white shadow-xs'
                                      : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-black/10'
                                  }`}
                                >
                                  Sai
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Lời giải chi tiết */}
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      Lời giải chi tiết (Hiển thị cho học sinh khi xem lại bài):
                    </label>
                    <textarea
                      rows={3}
                      value={q.explanation}
                      onFocus={() => setFocusedField({ qIdx, field: 'explanation' })}
                      onChange={(e) => {
                        const val = e.target.value
                        setKatexQuestions((prev) => {
                          const next = [...prev]
                          next[qIdx].explanation = val
                          return next
                        })
                      }}
                      placeholder="Giải thích từng bước có công thức KaTeX..."
                      className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 p-3 text-xs font-mono outline-none focus:border-indigo-500"
                    />

                    {q.explanation && (
                      <div className="mt-2 rounded-2xl border border-emerald-500/20 bg-emerald-50/20 dark:bg-emerald-950/20 p-3 text-xs">
                        <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 block mb-1">
                          Xem trước lời giải:
                        </span>
                        <SafeMathRenderer content={q.explanation} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setActiveTab('manage')}
                className="px-5 py-3 rounded-2xl border border-slate-200 dark:border-white/10 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Hủy bỏ
              </button>

              <button
                type="submit"
                disabled={savingKatexExam}
                className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-3.5 text-xs font-black uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition disabled:opacity-50"
              >
                {savingKatexExam ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Xuất bản đề thi KaTeX
              </button>
            </div>
          </form>
        )}

        {/* ==================================================== */}
        {/* TAB 3: SOẠN ĐỀ PDF & SEB TRUYỀN THỐNG (DI DỜI TỪ NEW-ADMIN) */}
        {/* TAB 3: PRO MULTI-SECTION EXAM BUILDER TỪ NEW-ADMIN */}
        {activeTab === 'create_pdf' && (
          <form onSubmit={handleCreateExam} className="space-y-6 max-w-5xl mx-auto">
            {/* 1. TẢI FILE ĐỀ THI & ĐÁP ÁN (PHÂN TÍCH BẰNG AI GEMINI) */}
            <div className="p-6 sm:p-8 rounded-[32px] bg-gradient-to-br from-indigo-50/90 via-sky-50/80 to-blue-50/90 dark:from-slate-900/90 dark:via-indigo-950/40 dark:to-slate-900/90 border border-indigo-200/80 dark:border-indigo-500/20 shadow-xl backdrop-blur-xl space-y-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-sky-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <h2
                      className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 flex-wrap"
                      style={{ fontFamily: 'var(--font-setup-heading, var(--font-newadm-heading))' }}
                    >
                      <span>1. Tải Lên Đề Thi & Đáp Án (Phân Tích Bằng AI Gemini)</span>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white uppercase tracking-wider shadow-xs">
                        AI Tự Động
                      </span>
                    </h2>
                    <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 mt-0.5">
                      Tự động đọc, trích xuất cấu trúc đề thi, số phần, số câu và đối chiếu bảng đáp án chuẩn xác.
                    </p>
                  </div>
                </div>

                {/* Nút nạp nhanh mẫu đề thi */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLoadPresetTHPT2026}
                    className="rounded-xl border border-indigo-500/30 bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 transition hover:bg-indigo-500/20 shadow-2xs"
                  >
                    🎯 Mẫu THPT 2026
                  </button>
                  <button
                    type="button"
                    onClick={handleLoadPresetHSA}
                    className="rounded-xl border border-teal-500/30 bg-white/80 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-bold text-teal-600 dark:text-teal-400 transition hover:bg-teal-500/20 shadow-2xs"
                  >
                    ⚡ Mẫu HSA
                  </button>
                </div>
              </div>

              {/* HỎI TRƯỚC: BẠN ĐÃ CÓ FILE ĐÁP ÁN CHƯA? */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white/90 dark:bg-slate-800/90 border border-indigo-200/90 dark:border-indigo-500/20 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      Bạn đã có sẵn file / bảng đáp án riêng của đề thi này chưa?
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setHasSeparateAnswerFile(false)}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        !hasSeparateAnswerFile
                          ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-2xs font-black'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Chưa có (AI tự giải)
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasSeparateAnswerFile(true)}
                      className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                        hasSeparateAnswerFile
                          ? 'bg-indigo-600 text-white shadow-2xs font-black'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Đã có file đáp án (Khuyên dùng)</span>
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {hasSeparateAnswerFile
                    ? '💡 Bạn tải 1 bên File Đề Thi và 1 bên File Đáp Án (PDF/Ảnh). Gemini sẽ đối chiếu trực tiếp để nạp đáp án chuẩn 100%, nhanh chóng và giảm tải tính toán cho AI.'
                    : '💡 Bạn chỉ cần tải 1 file Đề Thi, Gemini sẽ tự động đọc câu hỏi và suy luận giải toàn bộ bảng đáp án.'}
                </p>
              </div>

              {/* KHU VỰC TẢI FILE: 1 BÊN ĐỀ VÀ 1 BÊN ĐÁP ÁN (HOẶC 1 CỘT KHI CHƯA CÓ ĐÁP ÁN) */}
              {hasSeparateAnswerFile ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* CỘT 1: BÊN TẢI FILE ĐỀ THI */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-indigo-200 dark:border-indigo-500/20 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                          <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          <span>1. File Đề Thi (PDF) *</span>
                        </span>
                        {examPdfFile && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                            ✓ Đã chọn
                          </span>
                        )}
                      </div>

                      {!examPdfFile ? (
                        <label className="border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 hover:border-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-indigo-50/60 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition text-center group">
                          <input
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) setExamPdfFile(f)
                            }}
                          />
                          <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition flex items-center justify-center">
                            <UploadCloud className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 block">
                              Chọn File PDF Đề Thi
                            </span>
                            <span className="text-[11px] text-slate-400 mt-0.5 block">
                              Kéo thả hoặc bấm để chọn tệp
                            </span>
                          </div>
                        </label>
                      ) : (
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-red-600 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block">
                                {examPdfFile.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {(examPdfFile.size / (1024 * 1024)).toFixed(2)} MB
                              </span>
                            </div>
                          </div>
                          <label className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold cursor-pointer transition shrink-0">
                            <span>Đổi file</span>
                            <input
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) setExamPdfFile(f)
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>

                    {/* CỘT 2: BÊN TẢI FILE ĐÁP ÁN */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-800/90 border border-emerald-200 dark:border-emerald-500/20 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          <span>2. File Đáp Án (PDF hoặc Ảnh) *</span>
                        </span>
                        {answerPdfFile && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                            ✓ Đã chọn
                          </span>
                        )}
                      </div>

                      {!answerPdfFile ? (
                        <label className="border-2 border-dashed border-emerald-200 dark:border-emerald-500/30 hover:border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20 hover:bg-emerald-50/60 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition text-center group">
                          <input
                            type="file"
                            accept="application/pdf,image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0]
                              if (f) setAnswerPdfFile(f)
                            }}
                          />
                          <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition flex items-center justify-center">
                            <UploadCloud className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="text-xs font-black text-emerald-950 dark:text-emerald-200 block">
                              Chọn File Đáp Án (PDF hoặc Ảnh)
                            </span>
                            <span className="text-[11px] text-slate-400 mt-0.5 block">
                              Bảng đáp án trắc nghiệm, lời giải hoặc ảnh chụp
                            </span>
                          </div>
                        </label>
                      ) : (
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block">
                                {answerPdfFile.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {(answerPdfFile.size / (1024 * 1024)).toFixed(2)} MB
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <label className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold cursor-pointer transition">
                              <span>Đổi file</span>
                              <input
                                type="file"
                                accept="application/pdf,image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  if (f) setAnswerPdfFile(f)
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => setAnswerPdfFile(null)}
                              className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/40 text-slate-400 hover:text-rose-600 transition"
                              title="Xóa file đáp án"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* NÚT BẮT ĐẦU PHÂN TÍCH ĐỀ & ĐỐI CHIẾU ĐÁP ÁN */}
                  <div className="flex items-center justify-end gap-3 pt-1">
                    <button
                      type="button"
                      disabled={analyzingWithAi || !examPdfFile}
                      onClick={() => handleAiAnalyze(examPdfFile || undefined, answerPdfFile)}
                      className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white text-xs font-black transition flex items-center gap-2 shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {analyzingWithAi ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Đang Phân Tích & Đối Chiếu Đáp Án...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          <span>✨ Bắt Đầu Phân Tích Đề & Nạp Đáp Án Bằng AI</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* CHẾ ĐỘ 1 CỘT (CHỈ CÓ FILE ĐỀ THI, AI TỰ GIẢI) */
                <>
                  {!examPdfFile ? (
                    <label className="border-2 border-dashed border-indigo-300 dark:border-indigo-500/30 hover:border-indigo-500 bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition text-center group shadow-xs">
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) {
                            setExamPdfFile(f)
                            handleAiAnalyze(f, null)
                          }
                        }}
                      />
                      <div className="h-12 w-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition flex items-center justify-center">
                        <UploadCloud className="h-6 w-6" />
                      </div>
                      <div>
                        <span className="text-sm font-black text-indigo-950 dark:text-indigo-200 block">
                          Bấm vào đây để chọn File PDF Đề Thi (hoặc kéo thả file vào đây)
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                          Khi tải file PDF lên, hệ thống sẽ tự động gửi tới Gemini để phân tích cấu trúc và tự giải đề ngay lập tức
                        </span>
                      </div>
                    </label>
                  ) : (
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-500/20 space-y-3 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0 border border-red-200 dark:border-red-900/40">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-900 dark:text-slate-100 truncate block">
                                {examPdfFile.name}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 shrink-0">
                                ✓ File PDF Đã Chọn
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {(examPdfFile.size / (1024 * 1024)).toFixed(2)} MB
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <label className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer transition">
                            <span>Đổi file PDF khác</span>
                            <input
                              type="file"
                              accept="application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) {
                                  setExamPdfFile(f)
                                  handleAiAnalyze(f, null)
                                }
                              }}
                            />
                          </label>

                          <button
                            type="button"
                            disabled={analyzingWithAi}
                            onClick={() => handleAiAnalyze(examPdfFile || undefined, null)}
                            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
                          >
                            {analyzingWithAi ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Đang Phân Tích & Giải...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>Phân Tích Lại Bằng AI</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {analyzingWithAi && (
                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-500/30 flex items-center gap-2.5 text-xs text-indigo-900 dark:text-indigo-200 font-bold animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>
                    {aiStatusMessage || 'AI đang xử lý file đề thi và ma trận đáp án... Vui lòng đợi trong giây lát.'}
                  </span>
                </div>
              )}
            </div>

            {/* 2. THÔNG TIN CHUNG ĐỀ THI */}
            <div className="p-6 sm:p-8 rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 shadow-xl backdrop-blur-xl space-y-5">
              <h2
                className="text-lg sm:text-xl font-black text-slate-900 dark:text-white"
                style={{ fontFamily: 'var(--font-setup-heading, var(--font-newadm-heading))' }}
              >
                2. Thông Tin Chung Đề Thi (AI Tự Động Điền)
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-slate-700 dark:text-slate-300">Tên Đề Thi *</label>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="Tự động điền sau khi tải file PDF, hoặc nhập thủ công..."
                    className="w-full h-11 px-3.5 rounded-2xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-750 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 dark:text-slate-300">Loại Kỳ Thi</label>
                  <select
                    value={examTypeVal}
                    onChange={(e) => setExamTypeVal(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-2xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {SETUP_EXAM_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 dark:text-slate-300">Thời Gian Làm Bài (Phút)</label>
                  <input
                    type="number"
                    value={examDuration}
                    onChange={(e) => setExamDuration(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-2xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    min={5}
                    max={300}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 dark:text-slate-300">Số Lần Thi Tối Đa (Max Attempts)</label>
                  <input
                    type="number"
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-2xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    min={1}
                    max={10}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-700 dark:text-slate-300">Thang Điểm Đề Thi</label>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">Quy đổi chuẩn hóa về thang 10</span>
                  </div>
                  <input
                    type="number"
                    value={examMaxScore}
                    onChange={(e) => setExamMaxScore(e.target.value)}
                    placeholder="Ví dụ: 10, 20, 50, 100..."
                    className="w-full h-11 px-3.5 rounded-2xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    min={1}
                    max={1000}
                    step="any"
                    required
                  />
                  <p className="text-[10px] text-slate-400">
                    Hệ thống sẽ tự động chuẩn hóa điểm bài làm của thí sinh về thang 10 để đồng bộ toàn hệ thống.
                  </p>
                </div>

                {/* Chọn Thư Mục Con (Môn Thi) Cho Đề */}
                <div className="space-y-1.5">
                  <label className="text-slate-700 dark:text-slate-300">
                    Gán Vào Thư Mục Môn Thi (Tùy chọn)
                  </label>
                  <select
                    value={selectedFolderId}
                    onChange={(e) => setSelectedFolderId(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-2xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">-- Chọn thư mục môn thi tương ứng --</option>
                    {allChildFolders.map((child: any) => (
                      <option key={child.id} value={child.id}>
                        {child.parentName} ➔ {child.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tùy chọn Đề Ẩn / Mã Code Bí Mật & Giám sát */}
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-black text-slate-900 dark:text-white">Đề thi ẩn (Cấp mã Access Code)</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={examIsHidden}
                        onChange={(e) => setExamIsHidden(e.target.checked)}
                        className="h-4 w-4 accent-indigo-600 cursor-pointer"
                      />
                    </div>
                    {examIsHidden && (
                      <input
                        type="text"
                        placeholder="Mã mở đề (VD: TOAN12, HSA2026...)"
                        value={examCustomCode}
                        onChange={(e) => setExamCustomCode(e.target.value.toUpperCase())}
                        className="h-9 w-full font-mono font-bold uppercase rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 outline-none"
                      />
                    )}
                  </div>

                  <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-rose-500" />
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-white">Bật giám sát chống gian lận</p>
                        <span className="text-[10px] text-[#6B7280] dark:text-slate-400 font-normal">Cảnh báo & đếm số lần thoát tab</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={requireProctoring}
                      onChange={(e) => setRequireProctoring(e.target.checked)}
                      className="h-4 w-4 accent-rose-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. THANH GẠT YÊU CẦU SAFE EXAM BROWSER (SEB) */}
            <div className={`p-6 sm:p-7 rounded-[32px] border transition-all shadow-xl backdrop-blur-xl ${
              requireSeb
                ? 'bg-sky-50/90 dark:bg-sky-950/30 border-sky-300 dark:border-sky-500/40 ring-2 ring-sky-500/20'
                : 'bg-white/85 dark:bg-slate-900/85 border-black/10 dark:border-white/10'
            }`}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center transition ${
                      requireSeb ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}>
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-setup-heading, var(--font-newadm-heading))' }}>
                      3. Yêu Cầu Thi Bằng Safe Exam Browser (SEB)
                    </h3>
                    {requireSeb ? (
                      <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-sky-600 text-white shadow-xs">
                        🛡️ ĐANG BẬT (Bắt buộc SEB)
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        🌐 ĐANG TẮT (Thi web thường)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {requireSeb
                      ? '🔒 Đề thi được bảo mật toàn diện: Gắn nhãn số 🛡️ SEB trên trang danh sách đề thi SenExam. Thí sinh bắt buộc phải cài đặt Safe Exam Browser và khởi chạy phòng thi bảo mật cao (chặn Alt+Tab, chặn chụp màn hình, chặn phần mềm bên thứ ba).'
                      : 'Thí sinh có thể làm bài trực tiếp trên trình duyệt web thông thường (Chrome, Edge, Safari...). Hãy gạt thanh công tắc bên cạnh sang BẬT nếu đây là kỳ thi chuẩn hóa đòi hỏi tính trung thực cao.'}
                  </p>
                </div>

                {/* THANH GẠT (TOGGLE SWITCH) */}
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={requireSeb}
                      onChange={(e) => setRequireSeb(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-16 h-8 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-8 peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-[26px] after:w-[26px] after:transition-all peer-checked:bg-sky-600 shadow-inner"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* 4. CẤU TRÚC ĐỀ THI & BẢNG ĐÁP ÁN LINH HOẠT */}
            <div className="p-6 sm:p-8 rounded-[32px] border border-black/10 dark:border-white/10 bg-white/85 dark:bg-slate-900/85 shadow-xl backdrop-blur-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/10 dark:border-white/10 pb-4">
                <div>
                  <h2
                    className="text-lg sm:text-xl font-black text-slate-900 dark:text-white"
                    style={{ fontFamily: 'var(--font-setup-heading, var(--font-newadm-heading))' }}
                  >
                    4. Cấu Trúc Các Phần Thi & Hướng Dẫn Tự Viết
                  </h2>
                  <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
                    Tùy biến số phần thi, số câu hỏi, cách tính điểm, hướng dẫn riêng và ảnh minh họa cho từng phần.
                  </p>
                </div>

                {/* Thống kê và Nút Thêm Phần */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40">
                    <span>{examSections.length} Phần thi</span>
                    <span>•</span>
                    <span>{totalQuestionCount} Câu hỏi</span>
                    <span>•</span>
                    <span className={totalExamPoints === 10 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
                      Tổng: {totalExamPoints.toFixed(1)} / 10.0 đ
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSection}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-indigo-500/20 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Thêm Phần Thi</span>
                  </button>
                </div>
              </div>

              {/* Danh sách các phần thi */}
              <div className="space-y-6">
                {(examSections || []).map((section, sIdx) => {
                  const qCount = parseInt(String(section.questionCount)) || 0
                  const pointsPerQ = section.totalPoints / (qCount || 1)

                  return (
                    <div
                      key={section.id || sIdx}
                      className="p-5 sm:p-6 rounded-3xl border border-black/10 dark:border-white/10 bg-black/[0.015] dark:bg-white/[0.015] space-y-5"
                    >
                      {/* Tiêu đề phần thi & nút xóa */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="h-7 w-7 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                            {sIdx + 1}
                          </span>
                          <input
                            type="text"
                            value={section.name}
                            onChange={(e) => handleUpdateSectionField(sIdx, 'name', e.target.value)}
                            placeholder={`Tên phần thi (Ví dụ: Phần ${sIdx + 1}: Trắc nghiệm...)`}
                            className="w-full px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 font-bold text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setQuickAnswersModalSecId(section.id)}
                            className="rounded-xl border border-teal-500/30 bg-teal-500/10 px-2.5 py-1.5 text-xs font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-500/20"
                          >
                            ⚡ Nhập nhanh
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveSection(sIdx)}
                            className="h-8 w-8 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 flex items-center justify-center transition shrink-0"
                            title="Xóa phần thi này"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Các tham số cấu hình: Số câu, Tổng điểm, Chế độ chia điểm, Thể loại câu hỏi */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white dark:bg-slate-800/90 p-4 rounded-2xl border border-black/10 dark:border-white/10 text-xs">
                        {/* 1. Số lượng câu hỏi */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-600 dark:text-slate-400">Số Câu Hỏi</label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={section.questionCount}
                            onChange={(e) =>
                              handleUpdateSectionField(sIdx, 'questionCount', Math.max(1, parseInt(e.target.value) || 1))
                            }
                            className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-900 font-bold focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>

                        {/* 2. Tổng điểm phần này */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-600 dark:text-slate-400">Tổng Điểm Phần Này</label>
                          <input
                            type="number"
                            step="0.25"
                            min={0}
                            max={10}
                            value={section.totalPoints}
                            onChange={(e) =>
                              handleUpdateSectionField(sIdx, 'totalPoints', Math.max(0, parseFloat(e.target.value) || 0))
                            }
                            className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-900 font-bold focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          />
                        </div>

                        {/* 3. Chế độ chia điểm */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-600 dark:text-slate-400">Cách Tính Điểm</label>
                          <select
                            value={section.scoringMode}
                            onChange={(e) => handleUpdateSectionField(sIdx, 'scoringMode', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-900 font-bold focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          >
                            <option value="auto_divide">
                              Chia đều ({pointsPerQ.toFixed(2)}đ/câu)
                            </option>
                            <option value="custom_points">Tùy chỉnh điểm từng câu</option>
                          </select>
                        </div>

                        {/* 4. Thể loại câu hỏi */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-600 dark:text-slate-400">Thể Loại Câu Hỏi</label>
                          <select
                            value={
                              section.type === 'mixed' || section.questionTypeMode === 'mixed'
                                ? 'mixed'
                                : section.questionTypeMode === 'custom'
                                ? 'custom'
                                : section.type
                            }
                            onChange={(e) => {
                              const val = e.target.value
                              if (val === 'custom') {
                                handleUpdateSectionField(sIdx, 'questionTypeMode', 'custom')
                              } else if (val === 'mixed') {
                                handleUpdateSectionField(sIdx, 'questionTypeMode', 'mixed')
                                handleUpdateSectionField(sIdx, 'type', 'mixed')
                                const count = section.questionCount || 10
                                if (!section.mixedRanges || section.mixedRanges.length === 0) {
                                  const splitPoint = Math.max(1, Math.floor(count * 0.6))
                                  handleUpdateSectionField(sIdx, 'mixedRanges', [
                                    { start: 1, end: splitPoint, type: 'single_choice', optionsCount: 4 },
                                    { start: splitPoint + 1, end: count, type: 'short_answer', optionsCount: 4 },
                                  ])
                                }
                              } else {
                                handleUpdateSectionField(sIdx, 'questionTypeMode', 'uniform')
                                handleUpdateSectionField(sIdx, 'type', val)
                              }
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-900 font-bold focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                          >
                            <option value="single_choice">🔵 Trắc nghiệm 4 lựa chọn (A, B, C, D)</option>
                            <option value="true_false">🟢 Trắc nghiệm Đúng / Sai (4 ý a, b, c, d)</option>
                            <option value="short_answer">🟠 Trả lời ngắn / Điền số</option>
                            <option value="essay">🟣 Tự luận</option>
                            <option value="mixed">🔀 Đề hỗn hợp (Theo dải câu / Nhiều dạng)</option>
                            <option value="custom">⚙️ Tùy chọn từng câu</option>
                          </select>
                        </div>
                      </div>

                      {/* Quản lý dải câu hỏi hỗn hợp (mixedRanges) */}
                      {(section.type === 'mixed' || section.questionTypeMode === 'mixed') && (
                        <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-500/30 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-200/60 dark:border-indigo-500/20 pb-2.5">
                            <div className="flex items-center gap-2">
                              <Sliders className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                              <span className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wider">
                                Phân Định Dải Câu Hỏi (Chế Độ Hỗn Hợp)
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleApplyMixedPreset(sIdx, 'thptqg')}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-slate-700 border border-indigo-200 dark:border-indigo-500/30 transition shadow-2xs"
                              >
                                Preset THPTQG (18-4-6)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplyMixedPreset(sIdx, 'hsa')}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-slate-700 border border-indigo-200 dark:border-indigo-500/30 transition shadow-2xs"
                              >
                                Preset HSA (40-10)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApplyMixedPreset(sIdx, 'tsa')}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-slate-700 border border-indigo-200 dark:border-indigo-500/30 transition shadow-2xs"
                              >
                                Preset TSA (30-6-4)
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddMixedRange(sIdx)}
                                className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs flex items-center gap-1 transition cursor-pointer"
                              >
                                <Plus className="h-3.5 w-3.5" /> Thêm dải câu
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {(section.mixedRanges || []).map((range: any, rIdx: number) => (
                              <div
                                key={rIdx}
                                className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-500/20 text-xs shadow-2xs"
                              >
                                <span className="text-indigo-900 dark:text-indigo-200 font-black text-[11px]">Dải #{rIdx + 1}:</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-600 dark:text-slate-400 text-[11px] font-semibold">Từ câu</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={range.start}
                                    onChange={(e) =>
                                      handleUpdateMixedRange(sIdx, rIdx, 'start', parseInt(e.target.value) || 1)
                                    }
                                    className="w-14 px-2 py-1 rounded-lg border border-black/10 dark:border-white/15 font-mono font-bold text-center text-xs bg-slate-50 dark:bg-slate-900"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-slate-600 dark:text-slate-400 text-[11px] font-semibold">đến</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={range.end}
                                    onChange={(e) =>
                                      handleUpdateMixedRange(sIdx, rIdx, 'end', parseInt(e.target.value) || 1)
                                    }
                                    className="w-14 px-2 py-1 rounded-lg border border-black/10 dark:border-white/15 font-mono font-bold text-center text-xs bg-slate-50 dark:bg-slate-900"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-600 dark:text-slate-400 text-[11px] font-semibold">Dạng câu:</span>
                                  <select
                                    value={range.type}
                                    onChange={(e) => handleUpdateMixedRange(sIdx, rIdx, 'type', e.target.value)}
                                    className="px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-900 text-xs font-bold"
                                  >
                                    <option value="single_choice">🔵 Trắc nghiệm 4 lựa chọn (A, B, C, D)</option>
                                    <option value="true_false">🟢 Đúng / Sai (4 ý a, b, c, d)</option>
                                    <option value="short_answer">🟠 Điền số / Trả lời ngắn</option>
                                    <option value="essay">🟣 Tự luận</option>
                                  </select>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMixedRange(sIdx, rIdx)}
                                  className="ml-auto text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                                  title="Xóa dải câu này"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                            {(!section.mixedRanges || section.mixedRanges.length === 0) && (
                              <p className="text-xs text-indigo-900/60 dark:text-indigo-300/60 italic py-1">
                                Chưa có dải câu nào được thiết lập. Hãy bấm "+ Thêm dải câu" hoặc chọn một mẫu Preset có sẵn ở trên.
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Hướng Dẫn Tự Viết & Ảnh Minh Họa Cho Phần Này */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-slate-800/90 p-4 rounded-2xl border border-black/10 dark:border-white/10">
                        {/* Hướng dẫn tự viết */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>Hướng Dẫn Làm Bài Cho Phần Này (Admin tự viết):</span>
                          </label>
                          <textarea
                            value={section.instructions}
                            onChange={(e) => handleUpdateSectionField(sIdx, 'instructions', e.target.value)}
                            placeholder="Nhập hướng dẫn làm bài chi tiết cho phần này (thí sinh sẽ đọc tại phòng chờ)..."
                            rows={3}
                            className="w-full p-2.5 rounded-xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-900 text-xs focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 leading-relaxed"
                          />
                        </div>

                        {/* Hình ảnh hướng dẫn (nếu có) */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <ImageIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                              <span>Hình Ảnh Hướng Dẫn (Nếu có):</span>
                            </span>
                            {section.instructionImage && (
                              <button
                                type="button"
                                onClick={() => handleUpdateSectionField(sIdx, 'instructionImage', '')}
                                className="text-[11px] text-rose-600 dark:text-rose-400 font-bold hover:underline"
                              >
                                Xóa ảnh
                              </button>
                            )}
                          </label>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={section.instructionImage || ''}
                              onChange={(e) => handleUpdateSectionField(sIdx, 'instructionImage', e.target.value)}
                              placeholder="Dán URL ảnh hoặc tải ảnh từ máy tính ➔"
                              className="flex-1 px-2.5 py-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-slate-50 dark:bg-slate-900 text-xs focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                            <label className="px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/15 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer transition flex items-center gap-1 shrink-0">
                              <FileUp className="h-3.5 w-3.5" />
                              <span>Tải ảnh</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  if (f) handleUploadInstructionImage(sIdx, f)
                                }}
                              />
                            </label>
                          </div>

                          {section.instructionImage && (
                            <div className="mt-2 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 max-h-28 bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                              <img
                                src={section.instructionImage}
                                alt="Ảnh hướng dẫn"
                                className="max-h-28 w-auto object-contain"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bảng nhập đáp án & điểm cho các câu hỏi của phần này */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                          <span>Bảng Nhập Đáp Án ({section.questionCount} câu hỏi):</span>
                          {section.scoringMode === 'custom_points' && (
                            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-normal">
                              ⚠️ Đang bật chế độ tùy chỉnh điểm từng câu
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                          {Array.from({ length: qCount }).map((_, qIdx) => {
                            const ans = section.correctAnswers?.[qIdx]
                            const rawQType =
                              section.questionTypeMode === 'custom' && section.questionTypes?.[qIdx]
                                ? section.questionTypes[qIdx]
                                : section.type
                            const qType = normalizeQuestionType(rawQType, section, qIdx)

                            const currentPoint =
                              section.scoringMode === 'custom_points'
                                ? section.pointsPerQuestion?.[qIdx] ?? pointsPerQ
                                : pointsPerQ

                            return (
                              <div
                                key={qIdx}
                                className="p-3 rounded-2xl bg-white dark:bg-slate-800/95 border border-black/10 dark:border-white/10 text-xs shadow-2xs space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-600 dark:text-slate-400">Câu {qIdx + 1}</span>
                                    <span
                                      className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                                        qType === 'single_choice'
                                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                                          : qType === 'true_false'
                                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                          : qType === 'short_answer'
                                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                          : 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400'
                                      }`}
                                    >
                                      {qType === 'single_choice'
                                        ? 'TN'
                                        : qType === 'true_false'
                                        ? 'Đ/S'
                                        : qType === 'short_answer'
                                        ? 'Số'
                                        : 'Luận'}
                                    </span>
                                  </div>

                                  {/* Điểm tùy chỉnh nếu bật custom_points */}
                                  {section.scoringMode === 'custom_points' ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        value={currentPoint}
                                        onChange={(e) =>
                                          handleSetQuestionPoint(sIdx, qIdx, parseFloat(e.target.value) || 0)
                                        }
                                        className="w-12 px-1 py-0.5 rounded border border-black/10 dark:border-white/15 text-center font-bold text-[11px] bg-slate-50 dark:bg-slate-900"
                                      />
                                      <span className="text-[10px] text-slate-400">đ</span>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {pointsPerQ.toFixed(2)}đ
                                    </span>
                                  )}
                                </div>

                                {/* Lựa chọn thể loại câu nếu ở chế độ custom */}
                                {section.questionTypeMode === 'custom' && (
                                  <select
                                    value={qType}
                                    onChange={(e) => handleSetQuestionType(sIdx, qIdx, e.target.value)}
                                    className="w-full px-1.5 py-0.5 rounded border border-black/10 dark:border-white/15 text-[10px] font-bold bg-slate-50 dark:bg-slate-900"
                                  >
                                    <option value="single_choice">4 Lựa chọn</option>
                                    <option value="true_false">Đúng / Sai</option>
                                    <option value="short_answer">Điền số</option>
                                    <option value="essay">Tự luận</option>
                                  </select>
                                )}

                                {/* Nhập đáp án cho dạng trắc nghiệm 4 lựa chọn */}
                                {qType === 'single_choice' && (
                                  <div className="flex gap-1 pt-1">
                                    {['A', 'B', 'C', 'D'].map((opt) => (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => handleSetCorrectAnswer(sIdx, qIdx, opt)}
                                        className={`flex-1 h-7 rounded-lg font-black transition cursor-pointer ${
                                          ans === opt
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-black/10'
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {/* Nhập đáp án cho dạng Đúng / Sai 4 ý */}
                                {qType === 'true_false' && (
                                  <div className="space-y-1 pt-1">
                                    {['a', 'b', 'c', 'd'].map((sub) => (
                                      <div key={sub} className="flex items-center justify-between text-[11px]">
                                        <span className="font-bold uppercase text-slate-400">{sub}:</span>
                                        <div className="flex gap-1">
                                          <button
                                            type="button"
                                            onClick={() => handleSetCorrectAnswerTF(sIdx, qIdx, sub, 'Đ')}
                                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] cursor-pointer ${
                                              ans?.[sub] === 'Đ' || ans?.[sub] === 'D'
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-black/10'
                                            }`}
                                          >
                                            Đ
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleSetCorrectAnswerTF(sIdx, qIdx, sub, 'S')}
                                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] cursor-pointer ${
                                              ans?.[sub] === 'S'
                                                ? 'bg-rose-600 text-white'
                                                : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-black/10'
                                            }`}
                                          >
                                            S
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Nhập đáp án cho dạng trả lời ngắn / điền số */}
                                {qType === 'short_answer' && (
                                  <div className="pt-1">
                                    <input
                                      type="text"
                                      value={ans || ''}
                                      onChange={(e) => handleSetCorrectAnswer(sIdx, qIdx, e.target.value)}
                                      placeholder="Đáp số..."
                                      className="w-full px-2 py-1.5 rounded-lg border border-black/10 dark:border-white/15 text-xs font-mono font-bold bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </div>
                                )}

                                {/* Dạng tự luận */}
                                {qType === 'essay' && (
                                  <div className="pt-1">
                                    <input
                                      type="text"
                                      value={ans || ''}
                                      onChange={(e) => handleSetCorrectAnswer(sIdx, qIdx, e.target.value)}
                                      placeholder="Barem / từ khóa..."
                                      className="w-full px-2 py-1 rounded-lg border border-black/10 dark:border-white/15 text-[11px] bg-slate-50 dark:bg-slate-900"
                                    />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Nút Xuất Bản */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('manage')}
                className="px-5 py-3 rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={creatingExam}
                className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white text-xs font-black uppercase tracking-wider transition flex items-center gap-2 shadow-xl shadow-indigo-500/25 cursor-pointer disabled:opacity-50"
              >
                {creatingExam ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                <span>Xuất Bản Toàn Bộ Đề Thi Lên Hệ Thống</span>
              </button>
            </div>
          </form>
        )}

        {/* MODAL NHẬP ĐÁP ÁN NHANH BẰNG TEXT */}
        {quickAnswersModalSecId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
            <div className="relative w-full max-w-md rounded-[28px] border border-white/20 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
              <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-setup-heading, var(--font-newadm-heading))' }}>
                ⚡ Nhập Chuỗi Đáp Án Nhanh
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-slate-400">
                Dán chuỗi đáp án (VD: <code>1A 2B 3C 4D...</code> hoặc <code>1Đ-S-Đ-S 2S-Đ-Đ-S...</code> hoặc dán chuỗi chữ cái <code>ABCDADCB...</code>):
              </p>

              <textarea
                rows={5}
                value={quickAnswersText}
                onChange={(e) => setQuickAnswersText(e.target.value)}
                placeholder="Dán chuỗi đáp án vào đây..."
                className="w-full font-mono text-xs rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 p-3 outline-none focus:border-indigo-500"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setQuickAnswersModalSecId(null)}
                  className="flex-1 rounded-xl border border-black/10 dark:border-white/10 py-2.5 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyQuickAnswers(quickAnswersModalSecId, quickAnswersText)}
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 text-xs font-black uppercase tracking-wider shadow transition"
                >
                  Nạp Đáp Án
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* MODAL AI SOẠN ĐỀ GEMINI ĐA TẦNG */}
      {/* ==================================================== */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-xl rounded-[32px] border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-500" />
                <h3 className="text-base font-black" style={{ fontFamily: 'var(--font-setup-heading)' }}>
                  AI Gemini Soạn Đề KaTeX
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-black dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Chủ đề / Yêu cầu cụ thể cho AI:
                </label>
                <textarea
                  rows={3}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Ví dụ: Tạo 5 câu trắc nghiệm Toán 12 về Nguyên hàm - Tích phân có công thức KaTeX đẹp và lời giải chi tiết..."
                  className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 p-3 text-xs font-bold outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Số lượng câu hỏi</label>
                  <select
                    value={aiQuestionCount}
                    onChange={(e) => setAiQuestionCount(Number(e.target.value))}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs font-bold outline-none"
                  >
                    <option value={3}>3 câu</option>
                    <option value={5}>5 câu</option>
                    <option value={10}>10 câu</option>
                    <option value={15}>15 câu</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Mức độ tư duy</label>
                  <select
                    value={aiDifficulty}
                    onChange={(e) => setAiDifficulty(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs font-bold outline-none"
                  >
                    <option value="Nhận biết - Thông hiểu">Nhận biết - Thông hiểu</option>
                    <option value="Vận dụng">Vận dụng</option>
                    <option value="Vận dụng cao">Vận dụng cao (Phân hóa)</option>
                  </select>
                </div>
              </div>

              {aiStatusMessage && (
                <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-3 text-xs text-indigo-700 dark:text-indigo-300 font-bold flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>{aiStatusMessage}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                disabled={aiLoading}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold"
              >
                Hủy
              </button>

              <button
                type="button"
                onClick={handleGenerateAiKatexExam}
                disabled={aiLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 py-2.5 text-xs font-black shadow-md hover:scale-105 active:scale-95 transition disabled:opacity-50"
              >
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Bắt đầu soạn đề
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL HƯỚNG DẪN ĐỊNH DẠNG FILE LATEX & QUY ƯỚC NHẬN DIỆN */}
      {showLatexHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-xs">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-setup-heading)' }}>
                    Hướng Dẫn Định Dạng Viết Đề LaTeX & Nhận Diện Câu Hỏi
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    Quy chuẩn nhận diện tự động cấu trúc đề 3 phần (Chuẩn Bộ GD 2026, HSA, TSA)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowLatexHelpModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="space-y-4 text-xs">
              {/* Section 1: 3 dạng câu hỏi chính */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl border border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2">
                  <span className="font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block">
                    1. Trắc nghiệm 4 lựa chọn
                  </span>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                    Mỗi câu có 4 phương án A, B, C, D. Hệ thống nhận diện qua <code>\choice&#123;A&#125;&#123;B&#125;&#123;C&#125;&#123;D&#125;</code> hoặc <code>A. B. C. D.</code>
                  </p>
                  <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                    Đáp án đúng: <code>\True</code>, <code>\textbf&#123;A&#125;</code>, hoặc bảng đáp án riêng.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl border border-purple-500/20 bg-purple-50/40 dark:bg-purple-950/20 space-y-2">
                  <span className="font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider block">
                    2. Đúng / Sai 4 ý (a, b, c, d)
                  </span>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                    Mỗi câu có 4 ý con <code>a)</code>, <code>b)</code>, <code>c)</code>, <code>d)</code> hoặc lệnh <code>\choiceTF</code>. Thí sinh chọn Đúng hoặc Sai cho từng ý.
                  </p>
                  <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
                    Đáp án: <code>\True</code> trước ý đúng, hoặc bảng đáp án riêng.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl border border-teal-500/20 bg-teal-50/40 dark:bg-teal-950/20 space-y-2">
                  <span className="font-black text-teal-700 dark:text-teal-300 uppercase tracking-wider block">
                    3. Trả lời ngắn / Điền số
                  </span>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                    Thí sinh tính toán và nhập đáp số số học (số nguyên hoặc thập phân, ví dụ <code>2.5</code>, <code>-4</code>).
                  </p>
                  <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400">
                    Đáp án: <code>\shortans&#123;2.5&#125;</code> hoặc <code>Đáp số: 2.5</code>.
                  </p>
                </div>
              </div>

              {/* Section 2: Công thức toán & Lời giải */}
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <span className="font-black text-slate-800 dark:text-slate-200">
                  ✨ Quy ước công thức KaTeX & Lời giải chi tiết:
                </span>
                <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                  <li><strong>Công thức nội dòng:</strong> Bọc trong cặp dấu <code>$...$</code>, ví dụ: <code>$y = f(x) = x^2 - 4x + 3$</code>.</li>
                  <li><strong>Công thức khối nổi bật:</strong> Bọc trong cặp dấu <code>$$...$$</code>, ví dụ: <code>$$\int_0^1 (2x + 1)dx = 2$$</code>.</li>
                  <li><strong>Lời giải chi tiết:</strong> Viết trong lệnh <code>\loigiai&#123;...&#125;</code> hoặc môi trường <code>\begin&#123;solution&#125;...\end&#123;solution&#125;</code>. Nếu chưa có, Gemini sẽ tự động giải toán từng bước và bổ sung.</li>
                  <li><strong>Bảng đáp án riêng:</strong> Bạn có thể đính kèm file đáp án (PDF/Ảnh) hoặc nhập văn bản nhanh dạng <code>1A 2B 3C...</code> để hệ thống đối chiếu 100%.</li>
                </ul>
              </div>

              {/* Section 3: Mẫu code LaTeX chuẩn có thể Copy 1-chạm */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-800 dark:text-slate-200">
                    📋 Mẫu mã nguồn LaTeX hoàn chỉnh (Chuẩn 2026):
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(SAMPLE_LATEX_EXAM)
                        setCopiedLatexSample(true)
                        setTimeout(() => setCopiedLatexSample(false), 2000)
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-600 text-white font-bold text-[11px] hover:bg-indigo-700 transition cursor-pointer"
                    >
                      {copiedLatexSample ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedLatexSample ? 'Đã sao chép!' : 'Sao chép mẫu'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLatexCode(SAMPLE_LATEX_EXAM)
                        setLatexInputMode('code')
                        setShowLatexHelpModal(false)
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border border-indigo-500/30 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 font-bold text-[11px] hover:bg-indigo-100 transition cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Dán mẫu vào khung soạn</span>
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-900 text-slate-200 p-4 font-mono text-[11px] overflow-x-auto max-h-56">
                  <pre>{SAMPLE_LATEX_EXAM}</pre>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end pt-3 border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={() => setShowLatexHelpModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs transition hover:opacity-90 cursor-pointer"
              >
                Đã hiểu, đóng hướng dẫn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL QUẢN LÝ HỌC SINH & GIÁM SÁT VI PHẠM THI CỬ */}
      {managingExamStudents && (
        <ExamStudentProctorModal
          isOpen={Boolean(managingExamStudents)}
          onClose={() => setManagingExamStudents(null)}
          exam={managingExamStudents}
        />
      )}

      {/* ==================================================== */}
      {/* MODAL CÀI ĐẶT CẤU HÌNH ĐỀ THI (NÚT SLIDERS CẠNH THÙNG RÁC) */}
      {/* ==================================================== */}
      {editingExamSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl p-6 sm:p-7 max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-black/5 dark:border-white/5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-setup-heading)' }}>
                      Cài Đặt Cấu Hình Đề Thi
                    </h3>
                    {checkIsKatexExam(editingExamSettings) ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                        ✨ KaTeX Live
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                        📄 Đề PDF
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold truncate max-w-sm sm:max-w-md">
                    {editingExamSettings.title}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingExamSettings(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSaveExamSettings} className="flex-1 overflow-y-auto py-5 space-y-5 pr-1 text-xs">
              {/* Tên đề thi */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                  Tên đề thi *
                </label>
                <input
                  type="text"
                  required
                  value={settingsTitle}
                  onChange={(e) => setSettingsTitle(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500"
                />
              </div>

              {/* Thông số cơ bản */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">Môn học</label>
                  <select
                    value={settingsSubject}
                    onChange={(e) => setSettingsSubject(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500"
                  >
                    <option value="Toán học">Toán học</option>
                    <option value="Vật lí">Vật lí</option>
                    <option value="Hóa học">Hóa học</option>
                    <option value="Sinh học">Sinh học</option>
                    <option value="Tin học">Tin học</option>
                    <option value="Tiếng Anh">Tiếng Anh</option>
                    <option value="Ngữ văn">Ngữ văn</option>
                    <option value="Lịch sử">Lịch sử</option>
                    <option value="Địa lí">Địa lí</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">Loại kỳ thi</label>
                  <select
                    value={settingsExamType}
                    onChange={(e) => setSettingsExamType(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500"
                  >
                    {SETUP_EXAM_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">Thời gian làm bài (phút)</label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    value={settingsDuration}
                    onChange={(e) => setSettingsDuration(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">Thang điểm tối đa</label>
                  <input
                    type="number"
                    step="0.1"
                    value={settingsMaxScore}
                    onChange={(e) => setSettingsMaxScore(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-xs font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* CÀI ĐẶT ĐẢO CÂU & ĐẢO ĐÁP ÁN (DÀNH RIÊNG CHO ĐỀ KATEX) */}
              {checkIsKatexExam(editingExamSettings) ? (
                <div className="p-4 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-pink-50/40 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-pink-950/20 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Shuffle className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-200">
                        Tính Năng Xáo Trộn Đề KaTeX (Chống Học Vẹt)
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                        Thay đổi thứ tự câu và các phương án mỗi lần làm lại để thí sinh không thể ghi nhớ vị trí đáp án cũ.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-white/80 dark:bg-slate-800/80 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={settingsShuffleQuestions}
                        onChange={(e) => setSettingsShuffleQuestions(e.target.checked)}
                        className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                      />
                      <div>
                        <span className="font-black text-slate-800 dark:text-slate-100 block">
                          🔀 Đảo thứ tự câu hỏi
                        </span>
                        <span className="text-[10px] text-slate-500">Mỗi thí sinh có thứ tự câu khác nhau</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-white/80 dark:bg-slate-800/80 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={settingsShuffleOptions}
                        onChange={(e) => setSettingsShuffleOptions(e.target.checked)}
                        className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                      />
                      <div>
                        <span className="font-black text-slate-800 dark:text-slate-100 block">
                          🔄 Đảo đáp án (A, B, C, D)
                        </span>
                        <span className="text-[10px] text-slate-500">Đảo ngẫu nhiên vị trí các lựa chọn</span>
                      </div>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                    <Lock className="h-4 w-4" />
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
                    <strong>Đề thi PDF:</strong> Đề sử dụng file đề in cố định nên tính năng <em>Đảo câu</em> và <em>Đảo đáp án</em> không khả dụng. Bạn có thể chuyển sang định dạng KaTeX để sử dụng trọn vẹn các tính năng xáo trộn này.
                  </p>
                </div>
              )}

              {/* Chế độ xem lại & Bảo mật */}
              <div className="space-y-3 pt-2 border-t border-black/5 dark:border-white/5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settingsAllowReview}
                    onChange={(e) => setSettingsAllowReview(e.target.checked)}
                    className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Cho phép học sinh xem lại lời giải chi tiết sau khi nộp bài
                  </span>
                </label>

                {/* ĐẶC QUYỀN VIP */}
                <label className="flex items-center gap-2.5 p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settingsIsVip}
                    onChange={(e) => setSettingsIsVip(e.target.checked)}
                    className="h-4 w-4 rounded accent-amber-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5 text-xs">
                      <Crown className="h-4 w-4 text-amber-500" /> Đề thi dành riêng cho tài khoản VIP
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block">
                      Chỉ học sinh sở hữu gói VIP hoặc tài khoản Giáo viên/Admin mới được phép vào thi.
                    </span>
                  </div>
                </label>

                <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/50 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settingsIsHidden}
                      onChange={(e) => setSettingsIsHidden(e.target.checked)}
                      className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Chế độ đề thi riêng tư (Yêu cầu nhập mã truy cập mới được vào thi)
                    </span>
                  </label>

                  {settingsIsHidden && (
                    <div className="pt-2 flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Mã truy cập đề (Access Code)</label>
                        <input
                          type="text"
                          value={settingsAccessCode}
                          onChange={(e) => setSettingsAccessCode(e.target.value.toUpperCase())}
                          placeholder="VD: 7YHSTB"
                          className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 font-mono font-black text-xs uppercase outline-none focus:border-indigo-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setSettingsAccessCode(Math.random().toString(36).substring(2, 8).toUpperCase())}
                        className="mt-4 px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 hover:bg-slate-100 text-xs font-bold transition shrink-0 cursor-pointer"
                        title="Tạo mã ngẫu nhiên"
                      >
                        🎲 Tạo mã mới
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 p-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settingsRequireSeb}
                      onChange={(e) => setSettingsRequireSeb(e.target.checked)}
                      className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">Khóa trình duyệt SEB</span>
                      <span className="text-[10px] text-slate-400">Yêu cầu Safe Exam Browser v3.8</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={settingsRequireProctoring}
                      onChange={(e) => setSettingsRequireProctoring(e.target.checked)}
                      className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">Giám sát chống gian lận</span>
                      <span className="text-[10px] text-slate-400">Ghi nhận tab switch, fullscreen</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Thông báo thành công */}
              {settingsSuccessMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{settingsSuccessMsg}</span>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-black/5 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setEditingExamSettings(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-black/5 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>

                <button
                  type="submit"
                  disabled={savingExamSettings}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs uppercase tracking-wider shadow-md transition hover:scale-105 active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingExamSettings ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Lưu Thay Đổi Cài Đặt</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )

  if (embedded) {
    return (
      <div className={`${headingFont.variable} ${bodyFont.variable} w-full text-[#1E293B] dark:text-slate-100 font-sans`}>
        {bodyContent}
      </div>
    )
  }

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen bg-[#F4F7FA] dark:bg-[#080D1A] text-[#1E293B] dark:text-slate-100 font-sans transition-colors duration-300`}
      style={themeVars}
    >
      {/* HEADER ĐIỀU HƯỚNG */}
      <header className="sticky top-0 z-30 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/new-dashboard"
            prefetch={false}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
            title="Quay lại Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black leading-tight" style={{ fontFamily: 'var(--font-setup-heading)' }}>
                Soạn Đề KaTeX & Khóa Học
              </h1>
              {/* BADGE 2 CHẾ ĐỘ NGẦM */}
              {userRole === 'admin' || userRole === 'collab' || userRole === 'teacher' ? (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                  <ShieldCheck className="h-3 w-3" /> Toàn hệ thống
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                  <GraduationCap className="h-3 w-3" /> Cá nhân
                </span>
              )}
            </div>
            <p className="text-xs text-[#6B7280] dark:text-slate-400">
              Quản lý đề thi, soạn đề KaTeX trực tiếp không cần PDF và hỗ trợ AI Gemini đa tầng.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(userRole === 'admin' || userRole === 'collab') && (
            <Link
              href="/new-admin-dashboard"
              prefetch={false}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-2xl border border-black/10 dark:border-white/15 bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition shadow-sm"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-indigo-500" /> <span className="hidden sm:inline">Admin Portal</span>
            </Link>
          )}

          <button
            type="button"
            onClick={toggleDarkMode}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm backdrop-blur-xl transition hover:scale-105"
            title="Chuyển chế độ Sáng / Tối"
          >
            {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
          </button>
        </div>
      </header>
      {bodyContent}
    </main>
  )
}

type ExamItem = {
  id: string
  title: string
  exam_type: string
  subject?: string | null
  description?: string | null
  duration?: number
  is_free?: boolean
  price?: number
  price_vnd?: number
  is_vip?: boolean
  vip_discount_percent?: number
  tags?: string[]
  drive_file_id?: string
  pdf_url?: string
  access_code?: string
  exam_structure?: any
  require_seb?: boolean
  folder_id?: string | null
  parent_folder_id?: string | null
  is_hidden?: boolean
  created_by?: string | null
}

type SubmissionItem = {
  id: string
  exam_id: string
  user_id: string
  score: number | null
  time_spent: number | null
  is_graded: boolean
  feedback: string | null
  created_at: string
  exams?: {
    id?: string
    title?: string
    exam_type?: string
    subject?: string
    duration?: number
    pdf_url?: string | null
    solution_pdf_url?: string | null
    drive_file_id?: string | null
    allow_review?: boolean
  } | null
}

interface SebChildFolder {
  id: string
  name: string
  parent_id?: string | null
  exam_count?: number
  icon?: string
  description?: string
}

interface SebParentFolder {
  id: string
  name: string
  parent_id: string | null
  icon?: string
  description?: string
  children: SebChildFolder[]
}

const EXAM_TYPES = ['Tất cả', 'THPTQG', 'HSA', 'TSA', 'SPT', 'ĐGNL', 'ĐGTD']
const HISTORY_EXAM_TYPES = ['Tất cả', 'THPTQG', 'HSA', 'TSA', 'SPT', 'ĐGNL']

// Trợ thủ phân tích tổng số câu hỏi theo từng loại (Trắc nghiệm, Đúng/Sai, Trả lời ngắn)
function getExamQuestionsBreakdown(examList: ExamItem[]) {
  let choiceCount = 0
  let tfCount = 0
  let saCount = 0

  examList.forEach((ex) => {
    let struct = ex.exam_structure
    if (typeof struct === 'string') {
      try {
        struct = JSON.parse(struct)
      } catch {
        struct = []
      }
    }
    if (struct && typeof struct === 'object' && !Array.isArray(struct) && Array.isArray(struct.sections)) {
      struct = struct.sections
    }
    if (!Array.isArray(struct)) return

    struct.forEach((section: any) => {
      const questions = Array.isArray(section?.questions) ? section.questions : []
      if (questions.length > 0) {
        questions.forEach((q: any) => {
          const qType = String(q?.type || section?.type || 'single_choice').toLowerCase().trim()
          if (qType === 'true_false') tfCount++
          else if (qType === 'short_answer') saCount++
          else choiceCount++
        })
      } else {
        const count = parseInt(section?.questionCount) || 0
        const sType = String(section?.type || 'single_choice').toLowerCase().trim()
        if (sType === 'true_false') tfCount += count
        else if (sType === 'short_answer') saCount += count
        else choiceCount += count
      }
    })
  })

  return { choiceCount, tfCount, saCount, total: choiceCount + tfCount + saCount }
}

interface LibraryFolderItem {
  id: string
  name: string
  parent_id: string | null
  created_by: string | null
  created_at: string
}

interface LibraryDocItem {
  id: string
  title: string
  drive_file_id: string
  folder_id: string | null
  created_by: string | null
  created_at: string
  is_vip_only?: boolean
  description?: string | null
}

function UnifiedHubContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState<'exams' | 'library' | 'create' | 'history'>('exams')
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isVipUser, setIsVipUser] = useState(false)
  const [exams, setExams] = useState<ExamItem[]>([])
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // ==========================================
  // THƯ VIỆN SEN ONLINE (GIAO THOA FEPN & SENEXAM)
  // ==========================================
  const [libraryFolders, setLibraryFolders] = useState<LibraryFolderItem[]>([])
  const [libraryDocs, setLibraryDocs] = useState<LibraryDocItem[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libCurrentFolderId, setLibCurrentFolderId] = useState<string | null>(null)
  const [libFolderSearch, setLibFolderSearch] = useState('')
  const [libDocSearch, setLibDocSearch] = useState('')
  const [libVipFilter, setLibVipFilter] = useState<'all' | 'free' | 'vip'>('all')
  const [libExpandedParents, setLibExpandedParents] = useState<Record<string, boolean>>({})
   const [libMobileTreeOpen, setLibMobileTreeOpen] = useState(false)
  const [libPreviewDoc, setLibPreviewDoc] = useState<LibraryDocItem | null>(null)
  const [libPreviewFullscreen, setLibPreviewFullscreen] = useState(false)

  // Cải tiến FEPN x SenExam: Thư mục cây to ẩn thành nút 3 gạch ngang khi chọn môn học -> Bấm vào hiện floating cây to
  const [libFloatingTreeOpen, setLibFloatingTreeOpen] = useState(false)
  const [libSmallTreeCategory, setLibSmallTreeCategory] = useState<'slides' | 'exercises' | 'videos' | 'exams' | string>('slides')
  const [libActiveInlineDoc, setLibActiveInlineDoc] = useState<LibraryDocItem | null>(null)
  const [libSplitRatio, setLibSplitRatio] = useState<'35:65' | '45:55' | '60:40'>('45:55')
  const [libAudioRecordingEnabled, setLibAudioRecordingEnabled] = useState(false)
  const [libToast, setLibToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null)

  // Drag & Drop state
  const [draggedItem, setDraggedItem] = useState<{
    type: 'doc' | 'folder'
    id: string
    name?: string
    sourceFolderId?: string | null
    sourceCategory?: string
  } | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null)

  // Modals quản lý Thư viện
  const [showLibCreateModal, setShowLibCreateModal] = useState(false)
  const [libCreateType, setLibCreateType] = useState<'folder' | 'subject'>('subject')
  const [libNewName, setLibNewName] = useState('')
  const [libNewParentId, setLibNewParentId] = useState<string | null>(null)
  const [libNewDesc, setLibNewDesc] = useState('')
  const [libCreateLoading, setLibCreateLoading] = useState(false)
  const [libCreateError, setLibCreateError] = useState('')

  const [showLibUploadModal, setShowLibUploadModal] = useState(false)
  const [libUploadTitle, setLibUploadTitle] = useState('')
  const [libUploadCategory, setLibUploadCategory] = useState<'slides' | 'exercises' | 'videos'>('slides')
  const [libUploadIsVip, setLibUploadIsVip] = useState(false)
  const [libUploadTargetFolderId, setLibUploadTargetFolderId] = useState<string | null>(null)
  const [libUploadFiles, setLibUploadFiles] = useState<File[]>([])
  const [libUploadStatus, setLibUploadStatus] = useState<{ type: 'idle' | 'uploading' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' })

  const [showLibAttachExamModal, setShowLibAttachExamModal] = useState(false)
  const [libAttachExamSearch, setLibAttachExamSearch] = useState('')
  const [libAttachTargetFolderId, setLibAttachTargetFolderId] = useState<string | null>(null)

  const [showLibRenameModal, setShowLibRenameModal] = useState(false)
  const [libRenameTarget, setLibRenameTarget] = useState<{ id: string; type: 'folder' | 'doc'; name: string } | null>(null)
  const [libRenameValue, setLibRenameValue] = useState('')

  // Cây Thư Mục Mẹ - Con theo kiến trúc SEB
  const [folders, setFolders] = useState<SebParentFolder[]>([])
  const [folderSearch, setFolderSearch] = useState('')
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({})
  const [selectedChildId, setSelectedChildId] = useState<string>('')
  const [selectedFolderObj, setSelectedFolderObj] = useState<SebChildFolder | null>(null)
  const [mobileFolderOpen, setMobileFolderOpen] = useState(false)

  // Tab Kho Đề states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('Tất cả')

  // Tuyển tập đề states
  const [collections, setCollections] = useState<ExamCollection[]>([])
  const [activeCollection, setActiveCollection] = useState<ExamCollection | null>(null)
  const [showAdminPackageModal, setShowAdminPackageModal] = useState(false)
  const [packagingEditingId, setPackagingEditingId] = useState<string | null>(null)
  const [packagingSubject, setPackagingSubject] = useState('')
  const [packagingTitle, setPackagingTitle] = useState('')
  const [packagingDesc, setPackagingDesc] = useState('')
  const [packagingSelectedExamIds, setPackagingSelectedExamIds] = useState<string[]>([])
  const [packagingExamSearch, setPackagingExamSearch] = useState('')
  const [packagingError, setPackagingError] = useState('')
  const [packagingLoading, setPackagingLoading] = useState(false)

  // Modal trộn đề (Student)
  const [showMixModal, setShowMixModal] = useState(false)
  const [mixIncludeChoice, setMixIncludeChoice] = useState(true)
  const [mixIncludeTF, setMixIncludeTF] = useState(true)
  const [mixIncludeSA, setMixIncludeSA] = useState(true)
  const [mixQuestionCount, setMixQuestionCount] = useState(40)
  const [mixDuration, setMixDuration] = useState(50)
  const [mixTitle, setMixTitle] = useState('')
  const [mixError, setMixError] = useState('')
  const [mixLoading, setMixLoading] = useState(false)
  const [showDetailedMix, setShowDetailedMix] = useState(false)
  const [examMixConfigs, setExamMixConfigs] = useState<Record<string, { enabled: boolean; count: number }>>({})

  // Nhập mã truy cập đề riêng tư
  const [accessCode, setAccessCode] = useState('')
  const [accessCodeError, setAccessCodeError] = useState('')
  const [accessCodeLoading, setAccessCodeLoading] = useState(false)

  // PDF Preview Modal
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)
  const [previewPdfTitle, setPreviewPdfTitle] = useState('')

  // Tab Lịch Sử Bài Nộp states
  const [historySearchQuery, setHistorySearchQuery] = useState('')
  const [historySelectedType, setHistorySelectedType] = useState('Tất cả')
  const [filterScoreStatus, setFilterScoreStatus] = useState<'all' | 'high' | 'low' | 'graded'>('all')
  const [chartExamFilter, setChartExamFilter] = useState('Tất cả')
  const [showChart, setShowChart] = useState(true)
  const [chartZoom, setChartZoom] = useState(1)
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest')
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; title: string; score: number; date: string } | null>(null)

  const deferredQuery = useDeferredValue(searchQuery)
  const deferredHistoryQuery = useDeferredValue(historySearchQuery)

  // Đọc tab & folder từ search params (hỗ trợ cả ?tab=... và ?exams, ?library, ?setup-courses, ?history)
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    const folderParam = searchParams.get('folder')

    if (folderParam) {
      setLibCurrentFolderId(folderParam)
    }

    if (tabParam === 'history' || searchParams.has('history') || searchParams.has('=history')) {
      setActiveTab('history')
    } else if (
      tabParam === 'setup-courses' ||
      tabParam === 'create' ||
      searchParams.has('setup-courses') ||
      searchParams.has('=setup-courses') ||
      searchParams.has('create')
    ) {
      setActiveTab('create')
    } else if (
      tabParam === 'library' ||
      tabParam === 'library-online' ||
      searchParams.has('library') ||
      searchParams.has('=library')
    ) {
      setActiveTab('library')
    } else if (
      tabParam === 'exams' ||
      searchParams.has('exams') ||
      searchParams.has('=exams')
    ) {
      setActiveTab('exams')
    }
  }, [searchParams])

  // Chuyển tab mượt mà và cập nhật URL sạch sẽ không reload server
  const handleSwitchTab = (tab: 'exams' | 'library' | 'create' | 'history') => {
    setActiveTab(tab)
    const paramKey = tab === 'create' ? 'setup-courses' : tab
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      ;['tab', 'exams', 'setup-courses', 'history', 'library', '=exams', '=setup-courses', '=history', '=library'].forEach((k) =>
        url.searchParams.delete(k)
      )
      url.searchParams.set('tab', paramKey)
      if (tab !== 'library') {
        url.searchParams.delete('folder')
      }
      window.history.replaceState(null, '', url.pathname + '?' + url.searchParams.toString())
    }
  }

  // Chọn môn học / thư mục Thư viện và đồng bộ ID vào URL không chuyển trang
  const handleSelectLibFolder = (folderId: string | null) => {
    setLibCurrentFolderId(folderId)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', 'library')
      if (folderId) {
        url.searchParams.set('folder', folderId)
      } else {
        url.searchParams.delete('folder')
      }
      window.history.replaceState(null, '', url.pathname + '?' + url.searchParams.toString())
    }
  }

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    const initData = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const user = authData?.user
        if (!user) {
          router.replace('/new-idp')
          return
        }

        setCurrentUserId(user.id)
        setUserEmail(user.email || null)
        await ensureStudentProfile(user.id)

        // Kiểm tra quyền Admin đa tầng (an toàn, không truy vấn cột is_admin không tồn tại)
        let hasAdminRole = false
        const userEmailLower = (user.email || '').toLowerCase().trim()
        const metaRole = (user.user_metadata?.role || user.app_metadata?.role || '').toLowerCase().trim()

        if (
          userEmailLower === 'hoangbinhminh2508@gmail.com' ||
          userEmailLower === 'admin@senexam.me' ||
          userEmailLower === 'admin@senexam.com' ||
          userEmailLower.includes('admin') ||
          metaRole === 'admin' ||
          metaRole === 'collab' ||
          metaRole === 'teacher'
        ) {
          hasAdminRole = true
        }

        try {
          const { data: profile, error: pErr } = await supabase
            .from('profiles')
            .select('role, email, vip_expires_at')
            .eq('id', user.id)
            .maybeSingle()

          if (!pErr && profile) {
            if (profile.vip_expires_at && new Date(profile.vip_expires_at).getTime() > Date.now()) {
              setIsVipUser(true)
            }
            const role = (profile.role || '').toLowerCase().trim()
            const pEmail = (profile.email || '').toLowerCase().trim()
            if (
              role === 'admin' ||
              role === 'collab' ||
              role === 'teacher' ||
              pEmail === 'hoangbinhminh2508@gmail.com' ||
              pEmail.includes('admin')
            ) {
              hasAdminRole = true
            }
          }
        } catch (e) {
          console.warn('Lỗi kiểm tra quyền profile:', e)
        }

        setIsAdmin(hasAdminRole)

        // 1. Tải cây Thư mục Mẹ - Con (SEB folders)
        try {
          const fRes = await fetch('/api/seb/folders')
          const fData = await fRes.json()
          const folderTree: SebParentFolder[] = fData?.folders || []
          setFolders(folderTree)
          // Mở rộng tất cả thư mục mẹ mặc định
          const initExp: Record<string, boolean> = {}
          folderTree.forEach((p) => {
            initExp[p.id] = true
          })
          setExpandedParents(initExp)
        } catch (fErr) {
          console.warn('Lỗi tải danh mục thư mục đề thi:', fErr)
        }

        // 2. Tải danh sách tuyển tập đề
        try {
          const res = await fetch('/api/exam-collections')
          if (res.ok) {
            const cData = await res.json()
            if (cData.collections) {
              setCollections(cData.collections)
            }
          }
        } catch (colErr) {
          console.error('Lỗi tải tuyển tập đề:', colErr)
        }

        // 3. Tải toàn bộ đề thi từ hệ thống
        const { data: examsData, error: examsError } = await supabase
          .from('exams')
          .select('*')
          .order('created_at', { ascending: false })

        // 4. Tải lịch sử bài nộp chi tiết của user
        const { data: submissionsData } = await supabase
          .from('submissions')
          .select('*, exams(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (examsError) {
          console.error('Error fetching exams:', examsError)
        } else {
          // LỌC ĐỀ HIỂN THỊ KHO ĐỀ:
          // Tuyệt đối không hiển thị đề trộn (is_hidden: true hoặc tiêu đề bắt đầu bằng [Trộn đề])
          const visibleExams = (examsData || []).filter((ex: any) => {
            if (ex.is_hidden === true) return false
            if (ex.title && ex.title.startsWith('[Trộn đề]')) return false
            if (ex.is_mixed === true) return false

            if (ex.created_by && ex.created_by === user.id) return true
            const code = String(ex.exam_code || ex.access_code || '')
            const is12DigitClassExam = code.length === 12 && /^\d{12}$/.test(code)
            if (is12DigitClassExam) return false
            return true
          })
          setExams(visibleExams)
        }

        setSubmissions((submissionsData as any) || [])

        // 5. Tải Thư viện Sen Online (library_folders & library_documents)
        try {
          const [libFoldersRes, libDocsRes] = await Promise.all([
            supabase.from('library_folders').select('*').order('name', { ascending: true }),
            supabase.from('library_documents').select('*').order('created_at', { ascending: false }),
          ])
          if (libFoldersRes.data) {
            setLibraryFolders(libFoldersRes.data as LibraryFolderItem[])
            const initExp: Record<string, boolean> = {}
            libFoldersRes.data.forEach((f: any) => {
              if (!f.parent_id) initExp[f.id] = true
            })
            setLibExpandedParents(initExp)
          }
          if (libDocsRes.data) {
            setLibraryDocs(libDocsRes.data as LibraryDocItem[])
          }
        } catch (libErr) {
          console.warn('Lỗi tải dữ liệu thư viện:', libErr)
        }
      } catch (e) {
        console.error('Lỗi khởi tạo new-exams-history-submissions:', e)
      } finally {
        setLoading(false)
      }
    }

    initData()
  }, [router])

  // Làm mới dữ liệu Thư viện Sen Online
  const refreshLibraryData = async () => {
    try {
      setLibraryLoading(true)
      const [libFoldersRes, libDocsRes] = await Promise.all([
        supabase.from('library_folders').select('*').order('name', { ascending: true }),
        supabase.from('library_documents').select('*').order('created_at', { ascending: false }),
      ])
      if (libFoldersRes.data) setLibraryFolders(libFoldersRes.data as LibraryFolderItem[])
      if (libDocsRes.data) setLibraryDocs(libDocsRes.data as LibraryDocItem[])
    } catch (e) {
      console.error('Error refreshing library:', e)
    } finally {
      setLibraryLoading(false)
    }
  }

  // Tổ chức thư mục cây Thư viện Sen Online: Thư mục cha & Môn học con
  const libraryTree = useMemo(() => {
    const rootFolders = libraryFolders.filter((f) => !f.parent_id)
    const childFolders = libraryFolders.filter((f) => !!f.parent_id)

    const parents: {
      parent: LibraryFolderItem
      children: LibraryFolderItem[]
    }[] = rootFolders.map((parent) => ({
      parent,
      children: childFolders.filter((c) => c.parent_id === parent.id),
    }))

    const orphanChildren = childFolders.filter((c) => !rootFolders.some((r) => r.id === c.parent_id))
    if (orphanChildren.length > 0) {
      parents.push({
        parent: {
          id: 'misc-group',
          name: 'Môn học khác',
          parent_id: null,
          created_by: null,
          created_at: '',
        },
        children: orphanChildren,
      })
    }

    return parents
  }, [libraryFolders])

  const filteredLibraryTree = useMemo(() => {
    if (!libFolderSearch.trim()) return libraryTree
    const q = libFolderSearch.toLowerCase().trim()
    return libraryTree
      .map((group) => {
        const matchParent = group.parent.name.toLowerCase().includes(q)
        const matchedChildren = group.children.filter((c) => c.name.toLowerCase().includes(q))
        if (matchParent) return group
        if (matchedChildren.length > 0) {
          return { ...group, children: matchedChildren }
        }
        return null
      })
      .filter(Boolean) as typeof libraryTree
  }, [libraryTree, libFolderSearch])

  // Đếm số tài liệu cho từng folder / môn học
  const libraryFolderDocCounts = useMemo(() => {
    const map: Record<string, number> = {}
    libraryDocs.forEach((d) => {
      if (d.folder_id) {
        map[d.folder_id] = (map[d.folder_id] || 0) + 1
      }
    })
    return map
  }, [libraryDocs])

  // Môn học / Thư mục hiện tại đang chọn
  const currentLibFolder = useMemo(() => {
    if (!libCurrentFolderId) return null
    return libraryFolders.find((f) => f.id === libCurrentFolderId) || null
  }, [libraryFolders, libCurrentFolderId])

  // Danh sách tài liệu trong môn học đang chọn
  const currentFolderDocs = useMemo(() => {
    if (!libCurrentFolderId) return libraryDocs
    return libraryDocs.filter((d) => d.folder_id === libCurrentFolderId)
  }, [libraryDocs, libCurrentFolderId])

  // Lọc tài liệu theo từ khóa và VIP
  const filteredCurrentDocs = useMemo(() => {
    return currentFolderDocs.filter((d) => {
      const matchQ = d.title.toLowerCase().includes(libDocSearch.toLowerCase().trim())
      if (!matchQ) return false
      if (libVipFilter === 'vip') return Boolean(d.is_vip_only)
      if (libVipFilter === 'free') return !d.is_vip_only
      return true
    })
  }, [currentFolderDocs, libDocSearch, libVipFilter])

  // Tách tài liệu theo các nhánh của sơ đồ cây FEPN x SenExam
  const subjectTreeBranches = useMemo(() => {
    // 1. Đề thi gắn kèm (Chế độ sơ đồ cây mang theo bài thi)
    const attachedExamDocs = filteredCurrentDocs.filter((d) =>
      Boolean(d.description && d.description.includes('[ATTACHED_EXAM:'))
    )
    const attachedExamIds = attachedExamDocs.map((d) => {
      const match = d.description?.match(/\[ATTACHED_EXAM:([^\]]+)\]/)
      return match ? match[1] : d.drive_file_id
    })

    const matchingExamsFromDb = exams.filter((ex) => {
      if (attachedExamIds.includes(ex.id)) return true
      if (libCurrentFolderId && currentLibFolder) {
        if (ex.subject && currentLibFolder.name.toLowerCase().includes(ex.subject.toLowerCase())) {
          return true
        }
      }
      return false
    })

    // 2. Tài liệu lý thuyết / Slides
    const slideDocs = filteredCurrentDocs.filter(
      (d) =>
        !d.description?.includes('[ATTACHED_EXAM:') &&
        !d.description?.includes('[CATEGORY:exercises]') &&
        !d.description?.includes('[CATEGORY:videos]')
    )

    // 3. Bài tập rèn luyện
    const exerciseDocs = filteredCurrentDocs.filter((d) =>
      Boolean(d.description && d.description.includes('[CATEGORY:exercises]'))
    )

    // 4. Video & Ghi âm bài giảng
    const videoDocs = filteredCurrentDocs.filter((d) =>
      Boolean(
        d.description &&
          (d.description.includes('[CATEGORY:videos]') || d.description.includes('[CATEGORY:recordings]'))
      )
    )

    return {
      attachedExams: matchingExamsFromDb,
      attachedExamDocs,
      slideDocs,
      exerciseDocs,
      videoDocs,
    }
  }, [filteredCurrentDocs, exams, libCurrentFolderId, currentLibFolder])

  // Các thư mục con (nhánh nhỏ) do Admin tạo bên trong môn học hiện tại
  const subjectSubFolders = useMemo(() => {
    if (!libCurrentFolderId) return []
    return libraryFolders.filter((f) => f.parent_id === libCurrentFolderId)
  }, [libraryFolders, libCurrentFolderId])

  // Toast thông báo Thư viện
  const showLibToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setLibToast({ message, type })
    setTimeout(() => {
      setLibToast((current) => (current?.message === message ? null : current))
    }, 3200)
  }

  // Tự động đồng bộ tài liệu xem trước trực tiếp khi môn hoặc danh mục thay đổi
  useEffect(() => {
    if (!libCurrentFolderId) {
      setLibActiveInlineDoc(null)
      return
    }

    let list: LibraryDocItem[] = []
    if (libSmallTreeCategory === 'slides') list = subjectTreeBranches.slideDocs
    else if (libSmallTreeCategory === 'exercises') list = subjectTreeBranches.exerciseDocs
    else if (libSmallTreeCategory === 'videos') list = subjectTreeBranches.videoDocs
    else if (typeof libSmallTreeCategory === 'string' && libSmallTreeCategory.startsWith('subfolder-')) {
      const subId = libSmallTreeCategory.replace('subfolder-', '')
      list = libraryDocs.filter((d) => d.folder_id === subId)
    }

    if (list.length > 0) {
      if (!libActiveInlineDoc || !list.some((d) => d.id === libActiveInlineDoc.id)) {
        setLibActiveInlineDoc(list[0])
      }
    } else {
      if (libActiveInlineDoc && !list.some((d) => d.id === libActiveInlineDoc.id)) {
        setLibActiveInlineDoc(null)
      }
    }
  }, [libCurrentFolderId, libSmallTreeCategory, subjectTreeBranches, libraryDocs])

  // Kéo thả: Di chuyển tài liệu sang thư mục / môn học khác
  const handleMoveDocToFolder = async (docId: string, targetFolderId: string, targetFolderName?: string) => {
    try {
      setLibraryDocs((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, folder_id: targetFolderId } : d))
      )
      const { error } = await supabase
        .from('library_documents')
        .update({ folder_id: targetFolderId })
        .eq('id', docId)
      if (error) throw error
      showLibToast(`Đã chuyển tài liệu sang "${targetFolderName || 'thư mục mới'}"!`, 'success')
      await refreshLibraryData()
    } catch (err: any) {
      showLibToast(`Lỗi di chuyển tài liệu: ${err.message}`, 'error')
      await refreshLibraryData()
    }
  }

  // Kéo thả: Di chuyển thư mục / môn học sang thư mục mẹ khác
  const handleMoveFolderToParent = async (folderId: string, newParentId: string | null, parentName?: string) => {
    try {
      setLibraryFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, parent_id: newParentId } : f))
      )
      const { error } = await supabase
        .from('library_folders')
        .update({ parent_id: newParentId })
        .eq('id', folderId)
      if (error) throw error
      showLibToast(`Đã di chuyển môn/thư mục vào "${parentName || 'gốc'}"!`, 'success')
      await refreshLibraryData()
    } catch (err: any) {
      showLibToast(`Lỗi di chuyển thư mục: ${err.message}`, 'error')
      await refreshLibraryData()
    }
  }

  // Kéo thả: Đổi danh mục cây nhỏ của tài liệu (Slide -> Bài tập -> Video)
  const handleChangeDocCategory = async (docId: string, targetCategory: 'slides' | 'exercises' | 'videos') => {
    try {
      const desc = `[CATEGORY:${targetCategory}]`
      setLibraryDocs((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, description: desc } : d))
      )
      const { error } = await supabase
        .from('library_documents')
        .update({ description: desc })
        .eq('id', docId)
      if (error) throw error
      const catLabel =
        targetCategory === 'slides'
          ? 'Slide Bài Giảng'
          : targetCategory === 'exercises'
          ? 'Tài Liệu Bài Tập'
          : 'Video Bài Giảng'
      showLibToast(`Đã chuyển tài liệu sang mục "${catLabel}"!`, 'success')
      await refreshLibraryData()
    } catch (err: any) {
      showLibToast(`Lỗi chuyển danh mục: ${err.message}`, 'error')
      await refreshLibraryData()
    }
  }

  // Gỡ đề thi khỏi môn học
  const handleDetachExamFromSubject = async (examId: string) => {
    if (!confirm('Bạn có muốn gỡ đề thi này khỏi môn học?')) return
    try {
      const matchDoc = libraryDocs.find(
        (d) =>
          d.folder_id === libCurrentFolderId &&
          d.description &&
          d.description.includes(`[ATTACHED_EXAM:${examId}]`)
      )
      if (matchDoc) {
        await supabase.from('library_documents').delete().eq('id', matchDoc.id)
      }
      showLibToast('Đã gỡ đề thi khỏi môn học!', 'info')
      await refreshLibraryData()
    } catch (err: any) {
      showLibToast(`Lỗi gỡ đề thi: ${err.message}`, 'error')
    }
  }

  // Tạo thư mục hoặc môn học mới
  const handleCreateLibFolderOrSubject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!libNewName.trim()) return
    setLibCreateLoading(true)
    setLibCreateError('')

    try {
      const { error } = await supabase.from('library_folders').insert({
        name: libNewName.trim(),
        parent_id: libCreateType === 'folder' ? null : libNewParentId,
        created_by: currentUserId,
      })
      if (error) throw error

      setLibNewName('')
      setLibNewDesc('')
      setShowLibCreateModal(false)
      await refreshLibraryData()
    } catch (err: any) {
      setLibCreateError(err.message || 'Lỗi tạo thư mục/môn học')
    } finally {
      setLibCreateLoading(false)
    }
  }

  // Tải tài liệu lên Google Drive và lưu vào Thư viện Sen Online
  const handleUploadLibDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (libUploadFiles.length === 0) return
    const targetFolderId = libUploadTargetFolderId || libCurrentFolderId
    if (!targetFolderId) {
      alert('Vui lòng chọn môn học hoặc thư mục để lưu tài liệu!')
      return
    }

    setLibUploadStatus({ type: 'uploading', message: 'Đang khởi tạo tải tệp lên Google Drive...' })

    try {
      for (let i = 0; i < libUploadFiles.length; i++) {
        const file = libUploadFiles[i]
        const title = libUploadTitle.trim() || file.name.replace(/\.[^/.]+$/, '')
        setLibUploadStatus({
          type: 'uploading',
          message: `Đang tải tệp (${i + 1}/${libUploadFiles.length}): ${file.name}...`,
        })

        const uploadUrl = await initGoogleDriveUpload(file.name, file.type || 'application/pdf')
        const uploaded = await uploadFileToGoogleDrive(uploadUrl, file, title)
        const driveFileId = typeof uploaded === 'string' ? uploaded : uploaded?.id || ''

        const desc = `[CATEGORY:${libUploadCategory}]`

        const { error } = await supabase.from('library_documents').insert({
          title,
          drive_file_id: driveFileId,
          folder_id: targetFolderId,
          created_by: currentUserId,
          is_vip_only: libUploadIsVip,
          description: desc,
        })

        if (error) throw error
      }

      setLibUploadStatus({ type: 'success', message: 'Tải tài liệu lên thành công!' })
      setTimeout(() => {
        setShowLibUploadModal(false)
        setLibUploadTitle('')
        setLibUploadFiles([])
        setLibUploadIsVip(false)
        setLibUploadStatus({ type: 'idle', message: '' })
        refreshLibraryData()
      }, 1000)
    } catch (err: any) {
      setLibUploadStatus({ type: 'error', message: `Lỗi tải tệp: ${err.message}` })
    }
  }

  // Đính kèm đề thi vào môn học (Vào nhanh bài thi)
  const handleAttachExamToSubject = async (exam: ExamItem) => {
    const targetFolderId = libAttachTargetFolderId || libCurrentFolderId
    if (!targetFolderId) {
      alert('Vui lòng chọn môn học để đính kèm đề thi!')
      return
    }

    try {
      const { error } = await supabase.from('library_documents').insert({
        title: exam.title,
        drive_file_id: exam.id,
        folder_id: targetFolderId,
        created_by: currentUserId,
        is_vip_only: false,
        description: `[ATTACHED_EXAM:${exam.id}] Đề thi khảo thí tích hợp`,
      })
      if (error) throw error
      setShowLibAttachExamModal(false)
      await refreshLibraryData()
      alert(`Đã đính kèm đề thi "${exam.title}" vào môn học!`)
    } catch (err: any) {
      alert(`Lỗi đính kèm: ${err.message}`)
    }
  }

  // Xóa thư mục / tài liệu
  const handleDeleteLibItem = async (id: string, type: 'folder' | 'doc') => {
    if (!confirm(`Bạn có chắc chắn muốn xóa ${type === 'folder' ? 'môn học / thư mục' : 'tài liệu'} này?`)) return
    try {
      if (type === 'folder') {
        const { error } = await supabase.from('library_folders').delete().eq('id', id)
        if (error) throw error
        if (libCurrentFolderId === id) handleSelectLibFolder(null)
      } else {
        const { error } = await supabase.from('library_documents').delete().eq('id', id)
        if (error) throw error
      }
      await refreshLibraryData()
    } catch (err: any) {
      alert(`Lỗi xóa: ${err.message}`)
    }
  }

  // Đổi tên thư mục / tài liệu
  const handleRenameLibItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!libRenameTarget || !libRenameValue.trim()) return
    try {
      if (libRenameTarget.type === 'folder') {
        const { error } = await supabase
          .from('library_folders')
          .update({ name: libRenameValue.trim() })
          .eq('id', libRenameTarget.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('library_documents')
          .update({ title: libRenameValue.trim() })
          .eq('id', libRenameTarget.id)
        if (error) throw error
      }
      setShowLibRenameModal(false)
      setLibRenameTarget(null)
      await refreshLibraryData()
    } catch (err: any) {
      alert(`Lỗi đổi tên: ${err.message}`)
    }
  }

  const toggleDarkMode = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  // Danh sách ID các đề đã gom vào bất kỳ tuyển tập nào
  const bundledExamIds = useMemo(() => {
    const ids = new Set<string>()
    collections.forEach((c) => {
      ;(c.exam_ids || []).forEach((id) => ids.add(id))
    })
    return ids
  }, [collections])

  // Đếm số lượng đề thi cho từng thư mục con
  const folderExamCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    folders.forEach((parent) => {
      ;(parent.children || []).forEach((child) => {
        counts[child.id] = exams.filter((ex) => isExamInFolder(ex, child)).length
      })
    })
    return counts
  }, [folders, exams])

  // Lọc cây thư mục theo ô tìm kiếm thư mục
  const filteredFolders = useMemo(() => {
    if (!folderSearch.trim()) return folders
    const q = folderSearch.toLowerCase().trim()

    return folders
      .map((parent) => {
        const parentMatches =
          parent.name.toLowerCase().includes(q) ||
          (parent.description && parent.description.toLowerCase().includes(q))
        const matchingChildren = (parent.children || []).filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.description && c.description.toLowerCase().includes(q))
        )

        if (parentMatches) {
          return parent
        }
        if (matchingChildren.length > 0) {
          return {
            ...parent,
            children: matchingChildren,
          }
        }
        return null
      })
      .filter(Boolean) as SebParentFolder[]
  }, [folders, folderSearch])

  useEffect(() => {
    if (folderSearch.trim()) {
      const exp: Record<string, boolean> = {}
      filteredFolders.forEach((p) => {
        exp[p.id] = true
      })
      setExpandedParents((prev) => ({ ...prev, ...exp }))
    }
  }, [folderSearch, filteredFolders])

  const toggleParent = (parentId: string) => {
    setExpandedParents((prev) => ({
      ...prev,
      [parentId]: !prev[parentId],
    }))
  }

  const handleSelectChild = (child: SebChildFolder) => {
    if (selectedChildId === child.id) {
      setSelectedChildId('')
      setSelectedFolderObj(null)
    } else {
      setSelectedChildId(child.id)
      setSelectedFolderObj(child)
      setActiveCollection(null)
    }
    setMobileFolderOpen(false)
  }

  const handleSelectAllExams = () => {
    setSelectedChildId('')
    setSelectedFolderObj(null)
    setActiveCollection(null)
    setMobileFolderOpen(false)
  }

  // Tra cứu mã truy cập đề riêng tư
  const handleAccessCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accessCode.trim()) return

    setAccessCodeLoading(true)
    setAccessCodeError('')

    try {
      const code = accessCode.trim().toUpperCase()
      const { data, error } = await supabase
        .from('exams')
        .select('*')
        .eq('access_code', code)
        .single()

      if (error || !data) {
        setAccessCodeError('Mã truy cập không hợp lệ hoặc đề thi không tồn tại.')
      } else {
        if (data.require_seb) {
          router.push(`/seb-exam/${data.id}`)
        } else {
          router.push(`/new-exams/${data.id}`)
        }
      }
    } catch {
      setAccessCodeError('Không tìm thấy đề thi với mã này.')
    } finally {
      setAccessCodeLoading(false)
    }
  }

  // Lọc đề thi độc lập (chưa gom vào tuyển tập)
  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      if (bundledExamIds.has(exam.id)) return false

      const query = deferredQuery.toLowerCase().trim()
      const matchSearch =
        !query ||
        exam.title.toLowerCase().includes(query) ||
        (exam.subject && exam.subject.toLowerCase().includes(query)) ||
        (exam.description && exam.description.toLowerCase().includes(query)) ||
        (exam.tags && exam.tags.some((t) => t.toLowerCase().includes(query)))

      if (!matchSearch) return false

      if (selectedType !== 'Tất cả') {
        const typeMatch = (exam.exam_type || '').toUpperCase().includes(selectedType.toUpperCase())
        if (!typeMatch) return false
      }

      if (selectedChildId && selectedFolderObj) {
        return isExamInFolder(exam, selectedFolderObj)
      }

      return true
    })
  }, [exams, deferredQuery, selectedType, selectedChildId, selectedFolderObj, bundledExamIds])

  // Lọc tuyển tập đề hiển thị
  const filteredCollections = useMemo(() => {
    return collections.filter((col) => {
      const query = deferredQuery.toLowerCase().trim()
      const matchSearch =
        !query ||
        col.subject.toLowerCase().includes(query) ||
        col.title.toLowerCase().includes(query) ||
        (col.description && col.description.toLowerCase().includes(query))

      if (!matchSearch) return false

      if (selectedChildId && selectedFolderObj) {
        const folderName = (selectedFolderObj.name || '').toLowerCase()
        const colSubject = col.subject.toLowerCase()
        return folderName.includes(colSubject) || colSubject.includes(folderName)
      }

      return true
    })
  }, [collections, deferredQuery, selectedChildId, selectedFolderObj])

  // Dữ liệu tuyển tập đang mở xem chi tiết
  const activeCollectionExams = useMemo(() => {
    if (!activeCollection) return []
    return (activeCollection.exam_ids || [])
      .map((id) => exams.find((e) => e.id === id))
      .filter(Boolean) as ExamItem[]
  }, [activeCollection, exams])

  const activeCollectionBreakdown = useMemo(() => {
    return getExamQuestionsBreakdown(activeCollectionExams)
  }, [activeCollectionExams])

  const activeCollectionSumDuration = useMemo(() => {
    return activeCollectionExams.reduce((sum, e) => sum + (e.duration || 50), 0)
  }, [activeCollectionExams])

  const activeCollectionMaxDuration = useMemo(() => {
    return activeCollectionSumDuration + 30
  }, [activeCollectionSumDuration])

  const currentMaxAvailableQuestions = useMemo(() => {
    let count = 0
    if (mixIncludeChoice) count += activeCollectionBreakdown.choiceCount
    if (mixIncludeTF) count += activeCollectionBreakdown.tfCount
    if (mixIncludeSA) count += activeCollectionBreakdown.saCount
    return count
  }, [mixIncludeChoice, mixIncludeTF, mixIncludeSA, activeCollectionBreakdown])

  // Tính số câu hỏi khả dụng của 1 đề cụ thể theo các dạng câu được tick
  const getSingleExamAvailableCount = (ex: ExamItem) => {
    const bd = getExamQuestionsBreakdown([ex])
    let count = 0
    if (mixIncludeChoice) count += bd.choiceCount
    if (mixIncludeTF) count += bd.tfCount
    if (mixIncludeSA) count += bd.saCount
    return count
  }

  // Danh sách các đề được tick chọn trong tùy chọn chi tiết
  const detailedSelectedExams = useMemo(() => {
    return activeCollectionExams.filter((ex) => examMixConfigs[ex.id]?.enabled)
  }, [activeCollectionExams, examMixConfigs])

  // Tổng số câu hỏi được chỉ định lấy từ các đề đã tick
  const detailedTotalQuestionsCount = useMemo(() => {
    return detailedSelectedExams.reduce((sum, ex) => sum + (examMixConfigs[ex.id]?.count || 0), 0)
  }, [detailedSelectedExams, examMixConfigs])

  // Tổng thời gian các đề được chọn cộng lại + 30 phút trong chế độ chi tiết
  const detailedSumDuration = useMemo(() => {
    return detailedSelectedExams.reduce((sum, e) => sum + (e.duration || 50), 0)
  }, [detailedSelectedExams])

  const detailedMaxDuration = useMemo(() => {
    const base = detailedSumDuration > 0 ? detailedSumDuration : activeCollectionSumDuration
    return base + 30
  }, [detailedSumDuration, activeCollectionSumDuration])

  const effectiveMaxDuration = showDetailedMix ? detailedMaxDuration : activeCollectionMaxDuration

  // Mở modal đóng gói tuyển tập (Admin)
  const handleOpenCreatePackageModal = () => {
    setPackagingEditingId(null)
    setPackagingSubject('')
    setPackagingTitle('')
    setPackagingDesc('')
    setPackagingSelectedExamIds([])
    setPackagingExamSearch('')
    setPackagingError('')
    setShowAdminPackageModal(true)
  }

  // Mở modal sửa tuyển tập (Admin)
  const handleOpenEditPackageModal = (col: ExamCollection) => {
    setPackagingEditingId(col.id)
    setPackagingSubject(col.subject)
    setPackagingTitle(col.title)
    setPackagingDesc(col.description || '')
    setPackagingSelectedExamIds([...(col.exam_ids || [])])
    setPackagingExamSearch('')
    setPackagingError('')
    setShowAdminPackageModal(true)
  }

  // Xóa / giải tán tuyển tập (Admin)
  const handleDeleteCollection = async (colId: string) => {
    if (
      !confirm(
        'Bạn có chắc chắn muốn giải tán tuyển tập đề này? Các đề thi bên trong sẽ xuất hiện trở lại tại trang khảo thí chung.'
      )
    ) {
      return
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const headers: Record<string, string> = {}
      if (token) headers['Authorization'] = `Bearer ${token}`

      const queryUrl = `/api/exam-collections?id=${encodeURIComponent(colId)}&userId=${encodeURIComponent(
        currentUserId || ''
      )}&userEmail=${encodeURIComponent(userEmail || '')}`

      const res = await fetch(queryUrl, {
        method: 'DELETE',
        headers,
      })
      const data = await res.json()
      if (data.success) {
        setCollections((prev) => prev.filter((c) => c.id !== colId))
        if (activeCollection?.id === colId) {
          setActiveCollection(null)
        }
      } else {
        alert(data.error || 'Lỗi khi xóa tuyển tập')
      }
    } catch {
      alert('Không thể kết nối đến máy chủ để xóa tuyển tập.')
    }
  }

  // Lưu đóng gói tuyển tập (Admin)
  const handleSavePackaging = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!packagingSubject.trim()) {
      setPackagingError('Vui lòng nhập tên môn học (ví dụ: Toán học, Vật lí, Hóa học...)')
      return
    }
    if (packagingSelectedExamIds.length === 0) {
      setPackagingError('Vui lòng chọn ít nhất 1 đề thi để đóng gói vào tuyển tập.')
      return
    }

    setPackagingLoading(true)
    setPackagingError('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/exam-collections', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: packagingEditingId || undefined,
          subject: packagingSubject.trim(),
          title: packagingTitle.trim() || `Tuyển tập đề thi môn ${packagingSubject.trim()}`,
          description: packagingDesc.trim() || `Gồm ${packagingSelectedExamIds.length} đề thi tuyển chọn chất lượng cao.`,
          exam_ids: packagingSelectedExamIds,
          userId: currentUserId,
          userEmail: userEmail,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi lưu tuyển tập đề')
      }

      setCollections(data.collections)
      setShowAdminPackageModal(false)

      if (activeCollection && activeCollection.id === data.collection.id) {
        setActiveCollection(data.collection)
      }
    } catch (err: any) {
      setPackagingError(err.message || 'Lỗi lưu tuyển tập đề')
    } finally {
      setPackagingLoading(false)
    }
  }

  // Mở modal trộn đề (Student)
  const handleOpenMixModal = () => {
    setMixIncludeChoice(true)
    setMixIncludeTF(true)
    setMixIncludeSA(true)
    setShowDetailedMix(false)

    const initialConfigs: Record<string, { enabled: boolean; count: number }> = {}
    activeCollectionExams.forEach((ex) => {
      const bd = getExamQuestionsBreakdown([ex])
      initialConfigs[ex.id] = {
        enabled: true,
        count: bd.total,
      }
    })
    setExamMixConfigs(initialConfigs)

    const available = activeCollectionBreakdown.total
    setMixQuestionCount(Math.min(40, Math.max(1, available)))
    setMixDuration(Math.min(activeCollectionSumDuration || 50, activeCollectionMaxDuration))
    setMixTitle(`[Trộn đề] Tuyển tập ${activeCollection?.subject || 'Đề thi'}`)
    setMixError('')
    setShowMixModal(true)
  }

  // Thực hiện trộn đề
  const handleExecuteMix = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeCollection) return

    if (!mixIncludeChoice && !mixIncludeTF && !mixIncludeSA) {
      setMixError('Vui lòng chọn ít nhất 1 dạng câu hỏi (trắc nghiệm, đúng sai hoặc trả lời ngắn).')
      return
    }

    if (!showDetailedMix && currentMaxAvailableQuestions <= 0) {
      setMixError('Không có câu hỏi nào thuộc các phần đã chọn để trộn.')
      return
    }

    if (showDetailedMix && detailedTotalQuestionsCount <= 0) {
      setMixError('Vui lòng chọn ít nhất 1 đề thi và đặt số câu hỏi muốn lấy lớn hơn 0.')
      return
    }

    setMixLoading(true)
    setMixError('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const payload: any = {
        collection_id: activeCollection.id,
        include_choice: mixIncludeChoice,
        include_true_false: mixIncludeTF,
        include_short_answer: mixIncludeSA,
        question_count: showDetailedMix ? detailedTotalQuestionsCount : mixQuestionCount,
        custom_duration: mixDuration,
        custom_title: mixTitle,
        userId: currentUserId,
        userEmail: userEmail,
      }

      if (showDetailedMix) {
        payload.exam_configs = detailedSelectedExams
          .filter((ex) => (examMixConfigs[ex.id]?.count || 0) > 0)
          .map((ex) => ({
            exam_id: ex.id,
            count: examMixConfigs[ex.id].count,
          }))
      }

      const res = await fetch('/api/exam-collections/mix', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Trộn đề thất bại')
      }

      setShowMixModal(false)
      // Chuyển thẳng đến phòng thi của đề đã trộn
      router.push(`/new-exams/${data.examId}`)
    } catch (err: any) {
      setMixError(err.message || 'Lỗi khi trộn đề thi')
    } finally {
      setMixLoading(false)
    }
  }

  // --- LOGIC CHO TAB LỊCH SỬ BÀI NỘP ---
  const chartData = useMemo(() => {
    let list = [...submissions].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    if (chartExamFilter !== 'Tất cả') {
      list = list.filter((item) => {
        const type = (item.exams?.exam_type || '').toUpperCase()
        const title = (item.exams?.title || '').toUpperCase()
        if (chartExamFilter === 'THPTQG') return type.includes('THPT') || title.includes('THPT')
        if (chartExamFilter === 'HSA') return type.includes('HSA') || title.includes('HSA') || type.includes('ĐGNL') || title.includes('ĐGNL')
        if (chartExamFilter === 'TSA') return type.includes('TSA') || title.includes('TSA') || type.includes('ĐGTD') || title.includes('ĐGTD')
        return type.includes(chartExamFilter.toUpperCase())
      })
    }

    const gradedItems = list.filter((s) => s.score !== null && s.score !== undefined)
    const count = gradedItems.length
    if (count === 0) return { count: 0, points: [], avg: '0', max: '0', min: '0', trend: 0, maxScoreRange: 10, gridSteps: [0, 2.5, 5, 7.5, 10], svgWidth: 650, svgHeight: 200 }

    const scores = gradedItems.map((s) => s.score || 0)
    const rawMax = Math.max(...scores)
    const min = Math.min(...scores)
    const avg = (scores.reduce((a, b) => a + b, 0) / count).toFixed(1)

    const maxScoreVal = Math.max(10, rawMax)
    const maxScoreRange = maxScoreVal <= 10 ? 10 : maxScoreVal <= 100 ? 100 : maxScoreVal <= 150 ? 150 : Math.ceil(maxScoreVal / 50) * 50
    const gridSteps = maxScoreRange === 10
      ? [0, 2.5, 5, 7.5, 10]
      : [0, Math.round(maxScoreRange * 0.25), Math.round(maxScoreRange * 0.5), Math.round(maxScoreRange * 0.75), maxScoreRange]

    const recentScores = scores.slice(-3)
    const initialScores = scores.slice(0, 3)
    const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length
    const initialAvg = initialScores.reduce((a, b) => a + b, 0) / initialScores.length
    const trend = parseFloat((recentAvg - initialAvg).toFixed(1))

    const baseWidth = Math.max(650, count * 55)
    const svgWidth = baseWidth * chartZoom
    const svgHeight = 200
    const paddingX = 50
    const paddingY = 30

    const points = gradedItems.map((item, idx) => {
      const x = count === 1 ? svgWidth / 2 : paddingX + (idx / (count - 1)) * (svgWidth - paddingX * 2)
      const rawScore = item.score || 0
      const clampedRatio = Math.max(0, Math.min(1, rawScore / maxScoreRange))
      const y = svgHeight - paddingY - clampedRatio * (svgHeight - paddingY * 2)

      return {
        x,
        y,
        score: rawScore,
        date: new Date(item.created_at).toLocaleDateString('vi-VN'),
        title: item.exams?.title || 'Đề thi tự luyện',
      }
    })

    const pathString = points.reduce((acc, p, idx) => {
      return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`
    }, '')

    const areaPath = points.length > 0
      ? `${pathString} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
      : ''

    return {
      count,
      points,
      avg,
      max: rawMax.toFixed(1),
      min: min.toFixed(1),
      trend,
      maxScoreRange,
      gridSteps,
      svgWidth,
      svgHeight,
      pathString,
      areaPath,
    }
  }, [submissions, chartExamFilter, chartZoom])

  const filteredSubmissions = useMemo(() => {
    let result = [...submissions]

    const q = deferredHistoryQuery.trim().toLowerCase()
    if (q) {
      result = result.filter((item) => {
        const title = (item.exams?.title || '').toLowerCase()
        const subject = (item.exams?.subject || '').toLowerCase()
        return title.includes(q) || subject.includes(q)
      })
    }

    if (historySelectedType !== 'Tất cả') {
      result = result.filter((item) => {
        const type = (item.exams?.exam_type || '').toUpperCase()
        const title = (item.exams?.title || '').toUpperCase()
        if (historySelectedType === 'THPTQG') return type.includes('THPT') || title.includes('THPT')
        if (historySelectedType === 'HSA') return type.includes('HSA') || title.includes('HSA') || type.includes('ĐGNL') || title.includes('ĐGNL')
        if (historySelectedType === 'TSA') return type.includes('TSA') || title.includes('TSA') || type.includes('ĐGTD') || title.includes('ĐGTD')
        return type.includes(historySelectedType.toUpperCase())
      })
    }

    if (filterScoreStatus === 'high') {
      result = result.filter((item) => (item.score ?? 0) >= 8.0)
    } else if (filterScoreStatus === 'low') {
      result = result.filter((item) => item.score !== null && (item.score ?? 0) < 5.0)
    } else if (filterScoreStatus === 'graded') {
      result = result.filter((item) => item.is_graded || item.score !== null)
    }

    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sortBy === 'highest') return (b.score || 0) - (a.score || 0)
      if (sortBy === 'lowest') return (a.score || 0) - (b.score || 0)
      return 0
    })

    return result
  }, [submissions, deferredHistoryQuery, historySelectedType, filterScoreStatus, sortBy])

  const historyStats = useMemo(() => {
    const total = submissions.length
    const graded = submissions.filter((s) => s.score !== null && s.score !== undefined)
    const scores = graded.map((s) => s.score || 0)
    const highest = scores.length > 0 ? Math.max(...scores).toFixed(1) : '—'
    const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—'
    const highCount = submissions.filter((s) => (s.score ?? 0) >= 8.0).length

    const totalSecs = submissions.reduce((acc, s) => acc + (s.time_spent || 0), 0)
    const totalMinutes = Math.round(totalSecs / 60)

    return { total, highest, avg, highCount, totalMinutes }
  }, [submissions])

  const activeThemeColor = activeTab === 'history' ? 'teal' : activeTab === 'create' ? 'emerald' : activeTab === 'library' ? 'violet' : 'indigo'
  const themeVars = getModernThemeVars(activeThemeColor, isDark)

  if (loading) {
    return (
      <ModernLoading
        isDark={isDark}
        themeColor={activeThemeColor}
        title="Sen Ground: Tạo Đề, Khảo Thí & Lịch Sử"
        subtitle="Đang khởi tạo không gian khảo thí & soạn đề tích hợp..."
      />
    )
  }

  return (
    <main
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-[#1A1A1A] dark:text-slate-100 transition-colors duration-300 font-sans`}
      style={{
        ...themeVars,
        background: isDark
          ? 'radial-gradient(circle at 10% 10%, rgba(56, 189, 248, 0.12), transparent 30%), radial-gradient(circle at 90% 20%, rgba(168, 85, 247, 0.12), transparent 30%), #080C14'
          : 'radial-gradient(circle at 10% 10%, rgba(255, 187, 120, 0.35), transparent 30%), radial-gradient(circle at 90% 20%, rgba(94, 234, 212, 0.3), transparent 30%), #F4F7FB',
      }}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Top Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-3">
            <Link
              href="/new-dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
              title="Quay lại Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1
                className="text-2xl sm:text-3xl font-black leading-tight text-slate-900 dark:text-white"
                style={{ fontFamily: 'var(--font-hub-heading)' }}
              >
                {activeTab === 'exams'
                  ? 'Sen Portal • Khảo Thí Quốc Gia & Luyện Thi Chuẩn Hóa'
                  : activeTab === 'library'
                  ? 'Thư Viện Sen Online'
                  : activeTab === 'create'
                  ? 'Tạo Đề KaTeX & Quản Trị Khóa Học'
                  : 'Lịch Sử Bài Nộp & Phân Tích Điểm'}
              </h1>
              <p className="text-xs text-[#6B7280] dark:text-slate-400">
                {activeTab === 'exams'
                  ? 'Quản lý tuyển tập đề theo môn, tổ chức theo khối thi và luyện thi thông minh.'
                  : activeTab === 'library'
                  ? 'Kho tài liệu số, bài giảng lý thuyết, bài tập chuyên đề và đề thi tích hợp theo môn.'
                  : activeTab === 'create'
                  ? 'Biên soạn đề KaTeX trực tiếp không cần PDF, quét AI đa tầng và cấu hình kỳ thi bảo mật.'
                  : 'Tra cứu kết quả thi, phân tích tiến độ điểm số và xem lại lời giải chi tiết.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Nút Tạo Tuyển Tập Đề - Chỉ Admin Mới Thấy */}
            {isAdmin && activeTab === 'exams' && (
              <button
                type="button"
                onClick={handleOpenCreatePackageModal}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2.5 text-xs font-bold shadow-sm transition hover:scale-105 cursor-pointer"
              >
                <Package className="h-4 w-4" />
                <span>Tạo tuyển tập đề</span>
              </button>
            )}

            {/* Nút bật/tắt Drawer trên Mobile (khi ở tab Kho Đề) */}
            {activeTab === 'exams' && (
              <button
                type="button"
                onClick={() => setMobileFolderOpen(!mobileFolderOpen)}
                className="md:hidden flex h-10 px-3.5 items-center gap-1.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 text-xs font-bold shadow-sm transition hover:scale-105"
              >
                <Filter className="h-4 w-4 text-indigo-500" />
                <span>{selectedFolderObj ? selectedFolderObj.name : 'Danh mục môn'}</span>
              </button>
            )}

            {/* Nút bật/tắt Drawer trên Mobile (khi ở tab Thư Viện) */}
            {activeTab === 'library' && (
              <button
                type="button"
                onClick={() => setLibMobileTreeOpen(!libMobileTreeOpen)}
                className="md:hidden flex h-10 px-3.5 items-center gap-1.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 text-xs font-bold shadow-sm transition hover:scale-105"
              >
                <Folder className="h-4 w-4 text-violet-500" />
                <span>{currentLibFolder ? currentLibFolder.name : 'Cây thư viện'}</span>
              </button>
            )}

            {/* Nút Thu gọn/Xem biểu đồ (khi ở tab Lịch sử) */}
            {activeTab === 'history' && (
              <button
                type="button"
                onClick={() => setShowChart((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm transition hover:scale-105"
                title={showChart ? 'Thu gọn biểu đồ' : 'Xem biểu đồ'}
              >
                <BarChart3 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </button>
            )}

            <button
              type="button"
              onClick={toggleDarkMode}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 shadow-sm backdrop-blur-xl transition hover:scale-105"
              title="Chuyển chế độ Sáng / Tối"
            >
              {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-indigo-500" />}
            </button>

            {/* Nút Lịch Sử Bài Thi - Chỉ còn mỗi logo icon */}
            <button
              type="button"
              onClick={() => handleSwitchTab(activeTab === 'exams' ? 'history' : 'exams')}
              title={activeTab === 'exams' ? 'Xem lịch sử bài thi & điểm số' : 'Quay lại kho đề thi'}
              className={`flex h-10 w-10 items-center justify-center rounded-2xl border shadow-sm transition hover:scale-105 cursor-pointer ${
                activeTab === 'history'
                  ? 'border-teal-500 bg-teal-500 text-white shadow-teal-500/20'
                  : 'border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 text-teal-500 hover:bg-black/5'
              }`}
            >
              <History className="h-5 w-5" />
            </button>

            <a
              href="https://seb.thicu.tailieufepn.senexam.me"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:from-sky-600 hover:to-blue-700"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Thi Bảo Mật Cao</span>
            </a>
          </div>
        </div>

        {/* TAB CHUYỂN ĐỔI: KHO ĐỀ, THƯ VIỆN, TẠO ĐỀ & LỊCH SỬ BÀI NỘP */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 max-w-fit overflow-x-auto">
          {/* NÚT 1: KHO ĐỀ THI & TUYỂN TẬP */}
          <button
            type="button"
            onClick={() => handleSwitchTab('exams')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'exams'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>Sen Portal Khảo Thí</span>
            {exams.length > 0 && (
              <span className="rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.2 text-[10px] font-black">
                {exams.length}
              </span>
            )}
          </button>

          {/* NÚT 2: THƯ VIỆN SEN ONLINE (NẰM CẠNH NÚT KHO ĐỀ THI) */}
          <button
            type="button"
            onClick={() => handleSwitchTab('library')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'library'
                ? 'bg-white dark:bg-slate-800 text-violet-600 dark:text-violet-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FolderOpen className="h-4 w-4 text-violet-500" />
            <span>Thư Viện Sen Online</span>
            {libraryDocs.length > 0 && (
              <span className="rounded-full bg-violet-500/15 text-violet-700 dark:text-violet-300 px-1.5 py-0.2 text-[10px] font-black">
                {libraryDocs.length}
              </span>
            )}
          </button>

          {/* NÚT 3: TẠO & SOẠN ĐỀ */}
          <button
            type="button"
            onClick={() => handleSwitchTab('create')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'create'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="h-4 w-4 text-emerald-500" />
            <span>Tạo & Soạn Đề</span>
            <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 text-[9px] font-black uppercase">
              KaTeX / AI
            </span>
          </button>

          {/* NÚT 4: LỊCH SỬ BÀI NỘP */}
          <button
            type="button"
            onClick={() => handleSwitchTab('history')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <History className="h-4 w-4 text-teal-500" />
            <span>Lịch Sử Bài Nộp</span>
            {submissions.length > 0 && (
              <span className="rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 px-1.5 py-0.2 text-[10px] font-black">
                {submissions.length}
              </span>
            )}
          </button>
        </div>

        {/* NỘI DUNG CHÍNH TAB 1: KHO ĐỀ THI & KHẢO THÍ */}
        {activeTab === 'exams' && (
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[310px_1fr] gap-6 items-start animate-in fade-in">
            {/* CỘT TRÁI: SIDEBAR CÂY THƯ MỤC MẸ - CON */}
            <aside
              className={`space-y-4 md:block ${
                mobileFolderOpen
                  ? 'fixed inset-0 z-50 bg-white/95 dark:bg-slate-900/95 p-6 overflow-y-auto backdrop-blur-xl'
                  : 'hidden'
              }`}
            >
              {mobileFolderOpen && (
                <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10 md:hidden">
                  <h3 className="font-black text-sm uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Danh mục cây môn học
                  </h3>
                  <button
                    onClick={() => setMobileFolderOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}

              {/* Ô TÌM KIẾM MÔN & CÂY THƯ MỤC */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Lọc môn học..."
                    value={folderSearch}
                    onChange={(e) => setFolderSearch(e.target.value)}
                    className="h-8 w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 pl-8 pr-2.5 text-xs outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Nút Xem Tất Cả */}
                <button
                  type="button"
                  onClick={handleSelectAllExams}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition ${
                    !selectedChildId && !activeCollection
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-black/10 dark:hover:bg-white/10'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>Tất cả đề thi & tuyển tập</span>
                  </span>
                  <span className="text-[10px] opacity-75 font-mono">{exams.length}</span>
                </button>
              </div>

              {/* Cây Thư Mục Mẹ - Con */}
              <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-3 shadow-sm backdrop-blur-xl max-h-[500px] overflow-y-auto space-y-1">
                {filteredFolders.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">Không tìm thấy thư mục</div>
                ) : (
                  filteredFolders.map((parent) => {
                    const isExp = expandedParents[parent.id] ?? true
                    const hasChildren = parent.children && parent.children.length > 0

                    return (
                      <div key={parent.id} className="space-y-0.5">
                        {/* Thư mục mẹ */}
                        <button
                          type="button"
                          onClick={() => toggleParent(parent.id)}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition"
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            {isExp ? (
                              <FolderOpen className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            ) : (
                              <Folder className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            )}
                            <span className="truncate">{parent.name}</span>
                          </span>
                          {hasChildren && (
                            <span className="text-slate-400">
                              {isExp ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </span>
                          )}
                        </button>

                        {/* Các thư mục con */}
                        {isExp && hasChildren && (
                          <div className="pl-3 space-y-0.5 border-l border-black/5 dark:border-white/5 ml-3">
                            {parent.children.map((child) => {
                              const isSelected = selectedChildId === child.id
                              const count = folderExamCounts[child.id] || 0

                              return (
                                <button
                                  key={child.id}
                                  type="button"
                                  onClick={() => handleSelectChild(child)}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white font-bold shadow-xs'
                                      : 'text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                                  }`}
                                >
                                  <span className="truncate">{child.name}</span>
                                  <span
                                    className={`font-mono text-[10px] px-1.5 py-0.2 rounded-md ${
                                      isSelected
                                        ? 'bg-white/20 text-white'
                                        : 'bg-black/5 dark:bg-white/5 text-slate-400'
                                    }`}
                                  >
                                    {count}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* KHỐI NHẬP MÃ TRUY CẬP ĐỀ THI */}
              <div className="rounded-[26px] border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 p-4 shadow-sm backdrop-blur-xl space-y-3">
                <div className="flex items-center gap-2 pb-1 border-b border-black/5 dark:border-white/5">
                  <KeyRound className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Vào Thi Bằng Mã Đề
                  </span>
                </div>
                <p className="text-[11px] text-[#6B7280] dark:text-slate-400">
                  Nhập mã đề riêng tư hoặc đề lớp học do thầy cô cấp.
                </p>

                <form onSubmit={handleAccessCodeSubmit} className="space-y-2">
                  <input
                    type="text"
                    placeholder="VD: TOAN12A, SINH01..."
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    className="w-full h-9 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 text-xs font-mono font-bold uppercase tracking-wider outline-none focus:border-indigo-500"
                  />
                  {accessCodeError && <p className="text-[11px] font-bold text-rose-500">{accessCodeError}</p>}
                  <button
                    type="submit"
                    disabled={accessCodeLoading || !accessCode.trim()}
                    className="w-full h-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-sm transition disabled:opacity-50"
                  >
                    {accessCodeLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : 'Vào phòng thi'}
                  </button>
                </form>
              </div>

              {/* Box Đóng gói đề (Admin only) */}
              {isAdmin && (
                <div className="rounded-[24px] border border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-500/10 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                    <Package className="h-4 w-4" /> Quản Trị Tuyển Tập
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Đóng gói các đề thi liên quan theo môn và cấu hình trộn đề tự động cho thí sinh.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenCreatePackageModal}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-3 text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Tạo tuyển tập đề
                  </button>
                </div>
              )}
            </aside>

            {/* CỘT PHẢI: KHO ĐỀ & TUYỂN TẬP */}
            <div className="space-y-6">
              {/* THANH TÌM KIẾM & CHỌN KHỐI THI */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm theo tên đề thi, mã đề, môn học hoặc từ khóa..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 text-xs font-medium shadow-sm backdrop-blur-xl outline-none focus:border-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {EXAM_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type)}
                      className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        selectedType === type
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'border border-black/5 dark:border-white/5 bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* BẢNG CHI TIẾT TUYỂN TẬP ĐANG MỞ (NẾU CÓ) */}
              {activeCollection && (
                <div className="p-5 sm:p-6 rounded-[28px] border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-white/80 to-indigo-500/10 dark:via-slate-900/80 shadow-md backdrop-blur-xl space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-purple-500 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5">
                          Tuyển tập môn {activeCollection.subject}
                        </span>
                        <span className="text-xs text-slate-500 font-bold font-mono">
                          {activeCollectionExams.length} đề thi
                        </span>
                      </div>
                      <h2
                        className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white"
                        style={{ fontFamily: 'var(--font-hub-heading)' }}
                      >
                        {activeCollection.title}
                      </h2>
                      {activeCollection.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl">
                          {activeCollection.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleOpenMixModal}
                        className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-4 py-2.5 text-xs font-black uppercase tracking-wider shadow-md transition hover:scale-105 cursor-pointer"
                      >
                        <Shuffle className="h-4 w-4" />
                        <span>Trộn đề ôn luyện</span>
                      </button>

                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEditPackageModal(activeCollection)}
                            className="p-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-black/5"
                            title="Sửa tuyển tập"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCollection(activeCollection.id)}
                            className="p-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
                            title="Giải tán tuyển tập"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setActiveCollection(null)}
                        className="p-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600"
                        title="Đóng xem chi tiết"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* THỐNG KÊ CÂU HỎI TRONG TUYỂN TẬP */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-purple-500/15">
                    <div className="p-2.5 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-black/5 dark:border-white/5">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Tổng số đề</div>
                      <div className="text-base font-black text-purple-600 dark:text-purple-400 font-mono">
                        {activeCollectionExams.length} đề thi
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-black/5 dark:border-white/5">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Trắc nghiệm (TN)</div>
                      <div className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono">
                        {activeCollectionBreakdown.choiceCount} câu
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-black/5 dark:border-white/5">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Đúng / Sai (Đ/S)</div>
                      <div className="text-base font-black text-sky-600 dark:text-sky-400 font-mono">
                        {activeCollectionBreakdown.tfCount} câu
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-black/5 dark:border-white/5">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Trả lời ngắn (TLN)</div>
                      <div className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                        {activeCollectionBreakdown.saCount} câu
                      </div>
                    </div>
                  </div>

                  {/* DANH SÁCH CÁC ĐỀ BÊN TRONG TUYỂN TẬP: ĐỀ SỐ 1, 2, 3... */}
                  <div className="space-y-2 pt-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Danh sách các đề thi trong tuyển tập:
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {activeCollectionExams.map((ex, idx) => {
                        const hasSubmitted = submissions.some((s) => s.exam_id === ex.id)
                        return (
                          <div
                            key={ex.id}
                            className="p-3 rounded-2xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-slate-800/90 shadow-2xs hover:shadow-xs transition flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-black font-mono">
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  Đề số {idx + 1}: {ex.title}
                                </h4>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                  <span>{ex.duration || 50} phút</span>
                                  {hasSubmitted && (
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                      ✓ Đã làm
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <Link
                              href={`/new-exams/${ex.id}`}
                              className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 text-xs font-bold transition shadow-2xs"
                            >
                              <span>Vào thi</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* PHẦN 1: DANH SÁCH TUYỂN TẬP ĐỀ (NẾU CHƯA MỞ XEM CHI TIẾT) */}
              {!activeCollection && filteredCollections.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      <h2
                        className="text-base sm:text-lg font-black uppercase tracking-wider text-slate-800 dark:text-slate-200"
                        style={{ fontFamily: 'var(--font-hub-heading)' }}
                      >
                        Tuyển Tập Đề Thi Theo Môn
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={handleOpenCreatePackageModal}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition hover:scale-105 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Tạo tuyển tập đề</span>
                        </button>
                      )}
                      <span className="text-xs text-slate-500 font-bold font-mono">
                        {filteredCollections.length} tuyển tập
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCollections.map((col) => {
                      const colExams = (col.exam_ids || [])
                        .map((id) => exams.find((e) => e.id === id))
                        .filter(Boolean) as ExamItem[]
                      const breakdown = getExamQuestionsBreakdown(colExams)

                      return (
                        <div
                          key={col.id}
                          className="group relative overflow-hidden rounded-[26px] border border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-white/80 to-indigo-500/5 dark:via-slate-900/80 dark:to-indigo-500/10 p-5 shadow-sm backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between"
                        >
                          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-sky-400" />

                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="rounded-lg bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                                Tuyển tập • {col.subject}
                              </span>
                              <span className="rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400 font-mono">
                                {col.exam_ids.length} đề thi
                              </span>
                            </div>

                            <h3
                              className="mt-3 text-base font-black text-slate-900 dark:text-white line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition"
                              style={{ fontFamily: 'var(--font-hub-heading)' }}
                            >
                              {col.title}
                            </h3>

                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                              {col.description || `Tuyển chọn ${col.exam_ids.length} đề thi môn ${col.subject}.`}
                            </p>

                            <div className="mt-3 grid grid-cols-3 gap-1.5 py-2 px-2.5 rounded-xl bg-black/5 dark:bg-white/5 text-center text-[10px] font-mono">
                              <div>
                                <span className="text-slate-400">TN:</span>{' '}
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                  {breakdown.choiceCount}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400">Đ/S:</span>{' '}
                                <span className="font-bold text-sky-600 dark:text-sky-400">
                                  {breakdown.tfCount}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400">TLN:</span>{' '}
                                <span className="font-bold text-amber-600 dark:text-amber-400">
                                  {breakdown.saCount}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2">
                            {/* Nút Quản Lý & Tuỳ Chỉnh Tuyển Tập Đề (Admin only: Icon Quản lý & Xóa) */}
                            {isAdmin && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleOpenEditPackageModal(col)
                                  }}
                                  className="h-9 w-9 rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 flex items-center justify-center transition active:scale-95 cursor-pointer"
                                  title="Quản lý & chỉnh sửa tuyển tập"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteCollection(col.id)
                                  }}
                                  className="h-9 w-9 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 flex items-center justify-center transition active:scale-95 cursor-pointer"
                                  title="Giải tán tuyển tập"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}

                            <div className="flex items-center gap-2 ml-auto">
                              <button
                                type="button"
                                onClick={() => setActiveCollection(col)}
                                className="h-9 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs active:scale-95 cursor-pointer whitespace-nowrap"
                                title="Mở tuyển tập đề"
                              >
                                <BookOpen className="h-4 w-4 shrink-0" />
                                <span>Mở</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveCollection(col)
                                  setTimeout(() => handleOpenMixModal(), 100)
                                }}
                                className="h-9 w-9 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 flex items-center justify-center transition active:scale-95 cursor-pointer"
                                title="Trộn đề ôn luyện từ tuyển tập này"
                              >
                                <Shuffle className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* PHẦN 2: DANH SÁCH ĐỀ THI ĐỘC LẬP / CÁC ĐỀ KHÔNG GỘP VÀO TUYỂN TẬP */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-indigo-500" />
                    <h2
                      className="text-base sm:text-lg font-black uppercase tracking-wider text-slate-800 dark:text-slate-200"
                      style={{ fontFamily: 'var(--font-hub-heading)' }}
                    >
                      {activeCollection ? 'Các Đề Thi Khác' : 'Sen Portal • Kho Đề Khảo Thí (100% KaTeX)'}
                    </h2>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['Tất cả', 'HSA', 'THPTQG'].map((typeCode) => {
                      const isActive = selectedType === typeCode
                      const label =
                        typeCode === 'Tất cả'
                          ? 'Tất cả đề'
                          : typeCode === 'HSA'
                          ? 'Đề HSA ĐHQGHN'
                          : 'Đề THPT Quốc Gia'

                      return (
                        <button
                          key={typeCode}
                          type="button"
                          onClick={() => setSelectedType(typeCode)}
                          className={`px-3 py-1 rounded-xl text-xs font-black transition cursor-pointer ${
                            isActive
                              ? 'bg-sky-600 text-white shadow-xs'
                              : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-black/10'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                    <span className="text-xs text-slate-500 font-bold font-mono pl-1">
                      {filteredExams.length} đề thi
                    </span>
                  </div>
                </div>

                {filteredExams.length === 0 ? (
                  <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 p-8 text-center backdrop-blur-xl">
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                      Không tìm thấy đề thi độc lập nào phù hợp với bộ lọc hiện tại.
                    </p>
                    {bundledExamIds.size > 0 && (
                      <p className="text-xs text-slate-400 mt-1">
                        (Các đề thi đã gộp vào tuyển tập đề theo môn sẽ chỉ hiển thị bên trong tuyển tập đó)
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredExams.map((exam) => {
                      const hasSubmitted = submissions.some((s) => s.exam_id === exam.id)

                      return (
                        <div
                          key={exam.id}
                          className="group relative overflow-hidden rounded-[26px] border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 p-5 shadow-sm backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                                {exam.exam_type || 'THPTQG'}
                              </span>

                              <div className="flex items-center gap-1.5">
                                {hasSubmitted && (
                                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                    ✓ Đã nộp bài
                                  </span>
                                )}
                                {exam.is_vip && (
                                  <span className="flex items-center gap-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                    <Crown className="h-3 w-3" /> VIP
                                  </span>
                                )}
                              </div>
                            </div>

                            <h3
                              className="mt-3 text-base font-black text-slate-900 dark:text-white line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition"
                              style={{ fontFamily: 'var(--font-hub-heading)' }}
                            >
                              {exam.title}
                            </h3>

                            {exam.description && (
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                {exam.description}
                              </p>
                            )}

                            <div className="mt-3 flex items-center gap-3 text-xs text-[#6B7280] dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5 text-amber-500" />
                                <span>{exam.duration || 50} phút</span>
                              </span>
                              {exam.subject && (
                                <span className="flex items-center gap-1 truncate">
                                  <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                                  <span className="truncate">{exam.subject}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between gap-2">
                            <Link
                              href={exam.require_seb ? `/seb-exam/${exam.id}` : `/new-exams/${exam.id}`}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white py-2 text-xs font-bold transition shadow-xs"
                            >
                              <span>{hasSubmitted ? 'Làm lại đề' : 'Bắt đầu thi'}</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Link>

                            {exam.pdf_url && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPreviewPdfUrl(exam.pdf_url!)
                                  setPreviewPdfTitle(exam.title)
                                }}
                                className="p-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400 transition"
                                title="Xem trước file PDF"
                              >
                                <FileText className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

                {/* ==================================================== */}
        {/* NỘI DUNG CHÍNH TAB 2: THƯ VIỆN SEN ONLINE (FEPN x SENEXAM) */}
        {/* ==================================================== */}
        {activeTab === 'library' && (
          <div className="w-full space-y-6 animate-in fade-in">
            {/* FLOATING DRAWER: THƯ MỤC CÂY TO (BẬT RA KHI BẤM NÚT 3 GẠCH NGANG HOẶC MOBILE) */}
            {libFloatingTreeOpen && (
              <div className="fixed inset-0 z-50 flex items-stretch justify-start bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div
                  className="relative w-full max-w-sm sm:max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl p-5 overflow-y-auto border-r border-black/10 dark:border-white/10 space-y-4 animate-in slide-in-from-left duration-200 flex flex-col justify-between"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="space-y-4">
                    {/* Header Drawer */}
                    <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
                      <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                        <FolderTree className="h-5 w-5" />
                        <h3 className="font-black text-sm uppercase tracking-wider text-slate-900 dark:text-white">
                          Cây Thư Viện Môn Học (Toàn Bộ)
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLibFloatingTreeOpen(false)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                        title="Đóng cây thư mục"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Ô Tìm Kiếm */}
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Lọc môn học & khối chuyên đề..."
                        value={libFolderSearch}
                        onChange={(e) => setLibFolderSearch(e.target.value)}
                        className="h-9 w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 pl-9 pr-3 text-xs outline-none focus:border-violet-500"
                      />
                    </div>

                    {/* Nút Xem Tất Cả Môn */}
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectLibFolder(null)
                        setLibFloatingTreeOpen(false)
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        libCurrentFolderId === null
                          ? 'bg-violet-600 text-white shadow-sm'
                          : 'bg-black/5 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-black/10 dark:hover:bg-white/10'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Tất cả môn & tài liệu</span>
                      </span>
                      <span className="text-[10px] opacity-75 font-mono">{libraryDocs.length}</span>
                    </button>

                    {/* Cây Thư Mục Mẹ - Con trong Floating Drawer */}
                    <div className="rounded-[22px] border border-black/10 dark:border-white/10 bg-slate-50/70 dark:bg-slate-800/50 p-2.5 shadow-inner max-h-[58vh] overflow-y-auto space-y-1">
                      {filteredLibraryTree.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">
                          Chưa có thư mục nào
                        </div>
                      ) : (
                        filteredLibraryTree.map(({ parent, children }) => {
                          const isExp = libExpandedParents[parent.id] ?? true
                          const hasChildren = children && children.length > 0
                          const isParentOver = dragOverTarget === `parent-${parent.id}`

                          return (
                            <div
                              key={parent.id}
                              className={`space-y-0.5 rounded-xl p-1 transition ${
                                isParentOver ? 'ring-2 ring-violet-500 bg-violet-500/10' : ''
                              }`}
                              onDragOver={(e) => {
                                if (draggedItem) {
                                  e.preventDefault()
                                  setDragOverTarget(`parent-${parent.id}`)
                                }
                              }}
                              onDragLeave={() => {
                                if (dragOverTarget === `parent-${parent.id}`) setDragOverTarget(null)
                              }}
                              onDrop={async (e) => {
                                e.preventDefault()
                                if (!draggedItem) return
                                if (draggedItem.type === 'folder' && draggedItem.id !== parent.id) {
                                  await handleMoveFolderToParent(draggedItem.id, parent.id, parent.name)
                                } else if (draggedItem.type === 'doc') {
                                  await handleMoveDocToFolder(draggedItem.id, parent.id, parent.name)
                                }
                                setDraggedItem(null)
                                setDragOverTarget(null)
                              }}
                            >
                              <div className="flex items-center justify-between group">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLibExpandedParents((prev) => ({ ...prev, [parent.id]: !isExp }))
                                  }}
                                  className="flex-1 flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                                >
                                  <span className="flex items-center gap-1.5 truncate">
                                    {isExp ? (
                                      <FolderOpen className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                                    ) : (
                                      <Folder className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                                    )}
                                    <span className="truncate">{parent.name}</span>
                                  </span>
                                  {hasChildren && (
                                    <span className="text-slate-400">
                                      {isExp ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    </span>
                                  )}
                                </button>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLibItem(parent.id, 'folder')}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition"
                                    title="Xóa khối này"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>

                              {isExp && hasChildren && (
                                <div className="pl-3 space-y-0.5 border-l border-black/5 dark:border-white/5 ml-3">
                                  {children.map((child) => {
                                    const isSelected = libCurrentFolderId === child.id
                                    const count = libraryFolderDocCounts[child.id] || 0
                                    const isChildOver = dragOverTarget === `child-${child.id}`

                                    return (
                                      <div
                                        key={child.id}
                                        draggable={isAdmin}
                                        onDragStart={(e) => {
                                          e.stopPropagation()
                                          e.dataTransfer.setData('text/plain', child.id)
                                          setDraggedItem({
                                            type: 'folder',
                                            id: child.id,
                                            name: child.name,
                                            sourceFolderId: child.parent_id,
                                          })
                                        }}
                                        onDragEnd={() => {
                                          setDraggedItem(null)
                                          setDragOverTarget(null)
                                        }}
                                        onDragOver={(e) => {
                                          if (draggedItem) {
                                            e.preventDefault()
                                            setDragOverTarget(`child-${child.id}`)
                                          }
                                        }}
                                        onDragLeave={() => {
                                          if (dragOverTarget === `child-${child.id}`) setDragOverTarget(null)
                                        }}
                                        onDrop={async (e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          if (draggedItem?.type === 'doc') {
                                            await handleMoveDocToFolder(draggedItem.id, child.id, child.name)
                                          }
                                          setDraggedItem(null)
                                          setDragOverTarget(null)
                                        }}
                                        className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                                          isChildOver
                                            ? 'ring-2 ring-violet-500 bg-violet-500/20'
                                            : isSelected
                                            ? 'bg-violet-600 text-white font-bold shadow-xs'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                        onClick={() => {
                                          handleSelectLibFolder(child.id)
                                          setLibFloatingTreeOpen(false)
                                        }}
                                      >
                                        <span className="truncate flex items-center gap-1.5">
                                          {isAdmin && (
                                            <GripVertical className="h-3 w-3 text-slate-400 opacity-60 hover:opacity-100" />
                                          )}
                                          <span className="truncate">{child.name}</span>
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <span
                                            className={`font-mono text-[10px] px-1.5 py-0.2 rounded-md ${
                                              isSelected
                                                ? 'bg-white/20 text-white'
                                                : 'bg-black/5 dark:bg-white/5 text-slate-400'
                                            }`}
                                          >
                                            {count}
                                          </span>
                                          {isAdmin && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                handleDeleteLibItem(child.id, 'folder')
                                              }}
                                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-500 transition"
                                              title="Xóa môn"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  {/* Admin Controls */}
                  {isAdmin && (
                    <div className="pt-3 border-t border-black/10 dark:border-white/10 space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLibCreateType('folder')
                          setLibNewParentId(null)
                          setShowLibCreateModal(true)
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs font-bold hover:bg-black/10 transition cursor-pointer"
                      >
                        <FolderPlus className="h-3.5 w-3.5 text-amber-500" /> + Tạo Khối / Thư Mục Cha
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLibCreateType('subject')
                          setLibNewParentId(libCurrentFolderId || null)
                          setShowLibCreateModal(true)
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 text-white px-3 py-2 text-xs font-bold shadow-xs hover:bg-violet-700 transition cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" /> + Tạo Môn Học Mới
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex-1 cursor-pointer" onClick={() => setLibFloatingTreeOpen(false)} />
              </div>
            )}

            {/* TOAST THÔNG BÁO THƯ VIỆN */}
            {libToast && (
              <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold animate-in slide-in-from-bottom duration-200 border border-white/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{libToast.message}</span>
              </div>
            )}

            {/* ========================================================= */}
            {/* TRƯỜNG HỢP 1: CHƯA CHỌN MÔN (GIAO DIỆN TỔNG QUAN VỚI CÂY TO) */}
            {/* ========================================================= */}
            {!currentLibFolder ? (
              <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[310px_1fr] gap-6 items-start">
                {/* CỘT TRÁI: SIDEBAR CÂY THƯ MỤC TO BÊN NGOÀI */}
                <aside className="space-y-4">
                  {/* Ô Tìm Kiếm */}
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Lọc môn học & thư mục..."
                        value={libFolderSearch}
                        onChange={(e) => setLibFolderSearch(e.target.value)}
                        className="h-8 w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 pl-8 pr-2.5 text-xs outline-none focus:border-violet-500"
                      />
                    </div>

                    {/* Nút Xem Tất Cả */}
                    <button
                      type="button"
                      onClick={() => handleSelectLibFolder(null)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer bg-violet-600 text-white shadow-sm"
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Tất cả tài liệu & môn học</span>
                      </span>
                      <span className="text-[10px] opacity-75 font-mono">{libraryDocs.length}</span>
                    </button>
                  </div>

                  {/* Cây Thư Mục Mẹ - Con */}
                  <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-3 shadow-sm backdrop-blur-xl max-h-[500px] overflow-y-auto space-y-1">
                    {filteredLibraryTree.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        Chưa có thư mục nào. Nhấn "+ Tạo Khối" để bắt đầu!
                      </div>
                    ) : (
                      filteredLibraryTree.map(({ parent, children }) => {
                        const isExp = libExpandedParents[parent.id] ?? true
                        const hasChildren = children && children.length > 0
                        const isParentOver = dragOverTarget === `parent-${parent.id}`

                        return (
                          <div
                            key={parent.id}
                            className={`space-y-0.5 rounded-xl transition ${isParentOver ? 'ring-2 ring-violet-500 bg-violet-500/10' : ''}`}
                            onDragOver={(e) => {
                              if (draggedItem) {
                                e.preventDefault()
                                setDragOverTarget(`parent-${parent.id}`)
                              }
                            }}
                            onDragLeave={() => {
                              if (dragOverTarget === `parent-${parent.id}`) setDragOverTarget(null)
                            }}
                            onDrop={async (e) => {
                              e.preventDefault()
                              if (!draggedItem) return
                              if (draggedItem.type === 'folder' && draggedItem.id !== parent.id) {
                                await handleMoveFolderToParent(draggedItem.id, parent.id, parent.name)
                              } else if (draggedItem.type === 'doc') {
                                await handleMoveDocToFolder(draggedItem.id, parent.id, parent.name)
                              }
                              setDraggedItem(null)
                              setDragOverTarget(null)
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setLibExpandedParents((prev) => ({ ...prev, [parent.id]: !isExp }))
                              }}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5 truncate">
                                {isExp ? (
                                  <FolderOpen className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                                ) : (
                                  <Folder className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                                )}
                                <span className="truncate">{parent.name}</span>
                              </span>
                              {hasChildren && (
                                <span className="text-slate-400">
                                  {isExp ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                </span>
                              )}
                            </button>

                            {isExp && hasChildren && (
                              <div className="pl-3 space-y-0.5 border-l border-black/5 dark:border-white/5 ml-3">
                                {children.map((child) => {
                                  const count = libraryFolderDocCounts[child.id] || 0
                                  const isChildOver = dragOverTarget === `child-${child.id}`

                                  return (
                                    <div
                                      key={child.id}
                                      draggable={isAdmin}
                                      onDragStart={(e) => {
                                        e.stopPropagation()
                                        e.dataTransfer.setData('text/plain', child.id)
                                        setDraggedItem({
                                          type: 'folder',
                                          id: child.id,
                                          name: child.name,
                                          sourceFolderId: child.parent_id,
                                        })
                                      }}
                                      onDragEnd={() => {
                                        setDraggedItem(null)
                                        setDragOverTarget(null)
                                      }}
                                      onDragOver={(e) => {
                                        if (draggedItem) {
                                          e.preventDefault()
                                          setDragOverTarget(`child-${child.id}`)
                                        }
                                      }}
                                      onDragLeave={() => {
                                        if (dragOverTarget === `child-${child.id}`) setDragOverTarget(null)
                                      }}
                                      onDrop={async (e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        if (draggedItem?.type === 'doc') {
                                          await handleMoveDocToFolder(draggedItem.id, child.id, child.name)
                                        }
                                        setDraggedItem(null)
                                        setDragOverTarget(null)
                                      }}
                                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                                        isChildOver
                                          ? 'ring-2 ring-violet-500 bg-violet-500/20'
                                          : 'text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
                                      }`}
                                      onClick={() => handleSelectLibFolder(child.id)}
                                    >
                                      <span className="truncate flex items-center gap-1.5">
                                        {isAdmin && (
                                          <GripVertical className="h-3 w-3 text-slate-400 opacity-60" />
                                        )}
                                        <span className="truncate">{child.name}</span>
                                      </span>
                                      <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-md bg-black/5 dark:bg-white/5 text-slate-400">
                                        {count}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* Quản Trị Cây To Cho Admin */}
                  {isAdmin && (
                    <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 p-3.5 space-y-2 backdrop-blur-xl">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Quản trị Thư viện
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setLibCreateType('folder')
                          setLibNewParentId(null)
                          setShowLibCreateModal(true)
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-2 text-xs font-bold hover:bg-black/10 transition cursor-pointer"
                      >
                        <FolderPlus className="h-3.5 w-3.5 text-amber-500" /> + Tạo Folder / Khối
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLibCreateType('subject')
                          setLibNewParentId(null)
                          setShowLibCreateModal(true)
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 text-white px-3 py-2 text-xs font-bold shadow-xs hover:bg-violet-700 transition cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" /> + Tạo Môn Học Mới
                      </button>
                    </div>
                  )}
                </aside>

                {/* CỘT PHẢI: TẤT CẢ MÔN HỌC & TÀI LIỆU MỚI NHẤT */}
                <div className="space-y-6">
                  {/* Header Banner */}
                  <div className="rounded-[28px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-5 sm:p-6 shadow-sm backdrop-blur-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2
                          className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white"
                          style={{ fontFamily: 'var(--font-hub-heading)' }}
                        >
                          Thư Viện Sen Online
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Nền tảng học tập & khảo thí tích hợp: Slide bài giảng, bài tập rèn luyện và đề thi vào nhanh.
                        </p>
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setLibUploadCategory('slides')
                              setLibUploadTargetFolderId(null)
                              setShowLibUploadModal(true)
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 text-white px-3.5 py-2 text-xs font-black shadow-md hover:bg-violet-700 transition cursor-pointer"
                          >
                            <UploadCloud className="h-3.5 w-3.5" /> Tải tài liệu
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Filter and Search */}
                    <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
                      <div className="relative w-full sm:max-w-md">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Tìm kiếm tài liệu, môn học..."
                          value={libDocSearch}
                          onChange={(e) => setLibDocSearch(e.target.value)}
                          className="h-9 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white/90 dark:bg-slate-800/90 pl-9 pr-3 text-xs outline-none focus:border-violet-500"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 w-full sm:w-auto">
                        {(['all', 'free', 'vip'] as const).map((tabKey) => (
                          <button
                            key={tabKey}
                            type="button"
                            onClick={() => setLibVipFilter(tabKey)}
                            className={`flex-1 sm:flex-initial px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                              libVipFilter === tabKey
                                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                          >
                            {tabKey === 'all' ? 'Tất cả' : tabKey === 'free' ? 'Miễn phí' : '⭐ VIP'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Grid Các Môn Học */}
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                      <Folder className="h-4 w-4 text-violet-500" /> Danh Mục Môn Học & Khối Chuyên Đề ({libraryFolders.length})
                    </h3>

                    {libraryFolders.length === 0 ? (
                      <div className="rounded-[28px] border border-dashed border-black/20 dark:border-white/20 bg-white/50 dark:bg-slate-900/50 p-10 text-center space-y-3">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-500">
                          <BookOpen className="h-7 w-7" />
                        </div>
                        <h4 className="text-base font-bold">Thư viện hiện chưa có môn học nào</h4>
                        <p className="text-xs text-slate-400">
                          Quản trị viên có thể nhấn "+ Tạo Môn Học Mới" để thêm môn đầu tiên.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {libraryFolders.map((folder) => {
                          const docCount = libraryFolderDocCounts[folder.id] || 0
                          const isOver = dragOverTarget === `grid-${folder.id}`

                          return (
                            <div
                              key={folder.id}
                              onDragOver={(e) => {
                                if (draggedItem) {
                                  e.preventDefault()
                                  setDragOverTarget(`grid-${folder.id}`)
                                }
                              }}
                              onDragLeave={() => {
                                if (dragOverTarget === `grid-${folder.id}`) setDragOverTarget(null)
                              }}
                              onDrop={async (e) => {
                                e.preventDefault()
                                if (draggedItem?.type === 'doc') {
                                  await handleMoveDocToFolder(draggedItem.id, folder.id, folder.name)
                                }
                                setDraggedItem(null)
                                setDragOverTarget(null)
                              }}
                              className={`rounded-2xl border bg-white/80 dark:bg-slate-900/80 p-4 shadow-sm backdrop-blur-xl flex flex-col justify-between gap-3 transition cursor-pointer hover:shadow-md ${
                                isOver
                                  ? 'border-violet-500 ring-2 ring-violet-500/40 bg-violet-500/10 scale-102'
                                  : 'border-black/10 dark:border-white/10 hover:border-violet-500/30'
                              }`}
                              onClick={() => handleSelectLibFolder(folder.id)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0">
                                    <Folder className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">
                                      {folder.name}
                                    </h4>
                                    <span className="text-[11px] text-slate-400 font-mono">
                                      {docCount} tài liệu
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  {isAdmin && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setLibRenameTarget({ id: folder.id, type: 'folder', name: folder.name })
                                          setLibRenameValue(folder.name)
                                          setShowLibRenameModal(true)
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-black dark:hover:text-white transition cursor-pointer"
                                        title="Đổi tên"
                                      >
                                        <Edit className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteLibItem(folder.id, 'folder')}
                                        className="p-1.5 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                                        title="Xóa"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
                                <span className="text-[11px] text-violet-600 dark:text-violet-400 font-bold flex items-center gap-1">
                                  <Zap className="h-3 w-3" /> Chế độ tích hợp bài thi
                                </span>
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                                  <span>Vào môn</span>
                                  <ChevronRight className="h-3.5 w-3.5 text-violet-500" />
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Danh Sách Tài Liệu Mới Cập Nhật */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-violet-500" /> Tài Liệu Mới Nhất ({libraryDocs.length})
                    </h3>
                    <div className="space-y-2.5">
                      {libraryDocs.slice(0, 10).map((doc) => {
                        const downloadUrl = `https://drive.google.com/uc?export=download&id=${doc.drive_file_id}`
                        const isLocked = doc.is_vip_only && !isVipUser && !isAdmin
                        const parentF = libraryFolders.find((f) => f.id === doc.folder_id)

                        return (
                          <div
                            key={doc.id}
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', doc.id)
                              setDraggedItem({
                                type: 'doc',
                                id: doc.id,
                                name: doc.title,
                                sourceFolderId: doc.folder_id,
                              })
                            }}
                            onDragEnd={() => {
                              setDraggedItem(null)
                              setDragOverTarget(null)
                            }}
                            className="group rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-3.5 shadow-sm backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-violet-500/30 transition"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0">
                                <FileText className="h-5 w-5" />
                              </div>
                              <div className="truncate">
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-sm truncate text-slate-900 dark:text-white group-hover:text-violet-600 transition">
                                    {doc.title}
                                  </p>
                                  {doc.is_vip_only && (
                                    <span className="flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2 py-0.5 text-[9px] font-black uppercase">
                                      <Crown className="h-2.5 w-2.5" /> VIP
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400 font-semibold">
                                  {parentF ? parentF.name : 'Thư viện chung'} • {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 justify-end">
                              {isLocked ? (
                                <Link
                                  href="/new-vip"
                                  className="inline-flex items-center gap-1 rounded-xl bg-amber-500 text-slate-950 px-3 py-1.5 text-xs font-black uppercase shadow-xs hover:bg-amber-400"
                                >
                                  <Crown className="h-3 w-3" /> Mở khóa VIP
                                </Link>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setLibPreviewDoc(doc)}
                                    className="inline-flex items-center gap-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-2.5 py-1.5 text-xs font-bold hover:bg-black/10 transition cursor-pointer"
                                  >
                                    <Eye className="h-3.5 w-3.5 text-violet-500" /> Xem thử
                                  </button>
                                  <a
                                    href={downloadUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3 py-1.5 text-xs font-bold shadow-xs hover:opacity-90 transition"
                                  >
                                    <Download className="h-3.5 w-3.5" /> Tải về
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ========================================================= */
              /* TRƯỜNG HỢP 2: ĐÃ CHỌN MÔN (GIAO THOA FEPN x SENEXAM)       */
              /* CÂY TO ẨN THÀNH NÚT 3 GẠCH NGANG - XEM TRỰC TIẾP FILE      */
              /* ========================================================= */
              <div className="space-y-4">
                {/* THANH TOP BAR MÔN HỌC (CHUẨN FEPN) */}
                <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-3 sm:p-4 shadow-sm backdrop-blur-xl flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* NÚT 3 GẠCH NGANG BẬT FLOATING CÂY THƯ MỤC TO */}
                    <button
                      type="button"
                      onClick={() => setLibFloatingTreeOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300 hover:bg-violet-500/20 transition font-bold text-xs cursor-pointer shadow-xs shrink-0"
                      title="Mở toàn bộ cây thư viện môn học"
                    >
                      <Menu className="h-4 w-4" />
                      <span className="hidden sm:inline">Cây Thư Mục</span>
                    </button>

                    {/* NÚT QUAY LẠI TẤT CẢ MÔN */}
                    <button
                      type="button"
                      onClick={() => handleSelectLibFolder(null)}
                      className="p-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 text-slate-700 dark:text-slate-300 transition cursor-pointer shrink-0"
                      title="Quay lại tất cả môn"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>

                    {/* BADGE MÃ MÔN & TÊN MÔN HỌC */}
                    <div className="flex items-center gap-2 truncate">
                      <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/25 text-xs font-mono font-black uppercase shrink-0">
                        {currentLibFolder.name.split(' ')[0] || 'MÔN'}
                      </span>
                      <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                        {currentLibFolder.name}
                      </h2>
                    </div>
                  </div>

                  {/* BỘ NÚT CHỌN TỈ LỆ CHIA FEPN & CÁC NÚT HÀNH ĐỘNG */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Nút tỉ lệ chia 35:65 | 45:55 | 60:40 giống FEPN */}
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 text-xs font-mono font-bold">
                      {(['35:65', '45:55', '60:40'] as const).map((ratio) => (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setLibSplitRatio(ratio)}
                          className={`px-2 py-0.5 rounded-lg transition cursor-pointer ${
                            libSplitRatio === ratio
                              ? 'bg-violet-600 text-white shadow-xs'
                              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>

                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setLibUploadCategory(
                              libSmallTreeCategory === 'exercises'
                                ? 'exercises'
                                : libSmallTreeCategory === 'videos'
                                ? 'videos'
                                : 'slides'
                            )
                            setLibUploadTargetFolderId(currentLibFolder.id)
                            setShowLibUploadModal(true)
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 text-white px-3 py-1.5 text-xs font-black shadow-xs hover:bg-violet-700 transition cursor-pointer"
                        >
                          <UploadCloud className="h-3.5 w-3.5" />
                          <span>ĐĂNG TÀI LIỆU</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setLibAttachTargetFolderId(currentLibFolder.id)
                            setShowLibAttachExamModal(true)
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1.5 text-xs font-black shadow-xs hover:bg-amber-500/20 transition cursor-pointer"
                        >
                          <Zap className="h-3.5 w-3.5" />
                          <span>ĐÍNH KÈM ĐỀ</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setLibRenameTarget({ id: currentLibFolder.id, type: 'folder', name: currentLibFolder.name })
                            setLibRenameValue(currentLibFolder.name)
                            setShowLibRenameModal(true)
                          }}
                          className="p-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-slate-500 hover:text-black dark:hover:text-white transition cursor-pointer"
                          title="Đổi tên môn học"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteLibItem(currentLibFolder.id, 'folder')}
                          className="p-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition cursor-pointer"
                          title="Xóa môn học này"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* KHÔNG GIAN CHÍNH: 2 CỘT (CÂY NHỎ BÊN TRÁI & XEM TRỰC TIẾP FILE BÊN PHẢI) */}
                <div className="flex flex-col lg:flex-row gap-5 items-start">
                  {/* CỘT TRÁI: THƯ MỤC CÂY NHỎ & THÀNH PHẦN MÔN HỌC */}
                  <div
                    className={`w-full space-y-4 transition-all duration-300 ${
                      libSplitRatio === '35:65'
                        ? 'lg:w-[35%]'
                        : libSplitRatio === '60:40'
                        ? 'lg:w-[60%]'
                        : 'lg:w-[45%]'
                    }`}
                  >
                    {/* Header Box Của Môn */}
                    <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-4 shadow-sm backdrop-blur-xl space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono font-bold text-sky-600 dark:text-sky-400">
                              {currentLibFolder.name.split(' ')[0] || 'MÔN'}
                            </span>
                            <span className="text-[11px] text-slate-400 font-bold">
                              3 Tín chỉ • Kỳ 3
                            </span>
                          </div>
                          <h3
                            className="text-base font-black text-slate-900 dark:text-white mt-0.5"
                            style={{ fontFamily: 'var(--font-hub-heading)' }}
                          >
                            {currentLibFolder.name}
                          </h3>
                        </div>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setLibUploadCategory('slides')
                              setLibUploadTargetFolderId(currentLibFolder.id)
                              setShowLibUploadModal(true)
                            }}
                            className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="h-3 w-3" /> Thêm file
                          </button>
                        )}
                      </div>

                      {/* Hàng File Ghi Âm & Thư Mục Nhỏ */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/5 dark:border-white/5 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 text-[11px]">
                            {libAudioRecordingEnabled ? (
                              <Mic className="h-3.5 w-3.5 text-rose-500" />
                            ) : (
                              <MicOff className="h-3.5 w-3.5 text-slate-400" />
                            )}
                            File Ghi Âm:
                          </span>
                          <button
                            type="button"
                            onClick={() => setLibAudioRecordingEnabled((v) => !v)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase transition cursor-pointer ${
                              libAudioRecordingEnabled
                                ? 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
                                : 'bg-black/5 dark:bg-white/5 text-slate-400'
                            }`}
                          >
                            {libAudioRecordingEnabled ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                          </button>
                        </div>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setLibCreateType('folder')
                              setLibNewParentId(currentLibFolder.id)
                              setShowLibCreateModal(true)
                            }}
                            className="text-[11px] font-bold text-slate-500 hover:text-violet-600 transition inline-flex items-center gap-1 cursor-pointer"
                            title="Tạo nhánh thư mục nhỏ cho môn học"
                          >
                            <FolderPlus className="h-3 w-3" /> + Thư mục nhỏ
                          </button>
                        )}
                      </div>
                    </div>

                    {/* CÂY THƯ MỤC NHỎ (TABS DANH MỤC: SLIDE, BÀI TẬP, VIDEO, BÀI THI, SUBFOLDERS) */}
                    <div className="rounded-[24px] border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 p-2 shadow-sm backdrop-blur-xl">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {/* Tab 1: Slide Bài Giảng */}
                        <div
                          onDragOver={(e) => {
                            if (draggedItem?.type === 'doc') {
                              e.preventDefault()
                              setDragOverTarget('cat-slides')
                            }
                          }}
                          onDragLeave={() => {
                            if (dragOverTarget === 'cat-slides') setDragOverTarget(null)
                          }}
                          onDrop={async (e) => {
                            e.preventDefault()
                            if (draggedItem?.type === 'doc') {
                              await handleChangeDocCategory(draggedItem.id, 'slides')
                            }
                            setDraggedItem(null)
                            setDragOverTarget(null)
                          }}
                          className={`rounded-xl transition ${dragOverTarget === 'cat-slides' ? 'ring-2 ring-violet-500 bg-violet-500/20' : ''}`}
                        >
                          <button
                            type="button"
                            onClick={() => setLibSmallTreeCategory('slides')}
                            className={`w-full p-2 rounded-xl text-center flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                              libSmallTreeCategory === 'slides'
                                ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-bold shadow-xs'
                                : 'text-slate-500 hover:bg-black/5 dark:hover:bg-white/5'
                            }`}
                          >
                            <FileText className="h-4 w-4" />
                            <span className="text-[11px] font-bold truncate">Slide Bài Giảng</span>
                            <span className="text-[9px] font-mono opacity-70">
                              ({subjectTreeBranches.slideDocs.length})
                            </span>
                          </button>
                        </div>

                        {/* Tab 2: Tài Liệu Bài Tập */}
                        <div
                          onDragOver={(e) => {
                            if (draggedItem?.type === 'doc') {
                              e.preventDefault()
                              setDragOverTarget('cat-exercises')
                            }
                          }}
                          onDragLeave={() => {
                            if (dragOverTarget === 'cat-exercises') setDragOverTarget(null)
                          }}
                          onDrop={async (e) => {
                            e.preventDefault()
                            if (draggedItem?.type === 'doc') {
                              await handleChangeDocCategory(draggedItem.id, 'exercises')
                            }
                            setDraggedItem(null)
                            setDragOverTarget(null)
                          }}
                          className={`rounded-xl transition ${dragOverTarget === 'cat-exercises' ? 'ring-2 ring-violet-500 bg-violet-500/20' : ''}`}
                        >
                          <button
                            type="button"
                            onClick={() => setLibSmallTreeCategory('exercises')}
                            className={`w-full p-2 rounded-xl text-center flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                              libSmallTreeCategory === 'exercises'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold shadow-xs'
                                : 'text-slate-500 hover:bg-black/5 dark:hover:bg-white/5'
                            }`}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-[11px] font-bold truncate">Tài Liệu Bài Tập</span>
                            <span className="text-[9px] font-mono opacity-70">
                              ({subjectTreeBranches.exerciseDocs.length})
                            </span>
                          </button>
                        </div>

                        {/* Tab 3: Video Bài Giảng */}
                        <div
                          onDragOver={(e) => {
                            if (draggedItem?.type === 'doc') {
                              e.preventDefault()
                              setDragOverTarget('cat-videos')
                            }
                          }}
                          onDragLeave={() => {
                            if (dragOverTarget === 'cat-videos') setDragOverTarget(null)
                          }}
                          onDrop={async (e) => {
                            e.preventDefault()
                            if (draggedItem?.type === 'doc') {
                              await handleChangeDocCategory(draggedItem.id, 'videos')
                            }
                            setDraggedItem(null)
                            setDragOverTarget(null)
                          }}
                          className={`rounded-xl transition ${dragOverTarget === 'cat-videos' ? 'ring-2 ring-violet-500 bg-violet-500/20' : ''}`}
                        >
                          <button
                            type="button"
                            onClick={() => setLibSmallTreeCategory('videos')}
                            className={`w-full p-2 rounded-xl text-center flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                              libSmallTreeCategory === 'videos'
                                ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 font-bold shadow-xs'
                                : 'text-slate-500 hover:bg-black/5 dark:hover:bg-white/5'
                            }`}
                          >
                            <Video className="h-4 w-4" />
                            <span className="text-[11px] font-bold truncate">Video Bài Giảng</span>
                            <span className="text-[9px] font-mono opacity-70">
                              ({subjectTreeBranches.videoDocs.length})
                            </span>
                          </button>
                        </div>

                        {/* Tab 4: Tài Liệu Bài Thi & Khảo Thí */}
                        <button
                          type="button"
                          onClick={() => setLibSmallTreeCategory('exams')}
                          className={`w-full p-2 rounded-xl text-center flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                            libSmallTreeCategory === 'exams'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold shadow-xs'
                              : 'text-slate-500 hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          <Zap className="h-4 w-4" />
                          <span className="text-[11px] font-bold truncate">Tài Liệu Bài Thi</span>
                          <span className="text-[9px] font-mono opacity-70">
                            ({subjectTreeBranches.attachedExams.length})
                          </span>
                        </button>
                      </div>

                      {/* Các Nhánh Thư Mục Con (Do Admin Tạo Riêng) */}
                      {subjectSubFolders.length > 0 && (
                        <div className="pt-2 mt-2 border-t border-black/5 dark:border-white/5 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] uppercase font-bold text-slate-400 px-1">
                            Thư mục con:
                          </span>
                          {subjectSubFolders.map((sub) => {
                            const isSubActive = libSmallTreeCategory === `subfolder-${sub.id}`
                            const subDocsCount = libraryDocs.filter((d) => d.folder_id === sub.id).length

                            return (
                              <div
                                key={sub.id}
                                className={`group inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition cursor-pointer ${
                                  isSubActive
                                    ? 'bg-violet-600 text-white font-bold shadow-xs'
                                    : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-black/10'
                                }`}
                                onClick={() => setLibSmallTreeCategory(`subfolder-${sub.id}`)}
                              >
                                <Folder className="h-3 w-3" />
                                <span>{sub.name}</span>
                                <span className="text-[10px] opacity-75 font-mono">({subDocsCount})</span>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteLibItem(sub.id, 'folder')
                                    }}
                                    className="p-0.5 hover:text-rose-400 opacity-60 group-hover:opacity-100 transition"
                                    title="Xóa thư mục con"
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* DANH SÁCH THÀNH PHẦN TRONG NHÁNH ĐANG CHỌN (DOCUMENTS / EXAMS) */}
                    <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                      {/* TRƯỜNG HỢP A: TAB ĐỀ THI & KHẢO THÍ (VÀO NHANH BÀI THI) */}
                      {libSmallTreeCategory === 'exams' ? (
                        subjectTreeBranches.attachedExams.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-black/15 dark:border-white/15 p-6 text-center space-y-2">
                            <Zap className="h-6 w-6 text-slate-400 mx-auto" />
                            <p className="text-xs text-slate-400">
                              Chưa có đề thi nào trong môn này.
                            </p>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => {
                                  setLibAttachTargetFolderId(currentLibFolder.id)
                                  setShowLibAttachExamModal(true)
                                }}
                                className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                              >
                                <Plus className="h-3.5 w-3.5" /> Đính kèm đề thi ngay
                              </button>
                            )}
                          </div>
                        ) : (
                          subjectTreeBranches.attachedExams.map((ex) => (
                            <div
                              key={ex.id}
                              className="rounded-2xl border border-amber-500/20 bg-white/90 dark:bg-slate-900/90 p-3.5 shadow-sm space-y-3 hover:border-amber-500/40 transition"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                      {ex.exam_type || 'Khảo thí'}
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-400">
                                      {ex.duration || 50} phút • {ex.total_questions || 40} câu
                                    </span>
                                  </div>
                                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-2">
                                    {ex.title}
                                  </h4>
                                </div>

                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleDetachExamFromSubject(ex.id)}
                                    className="p-1 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                                    title="Gỡ đề thi khỏi môn học"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-black/5 dark:border-white/5">
                                <span className="text-[11px] text-slate-400 font-semibold">
                                  Tự động đồng bộ đề thi
                                </span>
                                <Link
                                  href={`/new-exams/${ex.id}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs shadow-md transition hover:scale-102"
                                >
                                  <Zap className="h-3.5 w-3.5" />
                                  <span>Vào nhanh bài thi</span>
                                </Link>
                              </div>
                            </div>
                          ))
                        )
                      ) : (
                        /* TRƯỜNG HỢP B: TÀI LIỆU DẠNG CARD CHUẨN FEPN (SLIDES, BÀI TẬP, VIDEO, SUBFOLDER) */
                        (() => {
                          const docList =
                            libSmallTreeCategory === 'slides'
                              ? subjectTreeBranches.slideDocs
                              : libSmallTreeCategory === 'exercises'
                              ? subjectTreeBranches.exerciseDocs
                              : libSmallTreeCategory === 'videos'
                              ? subjectTreeBranches.videoDocs
                              : typeof libSmallTreeCategory === 'string' &&
                                libSmallTreeCategory.startsWith('subfolder-')
                              ? libraryDocs.filter(
                                  (d) => d.folder_id === libSmallTreeCategory.replace('subfolder-', '')
                                )
                              : []

                          if (docList.length === 0) {
                            return (
                              <div className="rounded-2xl border border-dashed border-black/15 dark:border-white/15 p-6 text-center space-y-2">
                                <FileText className="h-6 w-6 text-slate-400 mx-auto" />
                                <p className="text-xs text-slate-400">
                                  Chưa có tài liệu nào trong danh mục này.
                                </p>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLibUploadCategory(
                                        libSmallTreeCategory === 'exercises'
                                          ? 'exercises'
                                          : libSmallTreeCategory === 'videos'
                                          ? 'videos'
                                          : 'slides'
                                      )
                                      setLibUploadTargetFolderId(currentLibFolder.id)
                                      setShowLibUploadModal(true)
                                    }}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                                  >
                                    <Plus className="h-3.5 w-3.5" /> + Thêm file ngay
                                  </button>
                                )}
                              </div>
                            )
                          }

                          return docList.map((doc) => {
                            const isSelected = libActiveInlineDoc?.id === doc.id

                            return (
                              <div
                                key={doc.id}
                                draggable={true}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', doc.id)
                                  setDraggedItem({
                                    type: 'doc',
                                    id: doc.id,
                                    name: doc.title,
                                    sourceFolderId: doc.folder_id,
                                  })
                                }}
                                onDragEnd={() => {
                                  setDraggedItem(null)
                                  setDragOverTarget(null)
                                }}
                                onClick={() => setLibActiveInlineDoc(doc)}
                                className={`group rounded-2xl border p-3 shadow-xs transition flex items-center justify-between gap-3 cursor-pointer ${
                                  isSelected
                                    ? 'bg-sky-500/10 dark:bg-sky-500/15 border-sky-500 ring-1 ring-sky-500/50 shadow-sm'
                                    : 'bg-white/80 dark:bg-slate-900/80 border-black/10 dark:border-white/10 hover:border-sky-500/40 hover:bg-black/5 dark:hover:bg-white/5'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  {/* Icon File Box Chuẩn FEPN */}
                                  <div
                                    className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${
                                      isSelected
                                        ? 'bg-sky-500 text-white'
                                        : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                                    }`}
                                  >
                                    <FileText className="h-4 w-4" />
                                  </div>

                                  <div className="truncate">
                                    <p
                                      className={`text-xs sm:text-sm font-bold truncate transition ${
                                        isSelected
                                          ? 'text-sky-600 dark:text-sky-400'
                                          : 'text-slate-900 dark:text-white'
                                      }`}
                                    >
                                      {doc.title}
                                    </p>
                                    <span className="text-[10px] text-slate-400 font-medium block">
                                      Tài liệu học tập • {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteLibItem(doc.id, 'doc')}
                                      className="p-1.5 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                                      title="Xóa tài liệu"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  <ChevronRight
                                    className={`h-4 w-4 transition ${
                                      isSelected
                                        ? 'text-sky-500 translate-x-0.5'
                                        : 'text-slate-400 group-hover:translate-x-0.5'
                                    }`}
                                  />
                                </div>
                              </div>
                            )
                          })
                        })()
                      )}
                    </div>
                  </div>

                  {/* CỘT PHẢI: KHUNG XEM TRƯỚC FILE TRỰC TIẾP (CHUẨN FEPN) */}
                  <div className="flex-1 w-full bg-white/90 dark:bg-slate-900/90 rounded-[28px] border border-black/10 dark:border-white/10 p-4 sm:p-5 shadow-sm backdrop-blur-xl flex flex-col space-y-3">
                    {/* Header Khung Xem Trước (Badge + Tên File + 3 Nút FEPN) */}
                    <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10 gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25 shrink-0">
                          {libSmallTreeCategory === 'slides'
                            ? 'SLIDE'
                            : libSmallTreeCategory === 'exercises'
                            ? 'BÀI TẬP'
                            : libSmallTreeCategory === 'videos'
                            ? 'VIDEO'
                            : 'TÀI LIỆU'}
                        </span>
                        <h3 className="font-bold text-sm sm:text-base truncate text-slate-900 dark:text-white">
                          {libActiveInlineDoc ? libActiveInlineDoc.title : 'Chọn tài liệu để xem trực tiếp'}
                        </h3>
                      </div>

                      {/* Bộ 3 Nút Hành Động Chuẩn FEPN: Mở tab mới, Tải file, Phóng to */}
                      {libActiveInlineDoc && (
                        <div className="flex items-center gap-1 shrink-0">
                          {/* 1. Mở tab mới */}
                          <a
                            href={`https://drive.google.com/file/d/${libActiveInlineDoc.drive_file_id}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl text-slate-500 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition"
                            title="Mở trong tab mới"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>

                          {/* 2. Tải file */}
                          <a
                            href={`https://drive.google.com/uc?export=download&id=${libActiveInlineDoc.drive_file_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl text-slate-500 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition"
                            title="Tải tệp xuống"
                          >
                            <Download className="h-4 w-4" />
                          </a>

                          {/* 3. Phóng to toàn màn hình */}
                          <button
                            type="button"
                            onClick={() => {
                              setLibPreviewDoc(libActiveInlineDoc)
                              setLibPreviewFullscreen(true)
                            }}
                            className="p-2 rounded-xl text-slate-500 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                            title="Phóng to toàn màn hình"
                          >
                            <Maximize2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* VÙNG NHÚNG XEM TRỰC TIẾP FILE GOOGLE DRIVE IFRAME */}
                    <div className="w-full flex-1 rounded-2xl overflow-hidden border border-black/10 dark:border-white/10 bg-slate-950 relative min-h-[550px] lg:min-h-[700px]">
                      {libActiveInlineDoc ? (
                        <iframe
                          src={`https://drive.google.com/file/d/${libActiveInlineDoc.drive_file_id}/preview#toolbar=0&navpanes=0&scrollbar=0`}
                          className="w-full h-full min-h-[550px] lg:min-h-[700px] border-none"
                          allow="autoplay"
                          title={libActiveInlineDoc.title}
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-500">
                            <BookOpen className="h-8 w-8" />
                          </div>
                          <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                            Chưa có tài liệu nào được chọn
                          </h4>
                          <p className="text-xs text-slate-400 max-w-sm">
                            Vui lòng chọn một tài liệu ở danh sách bên trái để xem trước trực tiếp trên trang, hoặc tải tài liệu mới lên.
                          </p>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setLibUploadCategory('slides')
                                setLibUploadTargetFolderId(currentLibFolder.id)
                                setShowLibUploadModal(true)
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold shadow-xs hover:bg-violet-700 transition cursor-pointer"
                            >
                              <Plus className="h-3.5 w-3.5" /> + Tải tài liệu lên môn học
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
{/* ==================================================== */}
        {/* NỘI DUNG CHÍNH TAB: TẠO ĐỀ & SOẠN ĐỀ (KATEX / PDF / SEB / AI) */}
        {/* ==================================================== */}
        {activeTab === 'create' && (
          <div className="w-full animate-in fade-in">
            <SetupCourseMainContent embedded={true} isParentDark={isDark} />
          </div>
        )}

        {/* NỘI DUNG CHÍNH TAB 3: LỊCH SỬ BÀI NỘP & PHÂN TÍCH ĐIỂM */}
        {activeTab === 'history' && (
          <div className="space-y-6 animate-in fade-in">
            {/* KPI CARDS THỐNG KÊ NHANH */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Tổng bài đã nộp</span>
                  <FileText className="h-4 w-4 text-teal-500" />
                </div>
                <p
                  className="text-2xl font-black mt-2 text-slate-900 dark:text-white"
                  style={{ fontFamily: 'var(--font-hub-heading)' }}
                >
                  {historyStats.total}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Bài thi trên hệ thống</p>
              </div>

              <div className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Điểm cao nhất</span>
                  <Trophy className="h-4 w-4 text-amber-500" />
                </div>
                <p
                  className="text-2xl font-black mt-2 text-amber-600 dark:text-amber-400"
                  style={{ fontFamily: 'var(--font-hub-heading)' }}
                >
                  {historyStats.highest}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Kỷ lục điểm số của bạn</p>
              </div>

              <div className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Điểm trung bình</span>
                  <Award className="h-4 w-4 text-indigo-500" />
                </div>
                <p
                  className="text-2xl font-black mt-2 text-indigo-600 dark:text-indigo-400"
                  style={{ fontFamily: 'var(--font-hub-heading)' }}
                >
                  {historyStats.avg}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {historyStats.highCount} bài đạt điểm giỏi (≥ 8.0)
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Thời gian luyện đề</span>
                  <Clock className="h-4 w-4 text-sky-500" />
                </div>
                <p
                  className="text-2xl font-black mt-2 text-sky-600 dark:text-sky-400"
                  style={{ fontFamily: 'var(--font-hub-heading)' }}
                >
                  {historyStats.totalMinutes} <span className="text-xs font-bold text-slate-500">phút</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Tổng thời gian ngồi làm bài</p>
              </div>
            </section>

            {/* BIỂU ĐỒ TIẾN TRÌNH ĐIỂM SỐ (SVG CHART VỚI ZOOM & TOOLTIP) */}
            {showChart && chartData.count > 0 && (
              <section className="p-5 rounded-3xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                        Biểu đồ tiến độ phong độ điểm thi
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        {chartData.count} lần thi đã chấm • Xu hướng gần đây:{' '}
                        <span
                          className={`font-bold ${
                            chartData.trend > 0
                              ? 'text-emerald-500'
                              : chartData.trend < 0
                              ? 'text-rose-500'
                              : 'text-slate-500'
                          }`}
                        >
                          {chartData.trend > 0 ? `+${chartData.trend}` : chartData.trend} điểm
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
                      {['Tất cả', 'THPTQG', 'HSA', 'TSA'].map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setChartExamFilter(tab)}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                            chartExamFilter === tab
                              ? 'bg-teal-600 text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1 pl-2 border-l border-black/10 dark:border-white/10">
                      <button
                        onClick={() => setChartZoom((z) => Math.max(1, z - 0.25))}
                        className="px-2 py-1 rounded-lg border border-black/10 dark:border-white/10 text-xs font-bold hover:bg-black/5"
                        title="Thu nhỏ"
                      >
                        -
                      </button>
                      <span className="text-[11px] font-mono text-slate-500">{chartZoom.toFixed(2)}x</span>
                      <button
                        onClick={() => setChartZoom((z) => Math.min(2.5, z + 0.25))}
                        className="px-2 py-1 rounded-lg border border-black/10 dark:border-white/10 text-xs font-bold hover:bg-black/5"
                        title="Phóng to"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* SVG DRAWING AREA */}
                <div className="relative overflow-x-auto pb-2 scrollbar-thin">
                  <div style={{ minWidth: `${chartData.svgWidth}px` }} className="relative h-[200px]">
                    <svg
                      width={chartData.svgWidth}
                      height={chartData.svgHeight}
                      className="overflow-visible"
                    >
                      <defs>
                        <linearGradient id="hubGradTeal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Lưới ngang Grid Lines */}
                      {chartData.gridSteps.map((step) => {
                        const ratio = step / chartData.maxScoreRange
                        const y = chartData.svgHeight - 30 - ratio * (chartData.svgHeight - 60)
                        return (
                          <g key={step}>
                            <line
                              x1={40}
                              y1={y}
                              x2={chartData.svgWidth - 20}
                              y2={y}
                              stroke="currentColor"
                              strokeDasharray="3 3"
                              className="text-black/10 dark:text-white/10"
                            />
                            <text
                              x={10}
                              y={y + 3}
                              className="text-[9px] fill-slate-400 font-mono font-bold"
                            >
                              {step}
                            </text>
                          </g>
                        )
                      })}

                      {/* Vùng mờ Area Path */}
                      {chartData.areaPath && (
                        <path d={chartData.areaPath} fill="url(#hubGradTeal)" />
                      )}

                      {/* Đường line kết nối */}
                      {chartData.pathString && (
                        <path
                          d={chartData.pathString}
                          fill="none"
                          stroke="#0D9488"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Các điểm dữ liệu Data Points */}
                      {chartData.points.map((p, idx) => (
                        <g key={idx} className="cursor-pointer group">
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r="5"
                            className="fill-teal-500 stroke-white dark:stroke-slate-900 stroke-2 transition-transform duration-200 group-hover:scale-125"
                            onMouseEnter={() => setHoveredPoint(p)}
                            onMouseLeave={() => setHoveredPoint(null)}
                          />
                        </g>
                      ))}
                    </svg>

                    {/* Tooltip hiển thị khi hover vào điểm */}
                    {hoveredPoint && (
                      <div
                        className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full mb-2 bg-slate-900/90 text-white p-2 rounded-xl text-xs shadow-lg backdrop-blur-md border border-white/10 whitespace-nowrap"
                        style={{ left: `${hoveredPoint.x}px`, top: `${hoveredPoint.y}px` }}
                      >
                        <p className="font-bold truncate max-w-[200px]">{hoveredPoint.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-teal-300 font-mono">
                          <span>Điểm: {hoveredPoint.score}</span>
                          <span>•</span>
                          <span>{hoveredPoint.date}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* BỘ LỌC & DANH SÁCH BÀI LÀM ĐÃ NỘP */}
            <section className="space-y-4">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm bài nộp theo tên đề thi hoặc môn..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 text-xs font-medium outline-none focus:border-teal-500"
                  />
                  {historySearchQuery && (
                    <button
                      onClick={() => setHistorySearchQuery('')}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
                    {HISTORY_EXAM_TYPES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setHistorySelectedType(t)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                          historySelectedType === t
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'border border-black/5 dark:border-white/5 bg-white/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-black/5'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <select
                    value={filterScoreStatus}
                    onChange={(e: any) => setFilterScoreStatus(e.target.value)}
                    className="h-9 px-3 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-bold outline-none text-slate-700 dark:text-slate-200"
                  >
                    <option value="all">Tất cả điểm số</option>
                    <option value="high">Điểm giỏi (≥ 8.0)</option>
                    <option value="low">Cần cải thiện (&lt; 5.0)</option>
                    <option value="graded">Đã có điểm</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e: any) => setSortBy(e.target.value)}
                    className="h-9 px-3 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-bold outline-none text-slate-700 dark:text-slate-200"
                  >
                    <option value="newest">Mới nhất trước</option>
                    <option value="oldest">Cũ nhất trước</option>
                    <option value="highest">Điểm cao nhất</option>
                    <option value="lowest">Điểm thấp nhất</option>
                  </select>
                </div>
              </div>

              {filteredSubmissions.length === 0 ? (
                <div className="p-12 text-center rounded-3xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
                  <FileText className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Không tìm thấy bài nộp nào phù hợp
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Hãy thử đổi từ khóa tìm kiếm hoặc làm thêm các đề thi trong Kho Đề.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSubmissions.map((sub) => {
                    const exam = sub.exams
                    const score = sub.score !== null && sub.score !== undefined ? sub.score.toFixed(1) : null
                    const minutes = sub.time_spent ? Math.round(sub.time_spent / 60) : null
                    const dateStr = new Date(sub.created_at).toLocaleString('vi-VN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })

                    return (
                      <div
                        key={sub.id}
                        className="p-4 sm:p-5 rounded-2xl border border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs hover:shadow-md transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-start gap-3.5">
                          <div
                            className={`h-12 w-12 shrink-0 rounded-2xl flex flex-col items-center justify-center font-black ${
                              score !== null && parseFloat(score) >= 8
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : score !== null && parseFloat(score) >= 5
                                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                                : score !== null
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                            }`}
                          >
                            <span className="text-base leading-none">{score ?? '—'}</span>
                            <span className="text-[9px] uppercase tracking-wider font-bold opacity-75">Điểm</span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[10px] font-black uppercase">
                                {exam?.exam_type || 'THPTQG'}
                              </span>
                              {exam?.subject && (
                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                  {exam.subject}
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400">• {dateStr}</span>
                            </div>

                            <h3
                              className="text-sm font-bold text-slate-900 dark:text-white"
                              style={{ fontFamily: 'var(--font-hub-heading)' }}
                            >
                              {exam?.title || 'Đề thi tự luyện'}
                            </h3>

                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              {minutes !== null && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5 text-slate-400" /> Làm bài trong {minutes} phút
                                </span>
                              )}
                              <span>•</span>
                              <span>{sub.is_graded ? 'Đã chấm điểm' : 'Đang xử lý kết quả'}</span>
                            </div>

                            {sub.feedback && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 italic">
                                💬 Nhận xét: {sub.feedback}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {exam?.solution_pdf_url && (
                            <button
                              onClick={() => {
                                setPreviewPdfUrl(exam.solution_pdf_url!)
                                setPreviewPdfTitle(`Lời giải: ${exam.title}`)
                              }}
                              className="px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5"
                              title="Xem đáp án PDF"
                            >
                              <FileText className="h-3.5 w-3.5 text-amber-500" />
                              <span className="hidden sm:inline">Đáp án PDF</span>
                            </button>
                          )}

                          {sub.exam_id && (
                            <Link
                              href={`/new-exams/${sub.exam_id}`}
                              className="p-2 sm:px-3 sm:py-2 rounded-xl border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center gap-1.5"
                              title="Làm lại đề thi này"
                            >
                              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                              <span className="hidden sm:inline">Làm lại</span>
                            </Link>
                          )}

                          <Link
                            href={`/new-history-submissions/${sub.id}`}
                            className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Xem chi tiết</span>
                            <ChevronRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* MODAL ĐÓNG GÓI TUYỂN TẬP ĐỀ (ADMIN ONLY) */}
      {showAdminPackageModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-2xl rounded-[32px] border border-black/10 dark:border-white/15 bg-white dark:bg-slate-900 shadow-2xl p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3
                    className="text-lg font-black text-slate-900 dark:text-white"
                    style={{ fontFamily: 'var(--font-hub-heading)' }}
                  >
                    {packagingEditingId ? 'Cập Nhật Tuyển Tập Đề' : 'Tạo Tuyển Tập Đề Mới'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Gộp các đề liên quan theo môn và cấu hình trọn gói cho học sinh.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminPackageModal(false)}
                className="rounded-xl p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePackaging} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Môn học đóng gói <span className="text-rose-500">*</span>:
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Toán học, Vật lí, Hóa học..."
                    value={packagingSubject}
                    onChange={(e) => setPackagingSubject(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-3 text-xs font-bold outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tên tuyển tập đề:
                  </label>
                  <input
                    type="text"
                    placeholder={`Tuyển tập đề thi ${packagingSubject || 'môn học'}`}
                    value={packagingTitle}
                    onChange={(e) => setPackagingTitle(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-3 text-xs font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Mô tả ngắn gọn về tuyển tập:
                </label>
                <textarea
                  placeholder="Gồm các đề thi thử chọn lọc từ các trường THPT Chuyên, chuẩn ma trận Bộ GD&ĐT..."
                  value={packagingDesc}
                  onChange={(e) => setPackagingDesc(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 p-3 text-xs font-medium outline-none focus:border-indigo-500 h-16"
                />
              </div>

              {/* CHỌN CÁC ĐỀ THI ĐƯA VÀO TUYỂN TẬP */}
              <div className="space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Chọn đề thi đưa vào tuyển tập ({packagingSelectedExamIds.length} đề đã chọn):
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Các đề được chọn sẽ được gom gọn vào tuyển tập này.
                  </span>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Lọc nhanh đề theo tên để chọn..."
                    value={packagingExamSearch}
                    onChange={(e) => setPackagingExamSearch(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-xs outline-none"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1.5 p-1 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
                  {exams
                    .filter((ex) => {
                      if (!packagingExamSearch.trim()) return true
                      return ex.title.toLowerCase().includes(packagingExamSearch.toLowerCase())
                    })
                    .map((ex) => {
                      const isSelected = packagingSelectedExamIds.includes(ex.id)
                      return (
                        <div
                          key={ex.id}
                          onClick={() => {
                            setPackagingSelectedExamIds((prev) =>
                              isSelected ? prev.filter((id) => id !== ex.id) : [...prev, ex.id]
                            )
                          }}
                          className={`p-2 rounded-lg text-xs font-medium transition cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-indigo-600 text-white font-bold shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 shrink-0 text-white" />
                            ) : (
                              <Square className="h-4 w-4 shrink-0 text-slate-400" />
                            )}
                            <span className="truncate">{ex.title}</span>
                          </div>
                          <span className="shrink-0 text-[10px] opacity-75 font-mono">
                            {ex.duration || 50}p
                          </span>
                        </div>
                      )
                    })}
                </div>
              </div>

              {packagingError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">
                  {packagingError}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAdminPackageModal(false)}
                  className="rounded-xl border border-black/10 dark:border-white/10 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={packagingLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs font-black uppercase tracking-wider shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {packagingLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Đang lưu...
                    </>
                  ) : (
                    <>Lưu Tuyển Tập</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TRỘN ĐỀ THI DÀNH CHO THÍ SINH */}
      {showMixModal && activeCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-xl rounded-[32px] border border-black/10 dark:border-white/15 bg-white dark:bg-slate-900 shadow-2xl p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Shuffle className="h-5 w-5" />
                </div>
                <div>
                  <h3
                    className="text-lg font-black text-slate-900 dark:text-white"
                    style={{ fontFamily: 'var(--font-hub-heading)' }}
                  >
                    Trộn Đề Thi Ôn Luyện
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tuyển tập môn {activeCollection.subject} ({activeCollectionExams.length} đề thi)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMixModal(false)}
                className="rounded-xl p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteMix} className="space-y-4">
              {/* PHẦN 1: CHỌN CÁC DẠNG CÂU HỎI ĐƯA VÀO TRỘN */}
              <div className="space-y-2.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  1. Chọn các phần câu hỏi đưa vào trộn đề:
                </label>
                <p className="text-[11px] text-slate-500">
                  Bỏ chọn phần nào thì hệ thống sẽ không chọn câu hỏi thuộc phần đó.
                </p>

                <div className="grid gap-2 sm:grid-cols-3">
                  <label
                    className={`flex flex-col justify-between p-3 rounded-2xl border transition cursor-pointer select-none ${
                      mixIncludeChoice
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-900 dark:text-indigo-200 shadow-xs'
                        : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Trắc nghiệm</span>
                      <input
                        type="checkbox"
                        checked={mixIncludeChoice}
                        onChange={(e) => setMixIncludeChoice(e.target.checked)}
                        className="h-4 w-4 rounded accent-indigo-600"
                      />
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      Có sẵn: {activeCollectionBreakdown.choiceCount} câu
                    </div>
                  </label>

                  <label
                    className={`flex flex-col justify-between p-3 rounded-2xl border transition cursor-pointer select-none ${
                      mixIncludeTF
                        ? 'border-sky-500 bg-sky-500/10 text-sky-900 dark:text-sky-200 shadow-xs'
                        : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Đúng / Sai</span>
                      <input
                        type="checkbox"
                        checked={mixIncludeTF}
                        onChange={(e) => setMixIncludeTF(e.target.checked)}
                        className="h-4 w-4 rounded accent-sky-600"
                      />
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      Có sẵn: {activeCollectionBreakdown.tfCount} câu
                    </div>
                  </label>

                  <label
                    className={`flex flex-col justify-between p-3 rounded-2xl border transition cursor-pointer select-none ${
                      mixIncludeSA
                        ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 shadow-xs'
                        : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Trả lời ngắn</span>
                      <input
                        type="checkbox"
                        checked={mixIncludeSA}
                        onChange={(e) => setMixIncludeSA(e.target.checked)}
                        className="h-4 w-4 rounded accent-amber-600"
                      />
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      Có sẵn: {activeCollectionBreakdown.saCount} câu
                    </div>
                  </label>
                </div>
              </div>

              {/* TÙY CHỌN CHI TIẾT TỪNG ĐỀ (NÚT CHI TIẾT) */}
              <div className="pt-2 border-t border-black/10 dark:border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Tùy chọn chi tiết từng đề:
                    </label>
                    <p className="text-[11px] text-slate-500">
                      {showDetailedMix
                        ? 'Đang bật: Chọn cụ thể đề nào và số câu lấy từ mỗi đề.'
                        : 'Mặc định: Tự động gom & trộn đều từ toàn bộ tuyển tập.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !showDetailedMix
                      setShowDetailedMix(next)
                      if (next) {
                        const hasAny = Object.values(examMixConfigs).some((c) => c.enabled && c.count > 0)
                        if (!hasAny) {
                          const initialConfigs: Record<string, { enabled: boolean; count: number }> = {}
                          activeCollectionExams.forEach((ex) => {
                            const avail = getSingleExamAvailableCount(ex)
                            initialConfigs[ex.id] = { enabled: true, count: avail }
                          })
                          setExamMixConfigs(initialConfigs)
                        }
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition hover:bg-indigo-500/20 cursor-pointer"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>{showDetailedMix ? 'Đóng chi tiết' : 'Chi tiết'}</span>
                    {showDetailedMix ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {showDetailedMix && (
                  <div className="space-y-2.5 p-3 rounded-2xl border border-indigo-500/25 bg-indigo-500/5 dark:bg-indigo-500/10 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span>Chọn đề thi & số câu cần lấy:</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...examMixConfigs }
                            activeCollectionExams.forEach((ex) => {
                              const avail = getSingleExamAvailableCount(ex)
                              next[ex.id] = { enabled: true, count: avail }
                            })
                            setExamMixConfigs(next)
                          }}
                          className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          Chọn tất cả
                        </button>
                        <span className="text-slate-400">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...examMixConfigs }
                            activeCollectionExams.forEach((ex) => {
                              next[ex.id] = { enabled: false, count: 0 }
                            })
                            setExamMixConfigs(next)
                          }}
                          className="text-[11px] text-slate-500 hover:underline cursor-pointer"
                        >
                          Bỏ chọn hết
                        </button>
                      </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                      {activeCollectionExams.map((ex, idx) => {
                        const cfg = examMixConfigs[ex.id] || { enabled: false, count: 0 }
                        const available = getSingleExamAvailableCount(ex)
                        const bd = getExamQuestionsBreakdown([ex])

                        return (
                          <div
                            key={ex.id}
                            className={`p-2.5 rounded-xl border transition ${
                              cfg.enabled
                                ? 'border-indigo-500/40 bg-white dark:bg-slate-800 shadow-2xs'
                                : 'border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5 opacity-60'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <input
                                type="checkbox"
                                checked={cfg.enabled}
                                onChange={(e) => {
                                  const checked = e.target.checked
                                  setExamMixConfigs((prev) => ({
                                    ...prev,
                                    [ex.id]: {
                                      enabled: checked,
                                      count: checked ? (prev[ex.id]?.count > 0 ? prev[ex.id].count : available) : 0,
                                    },
                                  }))
                                }}
                                className="mt-1 h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                    Đề số {idx + 1}
                                  </span>
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                                    {ex.title}
                                  </span>
                                </div>
                                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                  Khả dụng: <span className="font-bold text-slate-700 dark:text-slate-300">{available} câu</span>
                                  {' '}({bd.choiceCount} TN · {bd.tfCount} Đ/S · {bd.saCount} TLN) · {ex.duration || 50} phút
                                </div>
                              </div>

                              {cfg.enabled && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[11px] text-slate-500">Lấy:</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max={available}
                                    value={cfg.count}
                                    onChange={(e) => {
                                      const val = Math.max(0, Math.min(available, parseInt(e.target.value) || 0))
                                      setExamMixConfigs((prev) => ({
                                        ...prev,
                                        [ex.id]: { enabled: true, count: val },
                                      }))
                                    }}
                                    className="w-14 h-8 rounded-lg border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-1.5 text-center text-xs font-mono font-bold outline-none focus:border-indigo-500"
                                  />
                                  <span className="text-[11px] text-slate-500">câu</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="pt-1.5 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-bold border-t border-black/5 dark:border-white/5">
                      <span>Đã chọn: {detailedSelectedExams.length} / {activeCollectionExams.length} đề thi</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-mono">
                        Tổng số câu lấy: {detailedTotalQuestionsCount} câu
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* PHẦN 2: TUỲ CHỌN SỐ CÂU HỎI ĐỂ TRỘN */}
              <div className="space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    2. Số câu hỏi cần trộn:
                  </label>
                  <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">
                    {showDetailedMix ? detailedTotalQuestionsCount : mixQuestionCount} câu (Tối đa: {currentMaxAvailableQuestions} câu)
                  </span>
                </div>

                {showDetailedMix ? (
                  <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
                    Số câu hỏi đang được tính theo tùy chọn chi tiết từng đề ở trên ({detailedTotalQuestionsCount} câu từ {detailedSelectedExams.length} đề thi được chọn).
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1"
                        max={Math.max(1, currentMaxAvailableQuestions)}
                        value={Math.min(mixQuestionCount, Math.max(1, currentMaxAvailableQuestions))}
                        onChange={(e) => setMixQuestionCount(Number(e.target.value))}
                        disabled={currentMaxAvailableQuestions === 0}
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                      <input
                        type="number"
                        min="1"
                        max={Math.max(1, currentMaxAvailableQuestions)}
                        value={mixQuestionCount}
                        onChange={(e) => setMixQuestionCount(Number(e.target.value))}
                        disabled={currentMaxAvailableQuestions === 0}
                        className="w-20 h-9 rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-2 text-center text-xs font-mono font-bold outline-none"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Tối đa là tổng số câu hỏi các đề có ở từng phần cộng dồn lại (đã trừ bớt nếu bỏ chọn phần tương ứng).
                    </p>
                  </>
                )}
              </div>

              {/* PHẦN 3: TUỲ CHỌN THỜI GIAN LÀM BÀI */}
              <div className="space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    3. Thời gian làm bài thi (phút):
                  </label>
                  <span className="text-xs font-mono font-black text-amber-600 dark:text-amber-400">
                    {mixDuration} phút (Tối đa: {effectiveMaxDuration} phút)
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="5"
                    max={effectiveMaxDuration}
                    value={Math.min(mixDuration, effectiveMaxDuration)}
                    onChange={(e) => setMixDuration(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                  <input
                    type="number"
                    min="5"
                    max={effectiveMaxDuration}
                    value={Math.min(mixDuration, effectiveMaxDuration)}
                    onChange={(e) => setMixDuration(Number(e.target.value))}
                    className="w-20 h-9 rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-2 text-center text-xs font-mono font-bold outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Tối đa cho phép: Tổng thời gian các đề {showDetailedMix ? 'được chọn' : ''} cộng lại ({showDetailedMix ? detailedSumDuration : activeCollectionSumDuration} phút) + 30 phút ={' '}
                  {effectiveMaxDuration} phút.
                </p>
              </div>

              {/* PHẦN 4: TIÊU ĐỀ ĐỀ TRỘN */}
              <div className="space-y-1.5 pt-2 border-t border-black/10 dark:border-white/10">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Đặt tên cho đề thi trộn (tùy chọn):
                </label>
                <input
                  type="text"
                  placeholder={`[Trộn đề] Tuyển tập ${activeCollection.subject}`}
                  value={mixTitle}
                  onChange={(e) => setMixTitle(e.target.value)}
                  className="h-10 w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 px-3 text-xs font-medium outline-none focus:border-indigo-500"
                />
              </div>

              {mixError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold">
                  {mixError}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowMixModal(false)}
                  className="rounded-xl border border-black/10 dark:border-white/10 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={
                    mixLoading ||
                    (!showDetailedMix && currentMaxAvailableQuestions === 0) ||
                    (showDetailedMix && detailedTotalQuestionsCount === 0)
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-xs font-black uppercase tracking-wider shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {mixLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Đang trộn đề...
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4" /> Bắt đầu làm bài thi
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODALS CỦA THƯ VIỆN SEN ONLINE */}
      {/* ==================================================== */}

      {/* 1. MODAL XEM TRƯỚC TÀI LIỆU THƯ VIỆN (GOOGLE DRIVE PREVIEW) */}
      {libPreviewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div
            className={`w-full rounded-3xl bg-white dark:bg-slate-900 border border-white/20 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
              libPreviewFullscreen ? 'h-[96vh] max-w-[96vw]' : 'h-[85vh] max-w-4xl'
            }`}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-800/80">
              <div className="flex items-center gap-2.5 min-w-0 pr-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="truncate">
                  <h3 className="font-bold text-sm truncate text-slate-900 dark:text-white">
                    {libPreviewDoc.title}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    Xem trước trực tuyến qua Google Drive
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setLibPreviewFullscreen((v) => !v)}
                  className="p-2 rounded-xl text-slate-500 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                  title={libPreviewFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
                <a
                  href={`https://drive.google.com/uc?export=download&id=${libPreviewDoc.drive_file_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-bold shadow-xs hover:bg-violet-700 transition"
                >
                  <Download className="h-3.5 w-3.5" /> Tải về
                </a>
                <button
                  type="button"
                  onClick={() => setLibPreviewDoc(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                  title="Đóng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Iframe Preview Google Drive */}
            <div className="flex-1 w-full bg-slate-100 dark:bg-slate-950 relative min-h-[500px]">
              <iframe
                src={`https://drive.google.com/file/d/${libPreviewDoc.drive_file_id}/preview#toolbar=0&navpanes=0&scrollbar=0`}
                className="w-full h-full min-h-[500px] border-none"
                allow="autoplay"
                title={libPreviewDoc.title}
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL TẠO THƯ MỤC / MÔN HỌC MỚI */}
      {showLibCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-[28px] border border-white/20 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                <FolderPlus className="h-5 w-5" />
                <h3 className="text-base font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-hub-heading)' }}>
                  {libCreateType === 'folder' ? 'Tạo Khối / Thư Mục Cha' : 'Tạo Môn Học Mới'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLibCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Toggle Loại */}
            <div className="flex rounded-xl bg-black/5 dark:bg-white/5 p-1 border border-black/5 dark:border-white/10">
              <button
                type="button"
                onClick={() => setLibCreateType('subject')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  libCreateType === 'subject'
                    ? 'bg-white dark:bg-slate-800 text-violet-600 dark:text-violet-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Môn học con
              </button>
              <button
                type="button"
                onClick={() => setLibCreateType('folder')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  libCreateType === 'folder'
                    ? 'bg-white dark:bg-slate-800 text-violet-600 dark:text-violet-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Khối / Thư mục cha
              </button>
            </div>

            <form onSubmit={handleCreateLibFolderOrSubject} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Tên {libCreateType === 'folder' ? 'khối / thư mục cha' : 'môn học'}:
                </label>
                <input
                  type="text"
                  placeholder={libCreateType === 'folder' ? 'Ví dụ: Kỳ thi HSA, ĐHQGHN, Khối 12...' : 'Ví dụ: Tư duy Định lượng, Vật lí đại cương 3...'}
                  value={libNewName}
                  onChange={(e) => setLibNewName(e.target.value)}
                  autoFocus
                  required
                  className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold outline-none focus:border-violet-500"
                />
              </div>

              {libCreateType === 'subject' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                    Thuộc Khối / Thư mục cha:
                  </label>
                  <select
                    value={libNewParentId || ''}
                    onChange={(e) => setLibNewParentId(e.target.value || null)}
                    className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold outline-none focus:border-violet-500"
                  >
                    <option value="">(Cấp gốc độc lập - Không nằm trong khối)</option>
                    {libraryFolders
                      .filter((f) => !f.parent_id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          📁 {p.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {libCreateError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 text-xs font-bold flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{libCreateError}</span>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowLibCreateModal(false)}
                  className="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2 text-xs font-bold hover:bg-black/10 transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={libCreateLoading || !libNewName.trim()}
                  className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-xs font-black shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {libCreateLoading ? 'Đang tạo...' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. MODAL TẢI TÀI LIỆU LÊN GOOGLE DRIVE */}
      {showLibUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-[28px] border border-white/20 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
                <UploadCloud className="h-6 w-6" />
                <h3 className="text-base font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-hub-heading)' }}>
                  Tải Lên Tài Liệu & Bài Tập
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLibUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUploadLibDoc} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Môn học / Thư mục lưu trữ:
                </label>
                <select
                  value={libUploadTargetFolderId || libCurrentFolderId || ''}
                  onChange={(e) => setLibUploadTargetFolderId(e.target.value || null)}
                  required
                  className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold outline-none focus:border-violet-500"
                >
                  <option value="" disabled>-- Chọn môn học lưu tài liệu --</option>
                  {libraryFolders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.parent_id ? '  ↳ 📚 ' : '📁 '} {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Phân loại nội dung môn:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLibUploadCategory('slides')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                      libUploadCategory === 'slides'
                        ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                        : 'border-black/10 dark:border-white/10 hover:bg-black/5'
                    }`}
                  >
                    📄 Bài giảng / Lý thuyết
                  </button>
                  <button
                    type="button"
                    onClick={() => setLibUploadCategory('exercises')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                      libUploadCategory === 'exercises'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-black/10 dark:border-white/10 hover:bg-black/5'
                    }`}
                  >
                    📝 Bài tập rèn luyện
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Tiêu đề tài liệu (Tùy chọn, để trống sẽ lấy tên tệp):
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Chuyên đề Hàm số 12 có đáp án..."
                  value={libUploadTitle}
                  onChange={(e) => setLibUploadTitle(e.target.value)}
                  className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Chọn tệp PDF hoặc ảnh:
                </label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setLibUploadFiles(Array.from(e.target.files || []))}
                  required
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-violet-500/10 file:text-violet-600 hover:file:bg-violet-500/20"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="libVipCheckbox"
                  checked={libUploadIsVip}
                  onChange={(e) => setLibUploadIsVip(e.target.checked)}
                  className="h-4 w-4 rounded accent-amber-500"
                />
                <label htmlFor="libVipCheckbox" className="text-xs font-bold flex items-center gap-1 text-amber-600 dark:text-amber-400 cursor-pointer">
                  <Crown className="h-3.5 w-3.5" /> Chỉ dành cho tài khoản VIP
                </label>
              </div>

              {libUploadStatus.type !== 'idle' && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    libUploadStatus.type === 'uploading'
                      ? 'bg-violet-500/10 text-violet-600'
                      : libUploadStatus.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-rose-500/10 text-rose-500'
                  }`}
                >
                  {libUploadStatus.type === 'uploading' && <Loader2 className="h-4 w-4 animate-spin" />}
                  {libUploadStatus.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {libUploadStatus.type === 'error' && <AlertCircle className="h-4 w-4 text-rose-500" />}
                  <span>{libUploadStatus.message}</span>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  disabled={libUploadStatus.type === 'uploading'}
                  onClick={() => setShowLibUploadModal(false)}
                  className="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2 text-xs font-bold disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={libUploadStatus.type === 'uploading' || libUploadFiles.length === 0}
                  className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-xs font-black shadow-md disabled:opacity-50 transition cursor-pointer"
                >
                  {libUploadStatus.type === 'uploading' ? 'Đang tải...' : 'Bắt đầu tải lên'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MODAL ĐÍNH KÈM ĐỀ THI VÀO MÔN HỌC (VÀO NHANH BÀI THI) */}
      {showLibAttachExamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-[28px] border border-white/20 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Zap className="h-5 w-5" />
                <h3 className="text-base font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-hub-heading)' }}>
                  Đính Kèm Đề Thi Vào Môn Học
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLibAttachExamModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Chọn đề thi để tích hợp nút <strong>"Vào nhanh bài thi"</strong> trực tiếp trong sơ đồ cây môn học.
            </p>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm tên đề thi, môn thi..."
                value={libAttachExamSearch}
                onChange={(e) => setLibAttachExamSearch(e.target.value)}
                className="h-9 w-full rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 pl-9 pr-3 text-xs outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[350px]">
              {exams
                .filter((ex) => ex.title.toLowerCase().includes(libAttachExamSearch.toLowerCase().trim()))
                .slice(0, 30)
                .map((ex) => (
                  <div
                    key={ex.id}
                    className="p-3 rounded-2xl border border-black/10 dark:border-white/10 hover:border-indigo-500/50 bg-white dark:bg-slate-800 flex items-center justify-between gap-3 transition"
                  >
                    <div className="min-w-0">
                      <h5 className="font-bold text-xs truncate text-slate-900 dark:text-white">
                        {ex.title}
                      </h5>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span>{ex.subject || 'Đề chung'}</span>
                        <span>•</span>
                        <span>{ex.duration || 50} phút</span>
                        <span>•</span>
                        <span>{ex.total_questions || 40} câu</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAttachExamToSubject(ex)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shrink-0 transition cursor-pointer"
                    >
                      Đính kèm
                    </button>
                  </div>
                ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-black/5 dark:border-white/5">
              <button
                type="button"
                onClick={() => setShowLibAttachExamModal(false)}
                className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-xs font-bold hover:bg-black/10 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL ĐỔI TÊN THƯ MỤC / TÀI LIỆU */}
      {showLibRenameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-[28px] border border-white/20 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-violet-500">
              <Edit className="h-5 w-5" />
              <h3 className="text-base font-black text-slate-900 dark:text-white" style={{ fontFamily: 'var(--font-hub-heading)' }}>
                Đổi Tên {libRenameTarget?.type === 'folder' ? 'Môn Học' : 'Tài Liệu'}
              </h3>
            </div>

            <form onSubmit={handleRenameLibItem} className="space-y-4">
              <input
                type="text"
                value={libRenameValue}
                onChange={(e) => setLibRenameValue(e.target.value)}
                autoFocus
                required
                className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold outline-none focus:border-violet-500"
              />

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowLibRenameModal(false)}
                  className="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2 text-xs font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-xs font-black shadow-md transition cursor-pointer"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="max-w-4xl w-full h-[85vh] rounded-3xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-sm truncate pr-2 text-slate-900 dark:text-white">
                {previewPdfTitle}
              </h3>
              <button
                onClick={() => setPreviewPdfUrl(null)}
                className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 text-xs font-bold hover:bg-black/10 transition"
              >
                Đóng
              </button>
            </div>
            <iframe src={previewPdfUrl} className="flex-1 w-full border-none" />
          </div>
        </div>
      )}
    </main>
  )
}

export default function NewSenGroundPage() {
  return (
    <Suspense
      fallback={
        <ModernLoading
          themeColor="indigo"
          title="Sen Ground: Tạo Đề, Khảo Thí & Lịch Sử"
          subtitle="Đang khởi tạo không gian Sen Ground..."
        />
      }
    >
      <UnifiedHubContent />
    </Suspense>
  )
}
