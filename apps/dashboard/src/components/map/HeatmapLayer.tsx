'use client'
import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { Incident } from '@/types'

interface HeatmapLayerProps {
  incidents: Incident[]
  visible: boolean
}

// Simple canvas-based heatmap overlay (no extra lib needed)
export default function HeatmapLayer({ incidents, visible }: HeatmapLayerProps) {
  const map = useMap()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const overlayRef = useRef<any>(null)

  useEffect(() => {
    if (!visible) {
      if (overlayRef.current) {
        overlayRef.current.remove()
        overlayRef.current = null
      }
      return
    }

    if (incidents.length === 0) return

    // Use Leaflet's built-in SVGOverlay approach via canvas
    const L = (window as any).L
    if (!L) return

    if (overlayRef.current) {
      overlayRef.current.remove()
    }

    // Build bounds that cover all incidents
    const lats = incidents.map(i => i.latitude)
    const lngs = incidents.map(i => i.longitude)
    const minLat = Math.min(...lats) - 0.003
    const maxLat = Math.max(...lats) + 0.003
    const minLng = Math.min(...lngs) - 0.003
    const maxLng = Math.max(...lngs) + 0.003

    const bounds: [[number, number], [number, number]] = [[minLat, minLng], [maxLat, maxLng]]

    // Create canvas
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 400
    const ctx = canvas.getContext('2d')!

    // Draw radial gradients for each incident
    incidents.forEach(inc => {
      const latFrac = (inc.latitude - minLat) / (maxLat - minLat)
      const lngFrac = (inc.longitude - minLng) / (maxLng - minLng)
      const x = lngFrac * 400
      const y = (1 - latFrac) * 400

      const radius = inc.severity === 'critical' ? 60
        : inc.severity === 'high' ? 45
        : inc.severity === 'medium' ? 30 : 20

      const color = inc.severity === 'critical' ? '226,75,74'
        : inc.severity === 'high' ? '245,158,11'
        : inc.severity === 'medium' ? '234,179,8' : '34,197,94'

      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
      grad.addColorStop(0, `rgba(${color},0.6)`)
      grad.addColorStop(0.5, `rgba(${color},0.25)`)
      grad.addColorStop(1, `rgba(${color},0)`)

      ctx.fillStyle = grad
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
    })

    // Add as image overlay
    overlayRef.current = L.imageOverlay(canvas.toDataURL(), bounds, { opacity: 0.65, zIndex: 400 })
    overlayRef.current.addTo(map)

    return () => {
      if (overlayRef.current) {
        overlayRef.current.remove()
        overlayRef.current = null
      }
    }
  }, [incidents, visible, map])

  return null
}