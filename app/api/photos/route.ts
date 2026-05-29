// app/api/photos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getShiftLog, uploadAttachment, FIELDS } from '@/lib/airtable'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'cleaner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const form       = await req.formData()
    const shiftLogId = form.get('shiftLogId') as string
    const file       = form.get('file') as File

    if (!shiftLogId || !file) {
      return NextResponse.json({ error: 'Missing shiftLogId or file' }, { status: 400 })
    }

    // Upload directly to Airtable — automatically appends to existing attachments
    await uploadAttachment(shiftLogId, FIELDS.LOG_END_PHOTO_URLS, file, file.name || 'photo.jpg')

    // Fetch updated log to return current count and URLs
    const log = await getShiftLog(shiftLogId)

    return NextResponse.json({
      log,
      photoCount:  log.endPhotoAttachments.length,
      updatedUrls: log.endPhotoUrls,
    })
  } catch (err: any) {
    console.error('Photos error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
