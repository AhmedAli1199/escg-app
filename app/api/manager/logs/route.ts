// app/api/manager/logs/route.ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getAllShiftLogs } from '@/lib/airtable'

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== 'manager') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const logs = await getAllShiftLogs(200)
    return NextResponse.json({ logs })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
