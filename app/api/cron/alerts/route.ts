// app/api/cron/alerts/route.ts
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
import { sendPushToCleaner, sendPushToManager, PUSH } from '@/lib/push'

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
    const sydDate = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }))
    const assignments = filterByFrequency(rawAssignments, sydDate)
    
    const logs = await getAllShiftLogsForDate(todayStr)
    const cleaners = await getAllCleaners()
    const cleanerMap = new Map(cleaners.map(c => [c.name, c.id]))

    const results = []

    for (const a of assignments) {
      if (!a.windowEnd && !a.isWeekendShift) continue

      let shouldAlert = false
      if (a.isWeekendShift) {
        // Alert between 8:00 and 8:15 PM (20:00 - 20:15)
        if (nowMins >= 1200 && nowMins <= 1215) shouldAlert = true
      } else {
        const [eh, em] = a.windowEnd!.split(':').map(Number)
        const endMins = eh * 60 + em
        // Alert if ~1 hour before window end (e.g., if endMins - nowMins is ~60)
        if (Math.abs(endMins - nowMins - 60) <= 15) shouldAlert = true
      }

      if (shouldAlert) {
        const cleanerId = cleanerMap.get(a.cleaner)
        if (!cleanerId) continue

        const existingLog = logs.find(l => l.assignmentId === a.id)
        if (existingLog) {
          if (!existingLog.noShowAlertSent && existingLog.state !== 'Complete' && existingLog.state !== 'Unavailable' && !existingLog.signInTime) {
            await updateShiftLog(existingLog.id, { 'No Show Alert Sent': true })
            await sendPushToCleaner(cleanerId, PUSH.lateAlert(a.site))
            await sendPushToManager(PUSH.noShow(a.cleaner, a.site))
            results.push({ site: a.site, type: 'updated' })
          }
        } else {
          await createShiftLog({
            Assignment: [a.id],
            Cleaner: [cleanerId],
            Date: todayStr,
            'No Show Alert Sent': true
          })
          await sendPushToCleaner(cleanerId, PUSH.lateAlert(a.site))
          await sendPushToManager(PUSH.noShow(a.cleaner, a.site))
          results.push({ site: a.site, type: 'created' })
        }
      }
    }

    return NextResponse.json({ ok: true, results })
  } catch (err: any) {
    console.error('Alerts cron error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
