'use client'
// app/cleaner/home/page.tsx
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Badge, Card, Spinner, TabBar, StatusBar, SectionLabel } from '@/components/ui'
import type { Tab } from '@/components/ui'

type ShiftState = 'loading' | 'no_shift' | 'menu_sent' | 'awaiting_photo' | 'active' | 'collecting_photos' | 'complete'

const TABS: Tab[] = [
  { id: 'home',     label: 'Home',     icon: '🏠' },
  { id: 'schedule', label: 'Schedule', icon: '📅' },
  { id: 'history',  label: 'History',  icon: '🕐' },
  { id: 'profile',  label: 'Profile',  icon: '👤' },
]

export default function CleanerHome() {
  const router = useRouter()
  const [shiftState, setShiftState] = useState<ShiftState>('loading')
  const [shiftData, setShiftData]   = useState<any>(null)
  const [logId, setLogId]           = useState('')
  const [assignmentId, setAssignmentId] = useState('')
  const [siteName, setSiteName]     = useState('')
  const [signInTime, setSignInTime] = useState('')
  const [signOutTime, setSignOutTime] = useState('')
  const [photoUrls, setPhotoUrls]   = useState('')
  const [photoCount, setPhotoCount] = useState(0)
  const [uploading, setUploading]   = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError]           = useState('')
  const [cleanerName, setCleanerName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadShifts() }, [])

  async function loadShifts() {
    try {
      const res = await fetch('/api/shifts')
      if (res.status === 401) { router.push('/login'); return }
      const data = await res.json()
      setShiftData(data)

      const { todayAssignments, activeLog } = data
      setCleanerName(data.cleanerName || '')

      if (activeLog) {
        setLogId(activeLog.id)
        setSignInTime(activeLog.signInTime || '')
        setSignOutTime(activeLog.signOutTime || '')
        setPhotoUrls(activeLog.endPhotoUrls || '')
        setPhotoCount(activeLog.endPhotoAttachments?.length ?? (activeLog.endPhotoUrls || '').split('\n').filter(Boolean).length)
        setSiteName(activeLog.siteName || todayAssignments?.[0]?.site || '')

        const s = activeLog.state
        if (s === 'Awaiting Signin Photo') setShiftState('awaiting_photo')
        else if (s === 'Active') setShiftState('active')
        // 'Collecting End Photos' renamed to 'Awaiting End Photo' in base
        else if (s === 'Collecting End Photos' || s === 'Awaiting End Photo') setShiftState('collecting_photos')
        else if (s === 'Complete') setShiftState('complete')
        else setShiftState('menu_sent')
      } else if (todayAssignments?.length > 0) {
        const a = todayAssignments[0]
        setSiteName(a.site)
        setAssignmentId(a.id)
        setShiftState('menu_sent')
      } else {
        setShiftState('no_shift')
      }
    } catch {
      setError('Failed to load shifts')
      setShiftState('no_shift')
    }
  }

  async function handleSignIn() {
    setUploading(true)
    try {
      let currentLogId = logId
      if (!currentLogId) {
        const res = await fetch('/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_log', assignmentId }),
        })
        const data = await res.json()
        currentLogId = data.log.id
        setLogId(currentLogId)
      }
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sign_in', shiftLogId: currentLogId }),
      })
      const data = await res.json()
      setSignInTime(data.signInTime)
      setShiftState('awaiting_photo')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleSignInPhoto(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('shiftLogId', logId)
      form.append('file', file, file.name || 'signin.jpg')
      const res = await fetch('/api/checkin', { method: 'POST', body: form })
      if (!res.ok) throw new Error('Upload failed')
      setShiftState('active')
    } catch {
      setError('Photo upload failed. Try again.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSignOut() {
    setUploading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftLogId: logId, siteName }),
      })
      const data = await res.json()
      setSignOutTime(data.signOutTime)
      setShiftState('collecting_photos')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handlePhotos(files: FileList) {
    setUploading(true)
    try {
      let count = photoCount
      let urls  = photoUrls
      for (const file of Array.from(files)) {
        const form = new FormData()
        form.append('shiftLogId', logId)
        form.append('file', file, file.name || 'photo.jpg')
        const res  = await fetch('/api/photos', { method: 'POST', body: form })
        const data = await res.json()
        urls  = data.updatedUrls
        count = data.photoCount
      }
      setPhotoUrls(urls)
      setPhotoCount(count)
    } catch {
      setError('Some photos failed to upload. Try again.')
    } finally {
      setUploading(false)
    }
  }

  async function handleComplete() {
    if (photoCount === 0) { setError('Please send at least one photo first'); return }
    setCompleting(true)
    try {
      await fetch('/api/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftLogId: logId, signInTime, signOutTime, siteName, photoCount }),
      })
      setShiftState('complete')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCompleting(false)
    }
  }

  async function handleCantMakeIt() {
    router.push('/cleaner/report?type=unavailable')
  }

  const hr = new Date().getHours()
  const greeting = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <StatusBar />

      <div className="bg-blue-800 px-4 h-14 flex items-center justify-between flex-shrink-0">
        <span className="text-white font-semibold text-[17px] tracking-tight">
          {greeting}{cleanerName ? `, ${cleanerName}` : ''}
        </span>
        <button onClick={() => router.push('/cleaner/profile')} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white text-lg">
          👤
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center justify-between">
            {error}
            <button onClick={() => setError('')} className="text-red-400 text-lg ml-2">×</button>
          </div>
        )}

        {shiftState === 'loading' && (
          <div className="flex justify-center items-center h-48"><Spinner /></div>
        )}

        {shiftState === 'no_shift' && (
          <>
            <div className="mx-4 mt-4 bg-blue-800 rounded-2xl p-5 text-white">
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2">Today</p>
              <p className="text-xl font-bold mb-1">No shifts today</p>
              <p className="text-white/70 text-sm">Enjoy your day off!</p>
            </div>
            <SectionLabel>Quick access</SectionLabel>
            <ActionGrid router={router} />
          </>
        )}

        {shiftState === 'menu_sent' && (
          <>
            <HeroCard site={siteName} state="Not started" shiftData={shiftData?.todayAssignments?.[0]} />
            <div className="mx-4 flex flex-col gap-3 mt-1">
              <Button onClick={handleSignIn} loading={uploading}>Sign In to Shift</Button>
              <Button variant="danger" onClick={handleCantMakeIt} className="h-11 text-sm">Can't Make It</Button>
            </div>
            <SectionLabel>Quick access</SectionLabel>
            <ActionGrid router={router} />
          </>
        )}

        {shiftState === 'awaiting_photo' && (
          <>
            <HeroCard site={siteName} state="Sign-in photo needed" badge="blue" signInTime={signInTime} />
            <Card className="mx-4 mt-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-xl">📸</div>
                <div>
                  <p className="font-semibold text-gray-900">Entrance photo required</p>
                  <p className="text-xs text-gray-500">Signed in at {signInTime}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-4">Take a photo of the entrance or site signage to confirm you're on location.</p>
              <Button loading={uploading} onClick={() => fileRef.current?.click()}>
                📷 Take entrance photo
              </Button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => e.target.files?.[0] && handleSignInPhoto(e.target.files[0])} />
            </Card>
          </>
        )}

        {shiftState === 'active' && (
          <>
            <HeroCard site={siteName} state="Active shift" badge="green" signInTime={signInTime} />
            <div className="mx-4 mt-1 flex flex-col gap-3">
              <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                <span className="text-green-600 text-lg">✅</span>
                <div>
                  <p className="text-sm font-semibold text-green-800">Shift in progress</p>
                  <p className="text-xs text-green-600">Signed in at {signInTime}</p>
                </div>
              </div>
              <Button loading={uploading} onClick={handleSignOut}>Sign Out</Button>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" className="h-11 text-sm" onClick={() => router.push('/cleaner/report')}>⚠️ Report issue</Button>
                <Button variant="secondary" className="h-11 text-sm" onClick={() => router.push('/cleaner/help')}>🆘 Need help</Button>
              </div>
            </div>
          </>
        )}

        {shiftState === 'collecting_photos' && (
          <>
            <HeroCard site={siteName} state="Send end-of-shift photos" badge="blue" signInTime={signInTime} signOutTime={signOutTime} />
            <Card className="mx-4 mt-1 mb-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-xl">📸</div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">End-of-shift photos</p>
                  <p className="text-xs text-gray-500">{photoCount} photo{photoCount !== 1 ? 's' : ''} uploaded</p>
                </div>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${Math.min(100, photoCount * 20)}%` }} />
              </div>
              <p className="text-xs text-gray-400 mb-4">
                {photoCount > 0 ? `${photoCount} photo${photoCount !== 1 ? 's' : ''} ready to submit` : 'Select photos below to submit'}
              </p>
              <div className="flex flex-col gap-3">
                <Button variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
                  ➕ Add more photos
                </Button>
                <Button loading={completing} disabled={photoCount === 0} onClick={handleComplete}>
                  ✅ Complete shift ({photoCount} photo{photoCount !== 1 ? 's' : ''})
                </Button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => e.target.files && handlePhotos(e.target.files)} />
            </Card>
          </>
        )}

        {shiftState === 'complete' && (
          <>
            <div className="bg-gradient-to-br from-blue-800 to-teal-800 mx-4 mt-4 rounded-2xl p-6 text-white text-center">
              <div className="text-5xl mb-3">✅</div>
              <p className="text-xl font-bold mb-1">All done!</p>
              <p className="text-white/70 text-sm">Your manager has been notified</p>
            </div>
            <Card className="mx-4 mt-3">
              <p className="font-bold text-gray-900 mb-4">Shift summary</p>
              <div className="space-y-3 text-sm">
                <SummaryRow label="Site"      value={siteName} />
                <div className="h-px bg-gray-100" />
                <SummaryRow label="Sign in"   value={signInTime} />
                <SummaryRow label="Sign out"  value={signOutTime} />
                <div className="h-px bg-gray-100" />
                <SummaryRow label="Photos"    value={`${photoCount} submitted`} highlight />
              </div>
            </Card>
          </>
        )}

        <div className="h-6" />
      </div>

      <TabBar tabs={TABS} active="home" onChange={id => {
        if (id === 'schedule') router.push('/cleaner/schedule')
        else if (id === 'history') router.push('/cleaner/history')
        else if (id === 'profile') router.push('/cleaner/profile')
      }} />
    </div>
  )
}

function HeroCard({ site, state, badge = 'amber', signInTime, signOutTime, shiftData }: any) {
  return (
    <div className="mx-4 mt-4 bg-blue-800 rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute right-[-20px] bottom-[-20px] w-28 h-28 bg-white/5 rounded-full" />
      <p className="text-white/60 text-[11px] font-semibold uppercase tracking-wider mb-2">Today's shift</p>
      <p className="text-white text-xl font-bold tracking-tight mb-1">{site || '—'}</p>
      {shiftData?.windowStart && (
        <p className="text-white/65 text-sm mb-3">
          🕐 {shiftData.isWeekendShift ? 'Weekend — flexible' : `${shiftData.windowStart}${shiftData.windowEnd ? ` – ${shiftData.windowEnd}` : ''}`}
        </p>
      )}
      {signInTime && !signOutTime && <p className="text-white/65 text-sm mb-3">🕐 In: {signInTime}</p>}
      {signInTime && signOutTime  && <p className="text-white/65 text-sm mb-3">🕐 {signInTime} → {signOutTime}</p>}
      <Badge variant={badge as any}>{state}</Badge>
    </div>
  )
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold ${highlight ? 'text-green-600' : 'text-gray-900'}`}>{value || '—'}</span>
    </div>
  )
}

function ActionGrid({ router }: { router: any }) {
  const actions = [
    { icon: '📅', label: 'My schedule', sub: 'Next 7 days', href: '/cleaner/schedule' },
    { icon: '⚠️', label: 'Report issue', sub: 'Log a problem', href: '/cleaner/report' },
    { icon: '🕐', label: 'Shift history', sub: 'Past records',  href: '/cleaner/history' },
    { icon: '👤', label: 'My profile',   sub: 'Stats & info',  href: '/cleaner/profile' },
  ]
  return (
    <div className="grid grid-cols-2 gap-2.5 px-4 pb-4">
      {actions.map(a => (
        <button key={a.href} onClick={() => router.push(a.href)}
          className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-start gap-2 text-left active:bg-gray-50">
          <span className="text-2xl">{a.icon}</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">{a.label}</p>
            <p className="text-xs text-gray-400">{a.sub}</p>
          </div>
        </button>
      ))}
    </div>
  )
}
