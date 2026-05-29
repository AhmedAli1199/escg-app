// app/api/cleaner/logs/route.ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getShiftLogHistoryForCleaner } from '@/lib/airtable'

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== 'cleaner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const logs = await getShiftLogHistoryForCleaner(session.phone || '', 100)
    return NextResponse.json({ logs })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
