// Dashboard has its own standalone API client (not re-exported from citizen)

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

import type {
  Incident, IncidentListResponse, Resource,
  Dispatch, SituationBrief, EventStats, Event, IncidentStatus,
} from '@/types'

// ── Incidents ─────────────────────────────────────────────────
export async function fetchIncidents(params: {
  event_id?: string; status?: string; severity?: string
  limit?: number; exclude_duplicates?: boolean
} = {}): Promise<IncidentListResponse> {
  const qs = new URLSearchParams()
  if (params.event_id) qs.set('event_id', params.event_id)
  if (params.status) qs.set('status', params.status)
  if (params.severity) qs.set('severity', params.severity)
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.exclude_duplicates !== undefined) qs.set('exclude_duplicates', String(params.exclude_duplicates))
  return request<IncidentListResponse>(`/incidents?${qs}`)
}

export async function fetchIncident(id: string): Promise<Incident> {
  return request<Incident>(`/incidents/${id}`)
}

export async function fetchIncidentTimeline(id: string): Promise<{ timeline: any[] }> {
  return request(`/incidents/${id}/timeline`)
}

export async function updateIncidentStatus(
  id: string, status: IncidentStatus, note?: string, actor?: string,
): Promise<Incident> {
  return request<Incident>(`/incidents/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note, actor }),
  })
}

// ── Resources ─────────────────────────────────────────────────
export async function fetchResources(params: {
  event_id?: string; status?: string; type?: string
} = {}): Promise<{ resources: Resource[] }> {
  const qs = new URLSearchParams()
  if (params.event_id) qs.set('event_id', params.event_id)
  if (params.status) qs.set('status', params.status)
  if (params.type) qs.set('type', params.type)
  return request(`/resources?${qs}`)
}

// ── Dispatch ──────────────────────────────────────────────────
export async function dispatchResource(payload: {
  incident_id: string; resource_id: string; notes?: string
}): Promise<Dispatch> {
  return request<Dispatch>('/dispatch', { method: 'POST', body: JSON.stringify(payload) })
}

export async function markArrived(dispatch_id: string): Promise<void> {
  return request(`/dispatch/${dispatch_id}/arrived`, { method: 'PATCH' })
}

export async function resolveDispatch(dispatch_id: string, notes?: string): Promise<void> {
  return request(`/dispatch/${dispatch_id}/resolve?notes=${encodeURIComponent(notes || '')}`, { method: 'PATCH' })
}

// ── AI ────────────────────────────────────────────────────────
export async function fetchSituationBrief(event_id?: string): Promise<SituationBrief> {
  const qs = event_id ? `?event_id=${event_id}` : ''
  return request<SituationBrief>(`/ai/brief${qs}`)
}

// ── Events ────────────────────────────────────────────────────
export async function fetchEvents(): Promise<{ events: Event[] }> {
  return request('/events')
}

export async function fetchEventStats(event_id: string): Promise<EventStats> {
  return request(`/events/${event_id}/stats`)
}

// ── Submit Incident (used by DemoScenarioEngine) ──────────────
export async function submitIncident(payload: {
  report_method: string
  raw_input?: string
  latitude: number
  longitude: number
  location_label?: string
  event_id?: string
  reporter_id?: string
}): Promise<Incident> {
  return request<Incident>('/incidents', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}