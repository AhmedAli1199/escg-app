'use client'
// app/cleaner/home/page.tsx
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Badge, Card, Spinner, TabBar, StatusBar, SectionLabel } from '@/components/ui'
import type { Tab } from '@/components/ui'
import imageCompression from 'browser-image-compression'

type ShiftState = 'loading' | 'no_shift' | 'menu_sent' | 'awaiting_photo' | 'active' | 'collecting_photos' | 'complete'

const TABS: Tab[] = [
  { id: 'home',     label: 'Home',     icon: '🏠' },
  { id: 'schedule', label: 'Schedule', icon: '📅' },
  { id: 'history',  label: 'History',  icon: '🕐' },
  { id: 'profile',  label: 'Profile',  icon: '👤' },
]

async function compressPhoto(file: File): Promise<File> {
  try {
    return await imageCompression(file, { maxSizeMB: 3, maxWidthOrHeight: 1920, useWebWorker: true })
  } catch {
    return file
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export default function CleanerHome() {
  const router = useRouter()
  const [loading, setLoading]       = useState(true)
  const [shifts, setShifts]         = useState<any[]>([])
  const [cleanerName, setCleanerName] = useState('')
  const [uploadTargetId, setUploadTargetId] = useState('')
  const [uploading, setUploading]   = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError]           = useState('')
  
  const signInFileRef = useRef<HTMLInputElement>(null)
  const photosFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadShifts() }, [])

  async function loadShifts() {
    try {
      const res = await fetch('/api/shifts')
      if (res.status === 401) { router.push('/login'); return }
      const data = await res.json()
      setCleanerName(data.cleanerName || '')
      setShifts(data.shifts || [])
    } catch {
      setError('Failed to load shifts')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignIn(assignmentId: string) {
    setUploading(true)
    setError('')
    try {
      const shift = shifts.find(s => s.assignment.id === assignmentId)
      let currentLogId = shift?.log?.id

      if (!currentLogId) {
        const res = await fetch('/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_log', assignmentId }),
        })
        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Failed to create shift log')
        }
        const data = await res.json()
        currentLogId = data.log.id
      }

      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sign_in', shiftLogId: currentLogId }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to sign in')
      }

      await loadShifts()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleSignInPhoto(assignmentId: string, file: File) {
    setUploading(true)
    setError('')
    try {
      const shift = shifts.find(s => s.assignment.id === assignmentId)
      const currentLogId = shift?.log?.id
      if (!currentLogId) throw new Error('No active shift log found')

      const compressed = await compressPhoto(file)
      const base64 = arrayBufferToBase64(await compressed.arrayBuffer())

      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sign_in_photo',
          shiftLogId: currentLogId,
          base64,
          contentType: file.type || 'image/jpeg',
          filename: file.name || 'signin.jpg',
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload failed')
      }

      await loadShifts()
    } catch (err: any) {
      setError(err.message || 'Photo upload failed. Try again.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSignOut(assignmentId: string) {
    setUploading(true)
    setError('')
    try {
      const shift = shifts.find(s => s.assignment.id === assignmentId)
      const currentLogId = shift?.log?.id
      if (!currentLogId) throw new Error('No active shift log found')

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftLogId: currentLogId, siteName: shift.assignment.site }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to sign out')
      }

      await loadShifts()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handlePhotos(assignmentId: string, files: FileList) {
    setUploading(true)
    setError('')
    try {
      const shift = shifts.find(s => s.assignment.id === assignmentId)
      const currentLogId = shift?.log?.id
      if (!currentLogId) throw new Error('No active shift log found')

      for (const file of Array.from(files)) {
        const compressed = await compressPhoto(file)
        const base64 = arrayBufferToBase64(await compressed.arrayBuffer())

        const res = await fetch('/api/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shiftLogId: currentLogId,
            base64,
            contentType: file.type || 'image/jpeg',
            filename: file.name || 'photo.jpg',
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Upload failed')
        }
      }

      await loadShifts()
    } catch (err: any) {
      setError(err.message || 'Some photos failed to upload. Try again.')
    } finally {
      setUploading(false)
    }
  }

  async function handleComplete(assignmentId: string) {
    const shift = shifts.find(s => s.assignment.id === assignmentId)
    const currentLogId = shift?.log?.id
    if (!currentLogId) throw new Error('No active shift log found')

    const photoCount = shift.log.endPhotoAttachments?.length ?? (shift.log.endPhotoUrls || '').split('\n').filter(Boolean).length
    if (photoCount === 0) {
      setError('Please send at least one photo first')
      return
    }

    setCompleting(true)
    setError('')
    try {
      const res = await fetch('/api/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftLogId: currentLogId,
          signInTime: shift.log.signInTime,
          signOutTime: shift.log.signOutTime,
          siteName: shift.assignment.site,
          photoCount,
        }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to complete shift')
      }

      await loadShifts()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCompleting(false)
    }
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

        {loading && (
          <div className="flex justify-center items-center h-48"><Spinner /></div>
        )}

        {!loading && shifts.length === 0 && (
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

        {!loading && shifts.length > 0 && (
          <div className="flex flex-col gap-4 pb-4">
            {shifts.map((shift) => {
              const { assignment, log, state } = shift
              const signInTime = log?.signInTime || ''
              const signOutTime = log?.signOutTime || ''
              const photoCount = log?.endPhotoAttachments?.length ?? (log?.endPhotoUrls || '').split('\n').filter(Boolean).length

              return (
                <div key={assignment.id} className="mx-4 mt-4 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                  {/* Shift Info */}
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-gray-900 text-lg">{assignment.site}</p>
                      {assignment.windowStart && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          🕐 {assignment.isWeekendShift ? 'Weekend — flexible' : `${assignment.windowStart}${assignment.windowEnd ? ` – ${assignment.windowEnd}` : ''}`}
                        </p>
                      )}
                      {signInTime && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          In: {signInTime} {signOutTime ? `→ Out: ${signOutTime}` : ''}
                        </p>
                      )}
                    </div>
                    <Badge variant={state === 'complete' ? 'green' : state === 'active' ? 'green' : state === 'menu_sent' ? 'amber' : 'blue'}>
                      {state === 'menu_sent' ? 'Not started' : state === 'awaiting_photo' ? 'Sign-in photo needed' : state === 'active' ? 'Active' : state === 'collecting_photos' ? 'End photos needed' : 'Complete'}
                    </Badge>
                  </div>

                  {/* Actions based on state */}
                  {state === 'menu_sent' && (
                    <div className="flex flex-col gap-2.5">
                      <Button onClick={() => handleSignIn(assignment.id)} loading={uploading}>Sign In to Shift</Button>
                      <Button variant="danger" onClick={() => router.push(`/cleaner/report?type=unavailable&assignmentId=${assignment.id}&shiftLogId=${log?.id || ''}&siteName=${encodeURIComponent(assignment.site)}`)} className="h-11 text-sm">Can't Make It</Button>
                    </div>
                  )}

                  {state === 'awaiting_photo' && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 flex flex-col gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">📸</span>
                        <p className="font-semibold text-sm text-gray-900">Entrance photo required</p>
                      </div>
                      <p className="text-xs text-gray-600">Take a photo of the entrance or site signage to confirm you're on location.</p>
                      <Button loading={uploading} onClick={() => {
                        setUploadTargetId(assignment.id)
                        signInFileRef.current?.click()
                      }}>
                        📷 Take entrance photo
                      </Button>
                    </div>
                  )}

                  {state === 'active' && (
                    <div className="flex flex-col gap-2.5">
                      <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
                        <span className="text-green-600 text-base">✅</span>
                        <div>
                          <p className="text-xs font-semibold text-green-800">Shift in progress</p>
                          <p className="text-[10px] text-green-600">Signed in at {signInTime}</p>
                        </div>
                      </div>
                      <Button loading={uploading} onClick={() => handleSignOut(assignment.id)}>Sign Out</Button>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="secondary" className="h-10 text-xs" onClick={() => router.push(`/cleaner/report?shiftLogId=${log?.id}&siteName=${encodeURIComponent(assignment.site)}`)}>⚠️ Report issue</Button>
                        <Button variant="secondary" className="h-10 text-xs" onClick={() => router.push(`/cleaner/help?shiftLogId=${log?.id}&siteName=${encodeURIComponent(assignment.site)}`)}>🆘 Need help</Button>
                      </div>
                    </div>
                  )}

                  {state === 'collecting_photos' && (
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 flex flex-col gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">📸</span>
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-gray-900">End-of-shift photos</p>
                          <p className="text-xs text-gray-500">{photoCount} photo{photoCount !== 1 ? 's' : ''} uploaded</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-200/60 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100, photoCount * 20)}%` }} />
                      </div>
                      <div className="flex flex-col gap-2 mt-1">
                        <Button variant="secondary" className="h-10 text-xs" loading={uploading} onClick={() => {
                          setUploadTargetId(assignment.id)
                          photosFileRef.current?.click()
                        }}>
                          ➕ Add more photos
                        </Button>
                        <Button loading={completing} disabled={photoCount === 0} onClick={() => handleComplete(assignment.id)}>
                          ✅ Complete shift ({photoCount} photo{photoCount !== 1 ? 's' : ''})
                        </Button>
                      </div>
                    </div>
                  )}

                  {state === 'complete' && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🎉</span>
                        <div>
                          <p className="text-xs font-bold text-gray-900">All done!</p>
                          <p className="text-[10px] text-gray-500">Your manager has been notified.</p>
                        </div>
                      </div>
                      <div className="bg-white border border-gray-100 rounded-lg p-2.5 text-xs flex flex-col gap-1.5 shadow-sm">
                        <div className="flex justify-between"><span className="text-gray-400">Sign in</span><span className="font-semibold">{signInTime}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Sign out</span><span className="font-semibold">{signOutTime}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400">Photos</span><span className="font-semibold text-green-600">{photoCount} submitted</span></div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            <SectionLabel>Quick access</SectionLabel>
            <ActionGrid router={router} />
          </div>
        )}

        <input ref={signInFileRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => e.target.files?.[0] && handleSignInPhoto(uploadTargetId, e.target.files[0])} />

        <input ref={photosFileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => e.target.files && handlePhotos(uploadTargetId, e.target.files)} />

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
