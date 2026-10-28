/**
 * Deterministic LaTeX Exam Parser for SenExam
 * Hỗ trợ bóc tách đề thi LaTeX chuẩn Việt Nam (ex_test, thpt, hsa, vted, fontmath...)
 * Hoạt động trực tiếp siêu tốc (10-50ms), không tốn token AI và không bị giới hạn độ dài file (hỗ trợ file 100KB - 2MB+).
 */

export interface ParsedKatexQuestion {
  id: string
  number?: number
  rawNumberStr?: string
  sectionName?: string
  type: 'single_choice' | 'true_false' | 'short_answer' | 'essay'
  text: string
  options: string[]
  correctAnswer: any
  explanation: string
  points: number
  hasAnswerInLatex: boolean
}

export interface ParseLatexResult {
  title: string
  subject: string
  exam_type: string
  duration: number
  questions: ParsedKatexQuestion[]
  matchedAnswersCount: number
  missingAnswersCount: number
  parseTimeMs: number
}

/**
 * Trích xuất khối ngoặc nhọn cân bằng {...} hỗ trợ lồng nhau
 */
export function extractBalancedBraces(
  text: string,
  startIndex: number
): { content: string; startIndex: number; endIndex: number } | null {
  let i = startIndex

  // Bỏ qua khoảng trắng và comment % trước dấu {
  while (i < text.length) {
    if (text[i] === '%') {
      while (i < text.length && text[i] !== '\n') i++
    } else if (text[i] === '{') {
      break
    } else if (!/\s/.test(text[i])) {
      return null
    }
    i++
  }

  if (i >= text.length || text[i] !== '{') return null

  const openBrace = i
  let depth = 0
  let inEscape = false

  for (let j = openBrace; j < text.length; j++) {
    const char = text[j]
    if (inEscape) {
      inEscape = false
      continue
    }
    if (char === '\\') {
      inEscape = true
      continue
    }
    if (char === '{') {
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0) {
        return {
          content: text.slice(openBrace + 1, j),
          startIndex: openBrace,
          endIndex: j + 1,
        }
      }
    }
  }

  return null
}

/**
 * Trích xuất khối ngoặc vuông cân bằng [...]
 */
export function extractBalancedBrackets(
  text: string,
  startIndex: number
): { content: string; startIndex: number; endIndex: number } | null {
  let i = startIndex
  while (i < text.length && /\s/.test(text[i])) i++
  if (i >= text.length || text[i] !== '[') return null

  const openBracket = i
  let depth = 0
  let inEscape = false

  for (let j = openBracket; j < text.length; j++) {
    const char = text[j]
    if (inEscape) {
      inEscape = false
      continue
    }
    if (char === '\\') {
      inEscape = true
      continue
    }
    if (char === '[') {
      depth++
    } else if (char === ']') {
      depth--
      if (depth === 0) {
        return {
          content: text.slice(openBracket + 1, j),
          startIndex: openBracket,
          endIndex: j + 1,
        }
      }
    }
  }

  return null
}

/**
 * Chuẩn hóa một phương án KaTeX: dọn macro \True, \dotEX và định dạng sạch
 */
export function cleanOptionText(raw: string): { text: string; isTrue: boolean } {
  let isTrue = false
  // Kiểm tra có chứa macro \True hoặc \dotEX hoặc \true hoặc gạch chân
  if (/\\(?:True|true|dotEX)\b/i.test(raw)) {
    isTrue = true
  }

  // Dọn dẹp macro đánh dấu đáp án đúng
  let cleaned = raw
    .replace(/\\(?:True|true|dotEX)\b/gi, '')
    .trim()

  // Bỏ tiền tố A., B., C., D. hoặc a), b), c), d) nếu đã bị lặp ở đầu
  cleaned = cleaned.replace(/^[A-Da-d][.)]\s*/, '').trim()

  return { text: cleaned, isTrue }
}

/**
 * Chuẩn hóa và tiền xử lý nội dung LaTeX trước khi render sang ReactMarkdown / KaTeX.
 * Hỗ trợ chuyển đổi các lệnh hình ảnh LaTeX sang Markdown Image:
 * - \includegraphics[options]{url}
 * - \includegraphics{url}
 * - \img{url}, \image{url}, \fig{url}
 * - Xóa các lệnh rác: \sourcepage{...}, \noindent, \centerline...
 * - Xử lý khối TikZ thành khung đồ thị trực quan
 */
