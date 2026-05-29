// lib/auth.ts
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production'
)

export interface Session {
  userId: string      // cleaner record ID or 'manager'
  name: string
  role: 'cleaner' | 'manager'
  phone?: string
}

export async function createSession(payload: Session): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret)
}

export async function verifySession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as Session
  } catch {
    return null
  }
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = cookies()
  const token = cookieStore.get('escg_session')?.value
  if (!token) return null
  return verifySession(token)
}

export function requireSession(session: Session | null): asserts session is Session {
  if (!session) throw new Error('Unauthorized')
}

export function requireManager(session: Session | null): asserts session is Session {
  if (!session || session.role !== 'manager') throw new Error('Forbidden')
}
