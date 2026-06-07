'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Incident, Resource, Dispatch, RoutePoint } from '@/types'
import { fetchIncidents, fetchResources, fetchEventStats, fetchSituationBrief } from '@/lib/api'
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates'
import IncidentQueue from '@/components/incidents/IncidentQueue'
import IncidentPanel from '@/components/incidents/IncidentPanel'
import StatsCards from '@/components/StatsCards'
import DemoScenarioEngine from '@/components/DemoScenarioEngine'
import type { EventStats } from '@/types'

const LiveMap = dynamic(() => import('@/components/map/LiveMap'), { ssr: false })

const EVENT_ID = process.env.NEXT_PUBLIC_EVENT_ID!
const MAP_CENTER: [number, number] = [25.4358, 81.8463]

export default function DashboardPage() {
  const [incidents, setIncidents]         = useState<Incident[]>([])
  const [resources, setResources]         = useState<Resource[]>([])
  const [selectedIncident, setSelected]   = useState<Incident | null>(null)
  const [activeRoute, setActiveRoute]     = useState<RoutePoint[] | null>(null)
  const [movingResource, setMovingResource] = useState<Resource | null>(null)
  const [movingTarget, setMovingTarget]   = useState<{ lat: number; lng: number } | null>(null)
  const [stats, setStats]                 = useState<EventStats | null>(null)
  const [brief, setBrief]                 = useState<string | null>(null)
  const [briefLoading, setBriefLoading]   = useState(true)
  const [loading, setLoading]             = useState(true)
  const [lastUpdated, setLastUpdated]     = useState(new Date())
  const [showHeatmap, setShowHeatmap]     = useState(false)
  const [showResolved, setShowResolved]   = useState(false)
  const [showDemo, setShowDemo]           = useState(false)
  const resourceSimRef                    = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const [incRes, resRes, statsRes] = await Promise.all([
        fetchIncidents({ event_id: EVENT_ID, limit: 50 }),
        fetchResources({ event_id: EVENT_ID }),
        fetchEventStats(EVENT_ID),
      ])
      setIncidents(incRes.incidents)
      setResources(resRes.resources)
      setStats(statsRes)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadBrief = useCallback(async () => {
    setBriefLoading(true)
    try {
      const res = await fetchSituationBrief(EVENT_ID)
      setBrief(res.brief)
    } catch {
      setBrief('Unable to generate brief — check API connection')
    } finally {
      setBriefLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
    loadBrief()
    const briefInterval = setInterval(loadBrief, 90_000)
    const dataInterval  = setInterval(loadAll, 15_000)
    return () => { clearInterval(briefInterval); clearInterval(dataInterval) }
  }, [loadAll, loadBrief])

  useRealtimeUpdates(EVENT_ID, {
    onIncidentInsert: (inc) => { setIncidents(prev => [inc, ...prev]); setLastUpdated(new Date()) },
    onIncidentUpdate: (updated) => {
      setIncidents(prev => prev.map(i => i.id === updated.id ? updated : i))
      if (selectedIncident?.id === updated.id) setSelected(updated)
      setLastUpdated(new Date())
    },
    onResourceUpdate: (updated) => {
      setResources(prev => prev.map(r => r.id === updated.id ? updated : r))
    },
  })

  const handleDispatch = useCallback((dispatch: Dispatch) => {
    setActiveRoute(dispatch.route)

    // Find the dispatched resource and incident for animation
    const resource = resources.find(r => r.id === dispatch.resource_id)
    const incident = incidents.find(i => i.id === dispatch.incident_id)
    if (resource && incident) {
      setMovingResource(resource)
      setMovingTarget({ lat: incident.latitude, lng: incident.longitude })
      // Clear moving animation after 12 seconds
      setTimeout(() => { setMovingResource(null); setMovingTarget(null) }, 12_000)
    }

    // Clear route after 35 seconds
    setTimeout(() => setActiveRoute(null), 35_000)
    setTimeout(loadAll, 2000)
  }, [resources, incidents, loadAll])

  const handleSelectIncident = useCallback((inc: Incident) => {
    setSelected(inc)
    setActiveRoute(null)
    // Close demo panel when incident selected
    if (showDemo) setShowDemo(false)
  }, [showDemo])

  const visibleIncidents = incidents.filter(i =>
    showResolved ? true : i.status !== 'resolved'
  )

  return (
    <div className="h-screen bg-zinc-950 text-white flex flex-col overflow-hidden">

      {/* Top bar */}
      <header className="flex items-center gap-3 px-5 py-2.5 bg-zinc-900 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center font-bold text-xs">S</div>
          <div>
            <h1 className="text-white font-semibold text-sm leading-none">Sanjeevani AI</h1>
            <p className="text-zinc-500 text-xs">Command Center · Mahakumbh 2025</p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => setShowHeatmap(h => !h)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-all
              ${showHeatmap ? 'bg-amber-950 border-amber-700 text-amber-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}
          >🌡 Heatmap</button>
          <button
            onClick={() => setShowResolved(s => !s)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-all
              ${showResolved ? 'bg-green-950 border-green-700 text-green-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}
          >✅ Resolved</button>
          <button
            onClick={() => setShowDemo(d => !d)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-all
              ${showDemo ? 'bg-purple-950 border-purple-700 text-purple-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}
          >🎬 Demo</button>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs">Live</span>
          </div>
          <span className="text-zinc-600 text-xs">{lastUpdated.toLocaleTimeString()}</span>
          <button
            onClick={() => { loadAll(); loadBrief() }}
            className="text-zinc-500 hover:text-white text-xs border border-zinc-700 rounded-lg px-2 py-1 transition-colors"
          >↻ Refresh</button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">

        {/* Left sidebar — incident queue */}
        <aside className="w-72 flex-shrink-0 flex flex-col border-r border-zinc-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">Incident queue</h2>
            <span className="text-xs text-zinc-500">{visibleIncidents.filter(i => i.status !== 'resolved').length} active</span>
          </div>
          <div className="flex-1 px-3 py-3 overflow-y-auto">
            <IncidentQueue
              incidents={visibleIncidents}
              selectedId={selectedIncident?.id || null}
              onSelect={handleSelectIncident}
              loading={loading}
            />
          </div>
        </aside>

        {/* Center — stats + map */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
            <StatsCards stats={stats} brief={brief} briefLoading={briefLoading} />
          </div>
          <div className="flex-1 p-3">
            <LiveMap
              incidents={visibleIncidents}
              resources={resources}
              activeRoute={activeRoute}
              movingResource={movingResource}
              movingTarget={movingTarget}
              selectedIncident={selectedIncident}
              onIncidentClick={handleSelectIncident}
              center={MAP_CENTER}
              showHeatmap={showHeatmap}
            />
          </div>
        </main>

        {/* Demo panel */}
        {showDemo && (
          <aside className="w-80 flex-shrink-0 border-l border-zinc-800 overflow-y-auto bg-zinc-900 p-4">
            <DemoScenarioEngine
              onIncidentCreated={() => { setTimeout(loadAll, 2000) }}
              onRefreshNeeded={() => loadAll()}
            />
          </aside>
        )}

        {/* Incident detail panel */}
        {selectedIncident && !showDemo && (
          <aside className="w-80 flex-shrink-0 border-l border-zinc-800 overflow-hidden">
            <IncidentPanel
              incident={selectedIncident}
              resources={resources}
              onDispatch={handleDispatch}
              onClose={() => { setSelected(null); setActiveRoute(null) }}
            />
          </aside>
        )}
      </div>
    </div>
  )
}