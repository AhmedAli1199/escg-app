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

  useEffect(() => {
    // Register push notifications
    registerPush()
    loadDashboard()
    const interval = setInterval(loadDashboard, 60000) // refresh every minute
    return () => clearInterval(interval)
  }, [])

  async function registerPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      })
      await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })
    } catch (err) {
      console.error('Push registration failed:', err)
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

  const { sites = [], stats = {}, cleanerSummaries = [], todayDate = '' } = data || {}
  const hasAlerts = sites.some((s: any) => s.status === 'noshow')

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <StatusBar />
      <div className="bg-blue-800 h-14 flex items-center px-4 justify-between flex-shrink-0">
        <span className="text-white font-semibold text-[17px] tracking-tight">
          Thu {todayDate}
        </span>
        <button onClick={() => router.push('/manager/alerts')} className="relative w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-white">
          🔔
          {hasAlerts && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2.5 p-4 pb-2">
          {[
            { label: 'Scheduled', value: stats.scheduled, color: 'text-gray-900' },
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
      </div>

      <TabBar tabs={TABS} active="dashboard" badge={hasAlerts ? 'alerts' : undefined}
        onChange={id => {
          if (id === 'logs')    router.push('/manager/logs')
          if (id === 'alerts')  router.push('/manager/alerts')
          if (id === 'cleaners') router.push('/manager/cleaners')
        }}
      />
    </div>
  )
}
