'use client'
// app/manager/dashboard/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, Spinner, TabBar, StatusBar } from '@/components/ui'
import type { Tab } from '@/components/ui'
import clsx from 'clsx'

const TABS: Tab[] = [
  { id: 'dashboard', label: 'Today',    icon: '⊞' },
  { id: 'cleaners',  label: 'Cleaners', icon: '👥' },
  { id: 'logs',      label: 'Logs',     icon: '📋' },
  { id: 'alerts',    label: 'Alerts',   icon: '🔔' },
  { id: 'profile',   label: 'Profile',  icon: '👤' },
]

const STATUS_COLORS: Record<string, string> = {
  complete:    'bg-green-500',
  active:      'bg-blue-400',
  noshow:      'bg-red-500',
  unavailable: 'bg-red-300',
  notstarted:  'bg-amber-500',
  tonight:     'bg-gray-300',
}

const STATUS_BADGE: Record<string, any> = {
  complete: 'green', active: 'blue', noshow: 'red',
  unavailable: 'red', notstarted: 'amber', tonight: 'gray',
}

const STATUS_LABEL: Record<string, string> = {
  complete: 'Complete', active: 'Active', noshow: 'No show',
  unavailable: 'Unavailable', notstarted: 'Not started', tonight: 'Tonight',
}

