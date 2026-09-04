'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Download,
  Upload,
  Lock,
  Unlock,
  FileCheck2,
  FileText,
  AlertTriangle,
  FileLock2,
  CheckCircle2,
  Loader2,
  X,
  RefreshCw,
} from 'lucide-react'
import {
  generateQuantumMasterKey,
  parseAndValidateKeyFile,
  encryptFileWithKey,
  decryptFileWithKey,
  MasterKeyCertificate,
} from '@/lib/cryptoSecurity'
import { supabase } from '@/lib/supabaseClient'

interface AdminSecurityVaultProps {
  userId: string
  userEmail: string
  isDeepVaultUnlocked: boolean
  activePayloadToken: string | null
  onUnlockSuccess: (payloadToken: string, keyId: string) => void
  onLockVault: () => void
  children?: React.ReactNode
}

/**
 * Global Admin Security Vault Component
 * Integrates:
 * 1. One-Time Master Key Issuance & Download Enforcement
 * 2. Deep Security Vault Gate (Submit .key file to unlock)
 * 3. File Encryption & Decryption Center (AES-256-GCM)
 */
export default function AdminSecurityVault({
  userId,
  userEmail,
  isDeepVaultUnlocked,
  activePayloadToken,
  onUnlockSuccess,
  onLockVault,
  children,
}: AdminSecurityVaultProps) {
  // Key Issuance States
  const [checkingIssuance, setCheckingIssuance] = useState(true)
  const [isKeyIssued, setIsKeyIssued] = useState(false)
  const [generatedCert, setGeneratedCert] = useState<MasterKeyCertificate | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [showIssuanceModal, setShowIssuanceModal] = useState(false)

  // Unlock Gate States
  const [registeredKeyHash, setRegisteredKeyHash] = useState<string | null>(null)
  const [isVerifyingFile, setIsVerifyingFile] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [activeKeyId, setActiveKeyId] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // 1. Check if Master Key has already been issued to this Admin
  useEffect(() => {
    let isMounted = true
    async function checkKeyStatus() {
      if (!userId) return
      setCheckingIssuance(true)
      try {
        // A. Check local permanent seal
        const localSeal = localStorage.getItem(`senexam_master_key_sealed_${userId}`)
        const localHash = localStorage.getItem(`senexam_master_key_hash_${userId}`)

        // B. Query database profile
        let dbIssuedAt = null
        let dbHash = null
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('admin_key_issued_at, admin_key_hash')
            .eq('id', userId)
            .maybeSingle()
          if (!error && data) {
            dbIssuedAt = data.admin_key_issued_at
            dbHash = data.admin_key_hash
          }
        } catch {
          // Column might not exist yet in DB; fallback smoothly to localStorage
        }

        const issued = Boolean(dbIssuedAt || localSeal)
        const hash = dbHash || localHash || null

        if (isMounted) {
          setIsKeyIssued(issued)
          setRegisteredKeyHash(hash)

          // If NOT issued yet, generate the quantum certificate ready for one-time download
          if (!issued) {
            const cert = await generateQuantumMasterKey(userEmail || 'admin@senexam.me')
            setGeneratedCert(cert)
            setShowIssuanceModal(true)
          }
        }
      } catch (err) {
        console.error('Error checking key issuance:', err)
      } finally {
        if (isMounted) setCheckingIssuance(false)
      }
    }

    checkKeyStatus()
    return () => {
      isMounted = false
    }
  }, [userId, userEmail])

  // 2. Handle One-Time Key File Download & Seal
  const handleDownloadAndSealKey = async () => {
    if (!generatedCert) return
    setIsDownloading(true)

    try {
      // 1. Create downloadable .key file
      const blob = new Blob([generatedCert.fileContent], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const sanitizedEmail = (userEmail || 'ADMIN').split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g, '_')
      a.href = url
      a.download = `SENEXAM_MASTER_SECURITY_${sanitizedEmail}.key`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // 2. Permanently record issuance in Supabase & localStorage
      const timestamp = new Date().toISOString()
      localStorage.setItem(`senexam_master_key_sealed_${userId}`, timestamp)
      localStorage.setItem(`senexam_master_key_hash_${userId}`, generatedCert.keyHash)
      localStorage.setItem(`senexam_master_key_id_${userId}`, generatedCert.keyId)

      try {
        await supabase
          .from('profiles')
          .update({
            admin_key_issued_at: timestamp,
            admin_key_hash: generatedCert.keyHash,
          })
          .eq('id', userId)
      } catch {
        // Fallback gracefully if columns are not yet present in Supabase
      }

      setIsKeyIssued(true)
      setRegisteredKeyHash(generatedCert.keyHash)
      setActiveKeyId(generatedCert.keyId)
      setShowIssuanceModal(false)

      alert('ĐÃ TẢI VỀ KHÓA BẢO MẬT THÀNH CÔNG!\n\nLưu ý: Tệp tin này chỉ được cấp 1 lần duy nhất và không thể tải lại. Hãy cất giữ ở nơi an toàn!')
    } catch (err: any) {
      alert('Lỗi tải khóa: ' + (err?.message || 'Không thể tạo file!'))
    } finally {
      setIsDownloading(false)
    }
  }

  // 3. Handle Submitting .key File into the Deep Vault
  const handleKeyFileUpload = async (file: File) => {
    if (!file) return
    setIsVerifyingFile(true)
    setVerifyError(null)

    try {
      const text = await file.text()
      const result = await parseAndValidateKeyFile(text, registeredKeyHash)

      if (!result.valid) {
        setVerifyError(result.error || 'Tệp khóa không hợp lệ!')
        return
      }

      // If registeredKeyHash was null (e.g. database column just added), register it now
      if (!registeredKeyHash && result.keyHash) {
        setRegisteredKeyHash(result.keyHash)
        localStorage.setItem(`senexam_master_key_hash_${userId}`, result.keyHash)
        try {
          await supabase
            .from('profiles')
            .update({
              admin_key_issued_at: new Date().toISOString(),
              admin_key_hash: result.keyHash,
            })
            .eq('id', userId)
        } catch {
          // ignore
        }
      }

      setActiveKeyId(result.keyId || 'SEC-ACTIVE')
      onUnlockSuccess(result.payloadToken!, result.keyId || 'SEC-ACTIVE')
    } catch (err: any) {
      setVerifyError('Lỗi đọc file: ' + (err?.message || 'Không xác định'))
    } finally {
      setIsVerifyingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <>
      {/* ======================================================== */}
      {/* 1. ONE-TIME MASTER KEY ISSUANCE MODAL (BLOCKING MODAL)   */}
      {/* ======================================================== */}
      {showIssuanceModal && !isKeyIssued && generatedCert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-xl rounded-3xl bg-slate-900 border-2 border-amber-500/50 p-6 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.25)] text-white space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                <ShieldAlert className="h-9 w-9 animate-pulse" />
              </div>
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Cấp quyền Quản trị tối cao
                </span>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  KHỞI TẠO KHÓA BẢO MẬT (.key)
                </h2>
                <p className="text-xs text-slate-300">
                  Hệ thống bảo vệ phân tầng lượng tử (Quantum Shield Security)
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 space-y-3 font-mono text-xs">
              <div className="flex justify-between items-center text-slate-400">
                <span>MÃ ĐỊNH DANH (KEY-ID):</span>
                <span className="text-sky-400 font-bold">{generatedCert.keyId}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>QUYỀN SỞ HỮU:</span>
                <span className="text-amber-400 font-bold">{generatedCert.owner}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>ĐỘ DÀI ENTROPY:</span>
                <span className="text-emerald-400 font-bold">512-bit Military Random</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>CHUẨN MÃ HÓA:</span>
                <span className="text-indigo-400 font-bold">AES-256-GCM / SHA-512</span>
              </div>
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500 truncate">
                CHECKSUM: <span className="text-slate-400">{generatedCert.checksum}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-200 leading-relaxed">
                <strong>CẢNH BÁO QUAN TRỌNG:</strong> Đây là lần đầu tiên tài khoản của bạn được cấp quyền Quản trị viên. Bạn <strong>bắt buộc phải tải về và lưu giữ cẩn thận tệp khóa (.key)</strong> này. Sau khi tải xuống, hệ thống sẽ tự động niêm phong và <strong>không thể tải lại lần thứ hai</strong>!
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadAndSealKey}
              disabled={isDownloading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 font-black text-slate-950 text-sm tracking-wider uppercase shadow-[0_10px_30px_rgba(245,158,11,0.4)] flex items-center justify-center gap-2.5 transition active:scale-[0.99] cursor-pointer"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>ĐANG NIÊM PHONG & TẢI XUỐNG...</span>
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" />
                  <span>TẢI VỀ FILE KHÓA (.key) & KÍCH HOẠT HỆ THỐNG</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. DEEP VAULT GATE OR UNLOCKED CONTENT                   */}
      {/* ======================================================== */}
      {!isDeepVaultUnlocked ? (
        /* VAULT IS LOCKED: Show Deep Security Vault Gate */
        <div className="relative rounded-3xl border-2 border-sky-500/30 bg-slate-900/90 text-white p-6 sm:p-10 shadow-2xl backdrop-blur-xl overflow-hidden my-6">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto text-center space-y-6">
            <div className="inline-flex p-4 rounded-3xl bg-sky-500/10 border border-sky-500/30 text-sky-400 shadow-[0_0_30px_rgba(14,165,233,0.2)]">
              <FileLock2 className="h-12 w-12" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider bg-sky-500/10 text-sky-400 border border-sky-500/30">
                <Lock className="h-3.5 w-3.5" />
                <span>Lớp Dữ Liệu Tối Mật (Deep Security Vault)</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                GIAO NỘP TỆP KHÓA ĐỂ TRUY CẬP TẦNG SÂU
              </h3>
              <p className="text-sm text-slate-400 max-w-lg mx-auto">
                Khu vực chứa dữ liệu cốt lõi (Ngân hàng đề thi, mã hóa tệp tin, phân quyền, cấu hình gốc). Vui lòng tải lên tệp tin khóa bảo mật <strong>(.key)</strong> đã được cấp để mở khóa.
              </p>
            </div>

            {/* Drag & Drop / Upload Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files?.[0]
                if (file) handleKeyFileUpload(file)
              }}
              className="group cursor-pointer rounded-2xl border-2 border-dashed border-sky-400/40 hover:border-sky-400 bg-slate-950/60 p-8 sm:p-10 transition duration-200 flex flex-col items-center justify-center gap-3 text-center"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".key,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleKeyFileUpload(file)
                }}
              />

              {isVerifyingFile ? (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-sky-400" />
                  <p className="text-sm font-bold text-sky-300">Đang xác thực chữ ký SHA-512 & giải mã...</p>
                </>
              ) : (
                <>
                  <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-400 group-hover:scale-110 transition">
                    <KeyRound className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-white group-hover:text-sky-300 transition">
                      Kéo thả file <span className="text-amber-400">.key</span> vào đây hoặc bấm để chọn file
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Hỗ trợ tệp chứng chỉ Master Key được cấp cho tài khoản này
                    </p>
                  </div>
                </>
              )}
            </div>

            {verifyError && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center justify-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{verifyError}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VAULT IS UNLOCKED: Render Deep Vault Banner + Children */
        <div className="space-y-6">
          {/* Active Vault Status Banner */}
          <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/80 via-slate-900/90 to-emerald-950/80 p-4 shadow-lg flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                    DEEP VAULT: ĐÃ MỞ KHÓA
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {activeKeyId || 'SEC-SESSION-VALID'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Phiên làm việc bảo mật cấp cao nhất đang hoạt động. Các tệp tin và dữ liệu cốt lõi đã sẵn sàng.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onLockVault}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold transition shadow-sm"
              title="Khóa ngay phiên làm việc tầng sâu"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Khóa Lớp Bảo Mật</span>
            </button>
          </div>

          {/* Unlocked Protected Content */}
          {children}
        </div>
      )}
    </>
  )
}

