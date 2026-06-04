// lib/airtable.ts
// All Airtable interactions happen here — server-side only
// Base: appCk19lbLLU2x99q ("Whatsapp Bot Cleaners Tables (Copy)")

const BASE_URL = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}`

const headers = {
  Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
}

// ─── TABLE IDs ────────────────────────────────────────────────
export const TABLES = {
  CLEANERS:    'tblGT6gkwbsQzEH6H',
  ASSIGNMENTS: 'tblRaY2TWDqFF2AAj',
  SHIFT_LOGS:  'tbleCJR1s6P0m1uOE',
  INCIDENTS:   'tblp2THjEA7Zy5pXq',
}

// ─── FIELD IDs ────────────────────────────────────────────────
export const FIELDS = {
  // Cleaners
  CLEANER_NAME:   'fldupf7UCNo0g0Apy',
  CLEANER_PHONE:  'fldHmZGruJ7JfQHEh',
  CLEANER_STATUS: 'fldlr7oMnyhaLzgof',

  // Assignments
  ASSIGN_SITE:           'fldj08rB4lquhxV4P',
  ASSIGN_CLEANER:        'fldfw76vhhQKCnyrM',
  ASSIGN_DAYS:           'fldbmRduzlZJ8jKfW',
  ASSIGN_FREQUENCY:      'flddXCTrwuPPZ9vQV',
  ASSIGN_WINDOW_START:   'fld9MDgWHITB6cMBb',
  ASSIGN_WINDOW_END:     'fldjg0KzVdkPKtzv4',
  ASSIGN_WEEKEND:        'fldorgdA1ADJwXv6b',
  ASSIGN_ACTIVE:         'fld7GrtuPlODe461i',
  ASSIGN_LAST_TRIGGERED: 'fldNVZTVrXbhQrWeK',

  // Shift Logs
  LOG_ASSIGNMENT:     'fldvu11MX1IM4co1C',
  LOG_CLEANER:        'fldFkonZblUxQCFBk',
  LOG_DATE:           'fldZIhfEfFQ0uRMYW',
  LOG_STATE:          'fldSgrl2wWcxm0bzu',
  LOG_SIGN_IN_TIME:   'fldlmrsDU6MS4KDFb',
  LOG_SIGN_OUT_TIME:  'flddmohXHvoaOsV3Q',
  LOG_SIGN_IN_PHOTO:  'fld7lE7jbYKqaiphA',  // multipleAttachments
  LOG_END_PHOTO_URLS: 'fld3yGK6ppU3qoINt',  // multipleAttachments
  LOG_CLEANER_NOTES:  'fldkoCjrCsEvFevxh',
  LOG_NO_SHOW_ALERT:  'fldOUhnXEVd27uWWL',
  LOG_REMINDER_SENT:  'fldS2vfH9cWyxeCgL',
  LOG_PENDING_ASSIGN: 'fldNwizCLcLDoPmy2',
  LOG_PREV_STATE:     'fldISJv1FXFGFaEtu',

  // Incidents
  INC_SITE:         'fldjBhESAo7G7tp3T',
  INC_CLEANER:      'fldYufFBVIsDQ648N',
  INC_DATE:         'fldyfeZck7yEiobWE',
  INC_DESCRIPTION:  'fldcezNW1zIuReFyB',
  INC_PHOTO:        'fldOcGFPX6Wn4ohE8',  // multipleAttachments
  INC_STATUS:       'flddLsNUaWLki5VzP',  // singleSelect: Todo / In progress / Done
  INC_MGR_ALERTED:  'flduOdn4TKm3D6Cv1',
}

// ─── TYPES ────────────────────────────────────────────────────
export interface Cleaner {
  id: string
  name: string
  phone: string
  status: string
}

export interface Assignment {
  id: string
  site: string
  cleaner: string
  days: string[]
  frequency: string
  windowStart: string | null
  windowEnd: string | null
  isWeekendShift: boolean
  active: boolean
  lastTriggered: string | null
}

export interface ShiftLog {
  id: string
  assignmentId: string
  cleanerId: string
  date: string
  state: string
  signInTime: string
  signOutTime: string
  signInPhoto: string
  endPhotoUrls: string             // newline-joined attachment URLs (for display/counting)
  endPhotoAttachments: any[]       // raw Airtable attachment objects (for appending)
  cleanerNotes: string
  noShowAlertSent: boolean
  reminderSent: boolean
  pendingAssignments: string
  previousState: string
  siteName?: string
  cleanerName?: string
}

export interface Incident {
  id: string
  site: string
  date: string
  description: string
  photoUrl: string
  resolved: boolean       // true when Status === 'Done'
  managerAlerted: boolean
}

// ─── LOW-LEVEL FETCH ──────────────────────────────────────────
async function airtableFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers || {}) },
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Airtable error ${res.status}: ${err}`)
  }
  return res.json()
}

