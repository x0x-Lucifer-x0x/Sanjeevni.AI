'use client'
import { useEffect, useState } from 'react'
import { fetchIncidents } from '@/lib/api'
import { Incident, SEVERITY_COLORS, STATUS_LABELS } from '@/types'
import { useRouter } from 'next/navigation'

export default function HistoryPage() {
  const router = useRouter()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchIncidents({
      event_id: process.env.NEXT_PUBLIC_EVENT_ID,
      limit: 20,
    }).then(res => {
      setIncidents(res.incidents)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const METHOD_ICONS: Record<string, string> = {
    sos: '🚨', voice: '🎙️', text: '💬', image: '📷',
  }

  return (
    <main className="min-h-screen bg-black flex flex-col max-w-sm mx-auto">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-zinc-800">
        <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400">
          ←
        </button>
        <h1 className="text-white font-medium">Report history</h1>
        <span className="ml-auto text-zinc-500 text-xs">{incidents.length} reports</span>
      </header>

      <div className="flex-1 px-4 py-4 flex flex-col gap-3 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && incidents.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-zinc-400">No reports yet</p>
            <p className="text-zinc-600 text-sm mt-1">Reports you submit will appear here</p>
          </div>
        )}

        {incidents.map(inc => {
          const sc = inc.severity ? SEVERITY_COLORS[inc.severity] : SEVERITY_COLORS.low
          return (
            <div key={inc.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span>{METHOD_ICONS[inc.report_method] || '📋'}</span>
                  <span className="text-white text-sm font-medium">{inc.category || 'Analyzing...'}</span>
                </div>
                {inc.severity && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}>
                    {inc.severity}
                  </span>
                )}
              </div>
              {inc.ai_summary && (
                <p className="text-zinc-400 text-xs mb-2 leading-relaxed line-clamp-2">{inc.ai_summary}</p>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
                  <span className="text-zinc-500 text-xs">{STATUS_LABELS[inc.status]}</span>
                </div>
                <span className="text-zinc-700 text-xs">
                  {new Date(inc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {inc.confirmation_count > 1 && (
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-amber-500 text-xs">🔗 {inc.confirmation_count} confirmations (deduplicated)</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <nav className="bg-zinc-950 border-t border-zinc-800 grid grid-cols-3">
        <button onClick={() => router.push('/')} className="flex flex-col items-center py-3 gap-1 text-zinc-500">
          <span className="text-xl">🚨</span>
          <span className="text-xs">SOS</span>
        </button>
        <button onClick={() => router.push('/report/text')} className="flex flex-col items-center py-3 gap-1 text-zinc-500">
          <span className="text-xl">📋</span>
          <span className="text-xs">Report</span>
        </button>
        <button className="flex flex-col items-center py-3 gap-1 text-red-500">
          <span className="text-xl">🕐</span>
          <span className="text-xs font-medium">History</span>
        </button>
      </nav>
    </main>
  )
}