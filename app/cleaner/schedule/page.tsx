'use client'
// app/cleaner/schedule/page.tsx
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

const DAY_NAMES: Record<string, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday',
  Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
}

export default function CleanerSchedule() {
  const router = useRouter()
  const [schedule, setSchedule] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { loadSchedule() }, [])

  async function loadSchedule() {
    try {
      const res = await fetch('/api/shifts')
      if (res.status === 401) { router.push('/login'); return }
      const data = await res.json()
      setSchedule(data.schedule || [])
    } catch {
      setError('Failed to load schedule')
    } finally {
      setLoading(false)
    }
  }

  // Group schedule items by date
  const grouped: Record<string, any[]> = {}
  const dateOrder: string[] = []
  for (const item of schedule) {
    if (!grouped[item.scheduleDate]) {
      grouped[item.scheduleDate] = []
      dateOrder.push(item.scheduleDate)
    }
    grouped[item.scheduleDate].push(item)
  }

  // Today formatted as dd/mm/yyyy (same format used in schedule)
  const today = new Date().toLocaleDateString('en-GB', { timeZone: 'Australia/Sydney' }).split('/').join('/')

  function dayLabel(dateStr: string, dayAbbr: string): string {
    if (dateStr === today) return `Today · ${DAY_NAMES[dayAbbr] || dayAbbr}`
    // Format date for display: e.g. "Thursday 29 May"
    const [d, m, y] = dateStr.split('/').map(Number)
    const date = new Date(y, m - 1, d)
    return date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  function timeWindow(item: any): string {
    if (item.isWeekendShift) return 'Flexible — any time this weekend'
    const start = item.windowStart
    const end = item.windowEnd
    if (!start) return ''
    if (!end) return start
    const startH = parseInt(start.split(':')[0])
    const endH = parseInt(end.split(':')[0])
    if (endH < startH) return `${start} → ${end} (overnight)`
    return `${start} – ${end}`
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <StatusBar />
      <div className="bg-blue-800 h-14 flex items-center px-4 flex-shrink-0">
        <span className="text-white font-semibold text-[17px] tracking-tight">My Schedule</span>
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

        {!loading && schedule.length === 0 && (
          <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-200 p-6 text-center">
            <p className="text-3xl mb-3">📅</p>
            <p className="font-semibold text-gray-900">No upcoming shifts</p>
            <p className="text-sm text-gray-500 mt-1">Your schedule is clear for the next 7 days</p>
          </div>
        )}

        {!loading && dateOrder.map(dateStr => {
          const items = grouped[dateStr]
          const isToday = dateStr === today
          return (
            <div key={dateStr}>
              <SectionLabel>{dayLabel(dateStr, items[0].scheduleDay)}</SectionLabel>
              <div className="px-4 flex flex-col gap-2 pb-1">
                {items.map((item: any, i: number) => (
                  <Card key={i} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{item.site}</p>
                        {timeWindow(item) && (
                          <p className="text-xs text-gray-500 mt-0.5">🕐 {timeWindow(item)}</p>
                        )}
                        {item.frequency && item.frequency !== 'Weekly' && (
                          <p className="text-xs text-gray-400 mt-0.5">{item.frequency}</p>
                        )}
                      </div>
                      <Badge variant={isToday ? 'blue' : 'gray'}>
                        {isToday ? 'Today' : 'Upcoming'}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )
        })}

        <div className="h-6" />
      </div>

      <TabBar tabs={TABS} active="schedule" onChange={id => {
        if (id === 'home') router.push('/cleaner/home')
        else if (id === 'history') router.push('/cleaner/history')
        else if (id === 'profile') router.push('/cleaner/profile')
      }} />
    </div>
  )
}
