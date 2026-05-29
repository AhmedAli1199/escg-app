'use client'
// app/manager/alerts/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, Spinner, TabBar, StatusBar, SectionLabel } from '@/components/ui'
import type { Tab } from '@/components/ui'

const TABS: Tab[] = [
  { id: 'dashboard', label: 'Today',    icon: '⊞' },
  { id: 'cleaners',  label: 'Cleaners', icon: '👥' },
  { id: 'logs',      label: 'Logs',     icon: '📋' },
  { id: 'alerts',    label: 'Alerts',   icon: '🔔' },
]

export default function ManagerAlerts() {
  const router = useRouter()
  const [incidents, setIncidents] = useState<any[]>([])
  const [noShows, setNoShows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [incRes, dashRes] = await Promise.all([
        fetch('/api/incidents'),
        fetch('/api/manager/dashboard'),
      ])
      if (incRes.status === 401) { router.push('/login'); return }

      const incData  = await incRes.json()
      setIncidents(incData.incidents || [])

      const dashData = await dashRes.json()
      setNoShows((dashData.sites || []).filter((s: any) => s.status === 'noshow'))
    } catch {
    } finally {
      setLoading(false)
    }
  }

  async function resolveIncident(id: string) {
    setResolving(id)
    try {
      const res = await fetch('/api/incidents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId: id }),
      })
      if (res.ok) {
        setIncidents(prev => prev.map(i => i.id === id ? { ...i, resolved: true } : i))
      }
    } catch {
    } finally {
      setResolving('')
    }
  }

  const unresolved = incidents.filter(i => !i.resolved)
  const resolved   = incidents.filter(i => i.resolved)
  const totalAlerts = unresolved.length + noShows.length

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <StatusBar />

      <div className="bg-blue-800 h-14 flex items-center px-4 gap-2 flex-shrink-0">
        <span className="text-white font-semibold text-[17px] tracking-tight">Alerts</span>
        {totalAlerts > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
            {totalAlerts}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex justify-center items-center h-32"><Spinner /></div>
        )}

        {/* No-shows today */}
        {!loading && noShows.length > 0 && (
          <>
            <SectionLabel>No shows today · {noShows.length}</SectionLabel>
            <div className="px-3 flex flex-col gap-2">
              {noShows.map((site: any) => (
                <div key={site.assignmentId} className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-red-900 text-sm">{site.site}</p>
                      <p className="text-xs text-red-500 mt-0.5">{site.cleaner}</p>
                    </div>
                    <Badge variant="red">No show</Badge>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Unresolved incidents */}
        {!loading && (
          <>
            <SectionLabel>
              Unresolved{unresolved.length > 0 ? ` · ${unresolved.length}` : ''}
            </SectionLabel>

            {unresolved.length === 0 ? (
              <div className="mx-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-center">
                <p className="text-sm text-green-700 font-semibold">✅ All clear — no open incidents</p>
              </div>
            ) : (
              <div className="px-3 flex flex-col gap-2">
                {unresolved.map(inc => (
                  <div key={inc.id} className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{inc.site || 'Unknown site'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {inc.date}{inc.time ? ` · ${inc.time}` : ''}
                        </p>
                      </div>
                      <Badge variant="red">Open</Badge>
                    </div>

                    {inc.description && (
                      <p className="text-xs text-gray-600 mb-3 bg-gray-50 rounded-xl px-3 py-2">
                        {inc.description}
                      </p>
                    )}

                    {inc.photoUrl && (
                      <img
                        src={inc.photoUrl}
                        alt="Incident photo"
                        className="w-20 h-20 rounded-xl object-cover mb-3 border border-gray-200"
                      />
                    )}

                    <button
                      onClick={() => resolveIncident(inc.id)}
                      disabled={resolving === inc.id}
                      className="w-full h-9 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs font-semibold active:bg-green-100 disabled:opacity-50"
                    >
                      {resolving === inc.id ? 'Resolving...' : '✓ Mark as resolved'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Activity feed — resolved incidents */}
        {!loading && resolved.length > 0 && (
          <>
            <SectionLabel>Activity feed · {resolved.length}</SectionLabel>
            <div className="px-3 flex flex-col gap-2">
              {resolved.slice(0, 20).map(inc => (
                <div key={inc.id} className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-400 line-through truncate">
                        {inc.site || 'Unknown site'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {inc.date}{inc.time ? ` · ${inc.time}` : ''}
                      </p>
                      {inc.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{inc.description}</p>
                      )}
                    </div>
                    <Badge variant="green">Resolved</Badge>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="h-4" />
      </div>

      <TabBar tabs={TABS} active="alerts" onChange={id => {
        if (id === 'dashboard') router.push('/manager/dashboard')
        if (id === 'cleaners')  router.push('/manager/cleaners')
        if (id === 'logs')      router.push('/manager/logs')
      }} />
    </div>
  )
}