/**
 * File Encryption & Decryption Center Component (AES-256-GCM)
 * Can be placed directly inside any Deep Vault unlocked tab!
 */
export function FileEncryptionCenter({ payloadToken }: { payloadToken: string | null }) {
  const [encryptingFile, setEncryptingFile] = useState(false)
  const [decryptingFile, setDecryptingFile] = useState(false)
  const [encResult, setEncResult] = useState<string | null>(null)
  const [decResult, setDecResult] = useState<string | null>(null)

  const handleEncryptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !payloadToken) return
    setEncryptingFile(true)
    setEncResult(null)

    try {
      const { encryptedBlob, outputFilename } = await encryptFileWithKey(file, payloadToken)
      const url = URL.createObjectURL(encryptedBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = outputFilename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setEncResult(`Đã mã hóa thành công tệp: ${outputFilename} (Chuẩn AES-256-GCM)`)
    } catch (err: any) {
      alert('Lỗi mã hóa tệp: ' + err.message)
    } finally {
      setEncryptingFile(false)
      e.target.value = ''
    }
  }

  const handleDecryptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !payloadToken) return
    setDecryptingFile(true)
    setDecResult(null)

    try {
      const { decryptedBlob, originalFilename } = await decryptFileWithKey(file, payloadToken)
      const url = URL.createObjectURL(decryptedBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = originalFilename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setDecResult(`Đã giải mã thành công tệp gốc: ${originalFilename}`)
    } catch (err: any) {
      alert('Lỗi giải mã: ' + (err.message || 'Khóa không khớp hoặc tệp bị hỏng!'))
    } finally {
      setDecryptingFile(false)
      e.target.value = ''
    }
  }

  return (
    <div className="rounded-3xl border border-slate-700 bg-slate-900/90 p-6 sm:p-8 text-white space-y-6 shadow-xl">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
          <FileLock2 className="h-7 w-7" />
        </div>
        <div>
          <h4 className="text-lg font-black tracking-tight">TRUNG TÂM MÃ HÓA & GIẢI MÃ TỆP TIN QUÂN SỰ</h4>
          <p className="text-xs text-slate-400">
            Mã hóa đề thi, slide, tài liệu FEPN thành định dạng bất khả xâm phạm <code>.senenc</code> bằng khóa Master Key AES-256-GCM.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Encrypt Box */}
        <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
            <Lock className="h-4 w-4" />
            <span>Mã Hóa Tệp Tin Mới (.senenc)</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Chọn tệp tin bất kỳ (PDF đề thi, Word đáp án, Ảnh...). Hệ thống sẽ nén và mã hóa toàn bộ dữ liệu. Tệp chỉ mở được khi có file khóa này.
          </p>
          <label className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-md">
            {encryptingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span>{encryptingFile ? 'ĐANG MÃ HÓA...' : 'CHỌN FILE ĐỂ MÃ HÓA'}</span>
            <input type="file" className="hidden" disabled={encryptingFile || !payloadToken} onChange={handleEncryptFile} />
          </label>
          {encResult && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{encResult}</span>
            </div>
          )}
        </div>

        {/* Decrypt Box */}
        <div className="rounded-2xl bg-slate-950/70 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <Unlock className="h-4 w-4" />
            <span>Giải Mã Tệp Tin (.senenc)</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Tải lên tệp đã được mã hóa <code>.senenc</code>. Hệ thống sẽ thẩm định chữ ký và khôi phục nguyên vẹn tệp tin ban đầu.
          </p>
          <label className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition shadow-md">
            {decryptingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span>{decryptingFile ? 'ĐANG GIẢI MÃ...' : 'CHỌN FILE .SENENC ĐỂ GIẢI MÃ'}</span>
            <input type="file" accept=".senenc" className="hidden" disabled={decryptingFile || !payloadToken} onChange={handleDecryptFile} />
          </label>
          {decResult && (
            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{decResult}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
