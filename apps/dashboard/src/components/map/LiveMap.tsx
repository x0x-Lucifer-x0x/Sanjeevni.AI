'use client'
import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Incident, Resource, RoutePoint } from '@/types'

const SEV_COLORS: Record<string, string> = {
  critical: '#E24B4A',
  high:     '#F59E0B',
  medium:   '#EAB308',
  low:      '#22C55E',
}

const RESOURCE_COLORS: Record<string, string> = {
  ambulance:    '#3B82F6',
  police:       '#8B5CF6',
  volunteer:    '#10B981',
  rescue:       '#F97316',
  medical_post: '#EC4899',
}

// Animated polyline — draws route progressively
function AnimatedRoute({ route }: { route: RoutePoint[] }) {
  const [visiblePoints, setVisiblePoints] = useState<RoutePoint[]>([route[0]])
  const stepRef = useRef(1)

  useEffect(() => {
    stepRef.current = 1
    setVisiblePoints([route[0]])
    const interval = setInterval(() => {
      if (stepRef.current >= route.length) {
        clearInterval(interval)
        return
      }
      setVisiblePoints(route.slice(0, stepRef.current + 1))
      stepRef.current++
    }, 200)
    return () => clearInterval(interval)
  }, [route])

  if (visiblePoints.length < 2) return null
  return (
    <Polyline
      positions={visiblePoints.map(p => [p.lat, p.lng])}
      pathOptions={{ color: '#60A5FA', weight: 4, opacity: 0.85, dashArray: '8 4' }}
    />
  )
}

// Canvas heatmap overlay
function HeatmapOverlay({ incidents, visible }: { incidents: Incident[]; visible: boolean }) {
  const map = useMap()
  const overlayRef = useRef<any>(null)

  useEffect(() => {
    const L = (window as any).L
    if (!L) return

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
      const r = inc.severity === 'critical' ? 70 : inc.severity === 'high' ? 50 : inc.severity === 'medium' ? 35 : 22
      const col = inc.severity === 'critical' ? '226,75,74' : inc.severity === 'high' ? '245,158,11' : inc.severity === 'medium' ? '234,179,8' : '34,197,94'
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
      grad.addColorStop(0, `rgba(${col},0.65)`)
      grad.addColorStop(0.5, `rgba(${col},0.28)`)
      grad.addColorStop(1, `rgba(${col},0)`)
      ctx.fillStyle = grad
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    })

    overlayRef.current = L.imageOverlay(
      canvas.toDataURL(),
      [[minLat, minLng], [maxLat, maxLng]],
      { opacity: 0.65, zIndex: 400 },
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
  selectedIncident: Incident | null
  onIncidentClick: (inc: Incident) => void
  center: [number, number]
  showHeatmap: boolean
}

export default function LiveMap({
  incidents, resources, activeRoute, selectedIncident,
  onIncidentClick, center, showHeatmap,
}: LiveMapProps) {
  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-zinc-700">
      <MapContainer center={center} zoom={15} className="w-full h-full" zoomControl={false}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />

        <HeatmapOverlay incidents={incidents} visible={showHeatmap} />

        {incidents.map(inc => (
          <CircleMarker
            key={inc.id}
            center={[inc.latitude, inc.longitude]}
            radius={inc.severity === 'critical' ? 14 : inc.severity === 'high' ? 11 : 8}
            pathOptions={{
              color: SEV_COLORS[inc.severity || 'low'],
              fillColor: SEV_COLORS[inc.severity || 'low'],
              fillOpacity: selectedIncident?.id === inc.id ? 1 : 0.8,
              weight: selectedIncident?.id === inc.id ? 3 : 2,
            }}
            eventHandlers={{ click: () => onIncidentClick(inc) }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-bold">{inc.category || 'Analyzing...'}</p>
                <p className="text-gray-400 text-xs mt-1">{inc.ai_summary || inc.raw_input}</p>
                <p className="text-xs mt-1">Severity: <strong style={{ color: SEV_COLORS[inc.severity || 'low'] }}>{inc.severity}</strong></p>
                {inc.confirmation_count > 1 && (
                  <p className="text-xs text-yellow-600">🔗 {inc.confirmation_count} confirmations</p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {resources.map(res => (
          <CircleMarker
            key={res.id}
            center={[res.latitude, res.longitude]}
            radius={7}
            pathOptions={{
              color: RESOURCE_COLORS[res.type] || '#888',
              fillColor: RESOURCE_COLORS[res.type] || '#888',
              fillOpacity: res.status === 'available' ? 0.9 : 0.35,
              weight: res.status === 'dispatched' ? 3 : 1.5,
              dashArray: res.status === 'dispatched' ? '4 2' : undefined,
            }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-bold">{res.name}</p>
                <p className="text-gray-400 capitalize text-xs">{res.type} · {res.status}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {activeRoute && activeRoute.length > 1 && (
          <AnimatedRoute route={activeRoute} />
        )}
      </MapContainer>
    </div>
  )
}