export default function ManagerDashboard() {
  const router = useRouter()
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [viewMode, setViewMode] = useState<'today' | 'roster'>('today')

  const [pushSupported, setPushSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    loadDashboard()
    const interval = setInterval(loadDashboard, 60000) // refresh every minute

    // Check push support and current subscription status
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true)
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription()
        setIsSubscribed(!!sub)
      }).catch(err => {
        console.error('Failed to get service worker ready status:', err)
      })
    }

    return () => clearInterval(interval)
  }, [])

  async function handleSubscribe() {
    if (!pushSupported || subscribing) return
    setSubscribing(true)
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        alert('Notification permission denied. Please enable notifications in your browser/device settings.')
        setSubscribing(false)
        return
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      })

      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })
      if (!res.ok) throw new Error('Failed to save subscription')

      setIsSubscribed(true)
    } catch (err: any) {
      console.error('Subscription failed:', err)
      alert('Failed to enable push notifications: ' + err.message)
    } finally {
      setSubscribing(false)
    }
  }

  async function handleUnsubscribe() {
    if (!pushSupported || subscribing) return
    setSubscribing(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        const res = await fetch('/api/push', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        if (!res.ok) throw new Error('Failed to remove subscription')
      }
      setIsSubscribed(false)
    } catch (err: any) {
      console.error('Unsubscription failed:', err)
      alert('Failed to disable push notifications: ' + err.message)
    } finally {
      setSubscribing(false)
    }
  }

  async function loadDashboard() {
    try {
      const res = await fetch('/api/manager/dashboard')
      if (res.status === 401) { router.push('/login'); return }
      const d = await res.json()
      setData(d)
    } catch {
      setError('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col h-screen bg-gray-50">
      <StatusBar />
      <div className="bg-blue-800 h-14 flex items-center px-4">
        <span className="text-white font-semibold">Loading...</span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    </div>
  )

  const { sites = [], stats = {}, cleanerSummaries = [], todayDate = '', todayDay = '', roster = [] } = data || {}
  const hasAlerts = sites.some((s: any) => s.status === 'noshow')

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <StatusBar />
      <div className="bg-blue-800 h-14 flex items-center px-4 justify-between flex-shrink-0">
        <span className="text-white font-semibold text-[17px] tracking-tight">
          {todayDay ? `${todayDay} ` : ''}{todayDate}
        </span>
        <button onClick={() => router.push('/manager/alerts')} className="relative w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-white">
          🔔
          {hasAlerts && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
        </button>
      </div>

      {/* View Mode Toggle */}
      <div className="bg-blue-800 px-4 pb-3 flex justify-center flex-shrink-0">
        <div className="bg-blue-900/40 p-0.5 rounded-xl flex w-full">
          <button
            onClick={() => setViewMode('today')}
            className={clsx(
              "flex-1 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200",
              viewMode === 'today' ? "bg-white text-blue-900 shadow-sm" : "text-white/70 hover:text-white"
            )}
          >
            Today's Overview
          </button>
          <button
            onClick={() => setViewMode('roster')}
            className={clsx(
              "flex-1 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200",
              viewMode === 'roster' ? "bg-white text-blue-900 shadow-sm" : "text-white/70 hover:text-white"
            )}
          >
            Weekly Roster
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {pushSupported && (
          <div className="mx-4 mt-4 p-3.5 rounded-2xl bg-white border border-gray-200 flex items-center justify-between transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className={clsx(
                "w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-colors duration-300",
                isSubscribed ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"
              )}>
                {isSubscribed ? '🔔' : '🔕'}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800">
                  {isSubscribed ? 'Alerts Activated' : 'Manager Alerts'}
                </p>
                <p className="text-[10px] text-gray-500 font-medium">
                  {isSubscribed ? 'Receiving real-time shift updates' : 'Enable mobile push notifications'}
                </p>
              </div>
            </div>
            <button
              onClick={isSubscribed ? handleUnsubscribe : handleSubscribe}
              disabled={subscribing}
              className={clsx(
                "px-3.5 py-1.5 rounded-xl text-xs font-semibold tracking-wide shadow-sm transition-all active:scale-95 duration-250 flex items-center justify-center min-w-[76px]",
                isSubscribed 
                  ? "bg-gray-100 hover:bg-gray-200 text-gray-600" 
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              )}
            >
              {subscribing ? (
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : isSubscribed ? (
                'Disable'
              ) : (
                'Enable'
              )}
            </button>
          </div>
        )}

        {viewMode === 'roster' ? (
          <div className="p-4 space-y-4">
            {roster.map((dayData: any) => (
              <div key={dayData.date} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-3">
                  <span className="font-bold text-gray-900 text-sm">{dayData.day}</span>
                  <span className="text-xs text-gray-400 font-semibold">{dayData.date}</span>
                </div>
                {dayData.shifts.length === 0 ? (
                  <p className="text-xs text-gray-400 py-1 italic">No shifts scheduled for this day</p>
                ) : (
                  <div className="space-y-2.5">
                    {dayData.shifts.map((shift: any) => (
                      <div key={shift.id} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-b-0">
                        <div className="min-w-0 flex-1 pr-3">
                          <p className="text-xs font-bold text-gray-800 truncate">{shift.site}</p>
                          {shift.windowStart && (
                            <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                              🕐 {shift.isWeekendShift ? 'Weekend — flexible' : `${shift.windowStart}${shift.windowEnd ? ` – ${shift.windowEnd}` : ''}`}
                            </p>
                          )}
                        </div>
                        <Badge variant="blue">
                          {shift.cleaner}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-2.5 p-4 pb-2">
              {[
                { label: 'Scheduled', value: (stats.scheduled ?? 0) - (stats.complete ?? 0), color: 'text-gray-900' },
                { label: 'Complete',  value: stats.complete,  color: 'text-green-600' },
                { label: 'Active',    value: stats.active,    color: 'text-blue-600'  },
                { label: 'No show',   value: stats.noShow,    color: 'text-red-600'   },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl border border-gray-200 p-3.5">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{s.label}</p>
                  <p className={`text-3xl font-bold tracking-tight ${s.color}`}>{s.value ?? '—'}</p>
                </div>
              ))}
            </div>

            <p className="px-4 pt-2 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">All sites today</p>

            {/* Site grid */}
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              {sites.map((s: any) => (
                <div key={s.assignmentId} className="bg-white rounded-2xl border border-gray-200 p-3">
                  <p className="text-xs font-semibold text-gray-900 leading-tight mb-1">{s.site}</p>
                  <p className="text-[11px] text-gray-400 mb-2">{s.cleaner}</p>
                  <div className={`h-1 rounded-full ${STATUS_COLORS[s.status] || 'bg-gray-200'}`} />
                  {s.signInTime && (
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      In {s.signInTime}{s.signOutTime ? ` · Out ${s.signOutTime}` : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="px-4 pb-4 flex flex-wrap gap-3">
              {Object.entries(STATUS_LABEL).map(([key, label]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-sm ${STATUS_COLORS[key]}`} />
                  <span className="text-[11px] text-gray-500 font-medium">{label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <TabBar tabs={TABS} active="dashboard" badge={hasAlerts ? 'alerts' : undefined}
        onChange={id => {
          if (id === 'logs')     router.push('/manager/logs')
          if (id === 'alerts')   router.push('/manager/alerts')
          if (id === 'cleaners') router.push('/manager/cleaners')
          if (id === 'profile')  router.push('/manager/profile')
        }}
      />
    </div>
  )
}
