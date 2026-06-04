// app/api/photos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getShiftLog, uploadAttachment } from '@/lib/airtable'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'cleaner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { shiftLogId, base64, contentType, filename } = await req.json()

    if (!shiftLogId || !base64) {
      return NextResponse.json({ error: 'Missing shiftLogId or base64' }, { status: 400 })
    }

    const buffer = Buffer.from(base64, 'base64')
    const blob = new Blob([buffer], { type: contentType || 'image/jpeg' })

    await uploadAttachment(shiftLogId, 'End Photo URLs', blob, filename || 'photo.jpg')

    const log = await getShiftLog(shiftLogId)
    const photoCount = log.endPhotoAttachments?.length ?? 0

    return NextResponse.json({
      log,
      photoCount,
      updatedUrls: log.endPhotoUrls,
    })
  } catch (err: any) {
    console.error('Photos error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
