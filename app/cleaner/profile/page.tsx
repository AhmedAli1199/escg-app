'use client'
// app/cleaner/profile/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Spinner, TabBar, StatusBar, SectionLabel, ListItem, IconCircle } from '@/components/ui'
import type { Tab } from '@/components/ui'

const TABS: Tab[] = [
  { id: 'home',     label: 'Home',     icon: '🏠' },
  { id: 'schedule', label: 'Schedule', icon: '📅' },
  { id: 'history',  label: 'History',  icon: '🕐' },
  { id: 'profile',  label: 'Profile',  icon: '👤' },
]

function calcHours(signIn: string, signOut: string): number {
  if (!signIn || !signOut) return 0
  const [ih, im] = signIn.split(':').map(Number)
  const [oh, om] = signOut.split(':').map(Number)
  let mins = (oh * 60 + om) - (ih * 60 + im)
  if (mins < 0) mins += 1440
  return Math.round((mins / 60) * 10) / 10
}

export default function CleanerProfile() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [notifs, setNotifs] = useState(false)
  const [stats, setStats] = useState({
    shiftsThisWeek: 0,
    hoursThisWeek: 0,
    totalCompleted: 0,
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [shiftsRes, logsRes] = await Promise.all([
        fetch('/api/shifts'),
        fetch('/api/cleaner/logs'),
      ])
      if (shiftsRes.status === 401) { router.push('/login'); return }

      const shiftsData = await shiftsRes.json()
      setName(shiftsData.cleanerName || '')

      const logsData = logsRes.ok ? await logsRes.json() : { logs: [] }
      const logs: any[] = logsData.logs || []

      // This week: Monday 00:00 to now
      const now = new Date()
      const dayOfWeek = now.getDay()
      const monday = new Date(now)
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      monday.setHours(0, 0, 0, 0)

      let shiftsThisWeek = 0
      let hoursThisWeek = 0
      let totalCompleted = 0

      for (const log of logs) {
        if (log.state !== 'Complete') continue
        totalCompleted++
        const [d, m, y] = (log.date || '').split('/').map(Number)
        if (!d) continue
        const logDate = new Date(y, m - 1, d)
        if (logDate >= monday) {
          shiftsThisWeek++
          hoursThisWeek += calcHours(log.signInTime, log.signOutTime)
        }
      }

      setStats({
        shiftsThisWeek,
        hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
        totalCompleted,
      })
    } catch {
      // non-fatal — show what we can
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await fetch('/api/auth', { method: 'DELETE' })
    } finally {
      router.push('/login')
    }
  }

  async function toggleNotifications() {
    if (notifs) { setNotifs(false); return }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') return
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      })
      await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })
      setNotifs(true)
    } catch {}
  }

  if (loading) return (
    <div className="flex flex-col h-screen bg-gray-50">
      <StatusBar />
      <div className="bg-blue-800 h-14 flex items-center px-4 flex-shrink-0">
        <span className="text-white font-semibold text-[17px]">My Profile</span>
      </div>
      <div className="flex-1 flex items-center justify-center"><Spinner /></div>
      <TabBar tabs={TABS} active="profile" onChange={() => {}} />
    </div>
  )

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <StatusBar />
      <div className="bg-blue-800 h-14 flex items-center px-4 flex-shrink-0">
        <span className="text-white font-semibold text-[17px] tracking-tight">My Profile</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Avatar */}
        <div className="flex flex-col items-center pt-6 pb-2">
          <div className="w-16 h-16 bg-blue-800 rounded-full flex items-center justify-center text-3xl mb-3">
            👤
          </div>
          <p className="text-lg font-bold text-gray-900">{name || 'Cleaner'}</p>
          <p className="text-sm text-gray-400">ESCG Team</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 px-4 mt-3 mb-1">
          {[
            { value: stats.shiftsThisWeek, label: 'Shifts', sub: 'this week' },
            { value: stats.hoursThisWeek,  label: 'Hours',  sub: 'this week' },
            { value: stats.totalCompleted, label: 'Total',  sub: 'completed' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-800">{s.value}</p>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Settings */}
        <SectionLabel>Settings</SectionLabel>
        <Card className="mx-4">
          <ListItem
            icon={<IconCircle color="blue">🔔</IconCircle>}
            title="Push notifications"
            subtitle={notifs ? 'Enabled' : 'Tap to enable'}
            right={
              <div
                onClick={toggleNotifications}
                className={`w-11 h-6 rounded-full transition-colors cursor-pointer flex items-center px-0.5 ${notifs ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${notifs ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            }
          />
          <div className="h-px bg-gray-100" />
          <ListItem
            icon={<IconCircle color="blue">📅</IconCircle>}
            title="My schedule"
            subtitle="Upcoming shifts"
            right={<span className="text-gray-300 text-sm">›</span>}
            onClick={() => router.push('/cleaner/schedule')}
          />
          <div className="h-px bg-gray-100" />
          <ListItem
            icon={<IconCircle color="blue">🕐</IconCircle>}
            title="Shift history"
            subtitle="Past records"
            right={<span className="text-gray-300 text-sm">›</span>}
            onClick={() => router.push('/cleaner/history')}
          />
          <div className="h-px bg-gray-100" />
          <ListItem
            icon={<IconCircle color="red">⚠️</IconCircle>}
            title="Report an issue"
            subtitle="Log a problem"
            right={<span className="text-gray-300 text-sm">›</span>}
            onClick={() => router.push('/cleaner/report')}
          />
        </Card>

        {/* Sign out */}
        <div className="px-4 mt-4 pb-4">
          <Button variant="danger" loading={signingOut} onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
        <div className="h-6" />
      </div>

      <TabBar tabs={TABS} active="profile" onChange={id => {
        if (id === 'home') router.push('/cleaner/home')
        else if (id === 'schedule') router.push('/cleaner/schedule')
        else if (id === 'history') router.push('/cleaner/history')
      }} />
    </div>
  )
}
