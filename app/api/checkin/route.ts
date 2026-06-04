// app/api/checkin/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  createShiftLog,
  updateShiftLog,
  uploadAttachment,
  updateAssignmentLastTriggered,
  getSydneyDateFormatted,
  getSydneyTime,
} from '@/lib/airtable'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'cleaner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action, shiftLogId, assignmentId, cleanerId, base64, contentType, filename } = body

    const now = getSydneyTime()

    if (action === 'create_log') {
      const log = await createShiftLog({
        Assignment:      assignmentId ? [assignmentId] : undefined,
        Cleaner:         cleanerId    ? [cleanerId]    : undefined,
        Date:            getSydneyDateFormatted(),
        'Cleaner State': 'Menu Sent',
      })
      if (assignmentId) {
        await updateAssignmentLastTriggered(
          assignmentId,
          new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
        )
      }
      return NextResponse.json({ log })
    }

    if (action === 'sign_in') {
      const log = await updateShiftLog(shiftLogId, {
        'Sign In Time':  now,
        'Cleaner State': 'Awaiting Signin Photo',
      })
      return NextResponse.json({ log, signInTime: now })
    }

    if (action === 'sign_in_photo') {
      if (!base64) {
        return NextResponse.json({ error: 'Missing base64 photo data' }, { status: 400 })
      }
      if (!shiftLogId) {
        return NextResponse.json({ error: 'Missing shiftLogId' }, { status: 400 })
      }
      const buffer = Buffer.from(base64, 'base64')
      const blob = new Blob([buffer], { type: contentType || 'image/jpeg' })

      await uploadAttachment(shiftLogId, 'Sign In Photo', blob, filename || 'signin.jpg')

      const log = await updateShiftLog(shiftLogId, {
        'Cleaner State': 'Active',
      })
      return NextResponse.json({ log })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    console.error('Checkin error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
