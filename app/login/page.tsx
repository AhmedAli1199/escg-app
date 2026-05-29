'use client'
// app/login/page.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui'

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab]         = useState<'cleaner' | 'manager'>('cleaner')
  const [phone, setPhone]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tab === 'cleaner' ? { phone, role: 'cleaner' } : { password, role: 'manager' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Register service worker & push
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(console.error)
      }

      router.push(data.role === 'manager' ? '/manager/dashboard' : '/cleaner/home')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Hero */}
      <div className="bg-blue-800 pt-16 pb-10 px-6 text-center">
        <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-white/15">
          <span className="text-4xl">🧹</span>
        </div>
        <h1 className="text-white text-2xl font-bold tracking-tight mb-1">ESCG Operations</h1>
        <p className="text-white/60 text-sm">Eastern Suburbs Cleaning Group</p>
      </div>

      {/* Form */}
      <div className="flex-1 px-4 pt-6 pb-8">
        {/* Tab toggle */}
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
          <button
            onClick={() => setTab('cleaner')}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
              tab === 'cleaner' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            I'm a cleaner
          </button>
          <button
            onClick={() => setTab('manager')}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${
              tab === 'manager' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            Manager
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {tab === 'cleaner' ? (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                Your phone number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+61 4XX XXX XXX"
                className="w-full h-13 border border-gray-200 rounded-2xl px-4 text-base focus:outline-none focus:border-blue-400 bg-white"
                required
                autoComplete="tel"
              />
              <p className="text-xs text-gray-400 mt-2">
                Use the number your manager registered for you
              </p>
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                Manager password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full h-13 border border-gray-200 rounded-2xl px-4 text-base focus:outline-none focus:border-blue-400 bg-white"
                required
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="mt-2 h-14 text-base">
            Sign in →
          </Button>
        </form>

        <div className="mt-8 bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <p className="text-xs font-semibold text-blue-800 mb-1">Need help?</p>
          <p className="text-xs text-blue-600">
            Contact your manager if you can't sign in.
          </p>
        </div>
      </div>
    </div>
  )
}
