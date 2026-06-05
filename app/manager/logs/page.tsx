'use client'
// app/manager/logs/page.tsx
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, Spinner, TabBar, StatusBar } from '@/components/ui'
import type { Tab } from '@/components/ui'

const TABS: Tab[] = [
  { id: 'dashboard', label: 'Today',    icon: '⊞' },
  { id: 'cleaners',  label: 'Cleaners', icon: '👥' },
  { id: 'logs',      label: 'Logs',     icon: '📋' },
  { id: 'alerts',    label: 'Alerts',   icon: '🔔' },
]

const PAGE_SIZE = 20

function calcDuration(signIn: string, signOut: string): string {
  if (!signIn || !signOut) return ''
  const [ih, im] = signIn.split(':').map(Number)
  const [oh, om] = signOut.split(':').map(Number)
  let mins = (oh * 60 + om) - (ih * 60 + im)
  if (mins < 0) mins += 1440
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}

function stateBadge(state: string): { variant: 'green' | 'red' | 'amber' | 'blue' | 'gray'; label: string } {
  if (state === 'Complete') return { variant: 'green', label: 'Complete' }
  if (state === 'No Show') return { variant: 'red', label: 'No show' }
  if (state === 'Unavailable') return { variant: 'amber', label: 'Unavailable' }
  if (['Active', 'Collecting End Photos'].includes(state)) return { variant: 'blue', label: 'Active' }
  return { variant: 'gray', label: state || '—' }
}

