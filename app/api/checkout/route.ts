// app/api/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { updateShiftLog, getSydneyTime } from '@/lib/airtable'
import { sendPushToManager, PUSH } from '@/lib/push'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'cleaner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { shiftLogId, siteName } = await req.json()
    const now = getSydneyTime()

    // "Collecting End Photos" was removed from the base — use "Awaiting End Photo"
    const log = await updateShiftLog(shiftLogId, {
      'Sign Out Time': now,
      'Cleaner State': 'Awaiting End Photo',
    })

    return NextResponse.json({ log, signOutTime: now })
  } catch (err: any) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
