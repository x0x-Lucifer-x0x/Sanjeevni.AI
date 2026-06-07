export type ReportMethod = 'sos' | 'voice' | 'text' | 'image'
export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type IncidentStatus =
  | 'reported' | 'analyzing' | 'verified'
  | 'assigned' | 'en_route' | 'on_site' | 'resolved'
export type ResourceType = 'ambulance' | 'police' | 'volunteer' | 'rescue' | 'medical_post'
export type ResourceStatus = 'available' | 'dispatched' | 'unavailable'

export interface Incident {
  id: string
  report_method: ReportMethod
  raw_input?: string
  image_url?: string
  category?: string
  severity?: Severity
  severity_score?: number
  ai_summary?: string
  recommended_resource_type?: string
  latitude: number
  longitude: number
  location_label?: string
  status: IncidentStatus
  confirmation_count: number
  event_id?: string
  created_at: string
  updated_at: string
}

export interface IncidentTimelineEntry {
  id: string
  incident_id: string
  status: IncidentStatus
  actor: string
  note?: string
  created_at: string
}

export interface Resource {
  id: string
  name: string
  type: ResourceType
  status: ResourceStatus
  latitude: number
  longitude: number
  event_id?: string
  updated_at: string
}

export interface RoutePoint { lat: number; lng: number }

export interface Dispatch {
  id: string
  incident_id: string
  resource_id: string
  dispatched_at: string
  arrived_at?: string
  resolved_at?: string
  route: RoutePoint[]
  eta_seconds: number
  resource?: Resource
}

export interface Event {
  id: string
  name: string
  location: string
  center_lat: number
  center_lng: number
  active: boolean
  created_at: string
}

export interface IncidentListResponse {
  incidents: Incident[]
  meta: { total: number; critical: number; high: number; medium: number; low: number }
}

export interface SituationBrief {
  brief: string
  stats: {
    total: number; critical: number; high: number; medium: number; low: number
    resources_available: number; resources_dispatched: number
  }
  generated_at: string
}

export interface EventStats {
  incidents: {
    total: number; active: number; resolved: number
    critical: number; high: number; medium: number; low: number
  }
  resources: {
    total: number; available: number; dispatched: number; unavailable: number
    by_type: Record<ResourceType, number>
  }
}

export const SEVERITY_COLORS: Record<Severity, { bg: string; text: string; border: string; dot: string }> = {
  critical: { bg: 'bg-red-950',    text: 'text-red-400',    border: 'border-red-800',    dot: '#E24B4A' },
  high:     { bg: 'bg-amber-950',  text: 'text-amber-400',  border: 'border-amber-800',  dot: '#F59E0B' },
  medium:   { bg: 'bg-yellow-950', text: 'text-yellow-400', border: 'border-yellow-800', dot: '#EAB308' },
  low:      { bg: 'bg-green-950',  text: 'text-green-400',  border: 'border-green-800',  dot: '#22C55E' },
}

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  reported:  'Reported',
  analyzing: 'AI Analyzing',
  verified:  'Verified',
  assigned:  'Resource Assigned',
  en_route:  'En Route',
  on_site:   'On Site',
  resolved:  'Resolved',
}

export const RESOURCE_ICONS: Record<ResourceType, string> = {
  ambulance:    '🚑',
  police:       '🚔',
  volunteer:    '🙋',
  rescue:       '⛑️',
  medical_post: '🏥',
}