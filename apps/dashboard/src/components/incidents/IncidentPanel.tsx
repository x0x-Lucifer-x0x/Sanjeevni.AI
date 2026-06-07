'use client'
import { useState, useEffect } from 'react'
import { Incident, Resource, Dispatch, SEVERITY_COLORS, STATUS_LABELS, RESOURCE_ICONS } from '@/types'
import { fetchIncidentTimeline, dispatchResource, updateIncidentStatus, markArrived, resolveDispatch } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

interface IncidentPanelProps {
  incident: Incident
  resources: Resource[]
  onDispatch: (dispatch: Dispatch) => void
  onClose: () => void
}

export default function IncidentPanel({ incident, resources, onDispatch, onClose }: IncidentPanelProps) {
  const [timeline, setTimeline] = useState<any[]>([])
  const [selectedResource, setSelectedResource] = useState<string | null>(null)
  const [dispatching, setDispatching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeDispatch, setActiveDispatch] = useState<Dispatch | null>(null)

  const sc = incident.severity ? SEVERITY_COLORS[incident.severity] : SEVERITY_COLORS.low

  // Recommended resource type filter
  const recommendedType = incident.recommended_resource_type
  const availableResources = resources.filter(r =>
    r.status === 'available' &&
    (!recommendedType || r.type === recommendedType || true) // show all, highlight recommended
  )

  useEffect(() => {
    fetchIncidentTimeline(incident.id).then(r => setTimeline(r.timeline))
  }, [incident.id])

  const handleDispatch = async () => {
    if (!selectedResource) return
    setDispatching(true)
    setError(null)
    try {
      const dispatch = await dispatchResource({
        incident_id: incident.id,
        resource_id: selectedResource,
      })
      setActiveDispatch(dispatch)
      onDispatch(dispatch)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDispatching(false)
    }
  }

  const handleMarkArrived = async () => {
    if (!activeDispatch) return
    await markArrived(activeDispatch.id)
  }

  const handleResolve = async () => {
    if (!activeDispatch) return
    await resolveDispatch(activeDispatch.id, 'Resolved by dispatcher')
    onClose()
  }

  return (
    <div className="flex flex-col h-full bg-zinc-900 text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-4 border-b border-zinc-800">
        <div
          className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
          style={{ background: sc.dot }}
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-semibold text-sm">{incident.category || 'Analyzing...'}</h2>
          <p className="text-zinc-500 text-xs mt-0.5">
            {formatDistanceToNow(new Date(incident.created_at), { addSuffix: true })} ·
            {incident.report_method.toUpperCase()} report
          </p>
        </div>
        <div className="flex items-center gap-2">
          {incident.severity && (
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sc.bg} ${sc.text} ${sc.border}`}>
              {incident.severity}
            </span>
          )}
          <button onClick={onClose} className="text-zinc-600 hover:text-white text-lg leading-none">✕</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">

        {/* AI Summary */}
        {incident.ai_summary && (
          <div className="bg-blue-950 border border-blue-900 rounded-xl p-3">
            <p className="text-blue-400 text-xs font-medium mb-1">✦ AI Summary</p>
            <p className="text-blue-200 text-sm leading-relaxed">{incident.ai_summary}</p>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-zinc-800 rounded-xl p-2.5 text-center">
            <p className="text-zinc-500 text-xs mb-0.5">Score</p>
            <p className="text-white font-bold">{incident.severity_score ?? '—'}<span className="text-zinc-600 font-normal">/10</span></p>
          </div>
          <div className="bg-zinc-800 rounded-xl p-2.5 text-center">
            <p className="text-zinc-500 text-xs mb-0.5">Confirms</p>
            <p className="text-amber-400 font-bold">{incident.confirmation_count}</p>
          </div>
          <div className="bg-zinc-800 rounded-xl p-2.5 text-center">
            <p className="text-zinc-500 text-xs mb-0.5">Resource</p>
            <p className="text-white text-xs font-medium capitalize">{incident.recommended_resource_type || '—'}</p>
          </div>
        </div>

        {/* Raw report */}
        {incident.raw_input && (
          <div>
            <p className="text-zinc-500 text-xs mb-1">Original report</p>
            <p className="text-zinc-300 text-xs leading-relaxed bg-zinc-800 rounded-xl p-3">
              "{incident.raw_input}"
            </p>
          </div>
        )}

        {/* Dispatch section */}
        {!activeDispatch && incident.status !== 'resolved' && (
          <div>
            <p className="text-zinc-400 text-xs mb-2">Assign resource</p>
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
              {availableResources.length === 0 ? (
                <p className="text-zinc-600 text-xs">No available resources</p>
              ) : (
                availableResources.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedResource(r.id === selectedResource ? null : r.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all text-xs
                      ${selectedResource === r.id
                        ? 'bg-blue-950 border-blue-700 text-white'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                      }`}
                  >
                    <span>{RESOURCE_ICONS[r.type]}</span>
                    <span className="flex-1 font-medium">{r.name}</span>
                    {r.type === recommendedType && (
                      <span className="text-green-400 text-xs">✦ recommended</span>
                    )}
                  </button>
                ))
              )}
            </div>

            {error && (
              <p className="text-red-400 text-xs mt-2">{error}</p>
            )}

            <button
              onClick={handleDispatch}
              disabled={!selectedResource || dispatching}
              className="w-full mt-3 bg-red-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all"
            >
              {dispatching ? '⏳ Dispatching...' : '🚀 Dispatch resource'}
            </button>
          </div>
        )}

        {/* Active dispatch controls */}
        {activeDispatch && incident.status !== 'resolved' && (
          <div className="bg-green-950 border border-green-800 rounded-xl p-3 flex flex-col gap-2">
            <p className="text-green-400 text-xs font-medium">✓ Resource dispatched — ETA {Math.ceil(activeDispatch.eta_seconds / 60)} min</p>
            <div className="flex gap-2">
              <button
                onClick={handleMarkArrived}
                className="flex-1 bg-zinc-800 text-zinc-300 py-2 rounded-lg text-xs"
              >
                Mark arrived
              </button>
              <button
                onClick={handleResolve}
                className="flex-1 bg-green-700 text-white py-2 rounded-lg text-xs font-medium"
              >
                Resolve incident
              </button>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div>
          <p className="text-zinc-500 text-xs mb-2">Timeline</p>
          <div className="flex flex-col gap-2">
            {timeline.map((entry, i) => (
              <div key={entry.id} className="flex gap-2 items-start">
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-2 h-2 rounded-full bg-zinc-600 flex-shrink-0 mt-0.5" />
                  {i < timeline.length - 1 && <div className="w-px h-full bg-zinc-800 min-h-3" />}
                </div>
                <div className="flex-1 pb-2">
                  <p className="text-zinc-300 text-xs">{entry.note}</p>
                  <p className="text-zinc-700 text-xs mt-0.5">
                    {entry.actor} · {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}