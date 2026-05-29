// app/api/checkin/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  createShiftLog, updateShiftLog, uploadAttachment,
  updateAssignmentLastTriggered,
  getSydneyDateFormatted, getSydneyTime,
  FIELDS,
} from '@/lib/airtable'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'cleaner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contentType = req.headers.get('content-type') || ''

    // ── sign_in_photo: multipart upload ────────────────────────
    if (contentType.includes('multipart/form-data')) {
      const form      = await req.formData()
      const shiftLogId = form.get('shiftLogId') as string
      const file      = form.get('file') as File

      if (!shiftLogId || !file) {
        return NextResponse.json({ error: 'Missing shiftLogId or file' }, { status: 400 })
      }

      // Upload photo directly to Airtable — appends to Sign In Photo field
      await uploadAttachment(shiftLogId, FIELDS.LOG_SIGN_IN_PHOTO, file, file.name || 'signin.jpg')

      // Update state to Active
      const log = await updateShiftLog(shiftLogId, { 'Cleaner State': 'Active' })
      return NextResponse.json({ log })
    }

    // ── create_log / sign_in: JSON ──────────────────────────────
    const { action, shiftLogId, assignmentId, cleanerId } = await req.json()
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

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err: any) {
    console.error('Checkin error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
