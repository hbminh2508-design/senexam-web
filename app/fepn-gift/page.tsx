'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Baloo_2, Nunito } from 'next/font/google'
import { supabase } from '@/lib/supabaseClient'
import FepnMobileNav from '@/components/FepnMobileNav'
import { checkFepnAccessAsync } from '@/lib/authHelper'
import {
  ArrowLeft,
  Gift,
  Trophy,
  QrCode,
  Share2,
  Copy,
  Check,
  RotateCcw,
  Award,
  ChevronRight,
  Loader2,
  PartyPopper,
  CheckCircle2,
  AlertCircle,
  Info,
  ExternalLink,
  ShieldCheck,
  Ticket,
  Clock,
  MapPin,
  X,
  Volume2,
  VolumeX,
} from 'lucide-react'

const headingFont = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-heading' })
const bodyFont = Nunito({ subsets: ['latin', 'vietnamese'], variable: '--font-fepn-body' })

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
  redeemed_users?: string[]
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

const DEFAULT_EVENT_CONFIG: FepnGiftEvent = {
  id: 'fepn-active-event',
  title: 'Vòng Quay May Mắn - Khoa Vật lý kỹ thuật & CNNN',
  location: '',
  time: '',
  how_to_receive: '',
  description: '',
  event_type: 'wheel',
  is_active: false,
  default_spins: 0,
}

const DEFAULT_GIFT_ITEMS: FepnGiftItem[] = [
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
]

