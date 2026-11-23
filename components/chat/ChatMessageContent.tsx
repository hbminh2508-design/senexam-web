'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import TikzRenderer from '@/app/components/TikzRenderer'
import { parseMessageLinks } from '@/lib/chatSanitizer'
import { hasMathOrTikz } from '@/lib/senChatAi'
import { isCompressedChatMessage, decompressChatMessageSync } from '@/lib/senChatCompression'

interface ChatMessageContentProps {
  content: string
  isSenAi?: boolean
  isMe?: boolean
}

export default function ChatMessageContent({
  content,
  isSenAi = false,
  isMe = false,
}: ChatMessageContentProps) {
  if (!content) return null

  // Tự động giải nén minh bạch nếu tin nhắn đang ở định dạng nén SEN_Z:...
  const rawContent = isCompressedChatMessage(content) ? decompressChatMessageSync(content) : content
  if (!rawContent) return null

  // Nếu là tin nhắn từ SenAI hoặc có chứa ký hiệu KaTeX ($...$ / $$...$$) / TikZ
  if (isSenAi || hasMathOrTikz(rawContent)) {
    // Chuẩn hóa nếu có \begin{tikzpicture} chưa bọc trong code fence
    let processedContent = rawContent
    if (processedContent.includes('\\begin{tikzpicture}')) {
      processedContent = processedContent.replace(
        /(```tikz\s*[\s\S]*?```)|(\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\})/gi,
        (match, p1, p2) => {
          if (p1) return p1
          return `\n\`\`\`tikz\n${p2}\n\`\`\`\n`
        }
      )
    }

    return (
      <div className={`text-xs leading-relaxed break-words space-y-1.5 math-view ${
        isMe ? 'text-white' : 'text-slate-800 dark:text-slate-100'
      }`}>
        <ReactMarkdown
          remarkPlugins={[remarkMath, remarkGfm]}
          rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
          components={{
            code: ({ className: codeClass, children, ...props }: any) => {
              const isTikz = /language-tikz/i.test(codeClass || '')
              const codeText = String(children).trim()
              if (isTikz || codeText.startsWith('\\begin{tikzpicture}')) {
                return (
                  <div className="my-2 p-1 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 overflow-x-auto">
                    <TikzRenderer code={codeText} />
                  </div>
                )
              }
              return (
                <code
                  className={`rounded px-1 py-0.5 font-mono text-[11px] ${
                    isMe
                      ? 'bg-emerald-700/60 text-emerald-100'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                  } ${codeClass || ''}`}
                  {...props}
                >
                  {children}
                </code>
              )
            },
            p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`underline font-medium ${
                  isMe ? 'text-emerald-100' : 'text-purple-600 dark:text-purple-400'
                }`}
              >
                {children}
              </a>
            ),
          }}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
    )
  }

  // Tin nhắn văn bản thông thường: Phân tích liên kết an toàn
  const textParts = parseMessageLinks(rawContent)

  return (
    <div className="text-xs leading-relaxed break-words">
      {textParts.map((part, pIdx) => {
        if (part.type === 'link') {
          return (
            <a
              key={pIdx}
              href={part.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline font-medium ${
                isMe ? 'text-emerald-100' : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {part.content}
            </a>
          )
        }
        return <span key={pIdx}>{part.content}</span>
      })}
    </div>
  )
}
