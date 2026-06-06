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
  { id: 'profile',   label: 'Profile',  icon: '👤' },
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
  const [selectedCleaner, setSelectedCleaner] = useState<any | null>(null)

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

  const cleanerStats = useMemo(() => {
    if (!selectedCleaner) return null
    const cleanerName = selectedCleaner.name
    const cleanerLogs = logs.filter(l => l.cleanerName === cleanerName)
    const completedLogs = cleanerLogs.filter(l => l.state === 'Complete')
    
    const thisWeekLogs = completedLogs.filter(l => {
      const [d, m, y] = (l.date || '').split('/').map(Number)
      if (!d) return false
      return new Date(y, m - 1, d) >= weekMonday
    })
    
    const hours = thisWeekLogs.reduce((sum: number, l: any) => sum + calcHours(l.signInTime, l.signOutTime), 0)
    
    return {
      shiftsThisWeek: thisWeekLogs.length,
      hoursThisWeek: Math.round(hours * 10) / 10,
      totalCompleted: completedLogs.length,
      logs: cleanerLogs.slice(0, 10), // last 10 logs for history
    }
  }, [selectedCleaner, logs, weekMonday])

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
                  <div key={c.id} onClick={() => setSelectedCleaner(c)} className="bg-white border border-gray-200 rounded-2xl px-4 py-3 cursor-pointer active:scale-[0.99] transition-transform">
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
        if (id === 'profile')   router.push('/manager/profile')
      }} />

      {selectedCleaner && cleanerStats && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center sm:justify-center p-0 sm:p-4">
          <div className="absolute inset-0" onClick={() => setSelectedCleaner(null)} />
          
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-xl z-10 flex flex-col max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-150 flex items-center justify-between bg-blue-800 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-lg font-bold">
                  {(selectedCleaner.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[16px] leading-tight truncate">{selectedCleaner.name}</h3>
                  {selectedCleaner.phone && (
                    <p className="text-xs text-white/70 mt-0.5">{selectedCleaner.phone}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedCleaner(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-white hover:bg-white/20 active:scale-95 transition-transform"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Contact actions */}
              {selectedCleaner.phone && (
                <div className="grid grid-cols-2 gap-3">
                  <a
                    href={`tel:${selectedCleaner.phone.replace(/\s/g, '')}`}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-50 text-blue-800 text-sm font-semibold rounded-2xl border border-blue-100 active:scale-[0.98] transition-all text-center"
                  >
                    📞 Call Cleaner
                  </a>
                  <a
                    href={`sms:${selectedCleaner.phone.replace(/\s/g, '')}`}
                    className="flex items-center justify-center gap-2 py-2.5 px-4 bg-green-50 text-green-800 text-sm font-semibold rounded-2xl border border-green-100 active:scale-[0.98] transition-all text-center"
                  >
                    💬 Message (SMS)
                  </a>
                </div>
              )}

              {/* Stats Cards */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Performance stats</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: cleanerStats.shiftsThisWeek, label: 'Shifts', sub: 'this week' },
                    { value: cleanerStats.hoursThisWeek,  label: 'Hours',  sub: 'this week' },
                    { value: cleanerStats.totalCompleted, label: 'Total',  sub: 'completed' },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 border border-gray-150 rounded-2xl p-3 text-center flex flex-col justify-center">
                      <p className="text-2xl font-bold text-blue-800 tracking-tight">{s.value}</p>
                      <p className="text-[10px] font-bold text-gray-800 uppercase tracking-wider mt-0.5">{s.label}</p>
                      <p className="text-[8px] font-semibold text-gray-400 uppercase tracking-wide">{s.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent History */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Recent Shifts (Last 10)</p>
                {cleanerStats.logs.length === 0 ? (
                  <div className="bg-gray-50 rounded-2xl p-4 text-center text-xs text-gray-400">
                    No shift records found for this cleaner.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cleanerStats.logs.map((log: any) => {
                      const duration = log.signInTime && log.signOutTime 
                        ? calcHours(log.signInTime, log.signOutTime)
                        : 0
                      const durationStr = duration > 0 ? `${Math.round(duration * 10) / 10} hrs` : '—'
                      
                      return (
                        <div key={log.id} className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex justify-between items-center">
                          <div>
                            <p className="text-xs font-bold text-gray-800">{log.siteName || 'Unknown Site'}</p>
                            <p className="text-[10px] text-gray-400 font-medium mt-0.5">{log.date}</p>
                          </div>
                          <div className="text-right">
                            <Badge variant={log.state === 'Complete' ? 'green' : log.state === 'Unavailable' ? 'red' : 'blue'}>
                              {log.state}
                            </Badge>
                            {log.state === 'Complete' && log.signInTime && (
                              <p className="text-[9px] text-gray-400 font-medium mt-1">
                                {log.signInTime} - {log.signOutTime} ({durationStr})
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
