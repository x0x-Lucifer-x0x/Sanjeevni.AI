'use client'
import { Incident, SEVERITY_COLORS, STATUS_LABELS } from '@/types'
import { formatDistanceToNow } from 'date-fns'

interface IncidentQueueProps {
  incidents: Incident[]
  selectedId: string | null
  onSelect: (inc: Incident) => void
  loading: boolean
}

const METHOD_ICONS: Record<string, string> = {
  sos: '🚨', voice: '🎙️', text: '💬', image: '📷',
}

const STATUS_DOT: Record<string, string> = {
  reported:  'bg-zinc-500',
  analyzing: 'bg-blue-400 animate-pulse',
  verified:  'bg-blue-400',
  assigned:  'bg-amber-400',
  en_route:  'bg-amber-400 animate-pulse',
  on_site:   'bg-green-400 animate-pulse',
  resolved:  'bg-green-500',
}

export default function IncidentQueue({ incidents, selectedId, onSelect, loading }: IncidentQueueProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (incidents.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-2xl mb-2">✅</p>
        <p className="text-zinc-500 text-sm">No active incidents</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto">
      {incidents.map(inc => {
        const sc = inc.severity ? SEVERITY_COLORS[inc.severity] : SEVERITY_COLORS.low
        const isSelected = selectedId === inc.id

        return (
          <button
            key={inc.id}
            onClick={() => onSelect(inc)}
            className={`w-full text-left p-3 rounded-xl border transition-all
              ${isSelected
                ? 'bg-zinc-700 border-zinc-500'
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
              }`}
          >
            <div className="flex items-start gap-2">
              {/* Severity indicator */}
              <div
                className="w-1.5 self-stretch rounded-full flex-shrink-0 mt-0.5"
                style={{ background: sc.dot }}
              />

              <div className="flex-1 min-w-0">
                {/* Top row */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm">{METHOD_ICONS[inc.report_method]}</span>
                  <span className="text-white text-xs font-medium truncate">
                    {inc.category || 'Analyzing...'}
                  </span>
                  {inc.severity && (
                    <span className={`ml-auto flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}>
                      {inc.severity}
                    </span>
                  )}
                </div>

                {/* Summary */}
                {inc.ai_summary && (
                  <p className="text-zinc-400 text-xs leading-relaxed line-clamp-2 mb-1.5">
                    {inc.ai_summary}
                  </p>
                )}

                {/* Bottom row */}
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[inc.status] || 'bg-zinc-600'}`} />
                  <span className="text-zinc-600 text-xs">{STATUS_LABELS[inc.status]}</span>
                  {inc.confirmation_count > 1 && (
                    <span className="text-amber-500 text-xs ml-auto">🔗 {inc.confirmation_count}×</span>
                  )}
                  <span className="text-zinc-700 text-xs ml-auto">
                    {formatDistanceToNow(new Date(inc.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}