export function preprocessLatexContent(raw: string): string {
  if (!raw || typeof raw !== 'string') return ''

  let text = raw
    // 1. Dọn dẹp lệnh \sourcepage{...} hoặc \sourcepage
    .replace(/\\sourcepage(?:\{[^}]*\})?/gi, '')
    .replace(/\\source(?:\{[^}]*\})?/gi, '')

    // 2. Chuyển đổi các macro chèn ảnh LaTeX sang cú pháp Markdown Image
    // Ví dụ: \includegraphics[width=0.8\linewidth]{https://...} hoặc \includegraphics{data:...}
    .replace(/\\includegraphics(?:\s*\[[^\]]*\])?\s*\{([^}]+)\}/gi, '\n\n![]($1)\n\n')
    // Ví dụ: \img{...}, \image{...}, \fig{...}
    .replace(/\\(?:img|image|fig)\s*\{([^}]+)\}/gi, '\n\n![]($1)\n\n')
    // \caption{...} và \label{...}
    .replace(/\\caption\s*\{([^}]+)\}/gi, '\n\n*($1)*\n\n')
    .replace(/\\label\s*\{[^}]*\}/gi, '')
    // \centerline{\includegraphics...}
    .replace(/\\centerline\s*\{\s*!\[([^\]]*)\]\(([^)]+)\)\s*\}/gi, '\n\n![$1]($2)\n\n')

    // 3. Xóa môi trường \begin{center} / \end{center} bọc quanh ảnh nếu có
    .replace(/\\begin\{center\}\s*(!\[[^\]]*\]\([^)]+\))\s*\\end\{center\}/gi, '$1')

    // 4. Khối TikZ biểu đồ / đồ thị: không để lộ raw coordinates
    .replace(/\\begin\{center\}\s*\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}\s*\\end\{center\}/gi, () => {
      return '\n\n> 📊 *[Hình vẽ / Đồ thị minh họa đề thi]*\n\n'
    })
    .replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/gi, () => {
      return '\n\n> 📊 *[Hình vẽ / Đồ thị minh họa đề thi]*\n\n'
    })

    // 5. Dọn dẹp các lệnh định dạng thừa
    .replace(/\\(?:noindent|centering|hfill|smallskip|medskip|bigskip|par|vfill)\b/g, '')
    .replace(/\\(?:vspace|hspace)\*?\{[^}]*\}/g, '')
    .replace(/\\(?:newpage|clearpage)\b/g, '')

    // 6. Dấu ngoặc kép tiếng Việt trong LaTeX
    .replace(/``/g, '"')
    .replace(/''/g, '"')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')

  return text.trim()
}

/**
 * Dọn dẹp các lệnh định dạng thừa trong văn bản câu hỏi LaTeX
 */
export function cleanLatexQuestionText(raw: string): string {
  let text = raw
    // Xóa comment % đến hết dòng
    .replace(/(^|[^\\])%.*$/gm, '$1')

  return preprocessLatexContent(text)
}

/**
 * Phân tích bảng đáp án riêng (dạng text hoặc chuỗi dòng)
 * Hỗ trợ các định dạng:
 * 1. Chương 0: 101: Đ-S-Đ-Đ | 102: Đ-Đ-S-Đ | 103: S-Đ-Đ-S ...
 * 2. 1A 2B 3C 4D 5A 6B ...
 * 3. 1. A, 2. B, 3. C ...
 * 4. Câu 1: A | Câu 2: B ...
 * 5. 101: 2.5 | 102: 1000 ... (Short answer)
 */
