'use client'
import { useState, useCallback, useRef } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useNetwork } from '@/hooks/useNetwork'
import { submitIncident } from '@/lib/api'
import { enqueueReport } from '@/lib/offlineQueue'
import { useRouter } from 'next/navigation'

const QUICK_TAGS = [
  { label: 'Medical emergency', icon: '🏥' },
  { label: 'Crowd surge', icon: '👥' },
  { label: 'Lost child', icon: '👶' },
  { label: 'Fire', icon: '🔥' },
  { label: 'Drowning', icon: '🌊' },
  { label: 'Security incident', icon: '🚨' },
]

const SEV_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-950 border-red-800',
  high:     'text-amber-400 bg-amber-950 border-amber-800',
  medium:   'text-yellow-400 bg-yellow-950 border-yellow-800',
  low:      'text-green-400 bg-green-950 border-green-800',
}

export default function TextReportPage() {
  const router = useRouter()
  const { coords, loading: gpsLoading } = useGeolocation()
  const { networkState } = useNetwork()

  const [text, setText] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [incident, setIncident] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!text.trim()) return
    setSubmitting(true)
    setError(null)

    const payload = {
      report_method: 'text' as const,
      raw_input: text,
      latitude: coords.lat,
      longitude: coords.lng,
      location_label: `${coords.lat.toFixed(4)}°N, ${coords.lng.toFixed(4)}°E`,
      event_id: process.env.NEXT_PUBLIC_EVENT_ID,
    }

    try {
      if (networkState === 'offline') {
        await enqueueReport(payload)
        setSubmitted(true)
        setTimeout(() => router.push('/history'), 1500)
      } else {
        const result = await submitIncident(payload)
        setIncident(result)
        setSubmitted(true)
        setTimeout(() => router.push('/history'), 2000)
      }
    } catch (err: any) {
      // Fallback to queue
      await enqueueReport(payload)
      setError('Queued for retry — report saved locally')
      setSubmitted(true)
      setTimeout(() => router.push('/history'), 2000)
    } finally {
      setSubmitting(false)
    }
  }

  const handleTagSelect = (tag: string) => {
    setSelectedTag(tag)
    setText(tag + ' — ')
  }

  return (
    <main className="min-h-screen bg-black flex flex-col max-w-sm mx-auto">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-zinc-800">
        <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400">
          ←
        </button>
        <h1 className="text-white font-medium">Text report</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-950 text-green-400 border border-green-800">
          AI classify
        </span>
      </header>

      <div className="flex-1 px-4 py-5 flex flex-col gap-5 overflow-y-auto">
        {/* Quick tags */}
        <div>
          <p className="text-zinc-500 text-xs mb-2">Quick select</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_TAGS.map(t => (
              <button
                key={t.label}
                onClick={() => handleTagSelect(t.label)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all
                  ${selectedTag === t.label
                    ? 'bg-red-950 border-red-700 text-red-400'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                  }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Text input */}
        <div>
          <p className="text-zinc-500 text-xs mb-2">Describe the emergency</p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="e.g. Heavy crowd pushing near Gate 7, people are falling..."
            rows={5}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-red-600 resize-none leading-relaxed"
          />
          <p className="text-zinc-700 text-xs mt-1 text-right">{text.length} chars</p>
        </div>

        {/* Location */}
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5">
          <span className="text-red-500">📍</span>
          <span className="text-zinc-300 text-sm">
            {gpsLoading ? 'Getting location...' : `${coords.lat.toFixed(4)}°N, ${coords.lng.toFixed(4)}°E`}
          </span>
        </div>

        {/* Note about AI processing */}
        <div className="flex items-start gap-2 bg-blue-950 border border-blue-900 rounded-xl px-3 py-2.5">
          <span className="text-blue-400 mt-0.5">✦</span>
          <p className="text-blue-300 text-xs leading-relaxed">
            Your report will be classified by Groq Llama 3.3 AI. Severity and resource recommendation are assigned automatically within seconds.
          </p>
        </div>

        {error && (
          <div className="bg-amber-950 border border-amber-800 rounded-xl px-3 py-2.5">
            <p className="text-amber-400 text-xs">{error}</p>
          </div>
        )}

        {submitted && (
          <div className="bg-green-950 border border-green-800 rounded-xl px-3 py-2.5 flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <p className="text-green-400 text-sm">Report submitted — redirecting...</p>
          </div>
        )}
      </div>

      <div className="px-4 pb-6 pt-3">
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || submitting || submitted}
          className="w-full bg-red-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white py-4 rounded-2xl font-medium flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          {submitting ? '⏳ Analyzing & sending...' : '✈ Send report'}
        </button>
      </div>
    </main>
  )
}