async function fetchAllRecords(tableId: string, formula?: string): Promise<any[]> {
  const records: any[] = []
  let offset: string | undefined

  do {
    const params = new URLSearchParams({ pageSize: '100' })
    if (formula) params.set('filterByFormula', formula)
    if (offset) params.set('offset', offset)

    const data = await airtableFetch(`/${tableId}?${params}`)
    records.push(...(data.records || []))
    offset = data.offset
  } while (offset)

  return records
}

// ─── CLEANERS ─────────────────────────────────────────────────
export async function getCleanerByPhone(phone: string): Promise<Cleaner | null> {
  const normalised = phone.replace(/\s/g, '')
  const formula = encodeURIComponent(`{Phone} = "${normalised}"`)
  const data = await airtableFetch(`/${TABLES.CLEANERS}?filterByFormula=${formula}`)
  const rec = data.records?.[0]
  if (!rec) return null
  return {
    id:     rec.id,
    name:   rec.fields?.Name || '',
    phone:  rec.fields?.Phone || '',
    status: rec.fields?.Status?.name || 'Active',
  }
}

export async function getAllCleaners(): Promise<Cleaner[]> {
  const records = await fetchAllRecords(TABLES.CLEANERS)
  return records
    .map(rec => ({
      id:     rec.id,
      name:   rec.fields?.Name || '',
      phone:  rec.fields?.Phone || '',
      status: rec.fields?.Status?.name || 'Active',
    }))
    .filter(c => c.name && !c.name.startsWith('['))
}

// ─── ASSIGNMENTS ──────────────────────────────────────────────
function normaliseAssignment(rec: any): Assignment {
  const f = rec.fields || {}
  return {
    id:             rec.id,
    site:           Array.isArray(f.Site) ? f.Site[0] : (f.Site || ''),
    // Cleaner is a singleSelect in this base
    cleaner:        typeof f.Cleaner === 'object' && f.Cleaner?.name ? f.Cleaner.name : (f.Cleaner || ''),
    days:           (f.Days || []).map((d: any) => typeof d === 'object' ? d.name : d),
    frequency:      typeof f.Frequency === 'object' ? f.Frequency?.name : (f.Frequency || 'Weekly'),
    windowStart:    f['Window Start'] || null,
    windowEnd:      f['Window End'] || null,
    isWeekendShift: f['Weekend Shift'] === true,
    active:         f.Active === true,
    lastTriggered:  f.LastTriggeredDate || null,
  }
}

export async function getAssignmentsForCleaner(cleanerName: string, dayAbbr: string, alsoYesterday?: string): Promise<Assignment[]> {
  let formula = `AND({Cleaner} = "${cleanerName}", {Active} = 1, FIND("${dayAbbr}", {Days}))`
  if (alsoYesterday) {
    formula = `AND({Cleaner} = "${cleanerName}", {Active} = 1, OR(FIND("${dayAbbr}", {Days}), FIND("${alsoYesterday}", {Days})))`
  }
  const records = await fetchAllRecords(TABLES.ASSIGNMENTS, formula)
  return records.map(normaliseAssignment)
}

export async function getAllActiveAssignmentsForDay(dayAbbr: string, alsoYesterday?: string): Promise<Assignment[]> {
  let formula = `AND({Active} = 1, {Cleaner} != "", FIND("${dayAbbr}", {Days}))`
  if (alsoYesterday) {
    formula = `AND({Active} = 1, {Cleaner} != "", OR(FIND("${dayAbbr}", {Days}), FIND("${alsoYesterday}", {Days})))`
  }
  const records = await fetchAllRecords(TABLES.ASSIGNMENTS, formula)
  return records.map(normaliseAssignment)
}