export function parseAnswerKeyText(rawAnswerText: string): {
  byNumber: Map<string, any>
  inOrder: any[]
} {
  const byNumber = new Map<string, any>()
  const inOrder: any[] = []
  if (!rawAnswerText || !rawAnswerText.trim()) return { byNumber, inOrder }

  const text = rawAnswerText.replace(/\r\n/g, '\n')

  // Định dạng 1: Trắc nghiệm Đúng - Sai 4 ý (101: Đ-S-Đ-Đ hoặc 1: D-S-D-D hoặc 101: T-F-T-T)
  const tfRegex = /(?:Câu\s*)?(\d+)\s*[:.-]\s*([ĐDSđdsTFtf])\s*[-–/]\s*([ĐDSđdsTFtf])\s*[-–/]\s*([ĐDSđdsTFtf])\s*[-–/]\s*([ĐDSđdsTFtf])/g
  let match: RegExpExecArray | null
  while ((match = tfRegex.exec(text)) !== null) {
    const qNum = match[1]
    const toDS = (c: string) => {
      const upper = c.toUpperCase()
      return upper === 'Đ' || upper === 'D' || upper === 'T' ? 'Đ' : 'S'
    }
    const val = {
      a: toDS(match[2]),
      b: toDS(match[3]),
      c: toDS(match[4]),
      d: toDS(match[5]),
    }
    byNumber.set(qNum, val)
    inOrder.push(val)
  }

  // Định dạng 2: Trắc nghiệm 4 lựa chọn có định dạng "101: A" hoặc "1. A" hoặc "Câu 1: B"
  const singleChoiceExplicitRegex = /(?:Câu\s*)?(\d+)\s*[:.-]\s*([A-Da-d])(?![a-zA-Z0-9])/g
  while ((match = singleChoiceExplicitRegex.exec(text)) !== null) {
    const qNum = match[1]
    if (!byNumber.has(qNum)) {
      const val = match[2].toUpperCase()
      byNumber.set(qNum, val)
      inOrder.push(val)
    }
  }

  // Định dạng 3: Điền số / Trả lời ngắn "101: 2.5" hoặc "101: -4" hoặc "101: 1000"
  const shortAnsRegex = /(?:Câu\s*)?(\d+)\s*[:.-]\s*(-?\d+(?:[.,]\d+)?)(?=\s*(?:\||\n|$))/g
  while ((match = shortAnsRegex.exec(text)) !== null) {
    const qNum = match[1]
    if (!byNumber.has(qNum)) {
      const val = match[2].replace(',', '.')
      byNumber.set(qNum, val)
      inOrder.push(val)
    }
  }

  // Định dạng 4: Chuỗi nén kiểu "1A 2B 3C 4D 5A 6B..." hoặc "1.A 2.B 3.C..."
  const compactSingleRegex = /\b(\d+)\s*[.]?\s*([A-Da-d])\b/g
  while ((match = compactSingleRegex.exec(text)) !== null) {
    const qNum = match[1]
    if (!byNumber.has(qNum)) {
      const val = match[2].toUpperCase()
      byNumber.set(qNum, val)
      inOrder.push(val)
    }
  }

  return { byNumber, inOrder }
}

/**
 * Parser chính: Bóc tách mã LaTeX đề thi thành danh sách câu hỏi KaTeX hoàn chỉnh
 */
