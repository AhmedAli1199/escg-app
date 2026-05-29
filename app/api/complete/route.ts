// app/api/complete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { updateShiftLog, calcDuration } from '@/lib/airtable'
import { sendPushToManager, PUSH } from '@/lib/push'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'cleaner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { shiftLogId, signInTime, signOutTime, siteName, photoCount } = await req.json()

    if (!photoCount || photoCount === 0) {
      return NextResponse.json({ error: 'No photos submitted' }, { status: 400 })
    }

    const log = await updateShiftLog(shiftLogId, {
      'Cleaner State': 'Complete',
    })

    const duration = calcDuration(signInTime, signOutTime)

    // Send push notification to manager
    await sendPushToManager(
      PUSH.shiftComplete(session.name, siteName || 'Unknown site', duration, photoCount)
    )

    return NextResponse.json({
      log,
      summary: {
        site: siteName,
        signIn: signInTime,
        signOut: signOutTime,
        duration,
        photos: photoCount,
      },
    })
  } catch (err: any) {
    console.error('Complete error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
