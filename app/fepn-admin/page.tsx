'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import { getModernThemeVars } from '@/app/components/modernTheme'
import AdminSecurityVault, { FileEncryptionCenter } from '@/app/components/AdminSecurityVaultModal'
import {
  BookOpen,
  FolderOpen,
  GraduationCap,
  Layers,
  Plus,
  Trash2,
  Edit3,
  Search,
  Filter,
  Shield,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Lock,
  Unlock,
  Users,
  FileLock2,
  Download,
  Upload,
  ArrowRight,
  LogOut,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Video,
  Award,
  Calendar,
  Clock,
  MapPin,
  Database,
  Eye,
  RefreshCw,
  Gift,
  Sparkles,
  Percent,
  Dices,
  QrCode,
  Tag,
  Check,
  Copy,
  AlertTriangle,
  Camera,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-body' })

export interface FepnSubject {
  id: string
  code: string
  name: string
  credits: number
  semester: string
  description?: string
  icon?: string
  created_at?: string
  total_materials?: number
}

export interface FepnMaterial {
  id: string
  subject_id: string
  title: string
  category: 'slide' | 'exercise' | 'video' | 'exam'
  file_url: string
  file_type?: string
  created_at?: string
}

export interface FepnUser {
  id: string
  email?: string
  full_name?: string
  role?: string
  created_at?: string
  admin_key_issued_at?: string
  [key: string]: any
}

export interface FepnGiftEvent {
  id: string
  title: string
  description: string
  location?: string
  time?: string
  how_to_receive?: string
  event_type: 'wheel' | 'code'
  is_active: boolean
  default_spins: number
  banner_url?: string
  updated_at?: string
}

export interface FepnGiftItem {
  id: string
  event_id?: string
  name: string
  image_url: string
  total_quantity: number
  remaining_quantity: number
  win_rate: number
  color: string
  is_consolation: boolean
  order_index?: number
}

export interface FepnGiftCode {
  id: string
  event_id?: string
  code: string
  type: 'spin' | 'gift'
  spin_count: number
  gift_item_id?: string
  max_uses: number
  used_count: number
  is_active: boolean
  created_at?: string
}

export interface FepnGiftClaim {
  id: string
  event_id?: string
  user_id?: string
  user_mssv: string
  user_name: string
  gift_id: string
  gift_name: string
  claim_code: string
  claimed_at: string
  status: 'pending' | 'delivered'
  delivered_at?: string
  delivered_by?: string
}

export default function FepnAdminDashboardPage() {
  const router = useRouter()
  const themeVars = useMemo(() => getModernThemeVars('indigo', false), [])

  // Auth & Admin Verification
  const [authLoading, setAuthLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthorized' | 'unauthenticated'>('loading')

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'subjects' | 'materials' | 'recap' | 'gifts' | 'vault'>('overview')

  // Deep Security Vault States
  const [isDeepVaultUnlocked, setIsDeepVaultUnlocked] = useState(false)
  const [activePayloadToken, setActivePayloadToken] = useState<string | null>(null)
  const [activeKeyId, setActiveKeyId] = useState<string>('')

  // Data States
  const [subjects, setSubjects] = useState<FepnSubject[]>([])
  const [materials, setMaterials] = useState<FepnMaterial[]>([])
  const [recapCount, setRecapCount] = useState(0)
  const [userList, setUserList] = useState<FepnUser[]>([])
  const [loadingData, setLoadingData] = useState(false)

  // Subject Modal State
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null)
  const [subCode, setSubCode] = useState('')
  const [subName, setSubName] = useState('')
  const [subCredits, setSubCredits] = useState(3)
  const [subSemester, setSubSemester] = useState('Kỳ 1')
  const [subDescription, setSubDescription] = useState('')
  const [savingSubject, setSavingSubject] = useState(false)

  // Material Modal State
  const [showMaterialModal, setShowMaterialModal] = useState(false)
  const [matSubjectId, setMatSubjectId] = useState('')
  const [matTitle, setMatTitle] = useState('')
  const [matCategory, setMatCategory] = useState<'slide' | 'exercise' | 'video' | 'exam'>('slide')
  const [matFileUrl, setMatFileUrl] = useState('')
  const [savingMaterial, setSavingMaterial] = useState(false)

  // Filters & Search
  const [searchSubject, setSearchSubject] = useState('')
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState('all')
  const [searchMaterial, setSearchMaterial] = useState('')
  const [selectedMatSubjectFilter, setSelectedMatSubjectFilter] = useState('all')
  const [selectedMatCategoryFilter, setSelectedMatCategoryFilter] = useState('all')

  // ========================================================
  // GIFT MANAGEMENT STATES & DATA
  // ========================================================
  const DEFAULT_GIFT_EVENT: FepnGiftEvent = useMemo(() => ({
    id: 'fepn-active-event',
    title: 'Vòng Quay May Mắn - Khoa Vật lý kỹ thuật & CNNN',
    location: '',
    time: '',
    how_to_receive: '',
    description: '',
    event_type: 'wheel',
    is_active: false,
    default_spins: 0,
  }), [])

  const DEFAULT_GIFT_ITEMS: FepnGiftItem[] = useMemo(() => [
    {
      id: 'gift-1',
      name: 'Áo Phông FEPN UET K69',
      image_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&auto=format&fit=crop&q=60',
      total_quantity: 25,
      remaining_quantity: 25,
      win_rate: 10,
      color: '#f43f5e',
      is_consolation: false,
    },
    {
      id: 'gift-2',
      name: 'Bình Giữ Nhiệt Nano Metallic',
      image_url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop&q=60',
      total_quantity: 30,
      remaining_quantity: 30,
      win_rate: 15,
      color: '#0284c7',
      is_consolation: false,
    },
    {
      id: 'gift-3',
      name: 'Sổ Tay & Bút Ký VLKT UET',
      image_url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&auto=format&fit=crop&q=60',
      total_quantity: 50,
      remaining_quantity: 50,
      win_rate: 20,
      color: '#10b981',
      is_consolation: false,
    },
    {
      id: 'gift-4',
      name: 'Móc Khóa Công Nghệ Nano',
      image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60',
      total_quantity: 80,
      remaining_quantity: 80,
      win_rate: 25,
      color: '#f59e0b',
      is_consolation: false,
    },
    {
      id: 'gift-5',
      name: 'Bộ Sticker Khoa Học FEPN',
      image_url: 'https://images.unsplash.com/photo-1572375992501-4b0892d50c69?w=500&auto=format&fit=crop&q=60',
      total_quantity: 100,
      remaining_quantity: 100,
      win_rate: 20,
      color: '#8b5cf6',
      is_consolation: false,
    },
    {
      id: 'gift-6',
      name: 'Chúc Bạn May Mắn Lần Sau',
      image_url: '',
      total_quantity: 9999,
      remaining_quantity: 9999,
      win_rate: 10,
      color: '#64748b',
      is_consolation: true,
    },
  ], [])

  const [giftEvent, setGiftEvent] = useState<FepnGiftEvent>(DEFAULT_GIFT_EVENT)
  const [giftItems, setGiftItems] = useState<FepnGiftItem[]>(DEFAULT_GIFT_ITEMS)
  const [giftCodes, setGiftCodes] = useState<FepnGiftCode[]>([])
  const [giftClaims, setGiftClaims] = useState<FepnGiftClaim[]>([])
  const [isSavingGiftEvent, setIsSavingGiftEvent] = useState(false)
  const [showGiftItemModal, setShowGiftItemModal] = useState(false)
  const [editingGiftItemId, setEditingGiftItemId] = useState<string | null>(null)
  const [itemFormName, setItemFormName] = useState('')
  const [itemFormImage, setItemFormImage] = useState('')
  const [itemFormTotal, setItemFormTotal] = useState(20)
  const [itemFormRemaining, setItemFormRemaining] = useState(20)
  const [itemFormWinRate, setItemFormWinRate] = useState(15)
  const [itemFormColor, setItemFormColor] = useState('#0284c7')
  const [itemFormConsolation, setItemFormConsolation] = useState(false)
  const [savingGiftItem, setSavingGiftItem] = useState(false)

  // Code Gen state
  const [genCodePrefix, setGenCodePrefix] = useState('FEPN-SPIN')
  const [genCodeCount, setGenCodeCount] = useState(5)
  const [genCodeType, setGenCodeType] = useState<'spin' | 'gift'>('spin')
  const [genCodeSpinCount, setGenCodeSpinCount] = useState(1)
  const [genCodeGiftId, setGenCodeGiftId] = useState('')
  const [genCodeMaxUses, setGenCodeMaxUses] = useState(1)
  const [generatingCodes, setGeneratingCodes] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [claimFilterStatus, setClaimFilterStatus] = useState<'all' | 'pending' | 'delivered'>('all')

  // Direct Claim Verification & Search states
  const [verifyCodeInput, setVerifyCodeInput] = useState('')
  const [verifyingClaim, setVerifyingClaim] = useState(false)
  const [foundVerifyClaim, setFoundVerifyClaim] = useState<FepnGiftClaim | null>(null)
  const [verifyStatusMessage, setVerifyStatusMessage] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null)
  const [manualGiftId, setManualGiftId] = useState('')
  const [manualStudentMssv, setManualStudentMssv] = useState('')
  const [manualStudentName, setManualStudentName] = useState('')
  const [claimSearchKeyword, setClaimSearchKeyword] = useState('')
  const [showScannerModal, setShowScannerModal] = useState(false)

  // ========================================================
  // 1. AUTHENTICATION & ROLE CHECK
  // ========================================================
  const checkFepnAdmin = async () => {
    setAuthLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      let currentUser = userData?.user ?? null
      if (!currentUser) {
        const { data: sessionData } = await supabase.auth.getSession()
        currentUser = sessionData?.session?.user ?? null
      }

      if (!currentUser) {
        setAuthStatus('unauthenticated')
        setAuthLoading(false)
        return
      }

      setUser(currentUser)

      // Query user role in profiles (only select 'role' to avoid schema error on non-existent columns)
      let role = ''
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUser.id)
          .maybeSingle()

        if (!error && profile?.role) {
          role = profile.role
        }
      } catch (err) {
        console.warn('Could not read role from profiles:', err)
      }

      const userEmail = currentUser.email?.toLowerCase() || ''
      const userRoleLower = role.toLowerCase().trim()
      const metaRole = (currentUser.user_metadata?.role || currentUser.app_metadata?.role || '').toLowerCase().trim()

      const isUserAdmin =
        userRoleLower === 'admin' ||
        userRoleLower === 'collab' ||
        metaRole === 'admin' ||
        metaRole === 'collab' ||
        userEmail === 'hoangbinhminh2508@gmail.com'

      // Auto-heal admin role in profiles for the creator/owner or meta-admin if missing
      if (isUserAdmin && userRoleLower !== 'admin' && userRoleLower !== 'collab') {
        try {
          await supabase.from('profiles').upsert({ id: currentUser.id, role: 'admin' }, { onConflict: 'id' })
        } catch {}
      }

      setIsAdmin(isUserAdmin)
      if (isUserAdmin) {
        setAuthStatus('authenticated')
      } else {
        setAuthStatus('unauthorized')
      }
    } catch (err) {
      console.error('Error checking FEPN admin:', err)
      setAuthStatus('unauthenticated')
    } finally {
      setAuthLoading(false)
    }
  }

  useEffect(() => {
    checkFepnAdmin()
  }, [])

  // ========================================================
  // 2. FETCH FEPN DATA
  // ========================================================
  const fetchAllData = async () => {
    setLoadingData(true)
    try {
      // 1. Subjects
      const { data: subData } = await supabase
        .from('fepn_subjects')
        .select('*')
        .order('created_at', { ascending: false })
      setSubjects(subData || [])

      // 2. Materials
      const { data: matData } = await supabase
        .from('fepn_materials')
        .select('*')
        .order('created_at', { ascending: false })
      setMaterials(matData || [])

      // 3. Recap posts count
      const { count: recapC } = await supabase
        .from('fepn_recap_posts')
        .select('id', { count: 'exact', head: true })
      setRecapCount(recapC || 0)

      // 4. Profiles (for Deep Vault User Role Management)
      const { data: usersData } = await supabase
        .from('profiles')
        .select('*')
        .limit(100)
      setUserList(usersData || [])

      // 5. Gift Event Data
      await fetchGiftData()
    } catch (err) {
      console.error('Error fetching FEPN admin data:', err)
    } finally {
      setLoadingData(false)
    }
  }

  // ========================================================
  // GIFT DATA FETCHING & ACTIONS
  // ========================================================
  const fetchGiftData = async () => {
    try {
      // 1. Event settings
      const { data: eventData } = await supabase
        .from('fepn_gift_events')
        .select('*')
        .eq('id', 'fepn-active-event')
        .maybeSingle()
      if (eventData) {
        setGiftEvent(eventData)
        localStorage.setItem('fepn_gift_event_config', JSON.stringify(eventData))
        localStorage.setItem('fepn_gift_event_active', eventData.is_active ? 'true' : 'false')
      } else {
        const cached = localStorage.getItem('fepn_gift_event_config')
        if (cached) {
          try {
            setGiftEvent(JSON.parse(cached))
          } catch (e) {}
        }
      }

      // 2. Gift Items
      const { data: itemsData } = await supabase
        .from('fepn_gift_items')
        .select('*')
        .order('order_index', { ascending: true })
      if (itemsData && itemsData.length > 0) {
        setGiftItems(itemsData)
        localStorage.setItem('fepn_gift_items_data', JSON.stringify(itemsData))
      } else {
        const cachedItems = localStorage.getItem('fepn_gift_items_data')
        if (cachedItems) {
          try {
            const parsed = JSON.parse(cachedItems)
            if (Array.isArray(parsed) && parsed.length > 0) setGiftItems(parsed)
          } catch (e) {}
        }
      }

      // 3. Gift Codes
      const { data: codesData } = await supabase
        .from('fepn_gift_codes')
        .select('*')
        .order('created_at', { ascending: false })
      if (codesData) {
        setGiftCodes(codesData)
        localStorage.setItem('fepn_gift_codes_data', JSON.stringify(codesData))
      } else {
        const cachedCodes = localStorage.getItem('fepn_gift_codes_data')
        if (cachedCodes) {
          try {
            const parsed = JSON.parse(cachedCodes)
            if (Array.isArray(parsed)) setGiftCodes(parsed)
          } catch (e) {}
        }
      }

      // 4. Gift Claims
      const { data: claimsData } = await supabase
        .from('fepn_gift_claims')
        .select('*')
        .order('claimed_at', { ascending: false })
      if (claimsData) {
        setGiftClaims(claimsData)
        localStorage.setItem('fepn_gift_claims_data', JSON.stringify(claimsData))
      } else {
        const cachedClaims = localStorage.getItem('fepn_gift_claims_data')
        if (cachedClaims) {
          try {
            const parsed = JSON.parse(cachedClaims)
            if (Array.isArray(parsed)) setGiftClaims(parsed)
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn('Notice loading gift data, using cached fallback:', err)
      try {
        const cachedEvent = localStorage.getItem('fepn_gift_event_config')
        if (cachedEvent) setGiftEvent(JSON.parse(cachedEvent))
        const cachedItems = localStorage.getItem('fepn_gift_items_data')
        if (cachedItems) setGiftItems(JSON.parse(cachedItems))
        const cachedCodes = localStorage.getItem('fepn_gift_codes_data')
        if (cachedCodes) setGiftCodes(JSON.parse(cachedCodes))
        const cachedClaims = localStorage.getItem('fepn_gift_claims_data')
        if (cachedClaims) setGiftClaims(JSON.parse(cachedClaims))
      } catch (e) {}
    }
  }

  const handleSaveGiftEvent = async () => {
    setIsSavingGiftEvent(true)
    try {
      const payload = {
        ...giftEvent,
        updated_at: new Date().toISOString(),
      }
      localStorage.setItem('fepn_gift_event_config', JSON.stringify(payload))
      localStorage.setItem('fepn_gift_event_active', payload.is_active ? 'true' : 'false')

      try {
        await supabase.from('fepn_gift_events').upsert(payload)
      } catch (e) {
        console.warn('Supabase upsert gift event notice:', e)
      }

      alert('Đã lưu cấu hình sự kiện tặng quà thành công!')
    } catch (err: any) {
      alert('Lỗi lưu cấu hình: ' + err.message)
    } finally {
      setIsSavingGiftEvent(false)
    }
  }

  const handleToggleGiftEventActive = async () => {
    const nextStatus = !giftEvent.is_active
    const updated = { ...giftEvent, is_active: nextStatus, updated_at: new Date().toISOString() }
    setGiftEvent(updated)
    localStorage.setItem('fepn_gift_event_config', JSON.stringify(updated))
    localStorage.setItem('fepn_gift_event_active', nextStatus ? 'true' : 'false')
    try {
      await supabase.from('fepn_gift_events').upsert(updated)
    } catch (e) {}
  }

  const handleOpenAddGiftItem = () => {
    setEditingGiftItemId(null)
    setItemFormName('')
    setItemFormImage('')
    setItemFormTotal(20)
    setItemFormRemaining(20)
    setItemFormWinRate(15)
    setItemFormColor('#0284c7')
    setItemFormConsolation(false)
    setShowGiftItemModal(true)
  }

  const handleOpenEditGiftItem = (item: FepnGiftItem) => {
    setEditingGiftItemId(item.id)
    setItemFormName(item.name)
    setItemFormImage(item.image_url)
    setItemFormTotal(item.total_quantity)
    setItemFormRemaining(item.remaining_quantity)
    setItemFormWinRate(item.win_rate)
    setItemFormColor(item.color || '#0284c7')
    setItemFormConsolation(item.is_consolation || false)
    setShowGiftItemModal(true)
  }

  const handleSaveGiftItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemFormName.trim()) {
      alert('Vui lòng nhập tên món quà!')
      return
    }
    setSavingGiftItem(true)
    try {
      const newItem: FepnGiftItem = {
        id: editingGiftItemId || `gift-${Date.now()}`,
        name: itemFormName.trim(),
        image_url: itemFormImage.trim(),
        total_quantity: Number(itemFormTotal) || 0,
        remaining_quantity: Number(itemFormRemaining) || 0,
        win_rate: Number(itemFormWinRate) || 0,
        color: itemFormColor || '#0284c7',
        is_consolation: itemFormConsolation,
        order_index: editingGiftItemId ? undefined : giftItems.length + 1,
      }

      let updatedList: FepnGiftItem[] = []
      if (editingGiftItemId) {
        updatedList = giftItems.map((it) => (it.id === editingGiftItemId ? newItem : it))
      } else {
        updatedList = [...giftItems, newItem]
      }
      setGiftItems(updatedList)
      localStorage.setItem('fepn_gift_items_data', JSON.stringify(updatedList))

      try {
        await supabase.from('fepn_gift_items').upsert(newItem)
      } catch (e) {}

      setShowGiftItemModal(false)
    } catch (err: any) {
      alert('Lỗi lưu món quà: ' + err.message)
    } finally {
      setSavingGiftItem(false)
    }
  }

  const handleDeleteGiftItem = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc muốn xóa món quà "${name}" khỏi danh sách?`)) return
    const updatedList = giftItems.filter((it) => it.id !== id)
    setGiftItems(updatedList)
    localStorage.setItem('fepn_gift_items_data', JSON.stringify(updatedList))
    try {
      await supabase.from('fepn_gift_items').delete().eq('id', id)
    } catch (e) {}
  }

  const handleGenerateCodes = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneratingCodes(true)
    try {
      const count = Math.max(1, Math.min(50, Number(genCodeCount) || 1))
      const prefix = (genCodePrefix.trim() || 'FEPN-SPIN').toUpperCase()
      const newCodes: FepnGiftCode[] = []

      for (let i = 0; i < count; i++) {
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
        const codeStr = `${prefix}-${rand}`
        newCodes.push({
          id: `code-${Date.now()}-${i}`,
          code: codeStr,
          type: genCodeType,
          spin_count: genCodeType === 'spin' ? Number(genCodeSpinCount) || 1 : 0,
          gift_item_id: genCodeType === 'gift' ? genCodeGiftId : undefined,
          max_uses: Number(genCodeMaxUses) || 1,
          used_count: 0,
          is_active: true,
          created_at: new Date().toISOString(),
        })
      }

      const updated = [...newCodes, ...giftCodes]
      setGiftCodes(updated)
      localStorage.setItem('fepn_gift_codes_data', JSON.stringify(updated))

      try {
        await supabase.from('fepn_gift_codes').insert(newCodes)
      } catch (e) {}

      alert(`Đã tạo thành công ${count} mã quà tặng / lượt quay mới!`)
    } catch (err: any) {
      alert('Lỗi sinh mã: ' + err.message)
    } finally {
      setGeneratingCodes(false)
    }
  }

  const handleDeleteCode = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xoá mã này?')) return
    const updated = giftCodes.filter((c) => c.id !== id)
    setGiftCodes(updated)
    localStorage.setItem('fepn_gift_codes_data', JSON.stringify(updated))
    try {
      await supabase.from('fepn_gift_codes').delete().eq('id', id)
    } catch (e) {}
  }

  const handleConfirmDelivery = async (targetClaim: FepnGiftClaim) => {
    try {
      // 1. Decrement Gift Item quantity
      const targetGift = giftItems.find(
        (g) => g.id === targetClaim.gift_id || g.name.trim().toLowerCase() === targetClaim.gift_name.trim().toLowerCase()
      )

      if (targetGift) {
        const nextRemaining = Math.max(0, targetGift.remaining_quantity - 1)
        const updatedGifts = giftItems.map((g) => (g.id === targetGift.id ? { ...g, remaining_quantity: nextRemaining } : g))
        setGiftItems(updatedGifts)
        localStorage.setItem('fepn_gift_items_data', JSON.stringify(updatedGifts))

        try {
          await supabase.from('fepn_gift_items').update({ remaining_quantity: nextRemaining }).eq('id', targetGift.id)
        } catch (e) {
          console.warn('Supabase gift item qty update error:', e)
        }
      }

      // 2. Mark Claim as delivered
      const deliveredAt = new Date().toISOString()
      const deliveredBy = user?.email || 'Admin FEPN'

      const updatedClaims = giftClaims.map((c) => {
        if (c.id === targetClaim.id || c.claim_code === targetClaim.claim_code) {
          return {
            ...c,
            status: 'delivered' as const,
            delivered_at: deliveredAt,
            delivered_by: deliveredBy,
          }
        }
        return c
      })
      setGiftClaims(updatedClaims)
      localStorage.setItem('fepn_gift_claims_data', JSON.stringify(updatedClaims))

      try {
        await supabase
          .from('fepn_gift_claims')
          .update({
            status: 'delivered',
            delivered_at: deliveredAt,
            delivered_by: deliveredBy,
          })
          .eq('id', targetClaim.id)
      } catch (e) {
        try {
          await supabase
            .from('fepn_gift_claims')
            .update({
              status: 'delivered',
              delivered_at: deliveredAt,
              delivered_by: deliveredBy,
            })
            .eq('claim_code', targetClaim.claim_code)
        } catch {}
      }

      setFoundVerifyClaim({
        ...targetClaim,
        status: 'delivered',
        delivered_at: deliveredAt,
        delivered_by: deliveredBy,
      })

      setVerifyStatusMessage({
        type: 'success',
        message: `✅ Xác nhận thành công! Đã trao phần quà "${targetClaim.gift_name}" cho sinh viên ${targetClaim.user_name} (${targetClaim.user_mssv}) và giảm 1 suất quà trên hệ thống.`,
      })
    } catch (err: any) {
      alert('Lỗi khi xác nhận trao quà: ' + err.message)
    }
  }

  const handleMarkClaimDelivered = async (claimId: string) => {
    const target = giftClaims.find((c) => c.id === claimId)
    if (target) {
      await handleConfirmDelivery(target)
    }
  }

  const handleCheckClaimCode = async (overrideCode?: string | React.FormEvent) => {
    let raw = ''
    if (typeof overrideCode === 'string') {
      raw = overrideCode.trim().toUpperCase()
    } else {
      if (overrideCode && 'preventDefault' in overrideCode) overrideCode.preventDefault()
      raw = verifyCodeInput.trim().toUpperCase()
    }
    if (!raw) return

    setVerifyCodeInput(raw)
    setVerifyingClaim(true)
    setVerifyStatusMessage(null)
    setFoundVerifyClaim(null)

    try {
      // 1. Search in local state
      let match = giftClaims.find((c) => c.claim_code.toUpperCase() === raw)

      // 2. If not found in state, try querying Supabase
      if (!match) {
        try {
          const { data: dbClaim } = await supabase
            .from('fepn_gift_claims')
            .select('*')
            .ilike('claim_code', raw)
            .maybeSingle()
          if (dbClaim) {
            match = dbClaim
            setGiftClaims((prev) => [dbClaim, ...prev.filter((p) => p.id !== dbClaim.id)])
          }
        } catch {}
      }

      if (match) {
        setFoundVerifyClaim(match)
        if (match.status === 'delivered') {
          setVerifyStatusMessage({
            type: 'warning',
            message: `⚠️ Mã đối soát này ĐÃ ĐƯỢC TRAO QUÀ trước đó vào lúc ${new Date(match.delivered_at || match.claimed_at).toLocaleString('vi-VN')} bởi ${match.delivered_by || 'Ban Tổ Chức'}!`,
          })
        } else {
          setVerifyStatusMessage({
            type: 'info',
            message: `Hợp lệ! Sinh viên: ${match.user_name} (${match.user_mssv}) - Trúng quà: "${match.gift_name}". Hãy bấm nút xác nhận trao quà bên dưới.`,
          })
        }
      } else {
        // Parse MSSV if in format CLAIM-[MSSV]-[RANDOM]
        const parts = raw.split('-')
        let detectedMssv = ''
        if (parts.length >= 2 && parts[0] === 'CLAIM') {
          detectedMssv = parts[1]
        }
        setManualStudentMssv(detectedMssv || '')
        setManualStudentName(detectedMssv ? `Sinh viên ${detectedMssv}` : 'Sinh viên VNU')
        const firstPhysicalGift = giftItems.find((g) => !g.is_consolation)
        if (firstPhysicalGift) setManualGiftId(firstPhysicalGift.id)

        setVerifyStatusMessage({
          type: 'warning',
          message: `Mã "${raw}" chưa có trong danh sách đồng bộ tự động. Bạn có thể kiểm tra màn hình của sinh viên và xác nhận trao quà thủ công ngay bên dưới để trừ kho!`,
        })
      }
    } catch (err: any) {
      setVerifyStatusMessage({
        type: 'error',
        message: 'Lỗi kiểm tra mã: ' + err.message,
      })
    } finally {
      setVerifyingClaim(false)
    }
  }

  const handleQrScanSuccess = (scannedCode: string) => {
    setShowScannerModal(false)
    const code = scannedCode.trim().toUpperCase()
    setVerifyCodeInput(code)
    handleCheckClaimCode(code)
  }

  const handleManualConfirmDelivery = async () => {
    const raw = verifyCodeInput.trim().toUpperCase()
    if (!raw) return
    const gift = giftItems.find((g) => g.id === manualGiftId)
    if (!gift) {
      alert('Vui lòng chọn món quà trao cho sinh viên!')
      return
    }

    try {
      // 1. Decrement Gift Item quantity
      const nextRemaining = Math.max(0, gift.remaining_quantity - 1)
      const updatedGifts = giftItems.map((g) => (g.id === gift.id ? { ...g, remaining_quantity: nextRemaining } : g))
      setGiftItems(updatedGifts)
      localStorage.setItem('fepn_gift_items_data', JSON.stringify(updatedGifts))

      try {
        await supabase.from('fepn_gift_items').update({ remaining_quantity: nextRemaining }).eq('id', gift.id)
      } catch {}

      // 2. Create Claim record
      const deliveredAt = new Date().toISOString()
      const deliveredBy = user?.email || 'Admin FEPN'
      const newClaim: FepnGiftClaim = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `claim-${Date.now()}`,
        event_id: giftEvent.id,
        user_mssv: manualStudentMssv.trim().toUpperCase() || 'VNU',
        user_name: manualStudentName.trim() || 'Sinh viên VNU',
        gift_id: gift.id,
        gift_name: gift.name,
        claim_code: raw,
        claimed_at: deliveredAt,
        status: 'delivered',
        delivered_at: deliveredAt,
        delivered_by: deliveredBy,
      }

      const updatedClaims = [newClaim, ...giftClaims]
      setGiftClaims(updatedClaims)
      localStorage.setItem('fepn_gift_claims_data', JSON.stringify(updatedClaims))

      try {
        await supabase.from('fepn_gift_claims').insert({
          event_id: giftEvent.id,
          user_mssv: newClaim.user_mssv,
          user_name: newClaim.user_name,
          gift_id: gift.id,
          gift_name: gift.name,
          claim_code: raw,
          claimed_at: deliveredAt,
          status: 'delivered',
          delivered_at: deliveredAt,
          delivered_by: deliveredBy,
        })
      } catch {}

      setFoundVerifyClaim(newClaim)
      setVerifyStatusMessage({
        type: 'success',
        message: `✅ Xác nhận thành công! Đã tạo phiếu đối soát và trao quà "${gift.name}" cho sinh viên ${newClaim.user_name} (${newClaim.user_mssv}). Số lượng quà trên trang đã được trừ 1 suất!`,
      })
    } catch (err: any) {
      alert('Lỗi xác nhận: ' + err.message)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      fetchAllData()
    }
  }, [isAdmin])

  // Deep Vault Unlock Handler
  const handleVaultUnlockSuccess = (payloadToken: string, keyId: string) => {
    setIsDeepVaultUnlocked(true)
    setActivePayloadToken(payloadToken)
    setActiveKeyId(keyId)
  }

  const handleVaultLock = () => {
    setIsDeepVaultUnlocked(false)
    setActivePayloadToken(null)
    setActiveKeyId('')
  }

  // ========================================================
  // 3. SUBJECT ACTIONS
  // ========================================================
  const handleOpenNewSubject = () => {
    setEditingSubjectId(null)
    setSubCode('')
    setSubName('')
    setSubCredits(3)
    setSubSemester('Kỳ 1')
    setSubDescription('')
    setShowSubjectModal(true)
  }

  const handleOpenEditSubject = (sub: FepnSubject) => {
    setEditingSubjectId(sub.id)
    setSubCode(sub.code)
    setSubName(sub.name)
    setSubCredits(sub.credits)
    setSubSemester(sub.semester)
    setSubDescription(sub.description || '')
    setShowSubjectModal(true)
  }

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subCode.trim() || !subName.trim()) {
      alert('Vui lòng nhập mã môn và tên môn học!')
      return
    }

    setSavingSubject(true)
    try {
      const payload = {
        code: subCode.trim().toUpperCase(),
        name: subName.trim(),
        credits: Number(subCredits) || 3,
        semester: subSemester,
        description: subDescription.trim(),
        updated_at: new Date().toISOString(),
      }

      if (editingSubjectId) {
        const { error } = await supabase
          .from('fepn_subjects')
          .update(payload)
          .eq('id', editingSubjectId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('fepn_subjects')
          .insert(payload)
        if (error) throw error
      }

      setShowSubjectModal(false)
      fetchAllData()
    } catch (err: any) {
      alert('Lỗi lưu môn học: ' + err.message)
    } finally {
      setSavingSubject(false)
    }
  }

  const handleDeleteSubject = async (id: string, name: string) => {
    if (!confirm(`Xác nhận xóa môn học "${name}"? Thao tác này sẽ xóa toàn bộ học liệu liên quan!`)) return
    try {
      const { error } = await supabase.from('fepn_subjects').delete().eq('id', id)
      if (error) throw error
      fetchAllData()
    } catch (err: any) {
      alert('Lỗi xóa môn học: ' + err.message)
    }
  }

  // ========================================================
  // 4. MATERIAL ACTIONS
  // ========================================================
  const handleOpenNewMaterial = () => {
    setMatSubjectId(subjects[0]?.id || '')
    setMatTitle('')
    setMatCategory('slide')
    setMatFileUrl('')
    setShowMaterialModal(true)
  }

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!matSubjectId || !matTitle.trim() || !matFileUrl.trim()) {
      alert('Vui lòng điền đầy đủ môn học, tiêu đề và link tài liệu!')
      return
    }

    setSavingMaterial(true)
    try {
      const { error } = await supabase.from('fepn_materials').insert({
        subject_id: matSubjectId,
        title: matTitle.trim(),
        category: matCategory,
        file_url: matFileUrl.trim(),
        created_at: new Date().toISOString(),
      })
      if (error) throw error

      setShowMaterialModal(false)
      fetchAllData()
    } catch (err: any) {
      alert('Lỗi lưu học liệu: ' + err.message)
    } finally {
      setSavingMaterial(false)
    }
  }

  const handleDeleteMaterial = async (id: string, title: string) => {
    if (!confirm(`Xác nhận xóa học liệu "${title}"?`)) return
    try {
      const { error } = await supabase.from('fepn_materials').delete().eq('id', id)
      if (error) throw error
      fetchAllData()
    } catch (err: any) {
      alert('Lỗi xóa tài liệu: ' + err.message)
    }
  }

  // User Role Change (Deep Vault Only)
  const handleChangeUserRole = async (targetUserId: string, newRole: string) => {
    if (!isDeepVaultUnlocked) {
      alert('Vui lòng mở khóa Deep Security Vault bằng file .key để thực hiện thay đổi quyền!')
      return
    }
    if (!confirm(`Xác nhận chuyển quyền người dùng sang "${newRole}"?`)) return

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', targetUserId)
      if (error) throw error
      alert('Cập nhật quyền thành công!')
      fetchAllData()
    } catch (err: any) {
      alert('Lỗi cập nhật quyền: ' + err.message)
    }
  }

  // Filtered Lists
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      const matchSearch = s.code.toLowerCase().includes(searchSubject.toLowerCase()) ||
        s.name.toLowerCase().includes(searchSubject.toLowerCase())
      const matchSem = selectedSemesterFilter === 'all' || s.semester === selectedSemesterFilter
      return matchSearch && matchSem
    })
  }, [subjects, searchSubject, selectedSemesterFilter])

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchSearch = m.title.toLowerCase().includes(searchMaterial.toLowerCase())
      const matchSub = selectedMatSubjectFilter === 'all' || m.subject_id === selectedMatSubjectFilter
      const matchCat = selectedMatCategoryFilter === 'all' || m.category === selectedMatCategoryFilter
      return matchSearch && matchSub && matchCat
    })
  }, [materials, searchMaterial, selectedMatSubjectFilter, selectedMatCategoryFilter])

  // Subject code to name lookup map
  const subjectMap = useMemo(() => {
    const map = new Map<string, FepnSubject>()
    subjects.forEach((s) => map.set(s.id, s))
    return map
  }, [subjects])

  // ========================================================
  // LOADING / UNAUTHENTICATED SCREENS
  // ========================================================
  if (authLoading) {
    return (
      <div className={`${headingFont.variable} ${bodyFont.variable} min-h-screen grid place-items-center bg-[#F4F7FB] text-slate-900 font-sans`}>
        <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-white/80 backdrop-blur-2xl border border-black/10 shadow-2xl">
          <div className="relative h-16 w-16">
            <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain animate-pulse" priority />
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
            <span className="font-bold text-sm tracking-wide">Đang xác thực quyền Quản trị FEPN...</span>
          </div>
        </div>
      </div>
    )
  }

  if (authStatus === 'unauthenticated' || authStatus === 'unauthorized') {
    return (
      <div className={`${headingFont.variable} ${bodyFont.variable} min-h-screen grid place-items-center bg-[#F4F7FB] text-slate-900 p-4 font-sans`}>
        <div className="flex flex-col items-center gap-4 w-full max-w-md p-8 rounded-3xl bg-white/90 backdrop-blur-2xl border border-black/10 shadow-2xl text-center">
          <div className="relative h-16 w-16">
            <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain" priority />
          </div>
          <div className="w-full">
            <h2 className="text-xl font-black text-slate-900 mb-2">
              {authStatus === 'unauthorized' ? 'Từ chối truy cập (403)' : 'Yêu cầu đăng nhập'}
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              {authStatus === 'unauthorized'
                ? 'Trang này chỉ dành riêng cho Quản trị viên Khoa Vật lý kỹ thuật & Công nghệ Nano.'
                : 'Bạn cần đăng nhập bằng tài khoản Quản trị viên để truy cập bảng điều khiển FEPN Admin.'}
            </p>

            {user?.email && (
              <div className="mb-6 rounded-xl bg-slate-100 p-3 text-xs text-slate-700">
                <span className="text-slate-500 font-medium">Tài khoản hiện tại:</span>{' '}
                <strong className="text-sky-700 font-bold">{user.email}</strong>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => checkFepnAdmin()}
                className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition shadow-md flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="h-4 w-4" />
                Thử lại xác thực quyền Admin
              </button>
              <Link
                href="/fepn-login"
                className="w-full py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
              >
                Đăng nhập tài khoản khác
              </Link>
              <Link
                href="/fepn-dashboard"
                className="w-full py-2.5 text-slate-500 hover:text-slate-700 text-xs font-semibold transition"
              >
                Quay về FEPN Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ========================================================
  // MAIN DASHBOARD VIEW
  // ========================================================
  return (
    <div
      className={`${headingFont.variable} ${bodyFont.variable} min-h-screen text-slate-900 font-sans flex flex-col bg-slate-50`}
      style={{
        ...themeVars,
        background:
          'radial-gradient(circle at 10% 10%, rgba(224, 242, 254, 0.6), transparent 35%), radial-gradient(circle at 90% 15%, rgba(224, 231, 255, 0.6), transparent 40%), #F8FAFC',
      }}
    >
      {/* 1. TOP HEADER BRANDING */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl px-4 py-3 sm:px-6 shadow-2xs">
        <div className="mx-auto flex w-full max-w-[1700px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/fepn-dashboard" className="flex items-center gap-3 group">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-sky-500/20 bg-white p-0.5 shadow-md group-hover:scale-105 transition">
                <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain" priority />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1
                    className="text-lg sm:text-xl font-black tracking-tight text-sky-950"
                    style={{ fontFamily: 'var(--font-fepn-heading)' }}
                  >
                    FEPN Admin Portal
                  </h1>
                  <span className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-black uppercase text-amber-600">
                    Bảo mật tối cao
                  </span>
                </div>
                <p className="hidden sm:block text-[11px] text-slate-500 font-medium">
                  Khoa Vật lý kỹ thuật & Công nghệ Nano - UET VNU
                </p>
              </div>
            </Link>

            <div className="h-5 w-px bg-slate-200 mx-2 hidden md:block" />

            {/* Subsite Navigation Links */}
            <div className="hidden md:flex items-center gap-2">
              <Link
                href="/fepn-dashboard"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 text-xs font-bold transition shadow-2xs"
              >
                <BookOpen className="h-3.5 w-3.5 text-sky-600" />
                <span>Xem Môn Học</span>
              </Link>
              <Link
                href="/fepn-recap"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 text-xs font-bold transition shadow-2xs"
              >
                <span>Xem Kỷ Yếu</span>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Vault Status Indicator */}
            <div
              onClick={() => setActiveTab('vault')}
              className={`cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                isDeepVaultUnlocked
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
              }`}
              title="Nhấn để xem trạng thái Lớp Bảo Mật Sâu"
            >
              {isDeepVaultUnlocked ? (
                <>
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span className="hidden sm:inline">Deep Vault: Đã Mở Khóa</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 text-slate-500" />
                  <span className="hidden sm:inline">Deep Vault: Đang Khóa</span>
                </>
              )}
            </div>

            {/* User Details */}
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold leading-none text-slate-800">{user?.email?.split('@')[0]}</p>
              <span className="text-[10px] font-black text-amber-600 uppercase">
                Quản Trị Viên Khoa
              </span>
            </div>

            {/* Logout */}
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/fepn-login')
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-50 text-rose-600 hover:bg-rose-100 shadow-sm transition"
              title="Đăng xuất"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. ADMIN TABS BAR */}
      <nav className="border-b border-slate-200 bg-white/70 backdrop-blur-md px-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1700px] items-center gap-2 overflow-x-auto py-2">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Tổng Quan FEPN</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('subjects')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'subjects'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            <span>Quản Lý Môn Học ({subjects.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('materials')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'materials'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FolderOpen className="h-4 w-4" />
            <span>Học Liệu & Đề Thi ({materials.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('recap')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'recap'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Kỷ Yếu Recap ({recapCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gifts')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'gifts'
                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Gift className="h-4 w-4" />
            <span>Quà Tặng FEPN ({giftItems.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vault')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'vault'
                ? 'bg-gradient-to-r from-amber-600 to-indigo-600 text-white shadow-sm'
                : isDeepVaultUnlocked
                ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                : 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            {isDeepVaultUnlocked ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <Shield className="h-4 w-4 text-amber-500" />}
            <span>Deep Security Vault (.key)</span>
          </button>
        </div>
      </nav>

      {/* 3. MAIN WORKSPACE CONTAINER */}
      <main className="flex-1 mx-auto w-full max-w-[1700px] p-4 sm:p-6 lg:p-8">
        {/* ======================================================== */}
        {/* TAB 1: TỔNG QUAN (OVERVIEW)                              */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Tổng Môn Học</span>
                  <BookOpen className="h-5 w-5 text-sky-600" />
                </div>
                <div className="text-3xl font-black text-slate-900">{subjects.length}</div>
                <p className="text-xs text-slate-400">Các môn chuyên ngành & đại cương Khoa FEPN</p>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Tổng Học Liệu</span>
                  <FolderOpen className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="text-3xl font-black text-slate-900">{materials.length}</div>
                <p className="text-xs text-slate-400">Slide, bài tập, video và đề thi trực tuyến</p>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Bài Viết Kỷ Yếu</span>
                  <Calendar className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="text-3xl font-black text-slate-900">{recapCount}</div>
                <p className="text-xs text-slate-400">Ghi lại các hoạt động của từng khóa sinh viên</p>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Tình Trạng An Ninh</span>
                  <ShieldCheck className="h-5 w-5 text-amber-600" />
                </div>
                <div className="text-xl font-black text-amber-600">
                  {isDeepVaultUnlocked ? 'DEEP VAULT ONLINE' : 'CẤP ĐỘ 1: AN TOÀN'}
                </div>
                <p className="text-xs text-slate-400">Chứng chỉ Master Key 512-bit mã hóa quân sự</p>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
              <h3 className="text-lg font-black text-slate-900">Thao Tác Nhanh Quản Trị FEPN</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('subjects')
                    handleOpenNewSubject()
                  }}
                  className="p-4 rounded-2xl border border-sky-200 bg-sky-50/50 hover:bg-sky-100/70 text-left transition space-y-2"
                >
                  <div className="p-2 w-fit rounded-xl bg-sky-600 text-white font-bold">
                    <Plus className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">Thêm Môn Học Mới</h4>
                  <p className="text-xs text-slate-500">Nhập mã môn, số tín chỉ và cấu hình môn học</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('materials')
                    handleOpenNewMaterial()
                  }}
                  className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/70 text-left transition space-y-2"
                >
                  <div className="p-2 w-fit rounded-xl bg-indigo-600 text-white font-bold">
                    <Upload className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">Đăng Học Liệu Mới</h4>
                  <p className="text-xs text-slate-500">Tải lên slide, bài tập hoặc đề thi cho sinh viên</p>
                </button>

                <Link
                  href="/fepn-recap"
                  className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 text-left transition space-y-2 block"
                >
                  <div className="p-2 w-fit rounded-xl bg-emerald-600 text-white font-bold">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">Soạn Bài Viết Kỷ Yếu</h4>
                  <p className="text-xs text-slate-500">Mở giao diện Recap để thêm bài viết hoạt động</p>
                </Link>

                <button
                  type="button"
                  onClick={() => setActiveTab('vault')}
                  className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/70 text-left transition space-y-2"
                >
                  <div className="p-2 w-fit rounded-xl bg-amber-600 text-white font-bold">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">Mở Deep Security Vault</h4>
                  <p className="text-xs text-slate-500">Nộp file .key để mã hóa tệp tin & phân quyền</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: QUẢN LÝ MÔN HỌC (SUBJECTS)                        */}
        {/* ======================================================== */}
        {activeTab === 'subjects' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-900">Danh Sách Môn Học FEPN</h3>
                <p className="text-xs text-slate-500">Quản lý chương trình đào tạo và học phần của Khoa</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchSubject}
                    onChange={(e) => setSearchSubject(e.target.value)}
                    placeholder="Tìm kiếm mã môn, tên môn..."
                    className="w-56 sm:w-64 pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                  />
                </div>

                <select
                  value={selectedSemesterFilter}
                  onChange={(e) => setSelectedSemesterFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs"
                >
                  <option value="all">Tất cả học kỳ</option>
                  <option value="Kỳ 1">Kỳ 1</option>
                  <option value="Kỳ 2">Kỳ 2</option>
                  <option value="Kỳ Hè">Kỳ Hè</option>
                </select>

                <button
                  type="button"
                  onClick={handleOpenNewSubject}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 text-xs font-bold shadow-md transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>Thêm Môn Học</span>
                </button>
              </div>
            </div>

            {/* Subjects Table */}
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Mã Môn</th>
                    <th className="px-5 py-3.5">Tên Môn Học</th>
                    <th className="px-5 py-3.5">Số Tín Chỉ</th>
                    <th className="px-5 py-3.5">Học Kỳ</th>
                    <th className="px-5 py-3.5">Mô Tả</th>
                    <th className="px-5 py-3.5 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        Không tìm thấy môn học nào phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredSubjects.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-5 py-3 font-mono font-black text-sky-700">
                          <Link href={`/tsv-fepn/${sub.code.toLowerCase()}`} className="hover:underline flex items-center gap-1">
                            <span>{sub.code}</span>
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </Link>
                        </td>
                        <td className="px-5 py-3 font-bold text-slate-900">{sub.name}</td>
                        <td className="px-5 py-3 font-semibold text-slate-600">{sub.credits} TC</td>
                        <td className="px-5 py-3">
                          <span className="rounded-md bg-sky-50 border border-sky-200 px-2 py-0.5 text-[11px] font-bold text-sky-700">
                            {sub.semester}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-500 max-w-xs truncate">{sub.description || 'Chưa có mô tả'}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditSubject(sub)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                              title="Sửa môn học"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubject(sub.id, sub.name)}
                              className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition"
                              title="Xóa môn học"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: QUẢN LÝ HỌC LIỆU (MATERIALS)                      */}
        {/* ======================================================== */}
        {activeTab === 'materials' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-900">Quản Lý Học Liệu & Đề Thi</h3>
                <p className="text-xs text-slate-500">Đăng và điều phối tài liệu các môn học Khoa FEPN</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchMaterial}
                    onChange={(e) => setSearchMaterial(e.target.value)}
                    placeholder="Tìm tên tài liệu..."
                    className="w-48 sm:w-56 pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-2xs"
                  />
                </div>

                <select
                  value={selectedMatSubjectFilter}
                  onChange={(e) => setSelectedMatSubjectFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs max-w-[200px] truncate"
                >
                  <option value="all">Tất cả môn học</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code} - {sub.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedMatCategoryFilter}
                  onChange={(e) => setSelectedMatCategoryFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs"
                >
                  <option value="all">Tất cả loại</option>
                  <option value="slide">Slide bài giảng</option>
                  <option value="exercise">Bài tập</option>
                  <option value="video">Video bài giảng</option>
                  <option value="exam">Đề thi & Đáp án</option>
                </select>

                <button
                  type="button"
                  onClick={handleOpenNewMaterial}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 text-xs font-bold shadow-md transition"
                >
                  <Plus className="h-4 w-4" />
                  <span>Đăng Tài Liệu</span>
                </button>
              </div>
            </div>

            {/* Materials Table */}
            <div className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Môn Học</th>
                    <th className="px-5 py-3.5">Tiêu Đề Học Liệu</th>
                    <th className="px-5 py-3.5">Phân Loại</th>
                    <th className="px-5 py-3.5">Đường Dẫn File</th>
                    <th className="px-5 py-3.5">Ngày Đăng</th>
                    <th className="px-5 py-3.5 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        Chưa có tài liệu nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredMaterials.map((mat) => {
                      const sub = subjectMap.get(mat.subject_id)
                      return (
                        <tr key={mat.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-5 py-3 font-mono font-bold text-slate-800">
                            {sub ? `${sub.code}` : 'Chưa gán'}
                          </td>
                          <td className="px-5 py-3 font-bold text-slate-900 max-w-sm truncate">
                            {mat.title}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[11px] font-bold uppercase ${
                                mat.category === 'exam'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : mat.category === 'video'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : mat.category === 'exercise'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-sky-50 text-sky-700 border border-sky-200'
                              }`}
                            >
                              {mat.category}
                            </span>
                          </td>
                          <td className="px-5 py-3 max-w-xs truncate text-sky-600 font-mono text-[11px]">
                            <a href={mat.file_url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                              <span className="truncate">{mat.file_url}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          </td>
                          <td className="px-5 py-3 text-slate-400">
                            {mat.created_at ? new Date(mat.created_at).toLocaleDateString('vi-VN') : ''}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteMaterial(mat.id, mat.title)}
                              className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition"
                              title="Xóa tài liệu"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: QUẢN LÝ KỶ YẾU RECAP                             */}
        {/* ======================================================== */}
        {activeTab === 'recap' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-900">Quản Lý Bài Viết Kỷ Yếu Recap</h3>
                <p className="text-xs text-slate-500">Theo dõi bài viết từng năm nhập học của sinh viên Khoa FEPN</p>
              </div>

              <Link
                href="/fepn-recap"
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 text-xs font-bold shadow-md transition"
              >
                <span>Mở Trang FEPN Recap</span>
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm space-y-4 text-center">
              <div className="p-4 rounded-2xl bg-sky-50 text-sky-600 w-fit mx-auto">
                <Calendar className="h-10 w-10" />
              </div>
              <h4 className="text-base font-black text-slate-900">
                Toàn bộ bài viết kỷ yếu đang được quản lý trực tiếp tại giao diện Recap
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Hiện có <strong>{recapCount} bài viết</strong> đã đăng. Admin có thể mở trang FEPN Recap để viết bài mới bằng cú pháp tiêu đề `#h1, #h2`, chèn ảnh `{'{AnhTieuDe}'}`, `{'{AnhDangBai}'}` hoặc tải lên hàng loạt ảnh tự động.
              </p>
              <Link
                href="/fepn-recap"
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 text-white px-5 py-2.5 text-xs font-black uppercase tracking-wider shadow-md hover:bg-sky-700 transition"
              >
                Đến Giao Diện Soạn Thảo Recap
              </Link>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: QUẢN LÝ TẶNG QUÀ & VÒNG QUAY FEPN               */}
        {/* ======================================================== */}
        {activeTab === 'gifts' && (
          <div className="space-y-8">
            {/* 1. Header Banner & Quick Stats */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-pink-500/10 via-rose-500/10 to-amber-500/10 border border-pink-500/20">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-lg shadow-pink-500/25">
                  <Gift className="h-7 w-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-slate-900">Quản Lý Hoạt Động Tặng Quà FEPN</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${
                      giftEvent.is_active
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                    }`}>
                      {giftEvent.is_active ? '● Đang Mở Hoạt Động' : '○ Đang Đóng'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Cấu hình sự kiện đổi quà, vòng quay may mắn, tạo mã nạp lượt quay và kiểm tra đối soát nhận quà cho sinh viên.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/fepn-gift"
                  target="_blank"
                  className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2.5 text-xs font-bold shadow-xs transition hover:scale-105"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Xem Trang Đổi Quà</span>
                </Link>

                <button
                  type="button"
                  onClick={handleToggleGiftEventActive}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase tracking-wider transition shadow-md hover:scale-105 ${
                    giftEvent.is_active
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25'
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{giftEvent.is_active ? 'Tạm Đóng Hoạt Động' : 'Mở Hoạt Động Ngay'}</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 font-bold">Hình Thức Tổ Chức</span>
                <p className="text-base font-black text-slate-900 mt-1 flex items-center gap-1.5">
                  {giftEvent.event_type === 'wheel' ? <Dices className="h-4 w-4 text-pink-600" /> : <Tag className="h-4 w-4 text-sky-600" />}
                  {giftEvent.event_type === 'wheel' ? 'Vòng quay may mắn' : 'Nhập mã nhận quà'}
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 font-bold">Danh Mục Quà</span>
                <p className="text-xl font-black text-slate-900 mt-1">
                  {giftItems.length} <span className="text-xs font-normal text-slate-500">phần quà</span>
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 font-bold">Mã Phát Hành</span>
                <p className="text-xl font-black text-slate-900 mt-1">
                  {giftCodes.length} <span className="text-xs font-normal text-slate-500">mã code</span>
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <span className="text-xs text-slate-500 font-bold">Lượt Trúng Thưởng</span>
                <p className="text-xl font-black text-emerald-600 mt-1">
                  {giftClaims.length} <span className="text-xs font-normal text-slate-500">lượt</span>
                </p>
              </div>
            </div>

            {/* 2. CẤU HÌNH SỰ KIỆN TẶNG QUÀ */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-pink-50 text-pink-600 border border-pink-100">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900">Cấu Hình Sự Kiện Đổi Quà</h4>
                    <p className="text-xs text-slate-500">Thiết lập tiêu đề, thể thức và quy định áp dụng</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSaveGiftEvent}
                  disabled={isSavingGiftEvent}
                  className="inline-flex items-center gap-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition disabled:opacity-50"
                >
                  {isSavingGiftEvent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  <span>Lưu Cấu Hình Sự Kiện</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Event Name */}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Tiêu Đề Sự Kiện *</label>
                  <input
                    type="text"
                    value={giftEvent.title}
                    onChange={(e) => setGiftEvent({ ...giftEvent, title: e.target.value })}
                    placeholder="Ví dụ: Vòng Quay May Mắn - Chào Đón Tân Sinh Viên K69..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-bold outline-none focus:border-pink-500 focus:bg-white transition"
                  />
                </div>

                {/* Event Type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Hình Thức Tham Gia *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGiftEvent({ ...giftEvent, event_type: 'wheel' })}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-black transition text-center ${
                        giftEvent.event_type === 'wheel'
                          ? 'border-pink-500 bg-pink-50 text-pink-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      🎰 Vòng Quay
                    </button>
                    <button
                      type="button"
                      onClick={() => setGiftEvent({ ...giftEvent, event_type: 'code' })}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-black transition text-center ${
                        giftEvent.event_type === 'code'
                          ? 'border-sky-500 bg-sky-50 text-sky-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      🎟️ Nhập Mã
                    </button>
                  </div>
                </div>

                {/* Default Spins */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Số Lượt Quay Mặc Định / Sinh Viên</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={giftEvent.default_spins}
                    onChange={(e) => setGiftEvent({ ...giftEvent, default_spins: Number(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-bold outline-none focus:border-pink-500 focus:bg-white transition"
                  />
                  <p className="text-[10px] text-slate-400">Số lượt sinh viên tự động có khi đăng nhập bằng email VNU</p>
                </div>

                {/* Active Toggle */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Trạng Thái Mở Sự Kiện</label>
                  <div className="flex items-center gap-3 pt-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={giftEvent.is_active}
                        onChange={handleToggleGiftEventActive}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                    </label>
                    <span className="text-xs font-bold text-slate-700">
                      {giftEvent.is_active ? 'Đang mở (Nút hiển thị trên Dashboard)' : 'Đang đóng'}
                    </span>
                  </div>
                </div>

                {/* Dynamic Rule Fields */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-pink-600" />
                    <span>Địa Điểm Nhận Quà</span>
                  </label>
                  <input
                    type="text"
                    value={giftEvent.location || ''}
                    onChange={(e) => setGiftEvent({ ...giftEvent, location: e.target.value })}
                    placeholder="VD: Bàn Ban Tổ Chức Khoa VLKT (Sảnh Nhà E4)..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-bold outline-none focus:border-pink-500 focus:bg-white transition"
                  />
                  <p className="text-[10px] text-slate-400">Vị trí sinh viên sẽ đến đối soát và lấy quà trực tiếp</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-sky-600" />
                    <span>Thời Gian Trao Quà</span>
                  </label>
                  <input
                    type="text"
                    value={giftEvent.time || ''}
                    onChange={(e) => setGiftEvent({ ...giftEvent, time: e.target.value })}
                    placeholder="VD: 08:30 - 16:30 các ngày 15/09 - 18/09..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-bold outline-none focus:border-pink-500 focus:bg-white transition"
                  />
                  <p className="text-[10px] text-slate-400">Khung giờ bàn trực của BTC mở cửa nhận đổi quà</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Cách Thức Nhận Quà</span>
                  </label>
                  <input
                    type="text"
                    value={giftEvent.how_to_receive || ''}
                    onChange={(e) => setGiftEvent({ ...giftEvent, how_to_receive: e.target.value })}
                    placeholder="VD: Xuất trình Mã Đối Soát (Claim Code) trên điện thoại cho BTC..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-bold outline-none focus:border-pink-500 focus:bg-white transition"
                  />
                  <p className="text-[10px] text-slate-400">Hướng dẫn thao tác đối soát để nhận quà hiện vật</p>
                </div>

                {/* Additional Notes & Description */}
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Ghi Chú / Thể Thức Lưu Ý Thêm (Tùy chọn)</label>
                  <textarea
                    rows={3}
                    value={giftEvent.description || ''}
                    onChange={(e) => setGiftEvent({ ...giftEvent, description: e.target.value })}
                    placeholder="Ghi chú thêm về quy định nhận quà, hướng dẫn đặc biệt cho sinh viên (nếu có)..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs font-medium outline-none focus:border-pink-500 focus:bg-white transition"
                  />
                </div>
              </div>
            </div>

            {/* 3. QUẢN LÝ DANH SÁCH QUÀ TẶNG */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h4 className="text-base font-black text-slate-900">Danh Mục Quà Tặng ({giftItems.length})</h4>
                  <p className="text-xs text-slate-500">Quản lý tên quà, hình ảnh, số lượng và tỉ lệ trúng thưởng trên vòng quay</p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Total Win Rate Indicator */}
                  {(() => {
                    const totalRate = giftItems.reduce((acc, it) => acc + (Number(it.win_rate) || 0), 0)
                    return (
                      <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                        totalRate === 100
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        <Percent className="h-3.5 w-3.5" />
                        <span>Tổng tỉ lệ: {totalRate}% {totalRate === 100 ? '(Chuẩn 100%)' : '(Chưa cân bằng 100%)'}</span>
                      </span>
                    )
                  })()}

                  <button
                    type="button"
                    onClick={handleOpenAddGiftItem}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 text-xs font-black uppercase tracking-wider shadow-sm transition hover:scale-105"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Thêm Món Quà</span>
                  </button>
                </div>
              </div>

              {/* Gift Items Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] font-black uppercase text-slate-400 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Ảnh</th>
                      <th className="px-4 py-3">Tên Món Quà</th>
                      <th className="px-4 py-3 text-center">Số Lượng Tổng</th>
                      <th className="px-4 py-3 text-center">Còn Lại</th>
                      <th className="px-4 py-3 text-center">Tỉ Lệ Trúng</th>
                      <th className="px-4 py-3 text-center">Màu Múi Quay</th>
                      <th className="px-4 py-3 text-center">Loại Quà</th>
                      <th className="px-4 py-3 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {giftItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3">
                          <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                            ) : (
                              <Gift className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800">
                          {item.name}
                        </td>
                        <td className="px-4 py-3 text-center font-bold">
                          {item.total_quantity}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-md font-black ${
                            item.remaining_quantity <= 5
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {item.remaining_quantity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-pink-600">
                          {item.win_rate}%
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-slate-200 bg-white">
                            <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: item.color }} />
                            <span className="font-mono text-[10px] uppercase font-bold">{item.color}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.is_consolation ? (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                              May mắn lần sau
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                              Quà hiện vật
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditGiftItem(item)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition"
                              title="Chỉnh sửa món quà"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteGiftItem(item.id, item.name)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Xóa món quà"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. SINH MÃ CODE (MÃ NẠP LƯỢT HOẶC MÃ QUÀ TẶNG) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h4 className="text-base font-black text-slate-900">Sinh Mã Code Nạp Lượt Quay & Mã Quà</h4>
                <p className="text-xs text-slate-500">
                  Phát mã tại bàn check-in hoặc mini-game để sinh viên nhập vào nhận thêm lượt quay may mắn.
                </p>
              </div>

              {/* Form Generator */}
              <form onSubmit={handleGenerateCodes} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tiền tố mã:</label>
                  <input
                    type="text"
                    value={genCodePrefix}
                    onChange={(e) => setGenCodePrefix(e.target.value)}
                    placeholder="VD: FEPN-SPIN"
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 font-mono uppercase font-bold outline-none focus:border-pink-500"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Loại mã:</label>
                  <select
                    value={genCodeType}
                    onChange={(e) => setGenCodeType(e.target.value as 'spin' | 'gift')}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 font-bold outline-none focus:border-pink-500"
                  >
                    <option value="spin">Cộng thêm lượt quay</option>
                    <option value="gift">Nhận quà trực tiếp</option>
                  </select>
                </div>

                {genCodeType === 'spin' ? (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Số lượt cộng:</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={genCodeSpinCount}
                      onChange={(e) => setGenCodeSpinCount(Number(e.target.value) || 1)}
                      className="w-full rounded-xl border border-slate-300 bg-white p-2.5 font-bold text-center outline-none focus:border-pink-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Chọn món quà:</label>
                    <select
                      value={genCodeGiftId}
                      onChange={(e) => setGenCodeGiftId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white p-2.5 font-bold outline-none focus:border-pink-500"
                    >
                      <option value="">-- Chọn món quà --</option>
                      {giftItems.filter((g) => !g.is_consolation).map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Số lượng mã cần sinh:</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={genCodeCount}
                    onChange={(e) => setGenCodeCount(Number(e.target.value) || 1)}
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 font-bold text-center outline-none focus:border-pink-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={generatingCodes}
                  className="w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-black uppercase text-xs tracking-wider shadow-sm transition hover:scale-105 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                >
                  {generatingCodes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  <span>Sinh Mã Ngay</span>
                </button>
              </form>

              {/* Codes List Table */}
              <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="sticky top-0 bg-slate-100 text-[11px] font-black uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Mã Code</th>
                      <th className="px-4 py-3">Loại Mã</th>
                      <th className="px-4 py-3 text-center">Giá Trị</th>
                      <th className="px-4 py-3 text-center">Số Lần Dùng</th>
                      <th className="px-4 py-3 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {giftCodes.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                          Chưa có mã nào được sinh. Hãy sử dụng form trên để tạo mã phát cho sinh viên!
                        </td>
                      </tr>
                    ) : (
                      giftCodes.map((codeItem) => (
                        <tr key={codeItem.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-4 py-2.5 font-mono font-bold text-slate-900">
                            {codeItem.code}
                          </td>
                          <td className="px-4 py-2.5">
                            {codeItem.type === 'spin' ? (
                              <span className="px-2 py-0.5 rounded-md bg-pink-50 text-pink-700 border border-pink-200 text-[10px] font-bold">
                                Cộng Lượt Quay
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold">
                                Quà Trực Tiếp
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center font-bold">
                            {codeItem.type === 'spin' ? `+${codeItem.spin_count} lượt` : '1 phần quà'}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              codeItem.used_count >= codeItem.max_uses
                                ? 'bg-slate-200 text-slate-600'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {codeItem.used_count} / {codeItem.max_uses}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(codeItem.code)
                                  setCopiedCode(codeItem.code)
                                  setTimeout(() => setCopiedCode(null), 2000)
                                }}
                                className="p-1 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition"
                                title="Sao chép mã"
                              >
                                {copiedCode === codeItem.code ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCode(codeItem.id)}
                                className="p-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                                title="Xoá mã"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. CỔNG NHẬP MÃ ĐỐI SOÁT & DANH SÁCH TRÚNG THƯỞNG */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
              {/* 5.1 CỔNG NHẬP MÃ ĐỐI SOÁT TRỰC TIẾP */}
              <div className="rounded-2xl border border-pink-500/20 bg-gradient-to-r from-pink-50/50 via-rose-50/30 to-amber-50/30 p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-pink-500 to-rose-600 text-white shadow-md">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900">Cổng Nhập Mã Đối Soát Trao Quà Trực Tiếp</h4>
                    <p className="text-xs text-slate-500">
                      Nhập hoặc dán mã đối soát (Claim Code) từ màn hình sinh viên để kiểm tra, xác nhận trao quà và tự động giảm số lượng quà trên hệ thống.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleCheckClaimCode} className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={verifyCodeInput}
                      onChange={(e) => setVerifyCodeInput(e.target.value.toUpperCase())}
                      placeholder="Nhập mã đối soát (VD: CLAIM-23020001-ABCD)..."
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white font-mono text-sm font-black uppercase tracking-wider outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 transition text-slate-900"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={verifyingClaim || !verifyCodeInput.trim()}
                    className="px-6 py-3 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-black text-xs uppercase tracking-wider shadow-sm transition hover:scale-105 disabled:opacity-50 inline-flex items-center justify-center gap-2 shrink-0"
                  >
                    {verifyingClaim ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    <span>Kiểm Tra & Đối Soát</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowScannerModal(true)}
                    className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-sky-600/20 transition hover:scale-105 inline-flex items-center justify-center gap-2 shrink-0"
                  >
                    <Camera className="h-4 w-4" />
                    <span>Quét Mã QR Đối Soát</span>
                  </button>

                  {verifyCodeInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setVerifyCodeInput('')
                        setFoundVerifyClaim(null)
                        setVerifyStatusMessage(null)
                      }}
                      className="px-3 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 text-xs font-bold transition shrink-0"
                      title="Xóa ô nhập"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </form>

                {/* Status Alert */}
                {verifyStatusMessage && (
                  <div
                    className={`p-4 rounded-xl text-xs font-bold border flex items-start gap-2.5 ${
                      verifyStatusMessage.type === 'success'
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : verifyStatusMessage.type === 'warning'
                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                        : verifyStatusMessage.type === 'info'
                        ? 'bg-sky-50 text-sky-900 border-sky-300'
                        : 'bg-rose-50 text-rose-900 border-rose-300'
                    }`}
                  >
                    {verifyStatusMessage.type === 'success' ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : verifyStatusMessage.type === 'warning' ? (
                      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    ) : verifyStatusMessage.type === 'info' ? (
                      <Check className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span className="leading-relaxed">{verifyStatusMessage.message}</span>
                  </div>
                )}

                {/* Found Claim Card */}
                {foundVerifyClaim && (
                  <div className="p-4 rounded-2xl bg-white border border-pink-200 shadow-sm space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[10px] font-black uppercase text-pink-600">Mã Đối Soát Hợp Lệ</span>
                        <p className="text-lg font-mono font-black text-slate-900">{foundVerifyClaim.claim_code}</p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                          foundVerifyClaim.status === 'delivered'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800 animate-pulse'
                        }`}
                      >
                        {foundVerifyClaim.status === 'delivered' ? '✓ Đã Trao Quà' : '⏳ Chờ Nhận Quà'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 font-bold block mb-1">Sinh Viên:</span>
                        <p className="font-black text-slate-900">{foundVerifyClaim.user_name || 'Sinh viên VNU'}</p>
                        <p className="font-mono text-slate-500 font-bold">{foundVerifyClaim.user_mssv}</p>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 font-bold block mb-1">Phần Quà Trúng:</span>
                        <p className="font-black text-pink-600 text-sm">{foundVerifyClaim.gift_name}</p>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-slate-400 font-bold block mb-1">Thời Gian Trúng:</span>
                        <p className="font-bold text-slate-700">
                          {new Date(foundVerifyClaim.claimed_at).toLocaleString('vi-VN')}
                        </p>
                        {foundVerifyClaim.delivered_at && (
                          <p className="text-[11px] text-emerald-600 font-bold mt-1">
                            Trao lúc: {new Date(foundVerifyClaim.delivered_at).toLocaleString('vi-VN')}
                          </p>
                        )}
                      </div>
                    </div>

                    {foundVerifyClaim.status === 'pending' && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => handleConfirmDelivery(foundVerifyClaim)}
                          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black uppercase text-xs tracking-wider shadow-md transition hover:scale-[1.01] flex items-center justify-center gap-2"
                        >
                          <Check className="h-4 w-4" />
                          <span>Xác Nhận Đã Trao Quà & Giảm Số Lượng Quà Trên Trang (-1)</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Manual Confirmation Card (if claim code not synced yet) */}
                {!foundVerifyClaim && verifyCodeInput.trim() && verifyStatusMessage?.type === 'warning' && (
                  <div className="p-4 rounded-2xl bg-white border border-amber-200 shadow-sm space-y-3">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                      <Gift className="h-4 w-4 text-amber-600" />
                      <span>Xác Nhận Trao Quà Thủ Công & Trừ Số Lượng Trong Kho</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">MSSV Sinh Viên:</label>
                        <input
                          type="text"
                          value={manualStudentMssv}
                          onChange={(e) => setManualStudentMssv(e.target.value.toUpperCase())}
                          placeholder="VD: 23020001"
                          className="w-full rounded-xl border border-slate-300 p-2 font-mono font-bold uppercase outline-none focus:border-pink-500"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Họ Tên Sinh Viên:</label>
                        <input
                          type="text"
                          value={manualStudentName}
                          onChange={(e) => setManualStudentName(e.target.value)}
                          placeholder="Họ tên sinh viên"
                          className="w-full rounded-xl border border-slate-300 p-2 font-bold outline-none focus:border-pink-500"
                        />
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Món Quà Sinh Viên Trúng:</label>
                        <select
                          value={manualGiftId}
                          onChange={(e) => setManualGiftId(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 p-2 font-bold outline-none focus:border-pink-500 bg-white"
                        >
                          {giftItems.filter((g) => !g.is_consolation).map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name} (Còn {g.remaining_quantity})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleManualConfirmDelivery}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black uppercase text-xs tracking-wider shadow-md transition flex items-center justify-center gap-2"
                    >
                      <Check className="h-4 w-4" />
                      <span>Xác Nhận Trao Quà & Giảm Số Lượng Quà (-1)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 5.2 DANH SÁCH TẤT CẢ LƯỢT TRÚNG & BỘ LỌC */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h4 className="text-base font-black text-slate-900">Danh Sách Trúng Thưởng & Đối Soát ({giftClaims.length})</h4>
                  <p className="text-xs text-slate-500">
                    Toàn bộ lịch sử trúng thưởng và trạng thái nhận quà của sinh viên.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={claimSearchKeyword}
                      onChange={(e) => setClaimSearchKeyword(e.target.value)}
                      placeholder="Tìm theo MSSV, mã đối soát..."
                      className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none focus:border-pink-500 focus:bg-white transition w-48 sm:w-60"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    {(['all', 'pending', 'delivered'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setClaimFilterStatus(st)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                          claimFilterStatus === st
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {st === 'all' ? 'Tất cả' : st === 'pending' ? 'Chờ trao quà' : 'Đã trao quà'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Claims Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[11px] font-black uppercase text-slate-400 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Mã Đối Soát</th>
                      <th className="px-4 py-3">Sinh Viên</th>
                      <th className="px-4 py-3">Món Quà Trúng</th>
                      <th className="px-4 py-3">Thời Gian Trúng</th>
                      <th className="px-4 py-3 text-center">Trạng Thái</th>
                      <th className="px-4 py-3 text-right">Xác Nhận Trao Quà</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const filteredClaims = giftClaims
                        .filter((c) => claimFilterStatus === 'all' || c.status === claimFilterStatus)
                        .filter((c) => {
                          if (!claimSearchKeyword.trim()) return true
                          const kw = claimSearchKeyword.trim().toLowerCase()
                          return (
                            c.claim_code.toLowerCase().includes(kw) ||
                            c.user_mssv.toLowerCase().includes(kw) ||
                            (c.user_name && c.user_name.toLowerCase().includes(kw)) ||
                            c.gift_name.toLowerCase().includes(kw)
                          )
                        })

                      if (filteredClaims.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                              {claimSearchKeyword ? 'Không tìm thấy lượt đổi quà khớp với từ khóa tìm kiếm.' : 'Chưa có lượt trúng thưởng nào trong danh sách.'}
                            </td>
                          </tr>
                        )
                      }

                      return filteredClaims.map((claim) => (
                        <tr key={claim.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-4 py-3 font-mono font-black text-pink-600">
                            {claim.claim_code}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900">{claim.user_name || 'Sinh viên VNU'}</p>
                            <p className="font-mono text-[11px] text-slate-400">{claim.user_mssv}</p>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-800">
                            {claim.gift_name}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {new Date(claim.claimed_at).toLocaleString('vi-VN')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {claim.status === 'delivered' ? (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                                ✓ Đã trao quà
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase animate-pulse">
                                ⏳ Chờ nhận
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {claim.status === 'pending' ? (
                              <button
                                type="button"
                                onClick={() => handleMarkClaimDelivered(claim.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition hover:scale-105"
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>Xác Nhận Đã Trao & Trừ Kho</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">
                                Đã trao bởi {claim.delivered_by || 'BTC'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 6: DEEP SECURITY VAULT (BẢO MẬT TỐI MẬT)            */}
        {/* ======================================================== */}
        {activeTab === 'vault' && (
          <div className="space-y-6">
            <AdminSecurityVault
              userId={user?.id}
              userEmail={user?.email}
              isDeepVaultUnlocked={isDeepVaultUnlocked}
              activePayloadToken={activePayloadToken}
              onUnlockSuccess={handleVaultUnlockSuccess}
              onLockVault={handleVaultLock}
            >
              {/* UNLOCKED DEEP VAULT PROTECTED CONTENT */}
              <div className="space-y-8">
                {/* 1. File Encryption Center */}
                <FileEncryptionCenter payloadToken={activePayloadToken} />

                {/* 2. User & Admin Role Management */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        <Users className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-slate-900">
                          Phân Quyền Người Dùng & Cấp Quyền Quản Trị
                        </h4>
                        <p className="text-xs text-slate-500">
                          Chỉ có thể thay đổi khi đã mở khóa Deep Vault bằng file khóa .key
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Email Người Dùng</th>
                          <th className="px-4 py-3">Họ Tên</th>
                          <th className="px-4 py-3">Vai Trò Hiện Tại</th>
                          <th className="px-4 py-3">Trạng Thái Khóa .key</th>
                          <th className="px-4 py-3 text-right">Hành Động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {userList.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50/60 transition">
                            <td className="px-4 py-3 font-semibold text-slate-800">{u.email}</td>
                            <td className="px-4 py-3 text-slate-600">{u.full_name || '—'}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${
                                  u.role === 'admin'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {u.role === 'admin' ? 'Quản Trị Viên' : u.role || 'Sinh Viên'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                              {u.admin_key_issued_at ? (
                                <span className="text-emerald-600 font-bold flex items-center gap-1">
                                  <ShieldCheck className="h-3.5 w-3.5" /> Đã cấp khóa
                                </span>
                              ) : (
                                <span className="text-slate-400">Chưa cấp</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {u.role === 'admin' ? (
                                <button
                                  type="button"
                                  onClick={() => handleChangeUserRole(u.id, 'student')}
                                  className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-bold transition"
                                >
                                  Hạ quyền sinh viên
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleChangeUserRole(u.id, 'admin')}
                                  className="px-2.5 py-1 rounded-lg border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 text-[11px] font-bold transition"
                                >
                                  Cấp quyền Admin
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. Database Export & Backup */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                      <Database className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-900">
                        Sao Lưu Toàn Bộ Cơ Sở Dữ Liệu FEPN
                      </h4>
                      <p className="text-xs text-slate-500">
                        Xuất file dữ liệu JSON môn học, học liệu và bài viết kỷ yếu để lưu trữ an toàn
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const backupData = {
                        exportedAt: new Date().toISOString(),
                        subjects,
                        materials,
                        recapCount,
                      }
                      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `FEPN_DATABASE_BACKUP_${new Date().toISOString().slice(0, 10)}.json`
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                      URL.revokeObjectURL(url)
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-5 py-2.5 text-xs font-bold shadow-md hover:bg-black transition"
                  >
                    <Download className="h-4 w-4" />
                    <span>Tải Về File Sao Lưu Hệ Thống (.json)</span>
                  </button>
                </div>
              </div>
            </AdminSecurityVault>
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* SUBJECT MODAL (CREATE / EDIT)                            */}
      {/* ======================================================== */}
      {showSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                {editingSubjectId ? 'Chỉnh Sửa Môn Học FEPN' : 'Thêm Môn Học FEPN Mới'}
              </h3>
              <button
                type="button"
                onClick={() => setShowSubjectModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mã Môn Học (VD: EPN1001)</label>
                <input
                  type="text"
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value.toUpperCase())}
                  required
                  placeholder="EPN..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên Môn Học</label>
                <input
                  type="text"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  required
                  placeholder="Nhập tên môn học..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số Tín Chỉ</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={subCredits}
                    onChange={(e) => setSubCredits(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Học Kỳ</label>
                  <select
                    value={subSemester}
                    onChange={(e) => setSubSemester(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  >
                    <option value="Kỳ 1">Kỳ 1</option>
                    <option value="Kỳ 2">Kỳ 2</option>
                    <option value="Kỳ Hè">Kỳ Hè</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mô Tả Tóm Tắt</label>
                <textarea
                  rows={3}
                  value={subDescription}
                  onChange={(e) => setSubDescription(e.target.value)}
                  placeholder="Mô tả nội dung môn học..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={savingSubject}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md flex items-center gap-2"
                >
                  {savingSubject ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  <span>{editingSubjectId ? 'Cập Nhật Môn Học' : 'Thêm Môn Học'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MATERIAL MODAL (UPLOAD / ADD)                           */}
      {/* ======================================================== */}
      {showMaterialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Đăng Học Liệu / Đề Thi FEPN</h3>
              <button
                type="button"
                onClick={() => setShowMaterialModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMaterial} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Môn Học Thuộc Về</label>
                <select
                  value={matSubjectId}
                  onChange={(e) => setMatSubjectId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code} - {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tiêu Đề Tài Liệu</label>
                <input
                  type="text"
                  value={matTitle}
                  onChange={(e) => setMatTitle(e.target.value)}
                  required
                  placeholder="Ví dụ: Slide Bài Giảng Tuần 1, Đề Thi Cuối Kỳ 2025..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phân Loại Học Liệu</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['slide', 'exercise', 'video', 'exam'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setMatCategory(cat)}
                      className={`py-2 rounded-xl text-xs font-black uppercase transition border ${
                        matCategory === cat
                          ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Đường Dẫn File (Link Google Drive, YouTube hoặc URL)
                </label>
                <input
                  type="url"
                  value={matFileUrl}
                  onChange={(e) => setMatFileUrl(e.target.value)}
                  required
                  placeholder="https://drive.google.com/file/d/..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowMaterialModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={savingMaterial}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md flex items-center gap-2"
                >
                  {savingMaterial ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  <span>Đăng Học Liệu</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. MODAL THÊM / SỬA MÓN QUÀ TẶNG */}
      {showGiftItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-pink-50 text-pink-600">
                  <Gift className="h-5 w-5" />
                </div>
                <h3 className="text-base font-black text-slate-900">
                  {editingGiftItemId ? 'Chỉnh Sửa Món Quà' : 'Thêm Món Quà Mới'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGiftItemModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGiftItem} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên Món Quà *</label>
                <input
                  type="text"
                  value={itemFormName}
                  onChange={(e) => setItemFormName(e.target.value)}
                  placeholder="VD: Áo Phông Khoa VLKT, Bình Giữ Nhiệt Nano..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold focus:ring-2 focus:ring-pink-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Đường Dẫn Hình Ảnh (URL hoặc Link Google Drive)
                </label>
                <input
                  type="text"
                  value={itemFormImage}
                  onChange={(e) => setItemFormImage(e.target.value)}
                  placeholder="https://images.unsplash.com/... hoặc link drive"
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono focus:ring-2 focus:ring-pink-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Để trống nếu là ô "Chúc bạn may mắn lần sau"</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số Lượng Tổng *</label>
                  <input
                    type="number"
                    min="0"
                    value={itemFormTotal}
                    onChange={(e) => setItemFormTotal(Number(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold text-center focus:ring-2 focus:ring-pink-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số Lượng Còn Lại *</label>
                  <input
                    type="number"
                    min="0"
                    value={itemFormRemaining}
                    onChange={(e) => setItemFormRemaining(Number(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold text-center focus:ring-2 focus:ring-pink-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tỉ Lệ Trúng (% Xác Suất) *</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={itemFormWinRate}
                    onChange={(e) => setItemFormWinRate(Number(e.target.value) || 0)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold text-center focus:ring-2 focus:ring-pink-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Màu Múi Vòng Quay</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={itemFormColor}
                      onChange={(e) => setItemFormColor(e.target.value)}
                      className="h-9 w-12 rounded-xl border border-slate-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={itemFormColor}
                      onChange={(e) => setItemFormColor(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-200 p-2 text-xs font-mono uppercase font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={itemFormConsolation}
                    onChange={(e) => setItemFormConsolation(e.target.checked)}
                    className="h-4 w-4 rounded text-pink-600 focus:ring-pink-500"
                  />
                  <span className="font-bold text-slate-700 text-xs">
                    Đây là ô "Chúc bạn may mắn lần sau" (Không trừ số lượng quà vật lý)
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGiftItemModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={savingGiftItem}
                  className="px-5 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold shadow-md flex items-center gap-2"
                >
                  {savingGiftItem ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  <span>Lưu Món Quà</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL QUÉT MÃ QR ĐỐI SOÁT BẰNG CAMERA */}
      <AdminQrScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onScanSuccess={handleQrScanSuccess}
      />
    </div>
  )
}

function AdminQrScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  onScanSuccess: (code: string) => void
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const isScanningRef = React.useRef<boolean>(false)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isProcessingFile, setIsProcessingFile] = useState(false)

  const stopStream = () => {
    isScanningRef.current = false
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && !('BarcodeDetector' in window) && !(window as any).jsQR) {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      stopStream()
      return
    }

    let isMounted = true
    setCameraError(null)

    const startCamera = async () => {
      try {
        stopStream()

        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facingMode },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          })
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          })
        }

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        isScanningRef.current = true
        startScanLoop()
      } catch (err: any) {
        if (!isMounted) return
        setCameraError(
          err?.name === 'NotAllowedError'
            ? 'Quyền truy cập máy ảnh bị từ chối. Vui lòng cho phép quyền Camera trên trình duyệt hoặc tải ảnh QR lên.'
            : 'Không thể mở máy ảnh (' + (err?.message || 'Lỗi thiết bị') + '). Bạn có thể tải ảnh chụp QR lên.'
        )
      }
    }

    startCamera()

    return () => {
      isMounted = false
      stopStream()
    }
  }, [isOpen, facingMode])

  const startScanLoop = () => {
    let detector: any = null
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
      } catch {
        detector = null
      }
    }

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const tick = async () => {
      if (!isScanningRef.current) return
      const video = videoRef.current
      if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
        if (detector) {
          try {
            const barcodes = await detector.detect(video)
            if (barcodes && barcodes.length > 0 && barcodes[0]?.rawValue) {
              isScanningRef.current = false
              stopStream()
              if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(100)
              onScanSuccess(barcodes[0].rawValue)
              return
            }
          } catch {}
        }

        if ((window as any).jsQR && ctx) {
          try {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const code = (window as any).jsQR(imgData.data, imgData.width, imgData.height)
            if (code && code.data) {
              isScanningRef.current = false
              stopStream()
              if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(100)
              onScanSuccess(code.data)
              return
            }
          } catch {}
        }
      }

      if (isScanningRef.current) {
        requestAnimationFrame(tick)
      }
    }

    requestAnimationFrame(tick)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsProcessingFile(true)

    const reader = new FileReader()
    reader.onload = () => {
      const img = new (window as any).Image()
      img.onload = async () => {
        try {
          if ('BarcodeDetector' in window) {
            try {
              const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
              const barcodes = await detector.detect(img)
              if (barcodes && barcodes.length > 0 && barcodes[0]?.rawValue) {
                setIsProcessingFile(false)
                stopStream()
                onScanSuccess(barcodes[0].rawValue)
                return
              }
            } catch {}
          }

          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth || img.width
          canvas.height = img.naturalHeight || img.height
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          if (ctx) {
            ctx.drawImage(img, 0, 0)
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            if ((window as any).jsQR) {
              const code = (window as any).jsQR(imgData.data, imgData.width, imgData.height)
              if (code && code.data) {
                setIsProcessingFile(false)
                stopStream()
                onScanSuccess(code.data)
                return
              }
            }
          }
          alert('Không tìm thấy mã QR hợp lệ trong ảnh vừa tải lên. Vui lòng thử lại với ảnh rõ nét hơn!')
        } catch (err: any) {
          alert('Lỗi xử lý ảnh: ' + err.message)
        } finally {
          setIsProcessingFile(false)
        }
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden text-white flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-wide text-white">Quét Mã QR Đối Soát</h3>
              <p className="text-[11px] text-slate-400">Camera đối soát nhận quà tức thì cho BTC</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopStream()
              onClose()
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/50 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Video Camera Viewport */}
        <div className="relative aspect-square w-full bg-black overflow-hidden flex items-center justify-center">
          {cameraError ? (
            <div className="p-6 text-center space-y-3">
              <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
              <p className="text-xs text-amber-200 font-semibold">{cameraError}</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-xs font-bold text-white transition inline-flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                <span>Tải ảnh mã QR để đối soát</span>
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
              />

              {/* Reticle / Scanning Frame */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-64 h-64 border-2 border-pink-500/60 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  {/* Glowing Corners */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-pink-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-pink-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-pink-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-pink-400 rounded-br-lg" />

                  {/* Laser line moving vertically */}
                  <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-pink-400 to-transparent shadow-[0_0_12px_#ec4899] animate-bounce" />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-800/90 border-t border-slate-700/60 flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
            className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-slate-200 transition inline-flex items-center gap-1.5"
            title="Đổi camera trước/sau"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Đổi Camera</span>
          </button>

          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingFile}
            className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-slate-200 transition inline-flex items-center gap-1.5"
            title="Tải ảnh QR từ thư viện ảnh hoặc chụp ảnh"
          >
            {isProcessingFile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            <span>Tải Ảnh QR</span>
          </button>

          <button
            type="button"
            onClick={() => {
              stopStream()
              onClose()
            }}
            className="px-4 py-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-xs font-bold text-white transition ml-auto"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
