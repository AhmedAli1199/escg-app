// app/api/manager/dashboard/route.ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  getAllActiveAssignmentsForDay,
  getAllShiftLogsForDate,
  getAllCleaners,
  filterByFrequency,
  getSydneyDayAbbr,
  getSydneyDateFormatted,
} from '@/lib/airtable'

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== 'manager') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const todayAbbr = getSydneyDayAbbr()
    const todayFmt  = getSydneyDateFormatted()

    const [assignments, shiftLogs, cleaners] = await Promise.all([
      getAllActiveAssignmentsForDay(todayAbbr),
      getAllShiftLogsForDate(todayFmt),
      getAllCleaners(),
    ])

    const todayAssignments = filterByFrequency(assignments, new Date())

    // Map assignments to their shift log status
    const sites = todayAssignments.map(a => {
      const log = shiftLogs.find(l => l.assignmentId === a.id)
      const state = log?.state || 'Not Started'

      let status: 'complete' | 'active' | 'noshow' | 'unavailable' | 'notstarted' | 'tonight'
      if (state === 'Complete') status = 'complete'
      else if (['Active', 'Awaiting End Photo 1', 'Awaiting End Photo 2', 'Awaiting End Photo 3', 'Collecting End Photos'].includes(state)) status = 'active'
      else if (state === 'No Show') status = 'noshow'
      else if (state === 'Unavailable') status = 'unavailable'
      else if (a.windowStart && parseInt(a.windowStart) >= 18) status = 'tonight'
      else status = 'notstarted'

      return {
        assignmentId: a.id,
        site:        a.site,
        cleaner:     a.cleaner,
        windowStart: a.windowStart,
        windowEnd:   a.windowEnd,
        isWeekendShift: a.isWeekendShift,
        status,
        signInTime:  log?.signInTime || null,
        signOutTime: log?.signOutTime || null,
        shiftLogId:  log?.id || null,
      }
    })

    const stats = {
      scheduled:  sites.length,
      complete:   sites.filter(s => s.status === 'complete').length,
      active:     sites.filter(s => s.status === 'active').length,
      noShow:     sites.filter(s => s.status === 'noshow').length,
      unavailable:sites.filter(s => s.status === 'unavailable').length,
    }

    // Cleaner summaries
    const cleanerSummaries = cleaners.map(c => {
      const todaySites = sites.filter(s => s.cleaner === c.name)
      const todayStatus = todaySites.length === 0 ? 'off'
        : todaySites.some(s => s.status === 'noshow') ? 'noshow'
        : todaySites.some(s => s.status === 'active') ? 'active'
        : todaySites.every(s => s.status === 'complete') ? 'complete'
        : 'scheduled'
      return { ...c, todayStatus, sitesCount: todaySites.length }
    })

    return NextResponse.json({ sites, stats, cleanerSummaries, todayDate: todayFmt, todayDay: todayAbbr })
  } catch (err: any) {
    console.error('Dashboard error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
