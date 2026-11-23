'use client'

import React, { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import TikzRenderer from '@/app/components/TikzRenderer'
import { parseMessageLinks } from '@/lib/chatSanitizer'
import { hasMathOrTikz } from '@/lib/senChatAi'
import { isCompressedChatMessage, decompressChatMessage, decompressChatMessageSync } from '@/lib/senChatCompression'
import { getChatFontSize, ChatFontSize } from '@/lib/senChatStorage'

interface ChatMessageContentProps {
  content: string
  isSenAi?: boolean
  isMe?: boolean
  fontSize?: ChatFontSize
}

export default function ChatMessageContent({
  content,
  isSenAi = false,
  isMe = false,
  fontSize: propFontSize,
}: ChatMessageContentProps) {
  // 1. Tự động giải nén minh bạch tin nhắn (hỗ trợ cả SSR / sync và bất đồng bộ trên Client)
  const [rawContent, setRawContent] = useState<string>(() => {
    if (!content) return ''
    if (isCompressedChatMessage(content)) {
      const syncResult = decompressChatMessageSync(content)
      return isCompressedChatMessage(syncResult) ? '' : syncResult
    }
    return content
  })

  // 2. Cỡ chữ hiển thị tin nhắn (Nhỏ / Vừa / Lớn)
  const [currentFontSize, setCurrentFontSize] = useState<ChatFontSize>(() => {
    if (propFontSize) return propFontSize
    if (typeof window !== 'undefined') return getChatFontSize()
    return 'normal'
  })

  useEffect(() => {
    if (propFontSize) {
      setCurrentFontSize(propFontSize)
    }
  }, [propFontSize])

  useEffect(() => {
    const handleSettingsUpdate = (e: any) => {
      if (e.detail?.fontSize && !propFontSize) {
        setCurrentFontSize(e.detail.fontSize)
      }
    }
    window.addEventListener('senchat-settings-updated', handleSettingsUpdate)
    return () => window.removeEventListener('senchat-settings-updated', handleSettingsUpdate)
  }, [propFontSize])

  useEffect(() => {
    if (!content) {
      setRawContent('')
      return
    }
    if (isCompressedChatMessage(content)) {
      let active = true
      decompressChatMessage(content)
        .then((decompressed) => {
          if (active) setRawContent(decompressed)
        })
        .catch(() => {
          if (active) setRawContent(content)
        })
      return () => {
        active = false
      }
    } else {
      setRawContent(content)
    }
  }, [content])

  if (!content) return null
  if (!rawContent) {
    return (
      <span className="inline-block text-[11px] opacity-60 italic animate-pulse">
        Đang giải nén tin nhắn...
      </span>
    )
  }

  const fontSizeClass =
    currentFontSize === 'small'
      ? 'text-[13px]'
      : currentFontSize === 'large'
      ? 'text-base'
      : 'text-xs sm:text-sm'

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
      <div className={`${fontSizeClass} leading-relaxed break-words space-y-1.5 math-view ${
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
    <div className={`${fontSizeClass} leading-relaxed break-words`}>
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
