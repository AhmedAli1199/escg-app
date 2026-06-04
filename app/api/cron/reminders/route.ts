// app/api/cron/reminders/route.ts
import { NextResponse } from 'next/server'
import {
  getAllActiveAssignmentsForDay,
  getAllShiftLogsForDate,
  getAllCleaners,
  createShiftLog,
  updateShiftLog,
  getSydneyDateFormatted,
  getSydneyDayAbbr,
  getSydneyTime,
  filterByFrequency
} from '@/lib/airtable'
import { sendPushToCleaner, PUSH } from '@/lib/push'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dayAbbr = getSydneyDayAbbr()
    const todayStr = getSydneyDateFormatted()
    const nowTime = getSydneyTime()
    
    const [h, m] = nowTime.split(':').map(Number)
    const nowMins = h * 60 + m

    const rawAssignments = await getAllActiveAssignmentsForDay(dayAbbr)
    // For proper filterByFrequency we need the local date object for Sydney
    const sydDate = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }))
    const assignments = filterByFrequency(rawAssignments, sydDate)
    
    const logs = await getAllShiftLogsForDate(todayStr)
    const cleaners = await getAllCleaners()
    const cleanerMap = new Map(cleaners.map(c => [c.name, c.id]))

    const results = []

    for (const a of assignments) {
      if (!a.windowStart && !a.isWeekendShift) continue

      let shouldRemind = false
      if (a.isWeekendShift) {
        // Remind between 8:00 and 8:15 AM
        if (nowMins >= 480 && nowMins <= 495) shouldRemind = true
      } else {
        const [sh, sm] = a.windowStart!.split(':').map(Number)
        const startMins = sh * 60 + sm
        // Remind within +/- 15 mins of window start
        if (Math.abs(nowMins - startMins) <= 15) shouldRemind = true
      }

      if (shouldRemind) {
        const cleanerId = cleanerMap.get(a.cleaner)
        if (!cleanerId) continue

        const existingLog = logs.find(l => l.assignmentId === a.id)
        if (existingLog) {
          if (!existingLog.reminderSent && existingLog.state !== 'Complete' && existingLog.state !== 'Unavailable') {
            await updateShiftLog(existingLog.id, { 'Reminder Sent': true })
            await sendPushToCleaner(cleanerId, PUSH.reminder(a.site))
            results.push({ site: a.site, type: 'updated' })
          }
        } else {
          // Create empty log with Reminder Sent
          await createShiftLog({
            Assignment: [a.id],
            Cleaner: [cleanerId],
            Date: todayStr,
            'Reminder Sent': true
          })
          await sendPushToCleaner(cleanerId, PUSH.reminder(a.site))
          results.push({ site: a.site, type: 'created' })
        }
      }
    }

    return NextResponse.json({ ok: true, results })
  } catch (err: any) {
    console.error('Reminders cron error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
