'use client'

import React, { useState, useEffect, useMemo, useRef, useDeferredValue } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { ensureStudentProfile } from '@/lib/ensureProfile'
import CanvasStoryEngine, { CanvasIllustration } from '@/app/components/read/CanvasStoryEngine'
import { GoogleTtsEngine, splitTextIntoSentences, SpeechVoiceOption } from '@/app/components/read/GoogleTtsEngine'
import {
  BookOpen,
  ArrowLeft,
  Sparkles,
  Lock,
  Globe,
  User,
  Plus,
  Trash2,
  Search,
  Languages,
  Play,
  Pause,
  Square,
  Volume2,
  FastForward,
  Rewind,
  Sun,
  Moon,
  ChevronRight,
  ChevronLeft,
  Crown,
  Zap,
  Upload,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  Filter,
  Eye,
  RefreshCw,
  Sliders,
  ExternalLink,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-read-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-read-body' })

export interface ReadingChapter {
  id: string
  book_id: string
  chapter_number: number
  title: string
  content: string
  translation_en?: string | null
  translation_vi?: string | null
  illustrations?: Record<string, CanvasIllustration>
}

export interface ReadingBook {
  id: string
  user_id?: string | null
  title: string
  author: string
  description?: string
  cover_url?: string
  genre: string
  language: 'vi' | 'en'
  is_public: boolean
  total_chapters: number
  views_count?: number
  created_at?: string
  chapters?: ReadingChapter[]
}

// SÁCH MẪU CHỌN LỌC PHÒNG KHI CHƯA CHẠY MIGRATION SUPABASE
const DEMO_PUBLIC_BOOKS: ReadingBook[] = [
  {
    id: 'b0000001-0000-0000-0000-000000000001',
    user_id: null,
    title: 'Hoàng Tử Bé (The Little Prince)',
    author: 'Antoine de Saint-Exupéry',
    description:
      'Tác phẩm văn học bất hủ về tình yêu thương, sự gắn kết và lăng kính thuần khiết của trẻ thơ về nhân loại. Tích hợp song ngữ và minh họa nghệ thuật.',
    cover_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=800&auto=format&fit=crop',
    genre: 'Văn học cổ điển',
    language: 'vi',
    is_public: true,
    total_chapters: 2,
    chapters: [
      {
        id: 'c1',
        book_id: 'b0000001-0000-0000-0000-000000000001',
        chapter_number: 1,
        title: 'Chương 1: Bức tranh con trăn nuốt con voi',
        content: `Năm lên sáu tuổi, tôi đã nhìn thấy một bức tranh tuyệt đẹp trong một cuốn sách viết về Rừng Nguyên Thủy có tựa đề là "Những câu chuyện có thật". Bức tranh vẽ một con trăn khổng lồ đang nuốt chửng một con thú dữ.

[ILLUSTRATION: Tranh vẽ phác thảo một con trăn lớn cuộn mình trong rừng rậm hoang sơ dưới ánh trăng huyền ảo]

Cuốn sách viết rằng: "Những con trăn nuốt trọn con mồi mà không cần nhai. Sau đó chúng không thể di chuyển được nữa và phải ngủ liền trong sáu tháng để tiêu hóa."

Tôi đã suy nghĩ rất nhiều về những cuộc phiêu lưu nơi rừng thẳm, rồi cầm chiếc bút chì màu vẽ nên bức tranh đầu tiên của đời mình. Tôi đã cho người lớn xem kiệt tác ấy và hỏi họ có thấy sợ không. Họ trả lời: "Tại sao lại phải sợ một cái mũ?". Bức tranh của tôi không phải là cái mũ, mà là một con trăn đang tiêu hóa một con voi bên trong bụng nó.`,
        translation_en: `Once when I was six years old I saw a magnificent picture in a book, called True Stories from Nature, about the primeval forest. It was a picture of a boa constrictor in the act of swallowing an animal.

[ILLUSTRATION: Sketch of a giant boa constrictor coiled in a primeval moonlit jungle]

In the book it said: "Boa constrictors swallow their prey whole, without chewing it. After that they are not able to move, and they sleep through the six months which they need for digestion."

I pondered deeply, then, over the adventures of the jungle. And after some work with a colored pencil I succeeded in making my first drawing. My Drawing Number One. I showed my masterpiece to the grown-ups, and asked them whether the drawing frightened them. But they answered: "Frighten? Why should any one be frightened by a hat?" My drawing was not a picture of a hat. It was a picture of a boa constrictor digesting an elephant.`,
      },
      {
        id: 'c2',
        book_id: 'b0000001-0000-0000-0000-000000000001',
        chapter_number: 2,
        title: 'Chương 2: Cuộc hội ngộ giữa sa mạc Sahara',
        content: `Tôi đã sống cô đơn như thế, không một ai để thực sự chuyện trò, cho đến khi máy bay của tôi gặp sự cố trên sa mạc Sahara sáu năm trước. Một bộ phận trong động cơ bị vỡ. Và vì không có thợ máy hay hành khách nào đi cùng, tôi phải tự mình thực hiện một cuộc sửa chữa cam go. Đó là vấn đề sinh tử đối với tôi: lượng nước ngọt tôi mang theo chỉ đủ uống trong tám ngày.

[ILLUSTRATION: Phi công mệt mỏi bên cạnh cánh máy bay vỡ giữa biển cát vàng mênh mông dưới bầu trời đầy sao]

Đêm đầu tiên, tôi ngủ thiếp đi trên cát, cách xa mọi chốn nhân gian ngàn dặm. Tôi còn cô độc hơn một kẻ đắm tàu trôi dạt trên chiếc bè giữa đại dương. Thế nên bạn có thể tưởng tượng tôi đã kinh ngạc đến mức nào khi vào lúc rạng đông, một giọng nói nhỏ bé lạ thường đã đánh thức tôi dậy. Giọng nói thì thầm:

"Làm ơn... hãy vẽ cho tôi một con cừu!"`,
        translation_en: `So I lived my life alone, without anyone that I could really talk to, until I had an accident with my plane in the Desert of Sahara, six years ago. Something was broken in my engine. And as I had with me neither a mechanic nor any passengers, I set myself to attempt the difficult repairs all alone. It was a question of life or death for me: I had scarcely enough drinking water for eight days.

[ILLUSTRATION: Weary pilot beside broken airplane wings in endless golden sand dunes under starry skies]

The first night, then, I went to sleep on the sand, a thousand miles from any human habitation. I was more isolated than a shipwrecked sailor on a raft in the middle of the ocean. Thus you can imagine my amazement, at sunrise, when a strange little voice woke me up. It said:

"If you please—draw me a sheep!"`,
      },
    ],
  },
  {
    id: 'b0000002-0000-0000-0000-000000000002',
    user_id: null,
    title: 'Dế Mèn Phiêu Lưu Ký',
    author: 'Tô Hoài',
    description:
      'Kiệt tác văn học thiếu nhi Việt Nam về bài học trưởng thành, lòng dũng cảm, tình bạn tri kỷ và khát vọng hòa bình muôn loài.',
    cover_url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=800&auto=format&fit=crop',
    genre: 'Truyện đồng thoại',
    language: 'vi',
    is_public: true,
    total_chapters: 1,
    chapters: [
      {
        id: 'c3',
        book_id: 'b0000002-0000-0000-0000-000000000002',
        chapter_number: 1,
        title: 'Chương 1: Bài học đường đời đầu tiên',
        content: `Tôi sống độc lập từ thuở bé. Ấy là tục lệ lâu đời trong họ dế chúng tôi: lứa con nào mới lớn cũng phải ra ở riêng ngay. Mẹ tôi chỉ chăm lo cho chúng tôi được vài hôm, rồi dẫn mỗi đứa đi tìm một cái hang mới để tự lập.

[ILLUSTRATION: Chú Dế Mèn dũng mãnh đứng trên ngọn cỏ non, đôi càng bóng loáng vươn cao đón ánh nắng sớm ban mai]

Tôi chẳng những không buồn mà lại rất thích. Tôi bước vào đời với đôi càng mẫm bóng, những cái vuốt ở chân thì cứng dần và nhọn hoắt. Thỉnh thoảng, ngứa chân vuốt cánh, tôi lại co cẳng lên đạp phanh phách vào các ngọn cỏ. Những ngọn cỏ gãy rạp, y như có nhát dao vừa lia qua.`,
        translation_en: `I lived independently since childhood. That has been an ancient tradition of our cricket family: whenever the young grow up, they must leave to live on their own immediately. My mother only took care of us for a few days, then led each child to a separate burrow to be independent.

[ILLUSTRATION: The brave cricket standing proudly on a blade of grass, sleek hind legs reaching up under the morning sun]

Not only was I not sad, but I was thrilled. I entered the world with muscular, sleek legs and claws that gradually turned razor sharp and sturdy.`,
      },
    ],
  },
]

export default function SenReadPage() {
  const router = useRouter()
  const [isDark, setIsDark] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  // User Profile & Tiers
  const [userId, setUserId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('student')
  const [planTier, setPlanTier] = useState<string>('free')
  const [senaiTier, setSenaiTier] = useState<string>('free')
  const [vipExpiresAt, setVipExpiresAt] = useState<string | null>(null)

  // Active Space: 'public' (Không gian chung) vs 'private' (Không gian riêng)
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public')

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedGenre, setSelectedGenre] = useState<string>('Tất cả')
  const deferredSearch = useDeferredValue(searchQuery)

  // Book collections
  const [publicBooks, setPublicBooks] = useState<ReadingBook[]>(DEMO_PUBLIC_BOOKS)
  const [privateBooks, setPrivateBooks] = useState<ReadingBook[]>([])

  // Upgrade Gate Modal
  const [showUpgradeModal, setShowUpgradeModal] = useState<boolean>(false)
  const [upgradeReason, setUpgradeReason] = useState<'vip_lite' | 'premium_ai'>('vip_lite')

  // Reading Workspace Modal State
  const [readingBook, setReadingBook] = useState<ReadingBook | null>(null)
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(0)
  const [displayedLang, setDisplayedLang] = useState<'vi' | 'en'>('vi')
  const [isTranslating, setIsTranslating] = useState<boolean>(false)

  // TTS Engine State
  const ttsEngineRef = useRef<GoogleTtsEngine | null>(null)
  const [isPlayingTts, setIsPlayingTts] = useState<boolean>(false)
  const [isPausedTts, setIsPausedTts] = useState<boolean>(false)
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number | null>(null)
  const [ttsRate, setTtsRate] = useState<number>(1.0)
  const [availableVoices, setAvailableVoices] = useState<SpeechVoiceOption[]>([])
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('')

  // Upload & Publish Book Modal
  const [showPublishModal, setShowPublishModal] = useState<boolean>(false)
  const [publishTarget, setPublishTarget] = useState<'private' | 'public'>('private')
  const [bookTitle, setBookTitle] = useState<string>('')
  const [bookAuthor, setBookAuthor] = useState<string>('')
  const [bookGenre, setBookGenre] = useState<string>('Văn học')
  const [bookCoverUrl, setBookCoverUrl] = useState<string>('')
  const [bookDescription, setBookDescription] = useState<string>('')
  const [rawManuscript, setRawManuscript] = useState<string>('')
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false)
  const [aiGeneratedChapters, setAiGeneratedChapters] = useState<
    { chapter_number: number; title: string; content: string }[]
  >([])

  // Image Insert / Edit Modal on Canvas
  const [imageModalData, setImageModalData] = useState<{
    prompt: string
    index: number
    currentUrl?: string
  } | null>(null)
  const [imageUrlInput, setImageUrlInput] = useState<string>('')

  // Check VIP Lite Status
  const isVipLiteOrAbove = useMemo(() => {
    if (userRole === 'admin' || userRole === 'collab') return true
    if (vipExpiresAt && new Date(vipExpiresAt).getTime() > Date.now()) return true
    if (['lite', 'vip', 'premium', 'premium_plus', 'sen_one'].includes(planTier)) return true
    if (['lite', 'plus_lite', 'plus', 'ultra', 'max'].includes(senaiTier)) return true
    return false
  }, [userRole, vipExpiresAt, planTier, senaiTier])

  // Check Premium Status (cho tính năng AI Nhận diện & chia chương)
  const isPremiumOrAbove = useMemo(() => {
    if (userRole === 'admin') return true
    if (['premium', 'premium_plus', 'sen_one'].includes(planTier)) return true
    if (['plus', 'ultra', 'max'].includes(senaiTier)) return true
    return false
  }, [userRole, planTier, senaiTier])

  const isAdmin = userRole === 'admin'

  // Initialize Auth & Profiles
  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark'
    if (dark) document.documentElement.classList.add('dark')
    setIsDark(dark)

    // Init TTS Engine
    const engine = new GoogleTtsEngine()
    ttsEngineRef.current = engine
    setAvailableVoices(engine.getAvailableVoices('vi'))

    const init = async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const user = auth?.user
        if (user) {
          setUserId(user.id)
          await ensureStudentProfile(user.id)

          const { data: prof } = await supabase
            .from('profiles')
            .select('role, plan_tier, senai_tier, vip_expires_at')
            .eq('id', user.id)
            .maybeSingle()

          if (prof) {
            setUserRole(prof.role || 'student')
            setPlanTier(prof.plan_tier || 'free')
            setSenaiTier(prof.senai_tier || 'free')
            setVipExpiresAt(prof.vip_expires_at || null)
          }

          // Load user private books
          await fetchBooks(user.id)
        } else {
          // Khách chưa login vẫn load sách demo
          await fetchBooks(null)
        }
      } catch (err) {
        console.warn('Init read error:', err)
      } finally {
        setLoading(false)
      }
    }

    init()

    return () => {
      if (ttsEngineRef.current) {
        ttsEngineRef.current.stop()
      }
    }
  }, [])

  // Fetch books from Supabase with LocalStorage Fallback
  const fetchBooks = async (uid: string | null) => {
    try {
      // 1. Fetch public books
      const { data: pData, error: pErr } = await supabase
        .from('reading_books')
        .select('*, chapters:reading_chapters(*)')
        .eq('is_public', true)
        .order('created_at', { ascending: false })

      if (!pErr && pData && pData.length > 0) {
        setPublicBooks(pData as any)
      } else {
        setPublicBooks(DEMO_PUBLIC_BOOKS)
      }

      // 2. Fetch private books
      if (uid) {
        const { data: privData, error: privErr } = await supabase
          .from('reading_books')
          .select('*, chapters:reading_chapters(*)')
          .eq('user_id', uid)
          .eq('is_public', false)
          .order('created_at', { ascending: false })

        if (!privErr && privData) {
          setPrivateBooks(privData as any)
        } else {
          // Fallback to localStorage
          const local = localStorage.getItem(`senread_private_${uid}`)
          if (local) {
            try {
              setPrivateBooks(JSON.parse(local))
            } catch {}
          }
        }
      }
    } catch {
      setPublicBooks(DEMO_PUBLIC_BOOKS)
    }
  }

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

  // Filtered Books List
  const displayBooks = useMemo(() => {
    const source = activeTab === 'public' ? publicBooks : privateBooks
    return source.filter((b) => {
      const matchGenre = selectedGenre === 'Tất cả' || b.genre === selectedGenre
      const query = deferredSearch.toLowerCase()
      const matchSearch =
        !query ||
        b.title.toLowerCase().includes(query) ||
        b.author.toLowerCase().includes(query) ||
        (b.description || '').toLowerCase().includes(query)
      return matchGenre && matchSearch
    })
  }, [activeTab, publicBooks, privateBooks, selectedGenre, deferredSearch])

  // Get current active chapter object
  const activeChapter = useMemo(() => {
    if (!readingBook || !readingBook.chapters || readingBook.chapters.length === 0) return null
    return readingBook.chapters[activeChapterIndex] || readingBook.chapters[0]
  }, [readingBook, activeChapterIndex])

  // Current active text (original or translated)
  const activeChapterText = useMemo(() => {
    if (!activeChapter) return ''
    if (displayedLang === 'en' && activeChapter.translation_en) {
      return activeChapter.translation_en
    }
    if (displayedLang === 'vi' && activeChapter.translation_vi) {
      return activeChapter.translation_vi
    }
    return activeChapter.content
  }, [activeChapter, displayedLang])

  // Active sentences for TTS
  const activeSentences = useMemo(() => {
    return splitTextIntoSentences(activeChapterText)
  }, [activeChapterText])

  // Start / Toggle Audio Reading
  const handleToggleTts = () => {
    const engine = ttsEngineRef.current
    if (!engine) return

    if (isPlayingTts) {
      if (isPausedTts) {
        engine.resume()
        setIsPausedTts(false)
      } else {
        engine.pause()
        setIsPausedTts(true)
      }
      return
    }

    // Start playing
    const startIndex = currentSentenceIndex !== null ? currentSentenceIndex : 0
    engine.start(
      activeSentences,
      startIndex,
      displayedLang,
      (idx) => {
        setCurrentSentenceIndex(idx)
      },
      () => {
        setIsPlayingTts(false)
        setIsPausedTts(false)
        setCurrentSentenceIndex(null)
      }
    )
    setIsPlayingTts(true)
    setIsPausedTts(false)
  }

  const handleStopTts = () => {
    if (ttsEngineRef.current) {
      ttsEngineRef.current.stop()
    }
    setIsPlayingTts(false)
    setIsPausedTts(false)
    setCurrentSentenceIndex(null)
  }

  const handleTtsRateChange = (newRate: number) => {
    setTtsRate(newRate)
    if (ttsEngineRef.current) {
      ttsEngineRef.current.setRate(newRate)
    }
  }

  // Jump TTS to specific sentence
  const handleSentenceClick = (sentenceIndex: number) => {
    setCurrentSentenceIndex(sentenceIndex)
    if (ttsEngineRef.current) {
      if (isPlayingTts) {
        ttsEngineRef.current.jumpToSentence(sentenceIndex)
      } else {
        ttsEngineRef.current.start(
          activeSentences,
          sentenceIndex,
          displayedLang,
          (idx) => setCurrentSentenceIndex(idx),
          () => {
            setIsPlayingTts(false)
            setIsPausedTts(false)
            setCurrentSentenceIndex(null)
          }
        )
        setIsPlayingTts(true)
        setIsPausedTts(false)
      }
    }
  }

  // Translate active chapter
  const handleTranslateChapter = async (targetLang: 'vi' | 'en') => {
    if (!activeChapter) return
    if (!isPremiumOrAbove) {
      setUpgradeReason('premium_ai')
      setShowUpgradeModal(true)
      return
    }

    setIsTranslating(true)
    try {
      const res = await fetch('/api/read/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'translate',
          text: activeChapter.content,
          sourceLang: displayedLang,
          targetLang,
        }),
      })

      if (!res.ok) throw new Error('Dịch thất bại')
      const data = await res.json()

      // Update chapter translation in state
      if (readingBook) {
        const updatedChapters = [...(readingBook.chapters || [])]
        if (targetLang === 'en') {
          updatedChapters[activeChapterIndex].translation_en = data.translated_text
        } else {
          updatedChapters[activeChapterIndex].translation_vi = data.translated_text
        }
        setReadingBook({ ...readingBook, chapters: updatedChapters })
        setDisplayedLang(targetLang)
      }
    } catch (e: any) {
      alert('Lỗi dịch thuật: ' + (e.message || 'Vui lòng thử lại sau.'))
    } finally {
      setIsTranslating(false)
    }
  }

  // AI Segment Manuscript into Chapters
  const handleRunAiSegmentation = async () => {
    if (!rawManuscript.trim()) {
      alert('Vui lòng dán hoặc tải lên nội dung bản thảo.')
      return
    }

    if (!isPremiumOrAbove) {
      setUpgradeReason('premium_ai')
      setShowUpgradeModal(true)
      return
    }

    setIsAiProcessing(true)
    try {
      const res = await fetch('/api/read/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'segment_chapters',
          text: rawManuscript,
        }),
      })

      if (!res.ok) throw new Error('AI xử lý thất bại')
      const data = await res.json()
      if (Array.isArray(data.chapters) && data.chapters.length > 0) {
        setAiGeneratedChapters(data.chapters)
      } else {
        alert('AI không tìm thấy cấu trúc chương, đã chuyển thành 1 chương duy nhất.')
      }
    } catch (err: any) {
      alert('Lỗi AI: ' + (err.message || 'Không thể chia chương tự động.'))
    } finally {
      setIsAiProcessing(false)
    }
  }

  // Handle Publishing / Uploading Book
  const handlePublishBook = async () => {
    if (!bookTitle.trim()) {
      alert('Vui lòng nhập tên tác phẩm.')
      return
    }

    if (publishTarget === 'public' && !isAdmin) {
      alert('Chỉ quản trị viên (Admin) mới có quyền đăng tác phẩm lên Không gian chung!')
      return
    }

    if (publishTarget === 'private' && !isVipLiteOrAbove) {
      setUpgradeReason('vip_lite')
      setShowUpgradeModal(true)
      return
    }

    // Chapters to save
    let chaptersToSave = aiGeneratedChapters
    if (chaptersToSave.length === 0) {
      chaptersToSave = [
        {
          chapter_number: 1,
          title: 'Chương 1: Mở đầu',
          content: rawManuscript.trim() || 'Nội dung chương đang được cập nhật...',
        },
      ]
    }

    const newBookId = crypto.randomUUID()
    const newBook: ReadingBook = {
      id: newBookId,
      user_id: userId,
      title: bookTitle.trim(),
      author: bookAuthor.trim() || 'Khuyết danh',
      description: bookDescription.trim(),
      cover_url:
        bookCoverUrl.trim() ||
        'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=800&auto=format&fit=crop',
      genre: bookGenre,
      language: 'vi',
      is_public: publishTarget === 'public',
      total_chapters: chaptersToSave.length,
      chapters: chaptersToSave.map((c, idx) => ({
        id: crypto.randomUUID(),
        book_id: newBookId,
        chapter_number: c.chapter_number || idx + 1,
        title: c.title,
        content: c.content,
      })),
      created_at: new Date().toISOString(),
    }

    // Attempt save to Supabase
    try {
      const { error: bErr } = await supabase.from('reading_books').insert({
        id: newBook.id,
        user_id: newBook.user_id,
        title: newBook.title,
        author: newBook.author,
        description: newBook.description,
        cover_url: newBook.cover_url,
        genre: newBook.genre,
        language: newBook.language,
        is_public: newBook.is_public,
        total_chapters: newBook.total_chapters,
      })

      if (!bErr && newBook.chapters) {
        const chapterRows = newBook.chapters.map((c) => ({
          id: c.id,
          book_id: newBook.id,
          chapter_number: c.chapter_number,
          title: c.title,
          content: c.content,
        }))
        await supabase.from('reading_chapters').insert(chapterRows)
      }
    } catch {}

    // Update Local State & LocalStorage
    if (newBook.is_public) {
      setPublicBooks((prev) => [newBook, ...prev])
    } else {
      setPrivateBooks((prev) => {
        const next = [newBook, ...prev]
        if (userId) {
          localStorage.setItem(`senread_private_${userId}`, JSON.stringify(next))
        }
        return next
      })
    }

    // Reset Modal
    setShowPublishModal(false)
    setBookTitle('')
    setBookAuthor('')
    setBookDescription('')
    setRawManuscript('')
    setAiGeneratedChapters([])
    alert('🎉 Đăng tác phẩm thành công!')
  }

  // Delete Private Book
  const handleDeletePrivateBook = async (bookId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Bạn có chắc muốn xóa tác phẩm này khỏi Tủ sách riêng không?')) return

    try {
      await supabase.from('reading_books').delete().eq('id', bookId)
    } catch {}

    setPrivateBooks((prev) => {
      const next = prev.filter((b) => b.id !== bookId)
      if (userId) {
        localStorage.setItem(`senread_private_${userId}`, JSON.stringify(next))
      }
      return next
    })
  }

  // Save Content from Canvas Editor
  const handleSaveCanvasContent = (newContent: string) => {
    if (!readingBook || !activeChapter) return
    const updated = [...(readingBook.chapters || [])]
    updated[activeChapterIndex].content = newContent
    setReadingBook({ ...readingBook, chapters: updated })

    // Save to Supabase
    try {
      supabase
        .from('reading_chapters')
        .update({ content: newContent })
        .eq('id', activeChapter.id)
    } catch {}
  }

  // Handle Illustration URL save
  const handleSaveIllustration = () => {
    if (!imageModalData || !readingBook || !activeChapter) return
    const promptKey = imageModalData.prompt

    const existingIllustrations = { ...(activeChapter.illustrations || {}) }
    existingIllustrations[promptKey] = {
      id: crypto.randomUUID(),
      prompt: promptKey,
      imageUrl: imageUrlInput.trim(),
    }

    const updatedChapters = [...(readingBook.chapters || [])]
    updatedChapters[activeChapterIndex].illustrations = existingIllustrations
    setReadingBook({ ...readingBook, chapters: updatedChapters })

    setImageModalData(null)
    setImageUrlInput('')
  }

  const GENRES = ['Tất cả', 'Văn học cổ điển', 'Truyện đồng thoại', 'Khoa học', 'Tiểu thuyết', 'Kỹ năng sống']

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-[#fcfdfa] text-slate-900'
      } ${headingFont.variable} ${bodyFont.variable}`}
      style={{ fontFamily: 'var(--font-read-body)' }}
    >
      {/* ============================================================== */}
      {/* TOP HEADER */}
      {/* ============================================================== */}
      <header className="sticky top-0 z-40 border-b border-black/10 dark:border-white/10 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/new-dashboard"
              className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-all flex items-center gap-1.5 text-xs font-semibold"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Về Dashboard</span>
            </Link>

            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h1
                  className="text-lg font-black tracking-tight flex items-center gap-2"
                  style={{ fontFamily: 'var(--font-read-heading)' }}
                >
                  SenRead
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Phòng Đọc & Soạn Thảo Canvas
                  </span>
                </h1>
              </div>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* VIP Status Badge */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
              {isPremiumOrAbove ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-amber-600 dark:text-amber-400">Sen Premium AI</span>
                </>
              ) : isVipLiteOrAbove ? (
                <>
                  <Crown className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">VIP Lite</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-500">Thành viên Miễn phí</span>
                </>
              )}
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-all"
              title="Đổi chế độ sáng / tối"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Nút Đăng Tác Phẩm */}
            <button
              onClick={() => {
                if (!isVipLiteOrAbove) {
                  setUpgradeReason('vip_lite')
                  setShowUpgradeModal(true)
                  return
                }
                setShowPublishModal(true)
              }}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all hover:scale-[1.02]"
            >
              <Plus className="h-4 w-4" />
              <span>Đăng Tác Phẩm</span>
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* MAIN CONTAINER */}
      {/* ============================================================== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Banner Giới thiệu Phòng Đọc Thông Minh */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-cyan-500/10 border border-emerald-500/20">
          <div className="relative z-10 max-w-3xl space-y-2.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Công nghệ đọc sách không dùng DOM - 60FPS mượt mà</span>
            </div>
            <h2
              className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white"
              style={{ fontFamily: 'var(--font-read-heading)' }}
            >
              Không Gian Đọc Sách & Soạn Thảo Bản Thảo AI
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Trải nghiệm đọc và sáng tác hoàn toàn mới: Công nghệ vẽ trực tiếp trên HTML5 Canvas siêu nhẹ, tích hợp trí
              tuệ nhân tạo tự động nhận diện chia chương, chừa vị trí tranh minh họa, dịch thuật song ngữ Anh - Việt và
              đọc truyện bằng giọng Google sinh động.
            </p>
          </div>
        </div>

        {/* Tab Selection: Không gian chung vs Không gian riêng */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/10 dark:border-white/10 pb-4">
          <div className="flex items-center gap-2 p-1 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 w-fit">
            <button
              onClick={() => setActiveTab('public')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'public'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Globe className="h-4 w-4" />
              <span>Không Gian Chung</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                {publicBooks.length}
              </span>
            </button>

            <button
              onClick={() => {
                if (!isVipLiteOrAbove) {
                  setUpgradeReason('vip_lite')
                  setShowUpgradeModal(true)
                  return
                }
                setActiveTab('private')
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                activeTab === 'private'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <User className="h-4 w-4" />
              <span>Tủ Sách Riêng Của Bạn</span>
              {isVipLiteOrAbove ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                  {privateBooks.length}
                </span>
              ) : (
                <Lock className="h-3.5 w-3.5 text-amber-500" />
              )}
            </button>
          </div>

          {/* Search & Genre Filter */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên sách, tác giả..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="py-2 px-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none"
            >
              {GENRES.map((g) => (
                <option key={g} value={g} className="dark:bg-slate-900">
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Thông báo quyền hạn nếu là Không gian chung */}
        {activeTab === 'public' && (
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500 shrink-0" />
              <span>
                Thư viện chung tuyển chọn các tác phẩm kinh điển. Mọi người đều có thể đọc tự do. Chỉ Quản Trị Viên (Admin) mới có quyền đăng tác phẩm tại đây.
              </span>
            </div>
            {isAdmin && (
              <span className="font-bold px-2 py-0.5 rounded-md bg-blue-500 text-white text-[10px] shrink-0">
                Admin: Quyền Đăng Hoạt Động
              </span>
            )}
          </div>
        )}

        {/* DANH SÁCH TÁC PHẨM (CARDS GRID) */}
        {displayBooks.length === 0 ? (
          <div className="p-12 text-center rounded-3xl border border-dashed border-black/15 dark:border-white/15 space-y-3">
            <BookOpen className="h-10 w-10 text-slate-400 mx-auto" />
            <h3 className="font-bold text-base text-slate-700 dark:text-slate-300">Chưa có tác phẩm nào phù hợp</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {activeTab === 'private'
                ? 'Tủ sách riêng của bạn đang trống. Hãy bấm nút "Đăng Tác Phẩm" phía trên để tải lên bản thảo đầu tiên của bạn.'
                : 'Không tìm thấy tác phẩm nào trong không gian chung theo bộ lọc hiện tại.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {displayBooks.map((book) => (
              <div
                key={book.id}
                onClick={() => {
                  setReadingBook(book)
                  setActiveChapterIndex(0)
                  setDisplayedLang(book.language || 'vi')
                }}
                className="group relative cursor-pointer flex flex-col overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900/60 hover:shadow-xl hover:border-emerald-500/40 transition-all duration-300 hover:-translate-y-1"
              >
                {/* Book Cover */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-800">
                  <img
                    src={book.cover_url}
                    alt={book.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Badge Thể Loại */}
                  <span className="absolute top-3 left-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-md border border-white/20">
                    {book.genre}
                  </span>

                  {/* Nút Xóa nếu là sách riêng của user */}
                  {activeTab === 'private' && (
                    <button
                      onClick={(e) => handleDeletePrivateBook(book.id, e)}
                      className="absolute top-3 right-3 p-1.5 rounded-full bg-red-500/80 hover:bg-red-600 text-white transition-all shadow-md"
                      title="Xóa tác phẩm này"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}

                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <p className="text-[11px] text-slate-300 font-medium">{book.author}</p>
                    <h3
                      className="font-black text-sm line-clamp-1 group-hover:text-emerald-400 transition-colors"
                      style={{ fontFamily: 'var(--font-read-heading)' }}
                    >
                      {book.title}
                    </h3>
                  </div>
                </div>

                {/* Book Details */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {book.description || 'Tác phẩm văn học chọn lọc.'}
                  </p>

                  <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                      <Layers className="h-3.5 w-3.5" /> {book.total_chapters || book.chapters?.length || 1} chương
                    </span>

                    <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform font-bold text-slate-700 dark:text-slate-300">
                      Mở đọc <ChevronRight className="h-3.5 w-3.5 text-emerald-500" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* READING WORKSPACE MODAL (IMMERSIVE CANVAS READER & EDITOR) */}
      {/* ============================================================== */}
      {readingBook && activeChapter && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex flex-col animate-in fade-in duration-200">
          {/* Top Reading Header */}
          <div className="h-14 px-4 sm:px-6 border-b border-white/10 bg-slate-950/90 text-white flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  handleStopTts()
                  setReadingBook(null)
                }}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-xs flex items-center gap-1"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Đóng</span>
              </button>

              <div className="max-w-xs sm:max-w-md">
                <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-1">{readingBook.title}</h3>
                <p className="text-[11px] text-slate-400 line-clamp-1">
                  Chương {activeChapter.chapter_number}: {activeChapter.title}
                </p>
              </div>
            </div>

            {/* Translation & Chapter Navigation */}
            <div className="flex items-center gap-2">
              {/* Nút Dịch Thuật AI */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white/10 border border-white/15">
                <button
                  onClick={() => setDisplayedLang('vi')}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
                    displayedLang === 'vi' ? 'bg-emerald-500 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  VI
                </button>
                <button
                  onClick={() => {
                    if (!activeChapter.translation_en) {
                      handleTranslateChapter('en')
                    } else {
                      setDisplayedLang('en')
                    }
                  }}
                  disabled={isTranslating}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    displayedLang === 'en' ? 'bg-emerald-500 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Languages className="h-3 w-3" />
                  <span>{isTranslating ? 'Đang dịch...' : 'EN'}</span>
                </button>
              </div>

              {/* Prev / Next Chapter Buttons */}
              <button
                disabled={activeChapterIndex <= 0}
                onClick={() => {
                  handleStopTts()
                  setActiveChapterIndex((prev) => Math.max(0, prev - 1))
                }}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Chương trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                {activeChapterIndex + 1}/{(readingBook.chapters || []).length}
              </span>

              <button
                disabled={activeChapterIndex >= (readingBook.chapters || []).length - 1}
                onClick={() => {
                  handleStopTts()
                  setActiveChapterIndex((prev) => Math.min((readingBook.chapters || []).length - 1, prev + 1))
                }}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Chương tiếp theo"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Central Canvas Reader Workspace */}
          <div className="flex-1 relative w-full h-full p-2 sm:p-4 overflow-hidden">
            <CanvasStoryEngine
              title={readingBook.title}
              chapterNumber={activeChapter.chapter_number}
              chapterTitle={activeChapter.title}
              content={activeChapterText}
              sentences={activeSentences}
              currentSentenceIndex={currentSentenceIndex}
              isPlayingTts={isPlayingTts}
              illustrations={activeChapter.illustrations}
              onSentenceClick={handleSentenceClick}
              onIllustrationClick={(prompt, idx) => {
                setImageModalData({ prompt, index: idx })
              }}
              onSaveContent={handleSaveCanvasContent}
            />
          </div>

          {/* Bottom Floating Google TTS Player Controls */}
          <div className="h-16 px-4 sm:px-8 border-t border-white/10 bg-slate-950/95 text-white flex items-center justify-between gap-4 shrink-0 shadow-2xl">
            <div className="flex items-center gap-3">
              {/* Play / Pause Button */}
              <button
                onClick={handleToggleTts}
                className="h-10 w-10 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-all hover:scale-105"
                title={isPlayingTts && !isPausedTts ? 'Tạm dừng đọc' : 'Bắt đầu đọc bằng giọng Google'}
              >
                {isPlayingTts && !isPausedTts ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </button>

              {/* Stop Button */}
              {isPlayingTts && (
                <button
                  onClick={handleStopTts}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all"
                  title="Dừng đọc"
                >
                  <Square className="h-4 w-4" />
                </button>
              )}

              {/* Speed Controller */}
              <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1 text-xs font-bold">
                {[0.75, 1.0, 1.25, 1.5].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => handleTtsRateChange(rate)}
                    className={`px-2 py-0.5 rounded-lg transition-all ${
                      ttsRate === rate ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            {/* Speaking Status / Hint */}
            <div className="text-xs text-slate-400 hidden md:flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-emerald-400" />
              <span>
                {isPlayingTts
                  ? `Đang đọc (${displayedLang === 'vi' ? 'Tiếng Việt' : 'Tiếng Anh'}) • Bấm vào câu bất kỳ để nhảy giọng`
                  : 'Sẵn sàng đọc bằng giọng Google tự nhiên • Bấm Play để nghe'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CHÈN / THAY ẢNH MINH HỌA TRÊN CANVAS */}
      {/* ============================================================== */}
      {imageModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-emerald-500" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Chèn Hình Minh Họa</h3>
              </div>
              <button onClick={() => setImageModalData(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300">
              <span className="font-bold">Mô tả cảnh AI đề xuất:</span> {imageModalData.prompt}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Đường dẫn ảnh (URL)</label>
              <input
                type="url"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            {/* Quick Unsplash Presets */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-slate-500">Hoặc chọn nhanh ảnh mẫu:</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop',
                  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=600&auto=format&fit=crop',
                  'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=600&auto=format&fit=crop',
                ].map((presetUrl, idx) => (
                  <img
                    key={idx}
                    src={presetUrl}
                    onClick={() => setImageUrlInput(presetUrl)}
                    className="h-16 w-full object-cover rounded-xl cursor-pointer hover:ring-2 hover:ring-emerald-500 transition-all"
                  />
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setImageModalData(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-black/5 dark:hover:bg-white/5"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveIllustration}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition-all"
              >
                Lưu vào Canvas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ĐĂNG TÁC PHẨM & AI CHIA CHƯƠNG */}
      {/* ============================================================== */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 p-6 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-black/10 dark:border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <Upload className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">Đăng Tác Phẩm & Soạn Bản Thảo</h3>
                  <p className="text-xs text-slate-500">Hỗ trợ tự động phân tích và chia chương thông minh bằng AI</p>
                </div>
              </div>
              <button onClick={() => setShowPublishModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {/* Chọn Không Gian Đăng */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Không gian lưu trữ</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPublishTarget('private')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      publishTarget === 'private'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs mb-1">
                      <User className="h-4 w-4" /> Tủ sách riêng
                    </div>
                    <p className="text-[11px] opacity-80">Chỉ riêng bạn có thể đọc, sửa và xóa tác phẩm này.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isAdmin) {
                        alert('Chỉ tài khoản Quản trị viên (Admin) mới có quyền đăng lên Không gian chung.')
                        return
                      }
                      setPublishTarget('public')
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      publishTarget === 'public'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400'
                    } ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs mb-1">
                      <Globe className="h-4 w-4" /> Không gian chung
                    </div>
                    <p className="text-[11px] opacity-80">
                      {isAdmin ? 'Đăng công khai cho cộng đồng học viên cùng đọc.' : 'Yêu cầu quyền Quản trị viên (Admin).'}
                    </p>
                  </button>
                </div>
              </div>

              {/* Tên Sách & Tác Giả */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tên tác phẩm *</label>
                  <input
                    type="text"
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    placeholder="Ví dụ: Rừng Xà Nu..."
                    className="w-full p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tên tác giả</label>
                  <input
                    type="text"
                    value={bookAuthor}
                    onChange={(e) => setBookAuthor(e.target.value)}
                    placeholder="Ví dụ: Nguyễn Trung Thành..."
                    className="w-full p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              {/* Thể loại & Link Ảnh bìa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Thể loại</label>
                  <select
                    value={bookGenre}
                    onChange={(e) => setBookGenre(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none"
                  >
                    {GENRES.filter((g) => g !== 'Tất cả').map((g) => (
                      <option key={g} value={g} className="dark:bg-slate-900">
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Ảnh bìa (URL)</label>
                  <input
                    type="url"
                    value={bookCoverUrl}
                    onChange={(e) => setBookCoverUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              {/* Bản thảo nội dung */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nội dung bản thảo thô</label>

                  {/* Kích hoạt AI chia chương */}
                  <button
                    type="button"
                    onClick={handleRunAiSegmentation}
                    disabled={isAiProcessing}
                    className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold flex items-center gap-1 shadow-sm hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>{isAiProcessing ? 'AI đang phân tích...' : 'AI tự chia chương & chèn minh họa'}</span>
                  </button>
                </div>

                <textarea
                  value={rawManuscript}
                  onChange={(e) => setRawManuscript(e.target.value)}
                  rows={7}
                  placeholder="Dán toàn bộ nội dung bản thảo hoặc sách truyện vào đây... Nếu bấm 'AI tự chia chương', AI sẽ tự động bóc tách thành các hồi và chừa các vị trí chèn hình minh họa [ILLUSTRATION: ...]."
                  className="w-full p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none font-mono"
                />
              </div>

              {/* Preview các chương AI đã chia */}
              {aiGeneratedChapters.length > 0 && (
                <div className="space-y-2 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> AI đã chia thành {aiGeneratedChapters.length} chương thành công:
                  </p>
                  <div className="divide-y divide-emerald-500/15 max-h-36 overflow-y-auto pr-1">
                    {aiGeneratedChapters.map((c, i) => (
                      <div key={i} className="py-1.5 text-xs text-slate-700 dark:text-slate-200">
                        <span className="font-bold">Chương {c.chapter_number}:</span> {c.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-black/10 dark:border-white/10 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-black/5 dark:hover:bg-white/5"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handlePublishBook}
                className="px-6 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition-all"
              >
                Hoàn tất & Đăng tác phẩm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: NÂNG CẤP GÓI (UPGRADE GATE) */}
      {/* ============================================================== */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 p-6 text-center space-y-4 shadow-2xl">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center">
              <Crown className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                {upgradeReason === 'vip_lite' ? 'Yêu cầu gói VIP Lite trở lên' : 'Yêu cầu gói Sen Premium AI'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {upgradeReason === 'vip_lite'
                  ? 'Tính năng Tủ Sách Riêng và Soạn Thảo Canvas dành riêng cho học viên đăng ký từ gói VIP Lite trở lên.'
                  : 'Tính năng AI Tự động nhận diện chia chương, chừa vị trí tranh minh họa và Dịch thuật song ngữ yêu cầu gói Premium hoặc SenAI Plus trở lên.'}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-xs text-left space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" /> Không gian lưu trữ bản thảo riêng tư không giới hạn
              </div>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" /> Công nghệ đọc Canvas 60FPS không giật lag
              </div>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5" /> Nghe đọc bằng giọng Google Tiếng Việt & Tiếng Anh
              </div>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-black/5 dark:hover:bg-white/5"
              >
                Để sau
              </button>
              <Link
                href="/new-pay?tab=vip"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 hover:scale-105 transition-all"
              >
                Nâng cấp ngay
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
