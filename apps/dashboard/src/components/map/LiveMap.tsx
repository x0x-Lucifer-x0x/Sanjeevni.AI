'use client'
import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Incident, Resource, RoutePoint } from '@/types'

// Emoji divIcon factory
function emojiIcon(emoji: string, size = 32, glowing = false) {
  return L.divIcon({
    className: '',
    html: `<div style="
      font-size:${size}px;
      line-height:1;
      display:flex;
      align-items:center;
      justify-content:center;
      ${glowing ? 'filter:drop-shadow(0 0 8px #E24B4A) drop-shadow(0 0 16px #E24B4A);' : ''}
    ">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

// Severity emoji for incidents
function incidentEmoji(severity?: string) {
  switch (severity) {
    case 'critical': return '🚨'
    case 'high':     return '⚠️'
    case 'medium':   return '🔶'
    default:         return '📍'
  }
}

// Resource emoji
function resourceEmoji(type: string) {
  switch (type) {
    case 'ambulance':    return '🚑'
    case 'police':       return '🚔'
    case 'volunteer':    return '🙋'
    case 'rescue':       return '⛑️'
    case 'medical_post': return '🏥'
    default:             return '📍'
  }
}

// Resource contact info (seeded, consistent per resource name)
const CONTACTS: Record<string, { name: string; phone: string }> = {
  'Ambulance Unit 1':  { name: 'Dr. Ramesh Kumar',   phone: '+91-94150-11201' },
  'Ambulance Unit 2':  { name: 'Dr. Priya Singh',    phone: '+91-94150-11202' },
  'Ambulance Unit 3':  { name: 'Dr. Anil Verma',     phone: '+91-94150-11203' },
  'Police Team Alpha': { name: 'Insp. Suresh Yadav', phone: '+91-94150-22101' },
  'Police Team Beta':  { name: 'Insp. Kavita Joshi', phone: '+91-94150-22102' },
  'Police Team Gamma': { name: 'Insp. Dinesh Tiwari',phone: '+91-94150-22103' },
  'Rescue Team 1':     { name: 'Cdr. Vikram Nair',   phone: '+91-94150-33101' },
  'Rescue Team 2':     { name: 'Cdr. Anjali Mehta',  phone: '+91-94150-33102' },
  'Volunteer Squad A': { name: 'Raj Sharma',          phone: '+91-94150-44101' },
  'Volunteer Squad B': { name: 'Neha Patel',          phone: '+91-94150-44102' },
  'Medical Post 1':    { name: 'Dr. Sunita Rao',     phone: '+91-94150-55101' },
  'Medical Post 2':    { name: 'Dr. Mohan Das',      phone: '+91-94150-55102' },
}

// Animated route that draws progressively
function AnimatedRoute({ route }: { route: RoutePoint[] }) {
  const [visible, setVisible] = useState<RoutePoint[]>([route[0]])
  const step = useRef(1)

  useEffect(() => {
    step.current = 1
    setVisible([route[0]])
    const iv = setInterval(() => {
      if (step.current >= route.length) { clearInterval(iv); return }
      setVisible(route.slice(0, step.current + 1))
      step.current++
    }, 180)
    return () => clearInterval(iv)
  }, [route])

  if (visible.length < 2) return null
  return (
    <Polyline
      positions={visible.map(p => [p.lat, p.lng])}
      pathOptions={{ color: '#60A5FA', weight: 4, opacity: 0.9, dashArray: '8 4' }}
    />
  )
}

// Moving resource marker — animates from start toward target
function MovingResourceMarker({
  resource, targetLat, targetLng,
}: { resource: Resource; targetLat: number; targetLng: number }) {
  const [pos, setPos] = useState<[number, number]>([resource.latitude, resource.longitude])
  const frame = useRef(0)
  const totalFrames = 60

  useEffect(() => {
    frame.current = 0
    const startLat = resource.latitude
    const startLng = resource.longitude
    const iv = setInterval(() => {
      frame.current++
      const t = Math.min(frame.current / totalFrames, 1)
      // ease-in-out
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
      setPos([
        startLat + (targetLat - startLat) * ease,
        startLng + (targetLng - startLng) * ease,
      ])
      if (frame.current >= totalFrames) clearInterval(iv)
    }, 100)
    return () => clearInterval(iv)
  }, [resource.latitude, resource.longitude, targetLat, targetLng])

  const emoji = resourceEmoji(resource.type)
  const icon = emojiIcon(emoji, 28)

  return (
    <Marker position={pos} icon={icon}>
      <Popup>
        <div style={{ fontFamily: 'sans-serif', fontSize: 13 }}>
          <strong>{resource.name}</strong>
          <p style={{ color: '#f59e0b', margin: '4px 0 0' }}>🚀 En route to incident</p>
        </div>
      </Popup>
    </Marker>
  )
}

// Pan map to selected incident
function MapFocus({ incident }: { incident: Incident | null }) {
  const map = useMap()
  useEffect(() => {
    if (incident) {
      map.flyTo([incident.latitude, incident.longitude], 16, { duration: 1.2 })
    }
  }, [incident, map])
  return null
}

// Canvas heatmap overlay
function HeatmapOverlay({ incidents, visible }: { incidents: Incident[]; visible: boolean }) {
  const map = useMap()
  const overlayRef = useRef<any>(null)

  useEffect(() => {
    if (overlayRef.current) { overlayRef.current.remove(); overlayRef.current = null }
    if (!visible || incidents.length === 0) return
    const lats = incidents.map(i => i.latitude)
    const lngs = incidents.map(i => i.longitude)
    const pad = 0.004
    const minLat = Math.min(...lats) - pad, maxLat = Math.max(...lats) + pad
    const minLng = Math.min(...lngs) - pad, maxLng = Math.max(...lngs) + pad
    const canvas = document.createElement('canvas')
    canvas.width = 512; canvas.height = 512
    const ctx = canvas.getContext('2d')!
    incidents.forEach(inc => {
      const x = ((inc.longitude - minLng) / (maxLng - minLng)) * 512
      const y = (1 - (inc.latitude - minLat) / (maxLat - minLat)) * 512
      const r = inc.severity === 'critical' ? 70 : inc.severity === 'high' ? 50 : 35
      const col = inc.severity === 'critical' ? '226,75,74' : inc.severity === 'high' ? '245,158,11' : '234,179,8'
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
      grad.addColorStop(0, `rgba(${col},0.65)`)
      grad.addColorStop(0.5, `rgba(${col},0.28)`)
      grad.addColorStop(1, `rgba(${col},0)`)
      ctx.fillStyle = grad
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    })
    const L2 = (window as any).L
    overlayRef.current = L2.imageOverlay(
      canvas.toDataURL(), [[minLat, minLng], [maxLat, maxLng]], { opacity: 0.6, zIndex: 400 }
    )
    overlayRef.current.addTo(map)
    return () => { if (overlayRef.current) { overlayRef.current.remove(); overlayRef.current = null } }
  }, [incidents, visible, map])
  return null
}

interface LiveMapProps {
  incidents: Incident[]
  resources: Resource[]
  activeRoute: RoutePoint[] | null
  movingResource: Resource | null
  movingTarget: { lat: number; lng: number } | null
  selectedIncident: Incident | null
  onIncidentClick: (inc: Incident) => void
  center: [number, number]
  showHeatmap: boolean
}

export default function LiveMap({
  incidents, resources, activeRoute, movingResource, movingTarget,
  selectedIncident, onIncidentClick, center, showHeatmap,
}: LiveMapProps) {
  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-zinc-700">
      <MapContainer center={center} zoom={15} className="w-full h-full" zoomControl={false}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd" maxZoom={20}
        />

        <HeatmapOverlay incidents={incidents} visible={showHeatmap} />
        <MapFocus incident={selectedIncident} />

        {/* Incident markers */}
        {incidents.map(inc => {
          const isSelected = selectedIncident?.id === inc.id
          const emoji = incidentEmoji(inc.severity)
          const size = inc.severity === 'critical' ? 36 : inc.severity === 'high' ? 30 : 26
          const icon = emojiIcon(emoji, size, isSelected)
          return (
            <Marker
              key={inc.id}
              position={[inc.latitude, inc.longitude]}
              icon={icon}
              eventHandlers={{ click: () => onIncidentClick(inc) }}
            >
              <Popup>
                <div style={{ fontFamily: 'sans-serif', fontSize: 13, minWidth: 180 }}>
                  <strong>{inc.category || 'Analyzing...'}</strong>
                  <p style={{ color: '#9ca3af', margin: '4px 0', fontSize: 12 }}>
                    {inc.ai_summary?.slice(0, 80) || inc.raw_input?.slice(0, 80)}
                  </p>
                  <p style={{ fontSize: 11, color: inc.severity === 'critical' ? '#f87171' : '#fbbf24' }}>
                    {inc.severity?.toUpperCase()} · {inc.status}
                  </p>
                  {inc.confirmation_count > 1 && (
                    <p style={{ fontSize: 11, color: '#f59e0b' }}>🔗 {inc.confirmation_count} confirmations</p>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}

        {/* Resource markers — emoji with contact popup */}
        {resources.map(res => {
          // Skip the moving resource — rendered separately with animation
          if (movingResource?.id === res.id) return null
          const emoji = resourceEmoji(res.type)
          const dimmed = res.status === 'unavailable'
          const icon = emojiIcon(emoji, 26)
          const contact = CONTACTS[res.name]
          return (
            <Marker key={res.id} position={[res.latitude, res.longitude]} icon={icon}
              opacity={dimmed ? 0.4 : 1}>
              <Popup>
                <div style={{ fontFamily: 'sans-serif', fontSize: 13, minWidth: 180 }}>
                  <strong>{res.name}</strong>
                  <p style={{ margin: '4px 0 2px', textTransform: 'capitalize', color: '#9ca3af', fontSize: 12 }}>
                    {res.type.replace('_', ' ')}
                  </p>
                  <p style={{
                    fontSize: 12, fontWeight: 600,
                    color: res.status === 'available' ? '#4ade80' : res.status === 'dispatched' ? '#fbbf24' : '#9ca3af'
                  }}>
                    {res.status === 'available' ? '🟢 Available' : res.status === 'dispatched' ? '🟡 Dispatched' : '🔴 Unavailable'}
                  </p>
                  {contact && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #374151' }}>
                      <p style={{ fontSize: 12, color: '#e5e7eb' }}>👤 {contact.name}</p>
                      <p style={{ fontSize: 12, color: '#60a5fa' }}>📞 {contact.phone}</p>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}

        {/* Animated moving resource */}
        {movingResource && movingTarget && (
          <MovingResourceMarker
            resource={movingResource}
            targetLat={movingTarget.lat}
            targetLng={movingTarget.lng}
          />
        )}

        {/* Animated dispatch route */}
        {activeRoute && activeRoute.length > 1 && <AnimatedRoute route={activeRoute} />}
      </MapContainer>
    </div>
  )
}