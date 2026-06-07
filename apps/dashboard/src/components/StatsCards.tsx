'use client'
import { EventStats } from '@/types'

interface StatsCardsProps {
  stats: EventStats | null
  brief: string | null
  briefLoading: boolean
}

export default function StatsCards({ stats, brief, briefLoading }: StatsCardsProps) {
  const inc = stats?.incidents
  const res = stats?.resources

  return (
    <div className="flex flex-col gap-3">
      {/* AI Brief */}
      <div className="bg-blue-950 border border-blue-800 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-blue-400 text-xs font-medium">✦ AI Situation Brief</span>
          {briefLoading && <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        <p className="text-blue-200 text-sm leading-relaxed">
          {briefLoading ? 'Generating...' : brief || 'Loading situation assessment...'}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-red-950 border border-red-900 rounded-xl p-3 text-center">
          <p className="text-red-400 text-xl font-bold">{inc?.critical ?? 0}</p>
          <p className="text-red-600 text-xs">Critical</p>
        </div>
        <div className="bg-amber-950 border border-amber-900 rounded-xl p-3 text-center">
          <p className="text-amber-400 text-xl font-bold">{inc?.high ?? 0}</p>
          <p className="text-amber-600 text-xs">High</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-center">
          <p className="text-zinc-200 text-xl font-bold">{inc?.active ?? 0}</p>
          <p className="text-zinc-500 text-xs">Active</p>
        </div>
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-center">
          <p className="text-green-400 text-xl font-bold">{res?.available ?? 0}</p>
          <p className="text-zinc-500 text-xs">Available</p>
        </div>
      </div>

      {/* Resource breakdown */}
      {res && (
        <div className="grid grid-cols-5 gap-2">
          {(['ambulance', 'police', 'volunteer', 'rescue', 'medical_post'] as const).map(type => (
            <div key={type} className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-center">
              <p className="text-base">{
                { ambulance: '🚑', police: '🚔', volunteer: '🙋', rescue: '⛑️', medical_post: '🏥' }[type]
              }</p>
              <p className="text-white text-xs font-bold">{res.by_type[type] ?? 0}</p>
              <p className="text-zinc-700 text-xs capitalize">{type.replace('_', ' ')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}