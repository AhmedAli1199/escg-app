// components/ui/index.tsx
// Shared UI primitives used throughout the app

import clsx from 'clsx'
import { ReactNode, ButtonHTMLAttributes } from 'react'

// ─── BADGE ────────────────────────────────────────────────────
type BadgeVariant = 'green' | 'blue' | 'amber' | 'red' | 'gray' | 'teal'
const badgeStyles: Record<BadgeVariant, string> = {
  green: 'bg-green-50 text-green-700 border border-green-200',
  blue:  'bg-blue-50 text-blue-800 border border-blue-200',
  amber: 'bg-amber-50 text-amber-700 border border-amber-200',
  red:   'bg-red-50 text-red-700 border border-red-200',
  gray:  'bg-gray-100 text-gray-600 border border-gray-200',
  teal:  'bg-teal-50 text-teal-700 border border-teal-200',
}

export function Badge({ variant, children }: { variant: BadgeVariant; children: ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold', badgeStyles[variant])}>
      {children}
    </span>
  )
}

// ─── BUTTON ───────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
const btnStyles: Record<BtnVariant, string> = {
  primary:   'bg-blue-600 text-white active:bg-blue-800',
  secondary: 'bg-blue-50 text-blue-800 border border-blue-200 active:bg-blue-100',
  danger:    'bg-red-50 text-red-700 border border-red-200 active:bg-red-100',
  ghost:     'bg-transparent text-blue-600 active:text-blue-800',
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', loading, children, className, disabled, ...props }: BtnProps) {
  const sizes = { sm: 'h-10 text-sm px-4', md: 'h-13 text-base px-4', lg: 'h-14 text-lg px-6' }
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        'w-full rounded-2xl font-semibold flex items-center justify-center gap-2',
        'transition-transform active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed',
        btnStyles[variant], sizes[size], className
      )}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : children}
    </button>
  )
}

// ─── CARD ─────────────────────────────────────────────────────
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('bg-white rounded-2xl border border-gray-200 p-4', className)}>
      {children}
    </div>
  )
}

// ─── SECTION LABEL ────────────────────────────────────────────
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-4 pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
      {children}
    </p>
  )
}

// ─── SPINNER ──────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return (
    <div className={clsx('inline-block w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin', className)} />
  )
}

// ─── ICON CIRCLE ──────────────────────────────────────────────
export function IconCircle({ children, color = 'blue', size = 'md' }: {
  children: ReactNode; color?: string; size?: 'sm' | 'md'
}) {
  const s = size === 'sm' ? 'w-8 h-8 text-base' : 'w-10 h-10 text-lg'
  const c = color === 'green' ? 'bg-green-50 text-green-600'
          : color === 'red'   ? 'bg-red-50 text-red-600'
          : color === 'amber' ? 'bg-amber-50 text-amber-600'
          : 'bg-blue-50 text-blue-600'
  return (
    <div className={clsx('rounded-xl flex items-center justify-center flex-shrink-0', s, c)}>
      {children}
    </div>
  )
}

// ─── NAVBAR ───────────────────────────────────────────────────
export function Navbar({ title, onBack, action }: {
  title: string; onBack?: () => void; action?: ReactNode
}) {
  return (
    <div className="h-14 bg-blue-800 flex items-center px-3 gap-2 flex-shrink-0 shadow-md shadow-blue-900/30">
      {onBack && (
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white">
          ←
        </button>
      )}
      <span className="text-white text-[17px] font-semibold flex-1 tracking-tight">{title}</span>
      {action}
    </div>
  )
}

// ─── STATUS BAR (mock) ────────────────────────────────────────
export function StatusBar() {
  const time = new Date().toLocaleTimeString('en-AU', {
    timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit', hour12: false,
  })
  return (
    <div className="h-11 bg-blue-800 flex items-end justify-between px-4 pb-2 flex-shrink-0">
      <span className="text-white text-sm font-semibold">{time}</span>
      <span className="text-white text-sm">📶 🔋</span>
    </div>
  )
}

// ─── TAB BAR ──────────────────────────────────────────────────
export interface Tab { label: string; icon: string; id: string }

export function TabBar({ tabs, active, onChange, badge }: {
  tabs: Tab[]; active: string; onChange: (id: string) => void; badge?: string
}) {
  return (
    <div className="h-[68px] bg-white border-t border-gray-200 flex items-start pt-2 flex-shrink-0">
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onChange(tab.id)}
          className={clsx('flex-1 flex flex-col items-center gap-0.5 relative',
            active === tab.id ? 'text-blue-600' : 'text-gray-400')}
        >
          <span className="text-2xl leading-none">{tab.icon}</span>
          <span className="text-[10px] font-semibold">{tab.label}</span>
          {badge && tab.id === badge && (
            <span className="absolute top-0 right-[22%] w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>
      ))}
    </div>
  )
}

// ─── LIST ITEM ────────────────────────────────────────────────
export function ListItem({ icon, title, subtitle, right, onClick }: {
  icon?: ReactNode; title: string; subtitle?: string; right?: ReactNode; onClick?: () => void
}) {
  return (
    <div onClick={onClick} className={clsx('flex items-center gap-3 px-4 py-3.5', onClick && 'cursor-pointer active:bg-gray-50')}>
      {icon && <div className="flex-shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  )
}
