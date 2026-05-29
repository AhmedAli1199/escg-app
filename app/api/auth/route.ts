// app/api/auth/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCleanerByPhone } from '@/lib/airtable'
import { createSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { phone, password, role } = await req.json()

    if (role === 'manager') {
      if (password !== process.env.MANAGER_PASSWORD) {
        return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
      }
      const token = await createSession({ userId: 'manager', name: 'Tory', role: 'manager' })
      const res = NextResponse.json({ ok: true, name: 'Tory', role: 'manager' })
      res.cookies.set('escg_session', token, {
        httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7,
      })
      return res
    }

    // Cleaner login by phone number
    if (!phone) return NextResponse.json({ error: 'Phone required' }, { status: 400 })

    const cleaner = await getCleanerByPhone(phone)
    if (!cleaner) {
      return NextResponse.json({ error: 'Phone number not registered. Contact your manager.' }, { status: 404 })
    }

    const token = await createSession({
      userId: cleaner.id,
      name: cleaner.name,
      role: 'cleaner',
      phone: cleaner.phone,
    })

    const res = NextResponse.json({ ok: true, name: cleaner.name, role: 'cleaner' })
    res.cookies.set('escg_session', token, {
      httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7,
    })
    return res
  } catch (err: any) {
    console.error('Auth error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('escg_session')
  return res
}
