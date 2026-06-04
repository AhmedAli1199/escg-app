// app/api/incidents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  createIncident, getAllIncidents, updateIncident, uploadAttachment,
  updateShiftLog, createShiftLog,
  getSydneyDateFormatted, getSydneyTime,
} from '@/lib/airtable'
import { sendPushToManager, PUSH } from '@/lib/push'

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== 'manager') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const incidents = await getAllIncidents()
    return NextResponse.json({ incidents })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const {
      cleanerId,
      shiftLogId,
      assignmentId,
      siteName,
      description,
      currentState,
      type,
      base64,
      contentType,
      filename
    } = await req.json()

    const date = getSydneyDateFormatted()
    const time = getSydneyTime()

    if (type === 'unavailable') {
      // Create or update shift log state to Unavailable
      if (shiftLogId) {
        await updateShiftLog(shiftLogId, {
          'Cleaner State': 'Unavailable',
          'Cleaner Notes': description || '',
        })
      } else {
        await createShiftLog({
          Assignment:      assignmentId ? [assignmentId] : undefined,
          Cleaner:         [session.userId],
          Date:            date,
          'Cleaner State': 'Unavailable',
          'Cleaner Notes': description || '',
        })
      }

      // Create an incident report for unavailability
      await createIncident({
        Cleaner:           [session.userId],
        Site:              siteName     || '',
        Date:              date,
        Description:       `[UNAVAILABLE] ${description || ''}`,
        'Manager Alerted': true,
      })

      // Notify the manager
      await sendPushToManager(
        PUSH.unavailable(session.name, siteName || 'Unknown site')
      )

      return NextResponse.json({ ok: true })
    }

    // Standard Incident
    const incident = await createIncident({
      Cleaner:           cleanerId ? [cleanerId] : [session.userId],
      Site:              siteName     || '',
      Date:              date,
      Description:       description  || '',
      'Manager Alerted': true,
    })

    if (base64) {
      const buffer = Buffer.from(base64, 'base64')
      const blob = new Blob([buffer], { type: contentType || 'image/jpeg' })
      await uploadAttachment(incident.id, 'Photo', blob, filename || 'incident.jpg')
    }

    await sendPushToManager(
      PUSH.incident(session.name, siteName || 'Unknown site', description || '')
    )

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Incident error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'manager') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { incidentId } = await req.json()
    await updateIncident(incidentId, { Status: 'Done' })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
