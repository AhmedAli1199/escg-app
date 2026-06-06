'use client'
// app/manager/profile/page.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, TabBar, StatusBar, ListItem, IconCircle } from '@/components/ui'
import type { Tab } from '@/components/ui'

const TABS: Tab[] = [
  { id: 'dashboard', label: 'Today',    icon: '⊞' },
  { id: 'cleaners',  label: 'Cleaners', icon: '👥' },
  { id: 'logs',      label: 'Logs',     icon: '📋' },
  { id: 'alerts',    label: 'Alerts',   icon: '🔔' },
  { id: 'profile',   label: 'Profile',  icon: '👤' },
]

export default function ManagerProfile() {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await fetch('/api/auth', { method: 'DELETE' })
    } finally {
      router.push('/login')
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <StatusBar />
      <div className="bg-blue-800 h-14 flex items-center px-4 flex-shrink-0">
        <span className="text-white font-semibold text-[17px] tracking-tight">Manager Profile</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Avatar */}
        <div className="flex flex-col items-center pt-8 pb-4">
          <div className="w-18 h-18 bg-blue-800 rounded-full flex items-center justify-center text-white text-3xl font-bold mb-3 shadow-md shadow-blue-900/10">
            M
          </div>
          <p className="text-lg font-bold text-gray-900">ESCG Manager</p>
          <p className="text-sm text-gray-400">Administrator</p>
        </div>

        {/* Info card */}
        <Card className="mx-4 mt-2">
          <ListItem
            icon={<IconCircle color="blue">⚙️</IconCircle>}
            title="Portal Role"
            subtitle="Full Admin access to roster, logs and alerts"
          />
          <div className="h-px bg-gray-100" />
          <ListItem
            icon={<IconCircle color="green">🏢</IconCircle>}
            title="Company"
            subtitle="ESCG Operations"
          />
        </Card>

        {/* Sign out / Switch user */}
        <div className="px-4 mt-6">
          <Button variant="danger" loading={signingOut} onClick={handleSignOut} className="h-13 text-base">
            🚪 Sign out / Switch User
          </Button>
        </div>
      </div>

      <TabBar tabs={TABS} active="profile" onChange={id => {
        if (id === 'dashboard') router.push('/manager/dashboard')
        if (id === 'cleaners')  router.push('/manager/cleaners')
        if (id === 'logs')      router.push('/manager/logs')
        if (id === 'alerts')    router.push('/manager/alerts')
      }} />
    </div>
  )
}
