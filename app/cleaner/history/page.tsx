'use client'
// app/cleaner/history/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, Card, Spinner, TabBar, StatusBar, SectionLabel } from '@/components/ui'
import type { Tab } from '@/components/ui'

const TABS: Tab[] = [
  { id: 'home',     label: 'Home',     icon: '🏠' },
  { id: 'schedule', label: 'Schedule', icon: '📅' },
  { id: 'history',  label: 'History',  icon: '🕐' },
  { id: 'profile',  label: 'Profile',  icon: '👤' },
]

function parseLogDate(ddMMyyyy: string): Date | null {
  if (!ddMMyyyy) return null
  const parts = ddMMyyyy.split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts.map(Number)
  if (!d || !m || !y) return null
  return new Date(y, m - 1, d)
}

function getWeekMonday(date: Date): Date {
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function weekLabel(monday: Date): string {
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${monday.toLocaleDateString('en-AU', opts)} – ${sunday.toLocaleDateString('en-AU', opts)}`
}

function calcDuration(signIn: string, signOut: string): string {
  if (!signIn || !signOut) return ''
  const [ih, im] = signIn.split(':').map(Number)
  const [oh, om] = signOut.split(':').map(Number)
  let mins = (oh * 60 + om) - (ih * 60 + im)
  if (mins < 0) mins += 1440
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}

function stateBadge(state: string): { variant: 'green' | 'red' | 'amber' | 'gray'; label: string } {
  if (state === 'Complete') return { variant: 'green', label: 'Complete' }
  if (state === 'No Show') return { variant: 'red', label: 'No show' }
  if (state === 'Unavailable') return { variant: 'amber', label: 'Unavailable' }
  return { variant: 'gray', label: state || 'Unknown' }
}

export default function CleanerHistory() {
  const router = useRouter()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    try {
      const res = await fetch('/api/cleaner/logs')
      if (res.status === 401) { router.push('/login'); return }
      const data = await res.json()
      setLogs(data.logs || [])
    } catch {
      setError('Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  // Group logs by week
  const weekMap = new Map<string, { monday: Date; logs: any[] }>()
  const weekKeys: string[] = []

  for (const log of logs) {
    const d = parseLogDate(log.date)
    if (!d) continue
    const monday = getWeekMonday(d)
    const key = monday.toISOString()
    if (!weekMap.has(key)) {
      weekMap.set(key, { monday, logs: [] })
      weekKeys.push(key)
    }
    weekMap.get(key)!.logs.push(log)
  }

  function weekHours(weekLogs: any[]): number {
    return weekLogs.reduce((sum, l) => {
      const dur = calcDuration(l.signInTime, l.signOutTime)
      const hMatch = dur.match(/(\d+)h/)
      const mMatch = dur.match(/(\d+)m/)
      return sum + (hMatch ? parseInt(hMatch[1]) : 0) + (mMatch ? parseInt(mMatch[1]) / 60 : 0)
    }, 0)
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <StatusBar />
      <div className="bg-blue-800 h-14 flex items-center px-4 flex-shrink-0">
        <span className="text-white font-semibold text-[17px] tracking-tight">Shift History</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center items-center h-48"><Spinner /></div>
        )}

        {error && (
          <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && logs.length === 0 && (
          <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-200 p-6 text-center">
            <p className="text-3xl mb-3">🕐</p>
            <p className="font-semibold text-gray-900">No shift history yet</p>
            <p className="text-sm text-gray-500 mt-1">Completed shifts will appear here</p>
          </div>
        )}

        {!loading && weekKeys.map(key => {
          const { monday, logs: weekLogs } = weekMap.get(key)!
          const hours = weekHours(weekLogs)
          const hoursLabel = hours > 0 ? ` · ${Math.round(hours * 10) / 10}h` : ''
          return (
            <div key={key}>
              <SectionLabel>
                {weekLabel(monday)} · {weekLogs.length} shift{weekLogs.length !== 1 ? 's' : ''}{hoursLabel}
              </SectionLabel>
              <div className="px-4 flex flex-col gap-2 pb-1">
                {weekLogs.map(log => {
                  const { variant, label } = stateBadge(log.state)
                  const dur = calcDuration(log.signInTime, log.signOutTime)
                  return (
                    <Card key={log.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">
                            {log.siteName || 'Unknown site'}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{log.date}</p>
                          {log.signInTime && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {log.signInTime}
                              {log.signOutTime ? ` → ${log.signOutTime}` : ''}
                              {dur ? ` · ${dur}` : ''}
                            </p>
                          )}
                        </div>
                        <Badge variant={variant}>{label}</Badge>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          )
        })}

        <div className="h-6" />
      </div>

      <TabBar tabs={TABS} active="history" onChange={id => {
        if (id === 'home') router.push('/cleaner/home')
        else if (id === 'schedule') router.push('/cleaner/schedule')
        else if (id === 'profile') router.push('/cleaner/profile')
      }} />
    </div>
  )
}