export async function updateAssignmentLastTriggered(assignmentId: string, date: string) {
  return airtableFetch(`/${TABLES.ASSIGNMENTS}/${assignmentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: { LastTriggeredDate: date } }),
  })
}

// ─── FREQUENCY FILTER ─────────────────────────────────────────
export function filterByFrequency(assignments: Assignment[], targetDate: Date): Assignment[] {
  const dayOfMonth = targetDate.getDate()

  return assignments.filter(a => {
    const freq = a.frequency
    if (freq === 'Weekly') return true
    if (freq === 'Fortnightly') {
      if (!a.lastTriggered) return true
      const diff = Math.floor((targetDate.getTime() - new Date(a.lastTriggered).getTime()) / 86400000)
      return diff >= 13
    }
    if (freq === 'Monthly') return dayOfMonth <= 7
    if (freq === 'Adhoc') return false
    return true
  })
}

// ─── SHIFT LOGS ───────────────────────────────────────────────
function normaliseLog(rec: any): ShiftLog {
  const f = rec.fields || {}

  // Site name — multipleLookupValues returns an array
  let siteName = ''
  const siteField = f['Site (from Assignment)']
  if (Array.isArray(siteField)) {
    siteName = siteField[0] || ''
  }

  // Cleaner name — multipleLookupValues returns an array
  let cleanerName = ''
  const cleanerField = f['Name (from Cleaner)']
  if (Array.isArray(cleanerField)) {
    cleanerName = cleanerField[0] || ''
  }

  // End Photo URLs — multipleAttachments field
  const endPhotoField = f['End Photo URLs']
  const endPhotoAttachments: any[] = Array.isArray(endPhotoField) ? endPhotoField : []
  const endPhotoUrls = endPhotoAttachments.map((a: any) => a.url).join('\n')

  // Sign In Photo — multipleAttachments field
  const signInPhotoField = f['Sign In Photo']
  const signInPhoto = Array.isArray(signInPhotoField)
    ? (signInPhotoField[0]?.url || '')
    : (signInPhotoField || '')

  return {
    id:                 rec.id,
    assignmentId:       (f.Assignment || [])[0] || '',
    cleanerId:          (f.Cleaner || [])[0] || '',
    date:               f.Date || '',
    state:              f['Cleaner State']?.name || f['Cleaner State'] || '',
    signInTime:         f['Sign In Time'] || '',
    signOutTime:        f['Sign Out Time'] || '',
    signInPhoto,
    endPhotoUrls,
    endPhotoAttachments,
    cleanerNotes:       f['Cleaner Notes'] || '',
    noShowAlertSent:    f['No Show Alert Sent'] || false,
    reminderSent:       f['Reminder Sent'] || false,
    pendingAssignments: f['Pending Assignments'] || '',
    previousState:      f['Previous State'] || '',
    siteName,
    cleanerName,
  }
}

export async function getShiftLog(id: string): Promise<ShiftLog> {
  const data = await airtableFetch(`/${TABLES.SHIFT_LOGS}/${id}`)
  return normaliseLog(data)
}

export async function getActiveShiftLogsForCleaner(phone: string): Promise<ShiftLog[]> {
  const today     = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`

  const formula = encodeURIComponent(
    `AND({Phone (from Cleaner)} = "${phone}", OR({Date} = "${fmt(today)}", {Date} = "${fmt(yesterday)}"))`
  )
  const data = await airtableFetch(`/${TABLES.SHIFT_LOGS}?filterByFormula=${formula}`)
  return (data.records || []).map(normaliseLog)
}

export async function getAllShiftLogsForDate(dateStr: string): Promise<ShiftLog[]> {
  const formula = encodeURIComponent(`{Date} = "${dateStr}"`)
  const data = await airtableFetch(`/${TABLES.SHIFT_LOGS}?filterByFormula=${formula}`)
  return (data.records || []).map(normaliseLog)
}

export async function getAllShiftLogs(limit = 200): Promise<ShiftLog[]> {
  const data = await airtableFetch(
    `/${TABLES.SHIFT_LOGS}?pageSize=${Math.min(limit, 100)}&sort[0][field]=Date&sort[0][direction]=desc`
  )
  return (data.records || []).map(normaliseLog)
}

export async function getShiftLogHistoryForCleaner(phone: string, limit = 100): Promise<ShiftLog[]> {
  const formula = encodeURIComponent(`{Phone (from Cleaner)} = "${phone}"`)
  const data = await airtableFetch(
    `/${TABLES.SHIFT_LOGS}?filterByFormula=${formula}&pageSize=${Math.min(limit, 100)}&sort[0][field]=Date&sort[0][direction]=desc`
  )
  return (data.records || []).map(normaliseLog)
}

export async function createShiftLog(fields: Record<string, any>): Promise<ShiftLog> {
  const data = await airtableFetch(`/${TABLES.SHIFT_LOGS}`, {
    method: 'POST',
    body: JSON.stringify({ fields }),
  })
  return normaliseLog(data)
}

export async function updateShiftLog(id: string, fields: Record<string, any>): Promise<ShiftLog> {
  const data = await airtableFetch(`/${TABLES.SHIFT_LOGS}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  })
  return normaliseLog(data)
}

export async function deleteShiftLog(id: string): Promise<void> {
  await airtableFetch(`/${TABLES.SHIFT_LOGS}/${id}`, { method: 'DELETE' })
}

// ─── INCIDENTS ────────────────────────────────────────────────
export async function createIncident(fields: Record<string, any>): Promise<{ id: string }> {
  return airtableFetch(`/${TABLES.INCIDENTS}`, {
    method: 'POST',
    body: JSON.stringify({ fields }),
  })
}

export async function getAllIncidents(): Promise<Incident[]> {
  const data = await airtableFetch(
    `/${TABLES.INCIDENTS}?sort[0][field]=Date&sort[0][direction]=desc`
  )
  return (data.records || []).map((rec: any) => ({
    id:             rec.id,
    site:           rec.fields?.Site || '',
    date:           rec.fields?.Date || '',
    description:    rec.fields?.Description || '',
    // Photo is multipleAttachments — return first URL for display
    photoUrl:       Array.isArray(rec.fields?.Photo) ? (rec.fields.Photo[0]?.url || '') : '',
    // Status singleSelect: "Done" means resolved
    resolved:       rec.fields?.Status?.name === 'Done',
    managerAlerted: rec.fields?.['Manager Alerted'] || false,
  }))
}

export async function updateIncident(id: string, fields: Record<string, any>) {
  return airtableFetch(`/${TABLES.INCIDENTS}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  })
}