export default function FepnGiftPage() {
  const router = useRouter()

  // Auth States
  const [authLoading, setAuthLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [authStatus, setAuthStatus] = useState<'checking' | 'authorized' | 'unauthenticated' | 'restricted'>('checking')
  const [isAdmin, setIsAdmin] = useState(false)

  // Event Data States
  const [eventConfig, setEventConfig] = useState<FepnGiftEvent>(DEFAULT_EVENT_CONFIG)
  const [giftItems, setGiftItems] = useState<FepnGiftItem[]>(DEFAULT_GIFT_ITEMS)
  const [spinsRemaining, setSpinsRemaining] = useState<number>(0)
  const [myClaims, setMyClaims] = useState<FepnGiftClaim[]>([])

  // Wheel Canvas & Physics State
  const wheelCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isSpinning, setIsSpinning] = useState(false)
  const [rotationAngle, setRotationAngle] = useState(0) // radians
  const [winningItem, setWinningItem] = useState<FepnGiftItem | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Confetti Canvas Ref
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)

  // Modals & Controls
  const [showWinModal, setShowWinModal] = useState(false)
  const [latestClaim, setLatestClaim] = useState<FepnGiftClaim | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedClaimCode, setCopiedClaimCode] = useState(false)

  // Code Redeem States (Redeem Spin / Direct Gift)
  const [codeInput, setCodeInput] = useState('')
  const [codeSubmitting, setCodeSubmitting] = useState(false)
  const [codeFeedback, setCodeFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // 1. Initial Authentication Check
  useEffect(() => {
    const checkAuth = async () => {
      setAuthLoading(true)
      try {
        const { data: userData } = await supabase.auth.getUser()
        const currentUser = userData?.user ?? null

        if (!currentUser) {
          setAuthStatus('unauthenticated')
          setAuthLoading(false)
          router.replace('/fepn-login')
          return
        }

        setUser(currentUser)
        const email = currentUser.email?.toLowerCase() || ''
        const isVnu = email.endsWith('@vnu.edu.vn')
        const isOwner = email === 'hoangbinhminh2508@gmail.com'

        let role = ''
        try {
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', currentUser.id).maybeSingle()
          if (profile?.role) role = profile.role.toLowerCase()
        } catch {}

        const isUserAdmin = role === 'admin' || role === 'collab' || isOwner
        setIsAdmin(isUserAdmin)

        const isAllowed = await checkFepnAccessAsync(currentUser, role)

        if (!isAllowed) {
          setAuthStatus('restricted')
          setAuthLoading(false)
          return
        }

        setAuthStatus('authorized')
      } catch (err) {
        setAuthStatus('unauthenticated')
        router.replace('/fepn-login')
      } finally {
        setAuthLoading(false)
      }
    }

    checkAuth()
  }, [router])

  // 2. Load Event Settings & Gift Data
  const loadEventData = useCallback(async () => {
    try {
      // 1. Load Event Config
      let activeConfig = DEFAULT_EVENT_CONFIG
      const { data: dbEvent } = await supabase.from('fepn_gift_events').select('*').eq('id', 'fepn-active-event').maybeSingle()
      if (dbEvent) {
        activeConfig = dbEvent
      } else {
        const cached = localStorage.getItem('fepn_gift_event_config')
        if (cached) {
          try {
            activeConfig = JSON.parse(cached)
          } catch {}
        }
      }
      setEventConfig(activeConfig)

      // 2. Load Gift Items
      let items = DEFAULT_GIFT_ITEMS
      const { data: dbItems } = await supabase.from('fepn_gift_items').select('*').order('order_index', { ascending: true })
      if (dbItems && dbItems.length > 0) {
        items = dbItems
      } else {
        const cachedItems = localStorage.getItem('fepn_gift_items_data')
        if (cachedItems) {
          try {
            const parsed = JSON.parse(cachedItems)
            if (Array.isArray(parsed) && parsed.length > 0) items = parsed
          } catch {}
        }
      }
      setGiftItems(items)

      // 3. Load User Spins (from localStorage or user state, default 0)
      if (user?.id) {
        const spinKey = `fepn_spins_${user.id}`
        const savedSpins = localStorage.getItem(spinKey)
        if (savedSpins !== null) {
          setSpinsRemaining(Number(savedSpins) || 0)
        } else {
          const initialSpins = activeConfig.default_spins ?? 0
          setSpinsRemaining(initialSpins)
          localStorage.setItem(spinKey, String(initialSpins))
        }

        // 4. Load User Claims (Match by user_id OR MSSV)
        const mssv = user.email?.split('@')[0] || ''
        let claimsQuery = supabase.from('fepn_gift_claims').select('*')
        if (user.id && mssv) {
          claimsQuery = claimsQuery.or(`user_id.eq.${user.id},user_mssv.ilike.${mssv}`)
        } else if (user.id) {
          claimsQuery = claimsQuery.eq('user_id', user.id)
        }
        const { data: dbClaims } = await claimsQuery.order('claimed_at', { ascending: false })

        if (dbClaims && dbClaims.length > 0) {
          setMyClaims(dbClaims)
          setLatestClaim((prev) => {
            if (!prev) return null
            const match = dbClaims.find((c) => c.claim_code === prev.claim_code || c.id === prev.id)
            return match || prev
          })
        } else {
          const cachedClaims = localStorage.getItem('fepn_gift_claims_data')
          if (cachedClaims) {
            try {
              const allClaims: FepnGiftClaim[] = JSON.parse(cachedClaims)
              const userClaims = allClaims.filter((c) => c.user_id === user.id || c.user_mssv === user.email?.split('@')[0])
              setMyClaims(userClaims)
            } catch {}
          }
        }
      }
    } catch (err) {
      console.warn('Error loading gift data:', err)
    }
  }, [user])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/fepn-login')
  }

  useEffect(() => {
    if (authStatus === 'authorized') {
      loadEventData()
      // Polling every 12 seconds to sync latest gift inventory and claims status
      const interval = setInterval(() => {
        loadEventData()
      }, 12000)
      return () => clearInterval(interval)
    }
  }, [authStatus, loadEventData])

  // Play audio tick on slices pass
  const playWheelTick = useCallback(() => {
    if (!soundEnabled) return
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        audioContextRef.current = new AudioCtx()
      }
      const ctx = audioContextRef.current
      if (ctx.state === 'suspended') ctx.resume()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(650, ctx.currentTime)
      gain.gain.setValueAtTime(0.08, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.04)
    } catch {}
  }, [soundEnabled])

  // Draw Lucky Wheel Canvas
  const drawWheel = useCallback(
    (currentAngle: number) => {
      const canvas = wheelCanvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const numItems = giftItems.length
      if (numItems === 0) return

      const width = canvas.width
      const height = canvas.height
      const centerX = width / 2
      const centerY = height / 2
      const radius = Math.min(centerX, centerY) - 16

      ctx.clearRect(0, 0, width, height)

      const arc = (2 * Math.PI) / numItems

      // 1. Draw outer rim with metallic glow
      ctx.save()
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius + 10, 0, 2 * Math.PI)
      ctx.fillStyle = '#1e1b4b'
      ctx.fill()

      // Gold outer ring
      ctx.lineWidth = 8
      ctx.strokeStyle = '#f59e0b'
      ctx.stroke()
      ctx.restore()

      // 2. Draw Wheel Slices
      for (let i = 0; i < numItems; i++) {
        const angle = currentAngle + i * arc
        const item = giftItems[i]

        ctx.save()
        ctx.beginPath()
        ctx.moveTo(centerX, centerY)
        ctx.arc(centerX, centerY, radius, angle, angle + arc)
        ctx.closePath()

        ctx.fillStyle = item.color || (i % 2 === 0 ? '#0284c7' : '#f43f5e')
        ctx.fill()

        // White boundary line between slices
        ctx.lineWidth = 2.5
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
        ctx.stroke()

        // Draw Text inside slice
        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate(angle + arc / 2)
        ctx.textAlign = 'right'
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 13px system-ui, -apple-system, sans-serif'
        ctx.shadowColor = 'rgba(0,0,0,0.5)'
        ctx.shadowBlur = 4

        // Shorten title if too long
        let label = item.name
        if (label.length > 18) label = label.substring(0, 16) + '...'
        ctx.fillText(label, radius - 30, 5)

        // Draw small badge or indicator if out of stock
        if (item.remaining_quantity <= 0 && !item.is_consolation) {
          ctx.font = 'bold 10px system-ui'
          ctx.fillStyle = '#fecaca'
          ctx.fillText('(Hết quà)', radius - 30, 20)
        }

        ctx.restore()
        ctx.restore()
      }

      // 3. Draw outer decorative lights (bulbs around edge)
      const numBulbs = 24
      for (let b = 0; b < numBulbs; b++) {
        const bulbAngle = (b * 2 * Math.PI) / numBulbs
        const bx = centerX + (radius + 5) * Math.cos(bulbAngle)
        const by = centerY + (radius + 5) * Math.sin(bulbAngle)
        ctx.save()
        ctx.beginPath()
        ctx.arc(bx, by, 3.5, 0, 2 * Math.PI)
        ctx.fillStyle = b % 2 === 0 ? '#fef08a' : '#ffffff'
        ctx.shadowColor = '#fef08a'
        ctx.shadowBlur = 6
        ctx.fill()
        ctx.restore()
      }

      // 4. Center hub button base
      ctx.save()
      ctx.beginPath()
      ctx.arc(centerX, centerY, 42, 0, 2 * Math.PI)
      ctx.fillStyle = '#0f172a'
      ctx.fill()
      ctx.lineWidth = 4
      ctx.strokeStyle = '#f59e0b'
      ctx.stroke()

      ctx.beginPath()
      ctx.arc(centerX, centerY, 36, 0, 2 * Math.PI)
      const grad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, 36)
      grad.addColorStop(0, '#ec4899')
      grad.addColorStop(1, '#be185d')
      ctx.fillStyle = grad
      ctx.fill()

      ctx.fillStyle = '#ffffff'
      ctx.font = '900 13px system-ui'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('QUAY', centerX, centerY)
      ctx.restore()
    },
    [giftItems]
  )

  // Re-draw wheel on rotation change or items update, and when auth is ready
  useEffect(() => {
    drawWheel(rotationAngle)
    const t = setTimeout(() => {
      drawWheel(rotationAngle)
    }, 60)
    return () => clearTimeout(t)
  }, [rotationAngle, drawWheel, authStatus, authLoading, giftItems])

  // Canvas Confetti loop
  const triggerConfetti = useCallback(() => {
    setShowConfetti(true)
    const canvas = confettiCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: {
      x: number
      y: number
      size: number
      color: string
      vx: number
      vy: number
      rotation: number
      vRot: number
    }[] = []

    const colors = ['#f43f5e', '#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#eab308']
    for (let i = 0; i < 120; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.4,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 16,
        vy: (Math.random() - 1.2) * 14,
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
      })
    }

    let frame = 0
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let active = false

      particles.forEach((p) => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.35 // gravity
        p.rotation += p.vRot

        if (p.y < canvas.height + 50) {
          active = true
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate((p.rotation * Math.PI) / 180)
          ctx.fillStyle = p.color
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
          ctx.restore()
        }
      })

      frame++
      if (active && frame < 180) {
        requestAnimationFrame(animate)
      } else {
        setShowConfetti(false)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }

    requestAnimationFrame(animate)
  }, [])

  // Action: Spin the Lucky Wheel
  const handleSpinWheel = () => {
    if (isSpinning) return

    if (spinsRemaining <= 0) {
      alert('Bạn đã hết lượt quay! Hãy nhập mã nhận thêm lượt quay hoặc liên hệ BTC để nhận thêm lượt.')
      return
    }

    if (giftItems.length === 0) {
      alert('Danh sách quà tặng đang được chuẩn bị. Vui lòng thử lại sau!')
      return
    }

    setIsSpinning(true)
    setWinningItem(null)

    // 1. Calculate Winning Item based on win_rate probabilities
    const availableItems = giftItems.map((it) => {
      if (it.remaining_quantity <= 0 && !it.is_consolation) {
        return { ...it, win_rate: 0 }
      }
      return it
    })

    const totalRate = availableItems.reduce((acc, it) => acc + (Number(it.win_rate) || 0), 0)
    let randomVal = Math.random() * (totalRate > 0 ? totalRate : 100)
    let selectedIndex = 0

    let runningSum = 0
    for (let i = 0; i < availableItems.length; i++) {
      runningSum += Number(availableItems[i].win_rate) || 0
      if (randomVal <= runningSum) {
        selectedIndex = i
        break
      }
    }

    const wonItem = giftItems[selectedIndex]
    setWinningItem(wonItem)

    // 2. Compute Target Rotation Angle
    const numItems = giftItems.length
    const arc = (2 * Math.PI) / numItems
    const targetSliceCenter = selectedIndex * arc + arc / 2
    const pointerAngle = (3 * Math.PI) / 2 // Top pointer (270 degrees)

    const currentMod = rotationAngle % (2 * Math.PI)
    let targetAngle = pointerAngle - targetSliceCenter

    while (targetAngle < currentMod) {
      targetAngle += 2 * Math.PI
    }

    // Add 6 full extra rotations
    const fullSpins = 6 * 2 * Math.PI
    const finalAngle = rotationAngle + (targetAngle - currentMod) + fullSpins

    // 3. Smooth Physical Ease-Out Animation
    const startTime = performance.now()
    const duration = 4800
    const startAngle = rotationAngle
    let lastSliceIndex = -1

    const animateSpin = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / duration)

      const easeOut = 1 - Math.pow(1 - progress, 3)
      const current = startAngle + (finalAngle - startAngle) * easeOut
      setRotationAngle(current)

      const currentSlice = Math.floor(((current % (2 * Math.PI)) / (2 * Math.PI)) * numItems)
      if (currentSlice !== lastSliceIndex) {
        lastSliceIndex = currentSlice
        playWheelTick()
      }

      if (progress < 1) {
        requestAnimationFrame(animateSpin)
      } else {
        setIsSpinning(false)

        const nextSpins = Math.max(0, spinsRemaining - 1)
        setSpinsRemaining(nextSpins)
        if (user?.id) {
          localStorage.setItem(`fepn_spins_${user.id}`, String(nextSpins))
        }

        if (!wonItem.is_consolation) {
          const updatedItems = giftItems.map((g) => {
            if (g.id === wonItem.id) {
              return { ...g, remaining_quantity: Math.max(0, g.remaining_quantity - 1) }
            }
            return g
          })
          setGiftItems(updatedItems)
          localStorage.setItem('fepn_gift_items_data', JSON.stringify(updatedItems))
          try {
            supabase
              .from('fepn_gift_items')
              .update({ remaining_quantity: Math.max(0, wonItem.remaining_quantity - 1) })
              .eq('id', wonItem.id)
          } catch {}

          const mssv = user?.email?.split('@')[0] || 'VNU'
          const randHex = Math.random().toString(36).substring(2, 6).toUpperCase()
          const claimCode = `CLAIM-${mssv.toUpperCase()}-${randHex}`

          const newClaim: FepnGiftClaim = {
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `claim-${Date.now()}`,
            event_id: eventConfig.id,
            user_id: user?.id,
            user_mssv: mssv,
            user_name: user?.user_metadata?.full_name || 'Sinh viên VNU',
            gift_id: wonItem.id,
            gift_name: wonItem.name,
            claim_code: claimCode,
            claimed_at: new Date().toISOString(),
            status: 'pending',
          }

          const updatedClaims = [newClaim, ...myClaims]
          setMyClaims(updatedClaims)
          setLatestClaim(newClaim)

          try {
            const cachedAll = localStorage.getItem('fepn_gift_claims_data')
            const allClaims = cachedAll ? JSON.parse(cachedAll) : []
            localStorage.setItem('fepn_gift_claims_data', JSON.stringify([newClaim, ...allClaims]))
            
            // Insert claim to Supabase asynchronously
            supabase.from('fepn_gift_claims').insert({
              id: newClaim.id,
              event_id: eventConfig.id,
              user_id: user?.id,
              user_mssv: mssv,
              user_name: user?.user_metadata?.full_name || 'Sinh viên VNU',
              gift_id: wonItem.id,
              gift_name: wonItem.name,
              claim_code: claimCode,
              claimed_at: new Date().toISOString(),
              status: 'pending',
            }).then(({ error }) => {
              if (error) console.warn('Supabase claim insert warning:', error)
            })
          } catch {}

          triggerConfetti()
          setShowWinModal(true)
        } else {
          alert('Chúc bạn may mắn lần sau! Đừng buồn, bạn có thể nhập thêm mã code để nhận lượt quay tiếp theo nhé!')
        }
      }
    }

    requestAnimationFrame(animateSpin)
  }

  // Action: Redeem code for spins or direct gift
  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!codeInput.trim()) return

    setCodeSubmitting(true)
    setCodeFeedback(null)

    const rawCode = codeInput.trim().toUpperCase()

    try {
      if (!user?.id) {
        setCodeFeedback({
          type: 'error',
          message: 'Vui lòng đăng nhập để sử dụng mã!',
        })
        return
      }

      // Check if this specific user has already redeemed this code
      const userRedeemedKey = `fepn_redeemed_codes_${user.id}`
      let userRedeemedList: string[] = []
      try {
        const stored = localStorage.getItem(userRedeemedKey)
        if (stored) userRedeemedList = JSON.parse(stored)
      } catch {}

      if (userRedeemedList.includes(rawCode)) {
        setCodeFeedback({
          type: 'error',
          message: 'Bạn đã đổi mã này rồi!',
        })
        return
      }

      let foundCode: FepnGiftCode | null = null

      const { data: dbCode } = await supabase.from('fepn_gift_codes').select('*').eq('code', rawCode).maybeSingle()
      if (dbCode) {
        foundCode = dbCode
      } else {
        const cached = localStorage.getItem('fepn_gift_codes_data')
        if (cached) {
          try {
            const codes: FepnGiftCode[] = JSON.parse(cached)
            const match = codes.find((c) => c.code.toUpperCase() === rawCode)
            if (match) foundCode = match
          } catch {}
        }
      }

      if (!foundCode) {
        setCodeFeedback({
          type: 'error',
          message: 'Mã không tồn tại hoặc đã hết hạn. Vui lòng kiểm tra lại!',
        })
        return
      }

      // Double check if code tracks this user
      if (Array.isArray(foundCode.redeemed_users) && foundCode.redeemed_users.includes(user.id)) {
        setCodeFeedback({
          type: 'error',
          message: 'Bạn đã đổi mã này rồi!',
        })
        return
      }

      if (foundCode.used_count >= foundCode.max_uses) {
        setCodeFeedback({
          type: 'error',
          message: 'Mã này đã được sử dụng hết số lần quy định!',
        })
        return
      }

      // Record this redemption for the user immediately
      const nextRedeemedList = [...userRedeemedList, rawCode]
      localStorage.setItem(userRedeemedKey, JSON.stringify(nextRedeemedList))

      if (!Array.isArray(foundCode.redeemed_users)) foundCode.redeemed_users = []
      foundCode.redeemed_users.push(user.id)

      if (foundCode.type === 'spin') {
        const addSpins = foundCode.spin_count || 1
        const newTotal = spinsRemaining + addSpins
        setSpinsRemaining(newTotal)
        localStorage.setItem(`fepn_spins_${user.id}`, String(newTotal))

        foundCode.used_count += 1
        updateCodeUsed(foundCode)

        setCodeFeedback({
          type: 'success',
          message: `Nạp thành công! Bạn được cộng thêm +${addSpins} lượt quay may mắn.`,
        })
        setCodeInput('')
        triggerConfetti()
      } else {
        const matchingGift = giftItems.find((g) => g.id === foundCode?.gift_item_id) || giftItems[0]

        foundCode.used_count += 1
        updateCodeUsed(foundCode)

        const mssv = user?.email?.split('@')[0] || 'VNU'
        const randHex = Math.random().toString(36).substring(2, 6).toUpperCase()
        const claimCode = `CLAIM-${mssv.toUpperCase()}-${randHex}`

        const newClaim: FepnGiftClaim = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `claim-${Date.now()}`,
          event_id: eventConfig.id,
          user_id: user?.id,
          user_mssv: mssv,
          user_name: user?.user_metadata?.full_name || 'Sinh viên VNU',
          gift_id: matchingGift.id,
          gift_name: matchingGift.name,
          claim_code: claimCode,
          claimed_at: new Date().toISOString(),
          status: 'pending',
        }

        const updatedClaims = [newClaim, ...myClaims]
        setMyClaims(updatedClaims)
        setLatestClaim(newClaim)

        try {
          const cachedAll = localStorage.getItem('fepn_gift_claims_data')
          const allClaims = cachedAll ? JSON.parse(cachedAll) : []
          localStorage.setItem('fepn_gift_claims_data', JSON.stringify([newClaim, ...allClaims]))
          
          supabase.from('fepn_gift_claims').insert({
            id: newClaim.id,
            event_id: eventConfig.id,
            user_id: user?.id,
            user_mssv: mssv,
            user_name: user?.user_metadata?.full_name || 'Sinh viên VNU',
            gift_id: matchingGift.id,
            gift_name: matchingGift.name,
            claim_code: claimCode,
            claimed_at: new Date().toISOString(),
            status: 'pending',
          }).then(({ error }) => {
            if (error) console.warn('Supabase claim insert warning:', error)
          })
        } catch {}

        setCodeFeedback({
          type: 'success',
          message: `Chúc mừng! Bạn đã nhận trực tiếp phần quà: ${matchingGift.name}`,
        })
        setCodeInput('')
        triggerConfetti()
        setShowWinModal(true)
      }
    } catch (err: any) {
      setCodeFeedback({
        type: 'error',
        message: 'Có lỗi xảy ra khi xác thực mã: ' + err.message,
      })
    } finally {
      setCodeSubmitting(false)
    }
  }

  const updateCodeUsed = (codeObj: FepnGiftCode) => {
    try {
      const cached = localStorage.getItem('fepn_gift_codes_data')
      if (cached) {
        const list: FepnGiftCode[] = JSON.parse(cached)
        const updated = list.map((c) => (c.id === codeObj.id ? codeObj : c))
        localStorage.setItem('fepn_gift_codes_data', JSON.stringify(updated))
      }
      supabase
        .from('fepn_gift_codes')
        .update({
          used_count: codeObj.used_count,
          redeemed_users: codeObj.redeemed_users || [],
        })
        .eq('id', codeObj.id)
        .then(({ error }) => {
          if (error) console.warn('Supabase code update warning:', error)
        })
    } catch {}
  }

  const handleCopyShareLink = () => {
    const url = typeof window !== 'undefined' ? window.location.href : 'https://tsv.fepn.senexam.me/fepn-gift'
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  // ========================================================
  // VIEW: LOADING SCREEN
  // ========================================================
  if (authLoading) {
    return (
      <div className={`${headingFont.variable} ${bodyFont.variable} min-h-screen grid place-items-center bg-[#F4F7FB] dark:bg-[#070B14] text-slate-900 font-sans`}>
        <div className="flex flex-col items-center gap-4 p-8 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-2xl">
          <div className="relative h-16 w-16">
            <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain animate-pulse" priority />
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-pink-600" />
            <span className="font-bold text-sm tracking-wide">Đang tải FEPN Gift Center...</span>
          </div>
        </div>
      </div>
    )
  }

  // ========================================================
  // VIEW: UNAUTHENTICATED
  // ========================================================
  if (authStatus === 'unauthenticated') {
    return (
      <div className={`${headingFont.variable} ${bodyFont.variable} min-h-screen grid place-items-center bg-[#F4F7FB] dark:bg-[#070B14] text-slate-900 p-4 font-sans`}>
        <div className="flex flex-col items-center gap-4 w-full max-w-md p-8 rounded-3xl bg-white/90 shadow-2xl text-center border border-black/10">
          <div className="relative h-16 w-16">
            <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain" priority />
          </div>
          <h2 className="text-xl font-black text-slate-900">Yêu Cầu Đăng Nhập</h2>
          <p className="text-sm text-slate-600 mb-4">
            Vui lòng đăng nhập bằng tài khoản email VNU (@vnu.edu.vn) để tham gia nhận quà và quay vòng quay may mắn của Khoa VLKT.
          </p>
          <Link
            href="/fepn-login"
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 text-white font-black uppercase text-xs tracking-wider shadow-md hover:scale-[1.02] transition"
          >
            Đăng Nhập Ngay
          </Link>
        </div>
      </div>
    )
  }

  // ========================================================
  // VIEW: EVENT INACTIVE
  // ========================================================
  if (!eventConfig.is_active && !isAdmin) {
    return (
      <div className={`${headingFont.variable} ${bodyFont.variable} min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans`}>
        <header className="border-b border-black/10 bg-white/80 backdrop-blur-xl px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/fepn-dashboard"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-black/5 hover:bg-black/10 text-slate-600 transition"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="flex items-center gap-2">
                <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-pink-500/20 bg-white p-0.5 shadow-sm">
                  <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain" priority />
                </div>
                <span className="text-base font-black text-slate-900" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
                  FEPN Gift Center
                </span>
              </div>
            </div>
            <Link
              href="/fepn-dashboard"
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              Về Dashboard
            </Link>
          </div>
        </header>

        <main className="flex-1 grid place-items-center p-4">
          <div className="flex flex-col items-center gap-4 w-full max-w-lg p-8 rounded-3xl bg-white shadow-xl text-center border border-slate-200">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-50 text-pink-600 border border-pink-100">
              <Gift className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-900">Hoạt Động Tặng Quà Chưa Bắt Đầu</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Sự kiện đổi quà và vòng quay may mắn của Khoa Vật lý kỹ thuật & Công nghệ Nano hiện đang tạm đóng hoặc chuẩn bị cho đợt hoạt động tiếp theo.
            </p>
            <p className="text-xs text-pink-600 font-bold bg-pink-50 px-4 py-2 rounded-xl">
              📢 Hãy theo dõi các thông báo từ Ban Chủ nhiệm Khoa hoặc quay lại sau nhé!
            </p>
            <Link
              href="/fepn-dashboard"
              className="mt-2 inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black uppercase tracking-wider shadow-md transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Quay Lại Dashboard</span>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  // ========================================================
  // RENDER MAIN PAGE: EVENT ACTIVE
  // ========================================================
  return (
    <div className={`${headingFont.variable} ${bodyFont.variable} min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col`}>
      <canvas
        ref={confettiCanvasRef}
        className={`pointer-events-none fixed inset-0 z-50 transition-opacity duration-300 ${
          showConfetti ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* 1. TOP HEADER BRANDING */}
      <header className="sticky top-0 z-40 border-b border-black/10 bg-white/90 backdrop-blur-xl px-4 py-3 sm:px-6 shadow-2xs">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/fepn-dashboard"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-black/5 hover:bg-black/10 text-slate-600 transition shadow-sm"
              title="Quay lại Dashboard FEPN"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <Link href="/fepn-dashboard" className="flex items-center gap-2.5 transition hover:opacity-90 group">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-2xl border border-pink-500/20 bg-white p-0.5 shadow-md group-hover:scale-105 transition">
                <Image src="/fepn-logo.png" alt="FEPN Logo" fill className="object-contain" priority />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base sm:text-lg font-black tracking-tight text-slate-900" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
                    Tài liệu FEPN
                  </span>
                  <span className="rounded-md bg-pink-500/10 px-1.5 py-0.5 text-[10px] font-black text-pink-600 border border-pink-500/20">
                    Đổi Quà
                  </span>
                </div>
                <p className="hidden sm:block text-[11px] text-slate-500 font-medium">
                  Đổi quà & Vòng quay may mắn sự kiện Khoa VLKT & CNNN
                </p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
              title="Chia sẻ mã QR hoặc link tham gia"
            >
              <Share2 className="h-3.5 w-3.5 text-pink-600" />
              <span className="hidden sm:inline">Chia Sẻ</span>
            </button>

            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-2xs"
              title={soundEnabled ? 'Tắt âm thanh hiệu ứng' : 'Bật âm thanh hiệu ứng'}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-600" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-black/10">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold leading-none text-slate-900">{user?.email?.split('@')[0]}</p>
                <span className="text-[10px] font-black text-pink-600 uppercase">
                  {isAdmin ? 'Quản Trị Viên' : 'Sinh Viên VNU'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTAINER */}
      <main className="flex-1 mx-auto w-full max-w-[1400px] p-4 sm:p-6 lg:p-8 space-y-8 pb-32 sm:pb-8">
        {/* Banner Title */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-pink-600 via-rose-600 to-amber-600 text-white p-6 sm:p-8 shadow-xl shadow-pink-600/10">
          <div className="relative z-10 max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-black uppercase tracking-wider">
              <Award className="h-3.5 w-3.5 text-yellow-300" />
              <span>Sự Kiện Đổi Quà Chính Thức</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
              {eventConfig.title}
            </h1>
            <p className="text-xs sm:text-sm text-pink-100 font-medium leading-relaxed">
              Quay may mắn hoặc nhập mã nạp lượt để rinh ngay những phần quà hiện vật độc quyền của Khoa Vật lý kỹ thuật & Công nghệ Nano!
            </p>
          </div>

          <div className="absolute right-[-20px] bottom-[-20px] opacity-15 pointer-events-none">
            <Gift className="h-64 w-64 text-white" />
          </div>
        </div>

        {/* 3. INTERACTIVE SECTION: 2 COLUMNS ON DESKTOP */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN (LG: 7 COLS) -> LUCKY WHEEL OR CODE REDEMPTION */}
          <div className="lg:col-span-7 space-y-6">
            {eventConfig.event_type === 'wheel' ? (
              <div id="wheel-section" className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm flex flex-col items-center text-center space-y-6">
                <div className="w-full flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-left">
                    <div className="p-2 rounded-xl bg-pink-50 text-pink-600">
                      <Trophy className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">Vòng Quay May Mắn FEPN</h3>
                      <p className="text-xs text-slate-500">Chạm vào nút QUAY ở giữa tâm vòng quay để bắt đầu</p>
                    </div>
                  </div>

                  <div className="px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-600 text-white font-black text-xs shadow-sm flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5" />
                    <span>Lượt còn lại: {spinsRemaining}</span>
                  </div>
                </div>

                {/* THE WHEEL CONTAINER */}
                <div className="relative flex items-center justify-center p-2">
                  <div className="absolute top-0 z-20 -translate-y-2 flex flex-col items-center filter drop-shadow-md">
                    <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[26px] border-t-amber-400" />
                    <div className="h-2 w-2 rounded-full bg-amber-500 -mt-1" />
                  </div>

                  <div className="relative max-w-[440px] w-full aspect-square">
                    <canvas
                      ref={(el) => {
                        wheelCanvasRef.current = el
                        if (el) {
                          drawWheel(rotationAngle)
                        }
                      }}
                      width={440}
                      height={440}
                      className="w-full h-full cursor-pointer select-none touch-manipulation"
                      onClick={handleSpinWheel}
                    />
                  </div>
                </div>

                {/* SPIN ACTION BUTTON */}
                <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleSpinWheel}
                    disabled={isSpinning || spinsRemaining <= 0}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-black uppercase text-sm tracking-wider shadow-lg shadow-pink-600/25 transition hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                  >
                    {isSpinning ? <Loader2 className="h-5 w-5 animate-spin" /> : <Gift className="h-5 w-5" />}
                    <span>{isSpinning ? 'Đang quay...' : `QUAY NGAY (Còn ${spinsRemaining} lượt)`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowShareModal(true)}
                    className="w-full sm:w-auto px-5 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <QrCode className="h-4 w-4 text-pink-600" />
                    <span>Mã QR Tham Gia</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <div className="p-3 rounded-2xl bg-sky-50 text-sky-600">
                    <Ticket className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Nhập Mã Nhận Quà Trực Tiếp</h3>
                    <p className="text-xs text-slate-500">Nhập mã bí mật do Ban Tổ Chức cung cấp để nhận ngay phần quà</p>
                  </div>
                </div>

                <form onSubmit={handleRedeemCode} className="space-y-4">
                  <div className="relative">
                    <input
                      type="text"
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                      placeholder="Nhập mã code (VD: FEPN-GIFT-XXXX)..."
                      className="w-full p-4 rounded-2xl border border-slate-300 bg-slate-50 font-mono text-base sm:text-lg font-black uppercase tracking-widest text-slate-900 outline-none focus:border-pink-500 focus:bg-white transition"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={codeSubmitting || !codeInput.trim()}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-black uppercase text-xs tracking-wider shadow-lg shadow-sky-600/25 transition hover:scale-[1.02] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {codeSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
                    <span>Xác Nhận Đổi Quà</span>
                  </button>

                  {codeFeedback && (
                    <div
                      className={`p-3.5 rounded-2xl text-xs font-bold border flex items-center gap-2 ${
                        codeFeedback.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {codeFeedback.type === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                      )}
                      <span>{codeFeedback.message}</span>
                    </div>
                  )}
                </form>
              </div>
            )}

            {/* REDEEM CODE FORM (FOR RECHARGING SPINS) */}
            {eventConfig.event_type === 'wheel' && (
              <div id="code-section" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-pink-50 text-pink-600">
                    <Ticket className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">Nhập Mã Nhận Thêm Lượt Quay</h4>
                    <p className="text-[11px] text-slate-500">Tham gia check-in hoặc minigame sự kiện để nhận mã code từ BTC</p>
                  </div>
                </div>

                <form onSubmit={handleRedeemCode} className="flex gap-2">
                  <input
                    type="text"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    placeholder="VD: FEPN-SPIN-ABCD"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 font-mono text-xs font-black uppercase tracking-wider outline-none focus:border-pink-500 focus:bg-white transition"
                    required
                  />
                  <button
                    type="submit"
                    disabled={codeSubmitting || !codeInput.trim()}
                    className="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-black text-xs uppercase tracking-wider shadow-sm transition hover:scale-105 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {codeSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    <span>Áp Dụng</span>
                  </button>
                </form>

                {codeFeedback && (
                  <div
                    className={`p-3 rounded-xl text-xs font-bold border flex items-center gap-2 ${
                      codeFeedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    {codeFeedback.type === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    )}
                    <span>{codeFeedback.message}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN (LG: 5 COLS) -> GIFT INVENTORY & BTC RULES */}
          <div className="lg:col-span-5 space-y-6">
            {/* 1. GIFT INVENTORY & REMAINING QUANTITY */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                    <Gift className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-black text-slate-900">Danh Sách Quà Tặng & Số Lượng Còn</h4>
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase">Cập nhật liên tục</span>
              </div>

              <div className="space-y-3">
                {giftItems.filter((item) => !item.is_consolation).map((item) => {
                  const percentLeft = Math.round((item.remaining_quantity / (item.total_quantity || 1)) * 100)
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition flex items-center gap-3.5"
                    >
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-slate-100 text-slate-400">
                            <Gift className="h-6 w-6" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-black text-slate-900 truncate">{item.name}</p>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 ${
                              item.remaining_quantity <= 0
                                ? 'bg-rose-100 text-rose-700'
                                : item.remaining_quantity <= 5
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {item.remaining_quantity <= 0 ? 'Hết quà' : `Còn ${item.remaining_quantity}/${item.total_quantity}`}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, Math.max(0, percentLeft))}%`,
                              backgroundColor: item.color || '#ec4899',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 2. BTC RULES & INSTRUCTIONS */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <Info className="h-4 w-4" />
                </div>
                <h4 className="text-sm font-black text-slate-900">Thể Thức Tham Gia & Nhận Quà</h4>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                <div className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-pink-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800">Địa điểm nhận quà: </span>
                    <span>{eventConfig.location || 'Theo thông báo của Ban Tổ Chức Khoa VLKT'}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Clock className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800">Thời gian trao quà: </span>
                    <span>{eventConfig.time || 'Theo thời gian diễn ra hoạt động của sự kiện'}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800">Cách thức nhận: </span>
                    <span>{eventConfig.how_to_receive || 'Xuất trình màn hình chứa Mã Đối Soát (Claim Code) cho BTC kiểm tra và xác nhận nhận quà'}</span>
                  </div>
                </div>
              </div>

              {eventConfig.description ? (
                <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 font-medium whitespace-pre-line">
                  {eventConfig.description}
                </div>
              ) : null}
            </div>

            {/* 3. MY WON GIFTS (LỊCH SỬ TRÚNG THƯỞNG CỦA BẢN THÂN) */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <Award className="h-4 w-4" />
                  </div>
                  <h4 className="text-sm font-black text-slate-900">Quà Đã Trúng Của Bạn ({myClaims.length})</h4>
                </div>
              </div>

              {myClaims.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Bạn chưa có phần quà nào. Hãy thử vận may ngay với vòng quay may mắn nhé!
                </p>
              ) : (
                <div className="space-y-2.5 max-h-60 overflow-y-auto">
                  {myClaims.map((claim) => (
                    <div
                      key={claim.id}
                      className="p-3 rounded-2xl border border-slate-100 bg-slate-50 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-black text-slate-900">{claim.gift_name}</p>
                        <p className="font-mono text-[11px] text-pink-600 font-bold mt-0.5">
                          Mã: {claim.claim_code}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setLatestClaim(claim)
                            setShowWinModal(true)
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-pink-200 bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold text-[11px] transition shadow-2xs"
                          title="Xem mã QR đối soát và mã code"
                        >
                          <QrCode className="h-3.5 w-3.5 text-pink-600" />
                          <span>Mã QR</span>
                        </button>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase shrink-0 ${
                            claim.status === 'delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800 animate-pulse'
                          }`}
                        >
                          {claim.status === 'delivered' ? '✓ Đã nhận' : '⏳ Chờ nhận'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 4. MODAL THÔNG TIN ĐỐI SOÁT (HIỂN THỊ CẢ MÃ QR VÀ MÃ VĂN BẢN) */}
      {showWinModal && latestClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-7 shadow-2xl text-center space-y-4 border border-pink-500/30 my-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-600 text-white shadow-lg shadow-pink-500/30">
              <PartyPopper className="h-7 w-7" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-50 text-pink-700 text-xs font-black uppercase tracking-wider mb-2">
                🎉 Thông Tin Đối Soát Nhận Quà
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900" style={{ fontFamily: 'var(--font-fepn-heading)' }}>
                {latestClaim.gift_name}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sinh viên: <strong>{latestClaim.user_name}</strong> ({latestClaim.user_mssv})
              </p>
            </div>

            {/* Trạng thái trao quà */}
            {latestClaim.status === 'delivered' ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                <Check className="h-3.5 w-3.5" />
                <span>Phần quà này đã được trao thành công</span>
              </div>
            ) : null}

            {/* KHUNG HIỂN THỊ MÃ QR ĐỐI SOÁT */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center space-y-2">
              <div className="relative w-44 h-44 rounded-2xl border-2 border-pink-500/30 p-2 bg-white shadow-sm flex items-center justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                    latestClaim.claim_code
                  )}`}
                  alt={`Mã QR Đối Soát ${latestClaim.claim_code}`}
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>

              <span className="text-[11px] font-black uppercase tracking-wider text-pink-600 flex items-center gap-1 pt-1">
                <QrCode className="h-3.5 w-3.5" />
                <span>Mã QR Đối Soát (Quét Tại Bàn BTC)</span>
              </span>
            </div>

            {/* KHUNG HIỂN THỊ MÃ VĂN BẢN (TEXT CODE) */}
            <div className="p-3.5 rounded-2xl bg-pink-50/70 border border-pink-200/80 space-y-1">
              <span className="text-[10px] font-black uppercase text-pink-700">Mã Đối Soát (Văn Bản)</span>
              <div className="flex items-center justify-center gap-2">
                <p className="text-xl sm:text-2xl font-mono font-black text-pink-600 tracking-wider select-all">
                  {latestClaim.claim_code}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(latestClaim.claim_code)
                    setCopiedClaimCode(true)
                    setTimeout(() => setCopiedClaimCode(false), 2000)
                  }}
                  className="p-2 rounded-xl border border-pink-200 bg-white hover:bg-pink-100 text-pink-600 transition shadow-2xs"
                  title="Sao chép mã đối soát"
                >
                  {copiedClaimCode ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Xuất trình <strong>Mã QR</strong> để BTC quét nhanh bằng máy ảnh, hoặc đọc <strong>Mã đối soát</strong> trên tại bàn sự kiện!
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowWinModal(false)}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-black uppercase text-xs tracking-wider shadow-md transition"
            >
              Tôi Đã Lưu Mã & QR
            </button>
          </div>
        </div>
      )}

      {/* 5. MODAL CHIA SẺ SỰ KIỆN (MÃ QR & LINK) */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-pink-50 text-pink-600">
                  <QrCode className="h-5 w-5" />
                </div>
                <h3 className="text-base font-black text-slate-900">Chia Sẻ Sự Kiện Đổi Quà</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* QR Code Image */}
            <div className="mx-auto w-48 h-48 rounded-2xl border border-slate-200 p-2 bg-white shadow-xs flex items-center justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                  typeof window !== 'undefined' ? window.location.href : 'https://tsv.fepn.senexam.me/fepn-gift'
                )}`}
                alt="QR Code Tham Gia"
                className="w-full h-full object-contain rounded-xl"
              />
            </div>

            <p className="text-xs text-slate-500">
              Quét mã QR bằng camera điện thoại để vào trang tham gia vòng quay may mắn!
            </p>

            {/* Copy Link Field */}
            <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
              <input
                type="text"
                readOnly
                value={typeof window !== 'undefined' ? window.location.href : 'https://tsv.fepn.senexam.me/fepn-gift'}
                className="flex-1 bg-transparent px-3 text-xs text-slate-700 font-medium outline-none truncate"
              />
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="px-3.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs transition flex items-center gap-1 shrink-0"
              >
                {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedLink ? 'Đã chép' : 'Sao chép'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Unified 3-Button Navigation */}
      <FepnMobileNav
        activePage="gift"
        centerButton={{
          label: 'Quay Thưởng',
          icon: <Gift className="h-6 w-6" />,
          onClick: () => {
            const wheelEl = document.getElementById('wheel-section')
            if (wheelEl) {
              wheelEl.scrollIntoView({ behavior: 'smooth' })
            }
            if (!isSpinning && spinsRemaining > 0) {
              handleSpinWheel()
            }
          },
        }}
        customDrawerActions={[
          {
            label: 'Chia Sẻ Mã QR & Link',
            icon: <Share2 className="h-4 w-4 text-pink-500" />,
            onClick: () => setShowShareModal(true),
          },
          {
            label: soundEnabled ? 'Tắt Hiệu Ứng Âm Thanh' : 'Bật Hiệu Ứng Âm Thanh',
            icon: soundEnabled ? (
              <VolumeX className="h-4 w-4 text-slate-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-500" />
            ),
            onClick: () => setSoundEnabled(!soundEnabled),
          },
          {
            label: 'Nhập Mã Nhận Thêm Lượt',
            icon: <Ticket className="h-4 w-4 text-amber-500" />,
            onClick: () => {
              const codeEl = document.getElementById('code-section')
              if (codeEl) {
                codeEl.scrollIntoView({ behavior: 'smooth' })
              }
            },
          },
          ...(isAdmin
            ? [
                {
                  label: 'Quản Trị Sự Kiện (Admin)',
                  icon: <ShieldCheck className="h-4 w-4 text-rose-500" />,
                  onClick: () => router.push('/fepn-admin'),
                },
              ]
            : []),
        ]}
        userEmail={user?.email}
        onLogout={handleLogout}
      />
    </div>
  )
}
