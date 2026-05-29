// app/api/incidents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  createIncident, getAllIncidents, updateIncident, uploadAttachment,
  updateShiftLog, createShiftLog,
  getSydneyDateFormatted, getSydneyTime,
  FIELDS,
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

    const form        = await req.formData()
    const cleanerId   = form.get('cleanerId')   as string
    const shiftLogId  = form.get('shiftLogId')  as string
    const siteName    = form.get('siteName')    as string
    const description = form.get('description') as string
    const currentState = form.get('currentState') as string
    const file        = form.get('file') as File | null

    const date = getSydneyDateFormatted()

    // Create incident record first (without photo)
    const incident = await createIncident({
      Cleaner:           cleanerId ? [cleanerId] : undefined,
      Site:              siteName     || '',
      Date:              date,
      Description:       description  || '',
      'Manager Alerted': true,
    })

    // Upload photo to the created incident record if provided
    if (file && file.size > 0) {
      await uploadAttachment(incident.id, FIELDS.INC_PHOTO, file, file.name || 'incident.jpg')
    }

    // Update or create shift log
    if (shiftLogId && currentState) {
      await updateShiftLog(shiftLogId, {
        'Cleaner State':  'Incident Open',
        'Previous State': currentState,
        'Cleaner Notes':  `[${getSydneyTime()}] ${description}`,
      })
    } else {
      await createShiftLog({
        Cleaner:          cleanerId ? [cleanerId] : undefined,
        Date:             date,
        'Cleaner State':  'Incident Only',
        'Previous State': 'NO_LOG',
      })
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
