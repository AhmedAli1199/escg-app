'use client'
// app/cleaner/report/page.tsx
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, StatusBar, Navbar } from '@/components/ui'

type Severity = 'standard' | 'urgent'

export default function CleanerReport() {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [description, setDescription] = useState('')
  const [severity, setSeverity]       = useState<Severity>('standard')
  const [photoFile, setPhotoFile]     = useState<File | null>(null)
  const [submitting, setSubmitting]   = useState(false)
  const [success, setSuccess]         = useState(false)
  const [error, setError]             = useState('')
  const [shiftContext, setShiftContext] = useState<{
    logId: string; cleanerId: string; siteName: string; state: string
  } | null>(null)

  useEffect(() => {
    fetch('/api/shifts')
      .then(res => { if (res.status === 401) { router.push('/login'); return null } return res.json() })
      .then(data => {
        if (!data) return
        const log = data.activeLog
        const assignment = data.todayAssignments?.[0]
        setShiftContext({
          logId:      log?.id || '',
          cleanerId:  log?.cleanerId || '',
          siteName:   log?.siteName || assignment?.site || '',
          state:      log?.state || '',
        })
      })
      .catch(() => {})
  }, [])

  async function handleSubmit() {
    if (!description.trim()) { setError('Please describe the issue'); return }
    setSubmitting(true)
    setError('')
    try {
      const fullDesc = severity === 'urgent' ? `[URGENT] ${description.trim()}` : description.trim()

      const form = new FormData()
      form.append('cleanerId',    shiftContext?.cleanerId  || '')
      form.append('shiftLogId',   shiftContext?.logId      || '')
      form.append('siteName',     shiftContext?.siteName   || '')
      form.append('description',  fullDesc)
      form.append('currentState', shiftContext?.state      || '')
      if (photoFile) form.append('file', photoFile, photoFile.name || 'report.jpg')

      const res = await fetch('/api/incidents', { method: 'POST', body: form })
      if (!res.ok) throw new Error('Failed to submit')
      setSuccess(true)
    } catch {
      setError('Failed to submit report. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        <StatusBar />
        <Navbar title="Report Issue" onBack={() => router.back()} />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-xl font-bold text-gray-900 mb-2">Report sent</p>
          <p className="text-sm text-gray-500 mb-8">Your manager has been notified</p>
          <Button onClick={() => router.push('/cleaner/home')}>Back to home</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <StatusBar />
      <Navbar title="Report Issue" onBack={() => router.back()} />

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center justify-between">
            {error}
            <button onClick={() => setError('')} className="text-red-400 text-lg ml-2">×</button>
          </div>
        )}

        {shiftContext?.siteName && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-sm text-blue-800">
            📍 Reporting for: <span className="font-semibold">{shiftContext.siteName}</span>
          </div>
        )}

        {/* Severity */}
        <Card>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Severity</p>
          <div className="grid grid-cols-2 gap-2">
            {(['standard', 'urgent'] as Severity[]).map(s => (
              <button key={s} onClick={() => setSeverity(s)}
                className={`h-11 rounded-xl border text-sm font-semibold transition-colors ${
                  severity === s
                    ? s === 'urgent' ? 'bg-red-50 border-red-300 text-red-700' : 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-gray-50 border-gray-200 text-gray-500'
                }`}>
                {s === 'urgent' ? '🚨 Urgent' : '📋 Standard'}
              </button>
            ))}
          </div>
        </Card>

        {/* Description */}
        <Card>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</p>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Describe the issue in detail..."
            rows={5}
            className="w-full text-sm text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:border-blue-400"
          />
        </Card>

        {/* Photo */}
        <Card>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Photo (optional)</p>
          {photoFile ? (
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-2xl">📷</div>
              <div>
                <p className="text-sm font-semibold text-green-600">✓ Photo selected</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[160px]">{photoFile.name}</p>
                <button onClick={() => setPhotoFile(null)} className="text-xs text-red-500 mt-0.5">Remove</button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              📷 Add photo
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => e.target.files?.[0] && setPhotoFile(e.target.files[0])}
          />
        </Card>

        <Button loading={submitting} onClick={handleSubmit}>Submit report</Button>
        <div className="h-4" />
      </div>
    </div>
  )
}
