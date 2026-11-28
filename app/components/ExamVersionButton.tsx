'use client'

import { useRef } from 'react'

const changes = [
  'Sen Chat có giao diện web mobile, tích hợp Android, nhóm MLS và luồng kết bạn.',
  'Bổ sung @Sen trong chat, tin nhắn thoại có chuyển lời nói thành văn bản và đính kèm tệp mã hóa theo từng phần.',
  'Mobile có trang xem lại bài làm, ngăn điều hướng HSA, hỗ trợ nút quay lại và tải tệp an toàn.',
  'Tăng bảo vệ đáp án thi, ngăn nộp trùng và siết quyền quản trị.',
  'Tách cập nhật đồng hồ khỏi giao diện phòng thi để giảm việc vẽ lại.',
]

export default function ExamVersionButton({ className, version }: { className?: string; version: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  return <>
    <button type="button" aria-haspopup="dialog" className={className} onClick={() => dialog.current?.showModal()}>v{version}</button>
    <dialog ref={dialog} aria-label={`Nhật ký SenExam ${version}`}
      className="m-auto max-h-[85dvh] w-[min(94vw,32rem)] overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-950/50 dark:bg-slate-900 dark:text-slate-100">
      <form method="dialog" className="mb-3 flex items-start justify-between gap-2">
        <h2 className="text-lg font-bold">SenExam {version}</h2>
        <button className="rounded-lg bg-slate-100 px-3 py-1 text-sm dark:bg-slate-800">Đóng</button>
      </form>
      {version === '2.2.0' ? <>
        <p className="text-xs text-slate-500 dark:text-slate-400">Phát hành 20/11/2026</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{changes.map((change) => <li key={change}>{change}</li>)}</ul>
      </> : <p className="text-sm">Chưa có nhật ký cho phiên bản này.</p>}
    </dialog>
  </>
}
