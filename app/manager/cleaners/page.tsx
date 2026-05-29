'use client'
// app/manager/cleaners/page.tsx
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, Spinner, TabBar, StatusBar, SectionLabel } from '@/components/ui'
import type { Tab } from '@/components/ui'

const TABS: Tab[] = [
  { id: 'dashboard', label: 'Today',    icon: '⊞' },
  { id: 'cleaners',  label: 'Cleaners', icon: '👥' },
  { id: 'logs',      label: 'Logs',     icon: '📋' },
  { id: 'alerts',    label: 'Alerts',   icon: '🔔' },
]

const TODAY_STATUS: Record<string, { variant: 'blue' | 'green' | 'red' | 'amber' | 'gray'; label: string }> = {
  active:    { variant: 'blue',  label: 'Active now' },
  complete:  { variant: 'green', label: 'Done today' },
  noshow:    { variant: 'red',   label: 'No show' },
  scheduled: { variant: 'amber', label: 'Scheduled' },
  off:       { variant: 'gray',  label: 'Day off' },
}

function calcHours(signIn: string, signOut: string): number {
  if (!signIn || !signOut) return 0
  const [ih, im] = signIn.split(':').map(Number)
  const [oh, om] = signOut.split(':').map(Number)
  let mins = (oh * 60 + om) - (ih * 60 + im)
  if (mins < 0) mins += 1440
  return mins / 60
}

export default function ManagerCleaners() {
  const router = useRouter()
  const [cleanerSummaries, setCleanerSummaries] = useState<any[]>([])
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [dashRes, logsRes] = await Promise.all([
        fetch('/api/manager/dashboard'),
        fetch('/api/manager/logs'),
      ])
      if (dashRes.status === 401) { router.push('/login'); return }

      const dashData = await dashRes.json()
      setCleanerSummaries(dashData.cleanerSummaries || [])

      const logsData = logsRes.ok ? await logsRes.json() : { logs: [] }
      setLogs(logsData.logs || [])
    } catch {
    } finally {
      setLoading(false)
    }
  }

  // Monday of current week
  const weekMonday = useMemo(() => {
    const now = new Date()
    const day = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
    monday.setHours(0, 0, 0, 0)
    return monday
  }, [])

  function getWeekStats(cleanerName: string) {
    const thisWeekLogs = logs.filter(l => {
      if (l.cleanerName !== cleanerName || l.state !== 'Complete') return false
      const [d, m, y] = (l.date || '').split('/').map(Number)
      if (!d) return false
      return new Date(y, m - 1, d) >= weekMonday
    })
    const hours = thisWeekLogs.reduce((sum: number, l: any) => sum + calcHours(l.signInTime, l.signOutTime), 0)
    return {
      shifts: thisWeekLogs.length,
      hours:  Math.round(hours * 10) / 10,
    }
  }

  function lastActive(cleanerName: string): string {
    const match = logs.find(l => l.cleanerName === cleanerName && l.signInTime)
    return match ? match.date : 'Never'
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <StatusBar />

      <div className="bg-blue-800 h-14 flex items-center px-4 flex-shrink-0">
        <span className="text-white font-semibold text-[17px] tracking-tight">Team</span>
        {!loading && (
          <span className="text-white/60 text-sm font-normal ml-2">
            ({cleanerSummaries.length})
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center items-center h-32"><Spinner /></div>
        )}

        {!loading && (
          <>
            <SectionLabel>All cleaners</SectionLabel>
            <div className="px-3 flex flex-col gap-2">
              {cleanerSummaries.map((c: any) => {
                const status = TODAY_STATUS[c.todayStatus] || TODAY_STATUS.off
                const week   = getWeekStats(c.name)
                const last   = lastActive(c.name)
                const initial = (c.name || '?').charAt(0).toUpperCase()

                return (
                  <div key={c.id} className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                    {/* Header row */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-blue-800 rounded-full flex items-center justify-center text-white text-base font-bold flex-shrink-0">
                        {initial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                        <p className="text-xs text-gray-400">Last active: {last}</p>
                      </div>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Shifts (wk)', value: week.shifts },
                        { label: 'Hours (wk)',  value: week.hours  },
                        { label: 'Today',       value: c.sitesCount },
                      ].map(s => (
                        <div key={s.label} className="bg-gray-50 rounded-xl px-2 py-2 text-center">
                          <p className="text-sm font-bold text-gray-900">{s.value}</p>
                          <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
        <div className="h-4" />
      </div>

      <TabBar tabs={TABS} active="cleaners" onChange={id => {
        if (id === 'dashboard') router.push('/manager/dashboard')
        if (id === 'logs')      router.push('/manager/logs')
        if (id === 'alerts')    router.push('/manager/alerts')
      }} />
    </div>
  )
}
