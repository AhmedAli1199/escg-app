// lib/push.ts
// Web Push notification helpers
// Uses web-push library server-side

import webpush from 'web-push'

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@escg.com.au',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

// In production, store subscriptions in a DB or KV store.
// For MVP, store in a simple JSON file or Airtable table.
// Here we use an in-memory store (resets on server restart).
// Claude Code: replace with Vercel KV or an Airtable "Push Subscriptions" table.
const subscriptions: Map<string, webpush.PushSubscription> = new Map()

export function saveSubscription(userId: string, sub: webpush.PushSubscription) {
  subscriptions.set(userId, sub)
}

export function getSubscription(userId: string): webpush.PushSubscription | undefined {
  return subscriptions.get(userId)
}

export interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: Record<string, any>
  tag?: string
}

export async function sendPush(subscription: webpush.PushSubscription, payload: PushPayload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
  } catch (err: any) {
    if (err.statusCode === 410) {
      // Subscription expired — remove it
      Array.from(subscriptions.entries()).forEach(([key, sub]) => {
        if (sub.endpoint === subscription.endpoint) subscriptions.delete(key)
      })
    }
    console.error('Push failed:', err.message)
  }
}

export async function sendPushToManager(payload: PushPayload) {
  const managerSub = getSubscription('manager')
  if (managerSub) await sendPush(managerSub, payload)
}

// Notification templates
export const PUSH = {
  shiftComplete: (cleanerName: string, site: string, duration: string, photos: number): PushPayload => ({
    title: `✅ Shift complete — ${cleanerName}`,
    body: `${site} · ${duration} · ${photos} photo${photos !== 1 ? 's' : ''}`,
    tag: `complete-${cleanerName}`,
    data: { type: 'complete' },
  }),

  noShow: (cleanerName: string, site: string): PushPayload => ({
    title: `🚨 No sign-in — ${cleanerName}`,
    body: `${site} · Shift window has passed`,
    tag: `noshow-${cleanerName}`,
    data: { type: 'noshow' },
  }),

  incident: (cleanerName: string, site: string, description: string): PushPayload => ({
    title: `⚠️ Incident — ${cleanerName}`,
    body: `${site} · ${description.slice(0, 80)}`,
    tag: `incident-${cleanerName}`,
    data: { type: 'incident' },
  }),

  unavailable: (cleanerName: string, site: string): PushPayload => ({
    title: `❌ Unavailable — ${cleanerName}`,
    body: `${site} · This shift may need covering`,
    tag: `unavail-${cleanerName}`,
    data: { type: 'unavailable' },
  }),

  needHelp: (cleanerName: string, site: string): PushPayload => ({
    title: `🆘 Help needed — ${cleanerName}`,
    body: `${site} · Cleaner has requested assistance`,
    tag: `help-${cleanerName}`,
    data: { type: 'help' },
  }),
}
