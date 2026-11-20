## [2.2.0] - 2026-11-20

### 🚀 Tính Năng Mới (Features)
- ccc7bcc feat(chat): implement P7 Mobile web and Android Capacitor for Sen Chat
- 1d1f192 feat(chat): implement P6 SenAI (@Sen) chat integration with E2EE disclosure, quota & KaTeX/TikZ
- 005083e feat(chat): implement P5 voice messages and speech-to-text with on-device Whisper & server fallback
- d431701 feat(chat): implement P4 chunked e2ee file attachments with google drive integration
- 9804236 feat(chat): implement P3 MLS RFC 9420 email group chat with key rotation and role RLS
- e9520fe feat(chat): implement P2 3-column UI, friend request flow, disappearing messages and security headers
- 54d6e3c feat(chat): implement P1 E2EE Signal protocol architecture, schema migrations and RLS
- eb4638c feat(ui): optimize mobile non-exam usability touch targets contrast and empty states
- 2788205 feat(mobile): complete p3 parity with review page, hsa mobile drawer, capacitor back button and safe download
- c5a1c0e feat(mobile): separate scm wallet from pc sencash with ledger and isolation guards
- a970e5a feat(db): automate and execute all supabase migrations with tracking table

### 🐛 Sửa Lỗi & Bảo Mật (Fixes & Security)
- 9d1d178 fix(chat): patch PIN length verification, browser Buffer crash, offline queue auto-drain, and safe-area insets
- de6a1f7 fix(chat): patch E2EE zero-context leak, input retention, realtime SenAI routing, and prompt injection tag escaping
- 8579245 fix(chat): wire Bearer auth for STT & voice attachments, unnest message bubble, and improve Gemini STT parser
- ffebdb5 fix(chat): close ternary expression in chat input bar for clean build
- 7fb408c fix(chat): stream chunked e2ee crypto, drive stream retry, and account deletion cleanup
- 406149b fix(chat): wire MLS RPC auth dispatch, Bearer token headers, and cryptographic group commits
- f25243b fix(dashboard): bind web version display to APP_VERSION and add migration runner
- 8430c4a security(exam): patch indirect answer leak, duplicate submit idempotency, and admin authorization

### ⚡ Tối Ưu Hiệu Năng (Performance)
- d51cdef perf(exam-rooms): isolate countdown timer re-renders and headless engine architecture