export function parseLatexExamCode(
  latexCode: string,
  answerKeyText?: string
): ParseLatexResult {
  const startTime = Date.now()

  const result: ParseLatexResult = {
    title: 'Đề Thi KaTeX Biên Soạn Tự Động',
    subject: 'Toán học',
    exam_type: 'THPTQG',
    duration: 50,
    questions: [],
    matchedAnswersCount: 0,
    missingAnswersCount: 0,
    parseTimeMs: 0,
  }

  if (!latexCode || !latexCode.trim()) {
    result.parseTimeMs = Date.now() - startTime
    return result
  }

  // 1. Phân tích tiêu đề, môn học, thời gian từ metadata
  const titleMatch =
    latexCode.match(/\\title\{([^}]+)\}/) ||
    latexCode.match(/(?:ĐỀ\s*THI|KHẢO\s*SÁT|KIỂM\s*TRA)[^\n]+/i)
  if (titleMatch) {
    result.title = (titleMatch[1] ? titleMatch[1] : titleMatch[0])
      .replace(/\\textbf\{([^}]+)\}/g, '$1')
      .replace(/\\/g, '')
      .trim()
  }

  if (/Vật\s*l[ií]/i.test(latexCode)) result.subject = 'Vật lí'
  else if (/Hóa\s*học/i.test(latexCode)) result.subject = 'Hóa học'
  else if (/Sinh\s*học/i.test(latexCode)) result.subject = 'Sinh học'
  else if (/Tin\s*học/i.test(latexCode)) result.subject = 'Tin học'
  else if (/Tiếng\s*Anh/i.test(latexCode)) result.subject = 'Tiếng Anh'
  else if (/Lịch\s*sử/i.test(latexCode)) result.subject = 'Lịch sử'
  else if (/Địa\s*l[ií]/i.test(latexCode)) result.subject = 'Địa lí'
  else if (/Toán/i.test(latexCode)) result.subject = 'Toán học'

  const durationMatch = latexCode.match(/(\d+)\s*phút/i)
  if (durationMatch) {
    result.duration = parseInt(durationMatch[1], 10) || 50
  }

  // 2. Phân tích bảng đáp án ngoài nếu có
  const externalAnswers = answerKeyText
    ? parseAnswerKeyText(answerKeyText)
    : { byNumber: new Map<string, any>(), inOrder: [] }

  // 3. Nhận diện các phần (Section - Phần I, Phần II, Phần III)
  const sectionPositions: { index: number; name: string; defaultType: 'single_choice' | 'true_false' | 'short_answer' }[] = []
  const sectionRegex = /(?:PHẦN|Phần)\s*(I{1,3}|[123]|Một|Hai|Ba)\b[^\n]*/gi
  let secMatch: RegExpExecArray | null
  while ((secMatch = sectionRegex.exec(latexCode)) !== null) {
    const secStr = secMatch[0].toLowerCase()
    let defType: 'single_choice' | 'true_false' | 'short_answer' = 'single_choice'
    if (secStr.includes('đúng sai') || secStr.includes('ii') || secStr.includes('2')) {
      defType = 'true_false'
    } else if (secStr.includes('ngắn') || secStr.includes('điền') || secStr.includes('iii') || secStr.includes('3')) {
      defType = 'short_answer'
    }
    sectionPositions.push({
      index: secMatch.index,
      name: secMatch[0].trim(),
      defaultType: defType,
    })
  }

  const getSectionForIndex = (charIndex: number) => {
    let currentSec = sectionPositions[0] || null
    for (const sec of sectionPositions) {
      if (charIndex >= sec.index) {
        currentSec = sec
      } else {
        break
      }
    }
    return currentSec
  }

  // 4. Tách các khối câu hỏi
  interface RawQuestionBlock {
    rawText: string
    questionNumber?: number
    rawNumberStr?: string
    startIndex: number
    sectionName?: string
    sectionDefaultType?: 'single_choice' | 'true_false' | 'short_answer'
  }

  const rawBlocks: RawQuestionBlock[] = []

  // Chiến lược A: Tìm theo môi trường \begin{ex}...\end{ex}, \begin{bt}...\end{bt}...
  const envRegex = /\\begin\{(ex|bt|question|cauhoi|cautn|exercise)\}(?:\[([^\]]*)\])?([\s\S]*?)\\end\{\1\}/gi
  let envMatch: RegExpExecArray | null

  while ((envMatch = envRegex.exec(latexCode)) !== null) {
    const optionalTag = envMatch[2] || ''
    const content = envMatch[3] || ''
    const sec = getSectionForIndex(envMatch.index)

    // Tìm số câu hỏi từ thẻ tuỳ chọn [101] hoặc [Câu 101] hoặc [1D1-1]
    let qNum: number | undefined
    let rawNumStr: string | undefined

    const numInTag = optionalTag.match(/(?:Câu\s*)?(\d+)/i)
    if (numInTag) {
      qNum = parseInt(numInTag[1], 10)
      rawNumStr = numInTag[1]
    } else {
      const numInContent = content.match(/(?:^|\s)(?:\\textbf\{)?(?:Câu|Bài)\s*(\d+)[:.]?/i)
      if (numInContent) {
        qNum = parseInt(numInContent[1], 10)
        rawNumStr = numInContent[1]
      }
    }

    rawBlocks.push({
      rawText: content,
      questionNumber: qNum,
      rawNumberStr: rawNumStr,
      startIndex: envMatch.index,
      sectionName: sec?.name,
      sectionDefaultType: sec?.defaultType,
    })
  }

  // Chiến lược B: Nếu không có môi trường \begin{ex}, tách theo "Câu 1:", "Câu 2:" hoặc "Bài 1:"
  if (rawBlocks.length === 0) {
    const cauRegex = /(?:^|\n)\s*(?:\\textbf\{)?(?:Câu|Bài)\s*(\d+)[\s.:)]+/gi
    const splitIndices: { index: number; num: number; numStr: string }[] = []
    let cMatch: RegExpExecArray | null

    while ((cMatch = cauRegex.exec(latexCode)) !== null) {
      splitIndices.push({
        index: cMatch.index,
        num: parseInt(cMatch[1], 10),
        numStr: cMatch[1],
      })
    }

    for (let k = 0; k < splitIndices.length; k++) {
      const cur = splitIndices[k]
      const nextIndex = k + 1 < splitIndices.length ? splitIndices[k + 1].index : latexCode.length
      const blockText = latexCode.slice(cur.index, nextIndex)
      const sec = getSectionForIndex(cur.index)

      rawBlocks.push({
        rawText: blockText,
        questionNumber: cur.num,
        rawNumberStr: cur.numStr,
        startIndex: cur.index,
        sectionName: sec?.name,
        sectionDefaultType: sec?.defaultType,
      })
    }
  }

  // 5. Bóc tách từng câu hỏi chi tiết
  rawBlocks.forEach((block, idx) => {
    let blockContent = block.rawText
    const questionIndex = idx + 1
    const qNum = block.questionNumber || questionIndex
    const qNumStr = block.rawNumberStr || String(qNum)

    let explanation = ''
    let hasAnswerInLatex = false
    let qType: 'single_choice' | 'true_false' | 'short_answer' | 'essay' =
      block.sectionDefaultType || 'single_choice'
    let options: string[] = []
    let correctAnswer: any = null

    // A. Bóc tách lời giải \loigiai{...} hoặc \begin{loigiai}...\end{loigiai}
    const loigiaiEnvMatch = blockContent.match(
      /\\begin\{(?:loigiai|solution)\}([\s\S]*?)\\end\{(?:loigiai|solution)\}/i
    )
    if (loigiaiEnvMatch) {
      explanation = cleanLatexQuestionText(loigiaiEnvMatch[1])
      blockContent = blockContent.replace(loigiaiEnvMatch[0], '')
    } else {
      const loigiaiIdx = blockContent.search(/\\loigiai\s*\{/i)
      if (loigiaiIdx !== -1) {
        const braceResult = extractBalancedBraces(blockContent, loigiaiIdx + 8)
        if (braceResult) {
          explanation = cleanLatexQuestionText(braceResult.content)
          blockContent =
            blockContent.slice(0, loigiaiIdx) + blockContent.slice(braceResult.endIndex)
        }
      }
    }

    // B. Kiểm tra lệnh trả lời ngắn \shortans{...}
    const shortansIdx = blockContent.search(/\\shortans\b/i)
    if (shortansIdx !== -1) {
      qType = 'short_answer'
      let braceSearchStart = shortansIdx + 9
      const optBracket = extractBalancedBrackets(blockContent, braceSearchStart)
      if (optBracket) {
        braceSearchStart = optBracket.endIndex
      }
      const braceResult = extractBalancedBraces(blockContent, braceSearchStart)
      if (braceResult) {
        correctAnswer = braceResult.content.replace(/\$/g, '').trim()
        hasAnswerInLatex = true
        blockContent =
          blockContent.slice(0, shortansIdx) + blockContent.slice(braceResult.endIndex)
      }
    }

    // C. Kiểm tra Đúng - Sai \choiceTF{...}{...}{...}{...}
    const choiceTFIdx = blockContent.search(/\\choiceTF\b/i)
    if (choiceTFIdx !== -1 && qType !== 'short_answer') {
      qType = 'true_false'
      let searchStart = choiceTFIdx + 9
      const optBracket = extractBalancedBrackets(blockContent, searchStart)
      if (optBracket) {
        searchStart = optBracket.endIndex
      }

      const tfItems: string[] = []
      const tfAnswers: Record<string, 'Đ' | 'S'> = { a: 'S', b: 'S', c: 'S', d: 'S' }
      const keys: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd']
      let lastEnd = searchStart
      let foundTrueMacro = false

      for (let c = 0; c < 4; c++) {
        const brace = extractBalancedBraces(blockContent, lastEnd)
        if (brace) {
          const { text: cleanOpt, isTrue } = cleanOptionText(brace.content)
          tfItems.push(cleanOpt)
          if (isTrue) {
            tfAnswers[keys[c]] = 'Đ'
            foundTrueMacro = true
          }
          lastEnd = brace.endIndex
        } else {
          break
        }
      }

      if (tfItems.length > 0) {
        options = tfItems
        if (foundTrueMacro) {
          correctAnswer = tfAnswers
          hasAnswerInLatex = true
        }
        blockContent = blockContent.slice(0, choiceTFIdx) + blockContent.slice(lastEnd)
      }
    }

    // D. Kiểm tra Trắc nghiệm 4 lựa chọn \choice{...}{...}{...}{...}
    const choiceIdx = blockContent.search(/\\choice\b/i)
    if (choiceIdx !== -1 && qType !== 'true_false' && qType !== 'short_answer') {
      qType = 'single_choice'
      let searchStart = choiceIdx + 7
      const optBracket = extractBalancedBrackets(blockContent, searchStart)
      if (optBracket) {
        searchStart = optBracket.endIndex
      }

      const choiceItems: string[] = []
      const choiceLetters = ['A', 'B', 'C', 'D']
      let chosenLetter = 'A'
      let foundTrueChoice = false
      let lastEnd = searchStart

      for (let c = 0; c < 4; c++) {
        const brace = extractBalancedBraces(blockContent, lastEnd)
        if (brace) {
          const { text: cleanOpt, isTrue } = cleanOptionText(brace.content)
          choiceItems.push(cleanOpt)
          if (isTrue) {
            chosenLetter = choiceLetters[c]
            foundTrueChoice = true
          }
          lastEnd = brace.endIndex
        } else {
          break
        }
      }

      if (choiceItems.length > 0) {
        options = choiceItems
        if (foundTrueChoice) {
          correctAnswer = chosenLetter
          hasAnswerInLatex = true
        }
        blockContent = blockContent.slice(0, choiceIdx) + blockContent.slice(lastEnd)
      }
    }

    // E. Fallback: Nếu chưa có options qua macro, tìm tasks hoặc văn bản thuần A. B. C. D. hoặc a) b) c) d)
    if (options.length === 0) {
      // 1. tasks environment
      const tasksMatch = blockContent.match(
        /\\begin\{tasks\}(?:\([^)]*\))?([\s\S]*?)\\end\{tasks\}/i
      )
      if (tasksMatch) {
        const taskItems = tasksMatch[1].split(/\\task\b/).filter((t) => t.trim().length > 0)
        if (taskItems.length >= 2) {
          options = taskItems.map((item, cIdx) => {
            const { text: cleanOpt, isTrue } = cleanOptionText(item)
            if (isTrue) {
              correctAnswer = ['A', 'B', 'C', 'D'][cIdx] || 'A'
              hasAnswerInLatex = true
            }
            return cleanOpt
          })
          blockContent = blockContent.replace(tasksMatch[0], '')
        }
      }

      // 2. Định dạng a) b) c) d) trong đề Đúng Sai
      if (
        options.length === 0 &&
        (qType === 'true_false' ||
          /(?:^|\n|\r|\s+)(?:\\item\s*)?(?:[a-d]\)|\([a-d]\)|[a-d]\.|\b[a-d]\/)\s*/i.test(blockContent))
      ) {
        // Thử tách ngắt dòng trước
        let tfParts = blockContent.split(
          /(?:^|\n|\r)\s*(?:\\item\s*)?(?:[a-d]\)|\([a-d]\)|[a-d]\.|\b[a-d]\/)\s*/i
        )
        // Nếu không đủ 5 phần, thử tách theo khoảng cách rộng hoặc dấu chấm kết thúc câu
        if (tfParts.length < 5) {
          tfParts = blockContent.split(
            /(?:^|\n|\r|\s{2,}|\$\s*|\.\s+)(?:\\item\s*)?(?:[a-d]\)|\([a-d]\)|[a-d]\.|\b[a-d]\/)\s*/i
          )
        }
        // Thử tách khoảng trắng bất kỳ
        if (tfParts.length < 5) {
          tfParts = blockContent.split(
            /(?:^|\n|\r|\s+)(?:\\item\s*)?(?:[a-d]\)|\([a-d]\)|[a-d]\.|\b[a-d]\/)\s*/i
          )
        }

        if (tfParts.length >= 5) {
          // Phần 0 là câu hỏi, 1-4 là 4 ý a, b, c, d
          blockContent = tfParts[0]
          options = tfParts.slice(1, 5).map((p) => cleanLatexQuestionText(p))
          qType = 'true_false'
        }
      }

      // 2b. Định dạng \begin{enumerate} hoặc \begin{itemize} trong đề Đúng Sai
      if (options.length === 0 && qType === 'true_false') {
        const enumMatch = blockContent.match(
          /\\begin\{(?:enumerate|itemize)\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{(?:enumerate|itemize)\}/i
        )
        if (enumMatch) {
          const items = enumMatch[1].split(/\\item\b/).filter((t) => t.trim().length > 0)
          if (items.length >= 4) {
            options = items.slice(0, 4).map((p) => cleanLatexQuestionText(p))
            blockContent = blockContent.replace(enumMatch[0], '')
          }
        }
      }

      // 3. Định dạng A. B. C. D. thuần
      if (options.length === 0 && qType === 'single_choice') {
        const scParts = blockContent.split(/(?:^|\n)\s*(?:\\item\s*)?(?:[A-D]\.|\([A-D]\))\s*/)
        if (scParts.length >= 5) {
          blockContent = scParts[0]
          options = scParts.slice(1, 5).map((p, cIdx) => {
            const { text: cleanOpt, isTrue } = cleanOptionText(p)
            if (isTrue) {
              correctAnswer = ['A', 'B', 'C', 'D'][cIdx]
              hasAnswerInLatex = true
            }
            return cleanOpt
          })
        }
      }
    }

    // F. Đối chiếu với Bảng đáp án riêng bên ngoài (Ưu tiên hàng đầu)
    const extAns =
      externalAnswers.byNumber.get(qNumStr) ||
      externalAnswers.byNumber.get(String(questionIndex)) ||
      (externalAnswers.inOrder.length === rawBlocks.length ? externalAnswers.inOrder[idx] : undefined)

    if (extAns !== undefined) {
      correctAnswer = extAns
      hasAnswerInLatex = true
      result.matchedAnswersCount++
      if (typeof extAns === 'object' && extAns !== null && ('a' in extAns || 'b' in extAns)) {
        qType = 'true_false'
      } else if (typeof extAns === 'string' && /^[ABCD]$/i.test(extAns)) {
        qType = 'single_choice'
      } else if (typeof extAns === 'string' && /^-?\d+(?:\.\d+)?$/.test(extAns)) {
        qType = 'short_answer'
      }
    } else if (hasAnswerInLatex) {
      result.matchedAnswersCount++
    } else {
      result.missingAnswersCount++
    }

    // G. Mặc định giá trị an toàn nếu chưa có đáp án
    if (correctAnswer === null) {
      if (qType === 'single_choice') correctAnswer = 'A'
      else if (qType === 'true_false') correctAnswer = { a: 'Đ', b: 'S', c: 'Đ', d: 'S' }
      else if (qType === 'short_answer') correctAnswer = '0'
      else correctAnswer = 'Xem lời giải chi tiết'
    }

    // H. Làm sạch nội dung câu hỏi
    let questionText = cleanLatexQuestionText(blockContent)
    questionText = questionText
      .replace(/^(?:\\textbf\{)?(?:Câu|Bài)\s*\d+[\s.:)]*/i, '')
      .replace(/^\[[^\]]*\]/, '')
      .trim()
    if (!questionText) {
      questionText = `Câu hỏi ${questionIndex}`
    }

    if (qType === 'single_choice' && options.length === 0) {
      options = ['Phương án A', 'Phương án B', 'Phương án C', 'Phương án D']
    } else if (qType === 'true_false' && options.length === 0) {
      options = ['Ý a)', 'Ý b)', 'Ý c)', 'Ý d)']
    }

    result.questions.push({
      id: `q-latex-${Date.now()}-${questionIndex}`,
      number: qNum,
      rawNumberStr: qNumStr,
      sectionName: block.sectionName,
      type: qType,
      text: questionText,
      options,
      correctAnswer,
      explanation: explanation || 'Chưa có lời giải chi tiết.',
      points: 1,
      hasAnswerInLatex,
    })
  })

  result.parseTimeMs = Date.now() - startTime
  return result
}

