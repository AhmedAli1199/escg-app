'use client'
// app/cleaner/help/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, StatusBar, Navbar } from '@/components/ui'

export default function CleanerHelp() {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [shiftContext, setShiftContext] = useState<{
    logId: string; cleanerId: string; siteName: string; state: string
  } | null>(null)

  useEffect(() => {
    fetch('/api/shifts')
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null }
        return res.json()
      })
      .then(data => {
        if (!data) return
        const log = data.activeLog
        const assignment = data.todayAssignments?.[0]
        setShiftContext({
          logId:     log?.id || '',
          cleanerId: log?.cleanerId || '',
          siteName:  log?.siteName || assignment?.site || '',
          state:     log?.state || '',
        })
      })
      .catch(() => {})
  }, [])

  async function handleSendHelp() {
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cleanerId:    shiftContext?.cleanerId || '',
          shiftLogId:   shiftContext?.logId || '',
          siteName:     shiftContext?.siteName || '',
          description:  'HELP REQUEST — cleaner needs immediate assistance',
          photoUrl:     '',
          currentState: shiftContext?.state || '',
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setSent(true)
    } catch {
      setError('Failed to send help request. Try again.')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        <StatusBar />
        <Navbar title="Help" onBack={() => router.back()} />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="text-5xl mb-4">🆘</div>
          <p className="text-xl font-bold text-gray-900 mb-2">Help request sent</p>
          <p className="text-sm text-gray-500 mb-1">Tory has been notified</p>
          <p className="text-sm text-gray-500 mb-8">They will contact you shortly</p>
          <Button onClick={() => router.push('/cleaner/home')}>Back to home</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <StatusBar />
      <Navbar title="Need Help?" onBack={() => router.back()} />

      <div className="flex-1 flex flex-col justify-center p-4 gap-4">
        <Card className="text-center py-8 px-6">
          <div className="text-5xl mb-4">🆘</div>
          <p className="font-bold text-gray-900 text-lg mb-2">Send help request</p>
          <p className="text-sm text-gray-500 mb-1">This will immediately alert your manager</p>
          <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl py-2 px-4 inline-block">
            <p className="text-sm font-semibold text-blue-800">Tory Papa</p>
          </div>
          {shiftContext?.siteName && (
            <p className="text-xs text-gray-400 mt-4">📍 {shiftContext.siteName}</p>
          )}
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button loading={sending} onClick={handleSendHelp}>
          🆘 Send help request
        </Button>
        <Button variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
