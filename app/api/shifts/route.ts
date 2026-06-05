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

    const allAssignments = await getAssignmentsForCleaner(session.name, undefined, undefined)
    
    // For today/yesterday overnight assignments
    const assignments = allAssignments.filter(a => {
      const matchToday = a.days.includes(todayAbbr)
      const matchYesterday = yesterdayAbbr ? a.days.includes(yesterdayAbbr) : false
      return matchToday || matchYesterday
    })
    const filtered = filterByFrequency(assignments, now)
    
    const shiftLogs = await getActiveShiftLogsForCleaner(session.userId, session.phone || '', allAssignments.map(a => a.site))

    // Pair assignments with logs to determine status of each card
    const shifts = filtered.map(assignment => {
      const log = shiftLogs.find(l => l.assignmentId === assignment.id)
      let state = 'menu_sent'
      if (log) {
        const s = log.state
        if (s === 'Awaiting Signin Photo') state = 'awaiting_photo'
        else if (s === 'Active') state = 'active'
        else if (s === 'Collecting End Photos' || s === 'Awaiting End Photo') state = 'collecting_photos'
        else if (s === 'Complete') state = 'complete'
        else if (s === 'Unavailable') state = 'unavailable'
      }
      return {
        assignment,
        log: log || null,
        state,
      }
    })

    // Include unmatched active logs to avoid losing any active shifts
    for (const log of shiftLogs) {
      if (log.state !== 'Complete' && log.state !== 'Unavailable' && log.state !== 'Incident Only') {
        const alreadyIncluded = shifts.some(s => s.log?.id === log.id || s.assignment.id === log.assignmentId)
        if (!alreadyIncluded) {
          const assignment = allAssignments.find(a => a.id === log.assignmentId) || {
            id: log.assignmentId,
            site: log.siteName || 'Unknown Site',
            cleaner: session.name,
            days: [],
            frequency: 'Weekly',
            windowStart: null,
            windowEnd: null,
            isWeekendShift: false,
            active: true,
            lastTriggered: null,
          }
          let state = 'menu_sent'
          const s = log.state
          if (s === 'Awaiting Signin Photo') state = 'awaiting_photo'
          else if (s === 'Active') state = 'active'
          else if (s === 'Collecting End Photos' || s === 'Awaiting End Photo') state = 'collecting_photos'
          
          shifts.push({
            assignment,
            log,
            state,
          })
        }
      }
    }

    // Find the first active (non-complete) log for backwards compatibility
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

    const schedule = upcomingDays.flatMap(({ d, dayAbbr, dateStr, dayOfMonth }) => {
      const dayAssigns = allAssignments.filter(a => a.days.includes(dayAbbr))
      const validAssigns = filterByFrequency(dayAssigns, d)
      return validAssigns.map(a => ({ ...a, scheduleDate: dateStr, scheduleDay: dayAbbr }))
    })

    return NextResponse.json({
      cleanerName: session.name,
      todayAssignments: filtered,
      activeLog: activeLog || null,
      completedLogs,
      schedule,
      shifts,
    })
  } catch (err: any) {
    console.error('Shifts error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
