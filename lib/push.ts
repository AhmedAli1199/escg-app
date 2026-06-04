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

import {
  getManagerSubscriptions,
  saveManagerSubscription,
  removeManagerSubscription,
  getCleanerSubscriptions,
  saveCleanerSubscription,
  removeCleanerSubscription,
} from './airtable'

export async function saveSubscription(userId: string, sub: any) {
  if (userId === 'manager') {
    await saveManagerSubscription(sub)
  } else {
    await saveCleanerSubscription(userId, sub)
  }
}

export interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  data?: Record<string, any>
  tag?: string
}

export async function sendPush(subscription: any, payload: PushPayload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await removeManagerSubscription(subscription.endpoint)
    }
    console.error('Push failed:', err.message)
  }
}

export async function sendPushToManager(payload: PushPayload) {
  const subs = await getManagerSubscriptions()
  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload))
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await removeManagerSubscription(sub.endpoint)
      }
      console.error('Push to manager failed:', err.message)
    }
  }
}

export async function sendPushToCleaner(cleanerId: string, payload: PushPayload) {
  const subs = await getCleanerSubscriptions(cleanerId)
  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload))
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await removeCleanerSubscription(cleanerId, sub.endpoint)
      }
      console.error('Push to cleaner failed:', err.message)
    }
  }
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

  reminder: (site: string): PushPayload => ({
    title: `⏰ Upcoming Shift`,
    body: `Reminder: You have a shift at ${site} soon. Don't forget to sign in!`,
    tag: `reminder-${site}`,
    data: { type: 'reminder' },
  }),

  lateAlert: (site: string): PushPayload => ({
    title: `⚠️ Late Sign-in Alert`,
    body: `You haven't signed into your shift at ${site} yet. Please sign in or report if you are unavailable.`,
    tag: `late-${site}`,
    data: { type: 'late' },
  }),
}