/**
 * Kiểm tra xem danh sách phương án có phải là văn bản giữ chỗ mặc định không
 * Ví dụ: ['Phương án A', 'Phương án B', ...] hoặc ['Ý a)', 'Ý b)', ...] hoặc ['A', 'B', 'C', 'D']
 */
export function isPlaceholderOptions(opts: any): boolean {
  if (!Array.isArray(opts) || opts.length === 0) return true
  const placeholderRegex = /^(?:phương\s*án|phuong\s*an|đáp\s*án|dap\s*an|lựa\s*chọn|lua\s*chon|ý|cau|câu)?\s*[A-Da-d1-4][.)]?$/i
  return opts.every((opt) => {
    if (typeof opt !== 'string') return false
    const s = opt.trim()
    if (!s) return true
    return placeholderRegex.test(s)
  })
}

/**
 * Chuẩn hóa một câu hỏi LaTeX (dùng cho phòng thi, xem lại lịch sử, trộn đề...):
 * Tự động bóc tách các macro \choice, \choiceTF, \shortans còn lẫn trong thân đề bài,
 * làm sạch question text và trích xuất danh sách options thực tế cùng đáp án đúng \True.
 */
export function normalizeLatexQuestion(rawQ: any): any {
  if (!rawQ || typeof rawQ !== 'object') return rawQ

  const q = { ...rawQ }
  let text = q.text || q.content || q.prompt || q.question || ''
  if (!text || typeof text !== 'string') return q

  let type = q.type || 'single_choice'
  let options = Array.isArray(q.options) ? [...q.options] : []
  let correctAnswer = q.correctAnswer
  let explanation = q.explanation || q.solution || ''
  const isPlaceholder = isPlaceholderOptions(options)

  // 1. Dọn dẹp môi trường lời giải nếu còn trong đề
  const loigiaiEnvMatch = text.match(/\\begin\{loigiai\}([\s\S]*?)\\end\{loigiai\}/i)
  if (loigiaiEnvMatch) {
    if (!explanation) explanation = loigiaiEnvMatch[1].trim()
    text = text.replace(loigiaiEnvMatch[0], '')
  } else {
    const loigiaiIdx = text.search(/\\loigiai\b/i)
    if (loigiaiIdx !== -1) {
      const brace = extractBalancedBraces(text, loigiaiIdx + 8)
      if (brace) {
        if (!explanation) explanation = brace.content.trim()
        text = text.slice(0, loigiaiIdx) + text.slice(brace.endIndex)
      }
    }
  }

  // 2. Kiểm tra \shortans{...}
  const shortansIdx = text.search(/\\shortans\b/i)
  if (shortansIdx !== -1) {
    let braceStart = shortansIdx + 9
    const optBracket = extractBalancedBrackets(text, braceStart)
    if (optBracket) braceStart = optBracket.endIndex
    const brace = extractBalancedBraces(text, braceStart)
    if (brace) {
      if (
        correctAnswer === undefined ||
        correctAnswer === null ||
        correctAnswer === '' ||
        correctAnswer === 'A' ||
        correctAnswer === '0'
      ) {
        correctAnswer = brace.content.replace(/\$/g, '').trim()
      }
      text = text.slice(0, shortansIdx) + text.slice(brace.endIndex)
      type = 'short_answer'
    }
  }

  // 3. Kiểm tra \choiceTF
  const choiceTFIdx = text.search(/\\choiceTF\b/i)
  if (choiceTFIdx !== -1) {
    let searchStart = choiceTFIdx + 9
    const optBracket = extractBalancedBrackets(text, searchStart)
    if (optBracket) searchStart = optBracket.endIndex

    const tfItems: string[] = []
    const tfAnswers: Record<string, 'Đ' | 'S'> = { a: 'S', b: 'S', c: 'S', d: 'S' }
    const keys: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd']
    let lastEnd = searchStart
    let foundTrue = false

    for (let c = 0; c < 4; c++) {
      const brace = extractBalancedBraces(text, lastEnd)
      if (brace) {
        const { text: cleanOpt, isTrue } = cleanOptionText(brace.content)
        tfItems.push(cleanOpt)
        if (isTrue) {
          tfAnswers[keys[c]] = 'Đ'
          foundTrue = true
        }
        lastEnd = brace.endIndex
      } else {
        break
      }
    }

    if (tfItems.length > 0) {
      if (isPlaceholder || options.length === 0) {
        options = tfItems
      }
      if (foundTrue && (!correctAnswer || typeof correctAnswer !== 'object')) {
        correctAnswer = tfAnswers
      }
      text = text.slice(0, choiceTFIdx) + text.slice(lastEnd)
      type = 'true_false'
    }
  }

  // 4. Kiểm tra \choice
  const choiceIdx = text.search(/\\choice\b/i)
  if (choiceIdx !== -1 && type !== 'true_false' && type !== 'short_answer') {
    let searchStart = choiceIdx + 7
    const optBracket = extractBalancedBrackets(text, searchStart)
    if (optBracket) searchStart = optBracket.endIndex

    const choiceItems: string[] = []
    const choiceLetters = ['A', 'B', 'C', 'D']
    let chosenLetter: string | null = null
    let lastEnd = searchStart

    for (let c = 0; c < 4; c++) {
      const brace = extractBalancedBraces(text, lastEnd)
      if (brace) {
        const { text: cleanOpt, isTrue } = cleanOptionText(brace.content)
        choiceItems.push(cleanOpt)
        if (isTrue && !chosenLetter) {
          chosenLetter = choiceLetters[c]
        }
        lastEnd = brace.endIndex
      } else {
        break
      }
    }

    if (choiceItems.length > 0) {
      if (isPlaceholder || options.length === 0) {
        options = choiceItems
      }
      if (
        chosenLetter &&
        (correctAnswer === undefined ||
          correctAnswer === null ||
          correctAnswer === '' ||
          isPlaceholder)
      ) {
        correctAnswer = chosenLetter
      }
      text = text.slice(0, choiceIdx) + text.slice(lastEnd)
      type = 'single_choice'
    }
  }

  // 5. Kiểm tra tasks environment
  if ((isPlaceholder || options.length === 0) && type === 'single_choice') {
    const tasksMatch = text.match(/\\begin\{tasks\}(?:\([^)]*\))?([\s\S]*?)\\end\{tasks\}/i)
    if (tasksMatch) {
      const taskItems = tasksMatch[1].split(/\\task\b/).filter((t) => t.trim().length > 0)
      if (taskItems.length >= 2) {
        let chosenLetter: string | null = null
        options = taskItems.map((item, cIdx) => {
          const { text: cleanOpt, isTrue } = cleanOptionText(item)
          if (isTrue && !chosenLetter) {
            chosenLetter = ['A', 'B', 'C', 'D'][cIdx] || 'A'
          }
          return cleanOpt
        })
        if (chosenLetter && (!correctAnswer || isPlaceholder)) {
          correctAnswer = chosenLetter
        }
        text = text.replace(tasksMatch[0], '')
      }
    }
  }

  // 6. Kiểm tra dạng a) b) c) d) nếu là đề đúng sai mà options rỗng
  if ((isPlaceholder || options.length === 0) && type === 'true_false') {
    const tfParts = text.split(
      /(?:^|\n|\r)\s*(?:\\item\s*)?(?:[a-d]\)|\([a-d]\)|[a-d]\.|\b[a-d]\/)\s*/i
    )
    if (tfParts.length >= 5) {
      text = tfParts[0]
      options = tfParts.slice(1, 5).map((p) => cleanLatexQuestionText(p))
    }
  }

  // 7. Làm sạch văn bản câu hỏi
  let cleanedText = cleanLatexQuestionText(text)
  cleanedText = cleanedText
    .replace(/^(?:\\textbf\{)?(?:Câu|Bài)\s*\d+[\s.:)]*/i, '')
    .replace(/^\[[^\]]*\]/, '')
    .trim()

  q.text = cleanedText || text
  q.type = type
  q.options = options
  q.correctAnswer = correctAnswer
  if (explanation) q.explanation = explanation

  return q
}
