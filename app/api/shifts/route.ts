// app/api/shifts/route.ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  getAssignmentsForCleaner,
  getActiveShiftLogsForCleaner,
  filterByFrequency,
  getSydneyDayAbbr,
  getSydneyDateFormatted,
} from '@/lib/airtable'

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== 'cleaner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const todayAbbr = getSydneyDayAbbr()
    const todayFmt  = getSydneyDateFormatted()

    // For overnight shifts: also check yesterday's assignments before 8am
    const now = new Date()
    const sydneyHour = parseInt(
      new Date().toLocaleTimeString('en-AU', { timeZone: 'Australia/Sydney', hour: '2-digit', hour12: false })
    )
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    const todayIdx = new Date(
      new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }) + 'T12:00:00'
    ).getDay()
    const yesterdayAbbr = sydneyHour < 8 ? days[(todayIdx + 6) % 7] : undefined

    const assignments = await getAssignmentsForCleaner(session.name, todayAbbr, yesterdayAbbr)
    const filtered    = filterByFrequency(assignments, now)
    const shiftLogs   = await getActiveShiftLogsForCleaner(session.phone || '')

    // Find the active (non-complete) log
    const activeLog = shiftLogs.find(l =>
      l.state !== 'Complete' && l.state !== 'Unavailable' && l.state !== 'Incident Only'
    )
    const completedLogs = shiftLogs.filter(l => l.state === 'Complete')

    // Upcoming 7 days schedule
    const upcomingDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() + i)
      const dayAbbr = days[d.getDay()]
      const dateStr = d.toLocaleDateString('en-GB').split('/').join('/')
      return { d, dayAbbr, dateStr, dayOfMonth: d.getDate() }
    })

    const allAssignments = await getAssignmentsForCleaner(session.name, '', undefined)
    const schedule = upcomingDays.flatMap(({ d, dayAbbr, dateStr, dayOfMonth }) => {
      const dayAssigns = allAssignments.filter(a => a.days.includes(dayAbbr))
      const validAssigns = filterByFrequency(dayAssigns, d)
      return validAssigns.map(a => ({ ...a, scheduleDate: dateStr, scheduleDay: dayAbbr }))
    })

    return NextResponse.json({
      todayAssignments: filtered,
      activeLog: activeLog || null,
      completedLogs,
      schedule,
    })
  } catch (err: any) {
    console.error('Shifts error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
