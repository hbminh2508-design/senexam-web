'use client'

import React, { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Ghi log chi tiết lỗi hệ thống để chẩn đoán
    console.error('SenExam Root Global Error:', error)

    // Nếu là lỗi tải chunk mạng (ChunkLoadError / dynamic import), tự động reload lại trang sau 1s
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Connection closed') ||
      error?.message?.includes('Minified React error #412')

    if (isChunkError && typeof window !== 'undefined') {
      const reloadKey = 'sen_chunk_reload_' + window.location.pathname
      const lastReload = parseInt(sessionStorage.getItem(reloadKey) || '0', 10)
      if (Date.now() - lastReload > 10000) {
        sessionStorage.setItem(reloadKey, String(Date.now()))
        window.location.reload()
      }
    }
  }, [error])

  return (
    <html lang="vi">
      <head>
        <title>Sự cố hiển thị trang | SenExam</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style dangerouslySetInnerHTML={{ __html: `
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: #0B0F19;
            color: #E2E8F0;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 1.5rem;
            box-sizing: border-box;
          }
          .card {
            max-width: 440px;
            width: 100%;
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 1.5rem;
            padding: 2rem;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          }
          .icon-box {
            width: 3.5rem;
            height: 3.5rem;
            margin: 0 auto 1.25rem;
            background: rgba(244, 63, 94, 0.12);
            border: 1px solid rgba(244, 63, 94, 0.25);
            border-radius: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #FB7185;
            font-size: 1.75rem;
          }
          h1 {
            font-size: 1.25rem;
            font-weight: 800;
            margin: 0 0 0.5rem;
            color: #FFFFFF;
          }
          p {
            font-size: 0.875rem;
            color: #94A3B8;
            line-height: 1.5;
            margin: 0 0 1.5rem;
          }
          .btn-group {
            display: flex;
            gap: 0.75rem;
          }
          .btn-primary {
            flex: 1;
            padding: 0.75rem 1.25rem;
            background: #6366F1;
            color: #FFFFFF;
            border: none;
            border-radius: 0.875rem;
            font-weight: 700;
            font-size: 0.875rem;
            cursor: pointer;
            transition: background 0.15s ease;
          }
          .btn-primary:hover {
            background: #4F46E5;
          }
          .btn-secondary {
            flex: 1;
            padding: 0.75rem 1.25rem;
            background: rgba(255, 255, 255, 0.06);
            color: #CBD5E1;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 0.875rem;
            font-weight: 600;
            font-size: 0.875rem;
            cursor: pointer;
            transition: background 0.15s ease;
          }
          .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.12);
          }
        `}} />
      </head>
      <body>
        <div className="card">
          <div className="icon-box">⚠️</div>
          <h1>Trang đang làm mới kết nối</h1>
          <p>
            Phiên dữ liệu trình duyệt vừa chuyển tiếp trạng thái. Nhấn nút Tải lại bên dưới để tiếp tục sử dụng bình thường.
          </p>
          <div className="btn-group">
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.reload()
                } else {
                  reset()
                }
              }}
            >
              Tải lại trang
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  if (window.history.length > 1) {
                    window.history.back()
                  } else {
                    window.location.href = '/new-dashboard'
                  }
                }
              }}
            >
              Quay lại
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