// ─── ATTACHMENT UPLOAD ────────────────────────────────────────
// Uploads a file directly to an Airtable multipleAttachments field.
// Airtable appends to existing attachments — no need to preserve IDs.
export async function uploadAttachment(
  recordId: string,
  fieldId: string,
  file: Blob,
  filename: string,
): Promise<{ id: string; url: string; filename: string }> {
  const baseId = process.env.AIRTABLE_BASE_ID
  const token  = process.env.AIRTABLE_TOKEN
  const form   = new FormData()
  form.append('file', file, filename)
  // DO NOT append 'filename' separately — this causes 400

  const res = await fetch(
    `https://content.airtable.com/v0/${baseId}/${recordId}/${fieldId}/uploadAttachment`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Airtable upload error ${res.status}: ${err}`)
  }
  return res.json()
}

// ─── DATE HELPERS ─────────────────────────────────────────────
export function getSydneyDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
}

export function getSydneyDateFormatted(): string {
  const d = new Date()
  const parts = d.toLocaleDateString('en-GB', { timeZone: 'Australia/Sydney' }).split('/')
  return parts.join('/')
}

export function getSydneyDayAbbr(): string {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const sydneyDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
  return days[new Date(sydneyDate + 'T12:00:00').getDay()]
}

export function getSydneyTime(): string {
  return new Date().toLocaleTimeString('en-AU', {
    timeZone: 'Australia/Sydney',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function calcDuration(signIn: string, signOut: string): string {
  if (!signIn || !signOut) return ''
  const [ih, im] = signIn.split(':').map(Number)
  const [oh, om] = signOut.split(':').map(Number)
  let mins = (oh * 60 + om) - (ih * 60 + im)
  if (mins < 0) mins += 1440
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`
}