export default function ManagerLogs() {
  const router = useRouter()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCleaner, setFilterCleaner] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [page, setPage] = useState(0)
  const [selectedLog, setSelectedLog] = useState<any>(null)

  useEffect(() => { loadLogs() }, [])

  async function loadLogs() {
    try {
      const res = await fetch('/api/manager/logs')
      if (res.status === 401) { router.push('/login'); return }
      const data = await res.json()
      setLogs(data.logs || [])
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const cleanerNames = useMemo(() => {
    return Array.from(new Set(logs.map((l: any) => l.cleanerName).filter(Boolean))).sort() as string[]
  }, [logs])

  const filtered = useMemo(() => {
    return logs.filter((l: any) => {
      if (search && !(l.siteName || '').toLowerCase().includes(search.toLowerCase())) return false
      if (filterCleaner && l.cleanerName !== filterCleaner) return false
      if (filterStatus && l.state !== filterStatus) return false
      if (filterDate) {
        const [y, m, d] = filterDate.split('-')
        if (l.date !== `${d}/${m}/${y}`) return false
      }
      return true
    })
  }, [logs, search, filterCleaner, filterStatus, filterDate])

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  function resetFilters() {
    setSearch(''); setFilterCleaner(''); setFilterStatus(''); setFilterDate(''); setPage(0)
  }

  function exportCSV() {
    const rows = [
      ['Date', 'Site', 'Cleaner', 'Sign In', 'Sign Out', 'Duration', 'Status'],
      ...filtered.map((l: any) => [
        l.date || '',
        l.siteName || '',
        l.cleanerName || '',
        l.signInTime || '',
        l.signOutTime || '',
        calcDuration(l.signInTime, l.signOutTime),
        l.state || '',
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `escg-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasFilters = search || filterCleaner || filterStatus || filterDate

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <StatusBar />

      {/* Header */}
      <div className="bg-blue-800 h-14 flex items-center px-4 justify-between flex-shrink-0">
        <span className="text-white font-semibold text-[17px] tracking-tight">
          Shift Logs
          {!loading && <span className="text-white/60 text-sm font-normal ml-2">({filtered.length})</span>}
        </span>
        <button
          onClick={exportCSV}
          className="text-white/90 text-xs bg-white/15 px-3 py-1.5 rounded-lg font-semibold active:bg-white/25"
        >
          ↓ CSV
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white border-b border-gray-100 px-3 py-2 flex flex-col gap-2 flex-shrink-0">
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          placeholder="Search by site name..."
          className="h-9 border border-gray-200 rounded-xl px-3 text-sm w-full focus:outline-none focus:border-blue-400"
        />
        <div className="flex gap-2">
          <select
            value={filterCleaner}
            onChange={e => { setFilterCleaner(e.target.value); setPage(0) }}
            className="flex-1 h-8 border border-gray-200 rounded-lg px-2 text-xs focus:outline-none bg-white text-gray-700"
          >
            <option value="">All cleaners</option>
            {cleanerNames.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setPage(0) }}
            className="flex-1 h-8 border border-gray-200 rounded-lg px-2 text-xs focus:outline-none bg-white text-gray-700"
          >
            <option value="">All statuses</option>
            {['Complete', 'Active', 'No Show', 'Unavailable'].map(s =>
              <option key={s} value={s}>{s}</option>
            )}
          </select>
          <input
            type="date"
            value={filterDate}
            onChange={e => { setFilterDate(e.target.value); setPage(0) }}
            className="flex-1 h-8 border border-gray-200 rounded-lg px-2 text-xs focus:outline-none"
          />
        </div>
        {hasFilters && (
          <button onClick={resetFilters} className="text-xs text-blue-600 font-semibold text-left">
            Clear filters
          </button>
        )}
      </div>

      {/* Log list */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center items-center h-32"><Spinner /></div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm gap-1">
            <p>No logs found</p>
            {hasFilters && (
              <button onClick={resetFilters} className="text-blue-500 text-xs">Clear filters</button>
            )}
          </div>
        )}

        <div className="px-3 pt-2 flex flex-col gap-2">
          {paginated.map((log: any) => {
            const { variant, label } = stateBadge(log.state)
            const dur = calcDuration(log.signInTime, log.signOutTime)
            return (
              <div 
                key={log.id} 
                onClick={() => setSelectedLog(log)}
                className="bg-white rounded-2xl border border-gray-200 px-4 py-3 active:scale-[0.98] transition-transform cursor-pointer shadow-sm hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{log.siteName || '—'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {log.cleanerName || '—'} · {log.date || '—'}
                    </p>
                    {log.signInTime && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {log.signInTime}
                        {log.signOutTime ? ` → ${log.signOutTime}` : ''}
                        {dur ? ` · ${dur}` : ''}
                      </p>
                    )}
                  </div>
                  <Badge variant={variant}>{label}</Badge>
                </div>
              </div>
            )
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 py-4 text-sm">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="w-9 h-9 bg-white border border-gray-200 rounded-xl text-gray-600 disabled:opacity-40 font-semibold"
            >
              ‹
            </button>
            <span className="text-gray-500 text-xs">{page + 1} / {totalPages}</span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="w-9 h-9 bg-white border border-gray-200 rounded-xl text-gray-600 disabled:opacity-40 font-semibold"
            >
              ›
            </button>
          </div>
        )}
        <div className="h-4" />
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
          {/* Header */}
          <div className="bg-blue-800 h-14 flex items-center px-4 justify-between flex-shrink-0 shadow-sm">
            <span className="text-white font-semibold text-lg tracking-tight truncate pr-4">
              {selectedLog.siteName || 'Shift Details'}
            </span>
            <button
              onClick={() => setSelectedLog(null)}
              className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-full text-white active:bg-white/20"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Meta Info */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-gray-900 font-semibold">{selectedLog.cleanerName || 'Unknown Cleaner'}</h3>
                  <p className="text-sm text-gray-500">{selectedLog.date || 'No Date'}</p>
                </div>
                <Badge variant={stateBadge(selectedLog.state).variant}>{stateBadge(selectedLog.state).label}</Badge>
              </div>
              
              <div className="flex gap-4 text-sm text-gray-600 mt-2">
                <div>
                  <span className="block text-xs text-gray-400 uppercase tracking-wider font-semibold">Sign In</span>
                  {selectedLog.signInTime || '—'}
                </div>
                <div>
                  <span className="block text-xs text-gray-400 uppercase tracking-wider font-semibold">Sign Out</span>
                  {selectedLog.signOutTime || '—'}
                </div>
                <div>
                  <span className="block text-xs text-gray-400 uppercase tracking-wider font-semibold">Duration</span>
                  {calcDuration(selectedLog.signInTime, selectedLog.signOutTime) || '—'}
                </div>
              </div>
            </div>

            {/* Notes */}
            {selectedLog.cleanerNotes && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <h4 className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">Cleaner Notes</h4>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{selectedLog.cleanerNotes}</p>
              </div>
            )}

            {/* Sign In Photo */}
            {selectedLog.signInPhoto && (
              <div className="space-y-2">
                <h4 className="text-xs text-gray-500 uppercase tracking-wider font-semibold px-1">Sign In Photo</h4>
                <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-100">
                  <img src={selectedLog.signInPhoto} alt="Sign In" className="w-full h-auto object-cover" loading="lazy" />
                </div>
              </div>
            )}

            {/* End Photos */}
            {selectedLog.endPhotoUrls && selectedLog.endPhotoUrls.trim().length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs text-gray-500 uppercase tracking-wider font-semibold px-1">Sign Out Photos</h4>
                <div className="space-y-3">
                  {selectedLog.endPhotoUrls.split('\n').filter(Boolean).map((url: string, i: number) => (
                    <div key={i} className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-100">
                      <img src={url} alt={`Sign Out ${i + 1}`} className="w-full h-auto object-cover" loading="lazy" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <TabBar tabs={TABS} active="logs" onChange={id => {
        if (id === 'dashboard') router.push('/manager/dashboard')
        if (id === 'cleaners')  router.push('/manager/cleaners')
        if (id === 'alerts')    router.push('/manager/alerts')
      }} />
    </div>
  )
}
