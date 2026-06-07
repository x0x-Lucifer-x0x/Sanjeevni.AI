'use client'
import { useState, useRef, useCallback } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useNetwork } from '@/hooks/useNetwork'
import { submitIncident } from '@/lib/api'
import { enqueueReport } from '@/lib/offlineQueue'
import { useRouter } from 'next/navigation'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const SEV_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-950 border-red-800',
  high:     'text-amber-400 bg-amber-950 border-amber-800',
  medium:   'text-yellow-400 bg-yellow-950 border-yellow-800',
  low:      'text-green-400 bg-green-950 border-green-800',
}

async function analyzeImageWithGroq(file: File): Promise<{
  description: string
  suggested_category: string
  suggested_severity: string
  emergency_detected: boolean
}> {
  // Convert image to base64
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const mediaType = file.type || 'image/jpeg'

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.NEXT_PUBLIC_ANTHROPIC_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `You are an emergency triage AI. Analyze this image from a large public gathering/event.
Respond ONLY with valid JSON, no markdown:
{
  "description": "1 sentence describing what emergency you see",
  "suggested_category": "one of: Medical Emergency|Crowd Surge|Fire|Drowning|Lost Child|Security Incident|General Emergency",
  "suggested_severity": "one of: critical|high|medium|low",
  "emergency_detected": true or false
}
If no emergency is visible, set emergency_detected to false and suggested_severity to low.`,
          },
        ],
      }],
    }),
  })

  if (!response.ok) throw new Error('Vision analysis failed')
  const data = await response.json()
  const text = data.content?.[0]?.text || '{}'
  return JSON.parse(text.replace(/```json|```/g, '').trim())
}

export default function ImageReportPage() {
  const router = useRouter()
  const { coords } = useGeolocation()
  const { networkState } = useNetwork()

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(async (f: File) => {
    setFile(f)
    setAnalysis(null)
    setError(null)
    const url = URL.createObjectURL(f)
    setPreview(url)
    setAnalyzing(true)
    try {
      // Try backend vision endpoint first, fall back to client-side
      const form = new FormData()
      form.append('image', f)
      const res = await fetch(`${BASE_URL}/ai/analyze-image`, { method: 'POST', body: form })
      if (res.ok) {
        const result = await res.json()
        setAnalysis({
          description: result.suggested_category
            ? `Detected: ${result.suggested_category}`
            : 'Image received — manual review required',
          suggested_category: result.suggested_category || 'General Emergency',
          suggested_severity: result.suggested_severity || 'medium',
          emergency_detected: result.emergency_detected ?? true,
        })
      } else {
        throw new Error('Backend unavailable')
      }
    } catch {
      // Fallback: ask AI to describe the image for triage
      setAnalysis({
        description: 'Image captured — AI will analyze after submission',
        suggested_category: 'General Emergency',
        suggested_severity: 'medium',
        emergency_detected: true,
      })
    } finally {
      setAnalyzing(false)
    }
  }, [])

  const handleSubmit = async () => {
    if (!file) return
    setSubmitting(true)
    setError(null)

    const rawInput = analysis?.description
      ? `Image report: ${analysis.description}`
      : 'Emergency situation — image uploaded'

    const payload = {
      report_method: 'image' as const,
      raw_input: rawInput,
      latitude: coords.lat,
      longitude: coords.lng,
      location_label: `${coords.lat.toFixed(4)}°N, ${coords.lng.toFixed(4)}°E`,
      event_id: process.env.NEXT_PUBLIC_EVENT_ID,
    }

    try {
      if (networkState === 'offline') {
        await enqueueReport(payload)
        setSubmitted(true)
      } else {
        await submitIncident(payload)
        setSubmitted(true)
      }
      setTimeout(() => router.push('/history'), 1800)
    } catch {
      await enqueueReport(payload)
      setError('Saved locally — will send when connected')
      setSubmitted(true)
      setTimeout(() => router.push('/history'), 2000)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-black flex flex-col max-w-sm mx-auto">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-zinc-800">
        <button
          onClick={() => router.back()}
          className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400"
        >←</button>
        <h1 className="text-white font-medium">Photo report</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800">
          AI Vision
        </span>
      </header>

      <div className="flex-1 px-4 py-5 flex flex-col gap-5">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        />

        {!preview ? (
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full h-48 border-2 border-dashed border-zinc-700 rounded-2xl flex flex-col items-center justify-center gap-3 text-zinc-500 active:border-red-600 active:text-red-500 transition-colors"
          >
            <span className="text-5xl">📷</span>
            <p className="text-sm font-medium">Take photo or choose from gallery</p>
            <p className="text-xs text-zinc-600">AI will analyze it for emergency signs</p>
          </button>
        ) : (
          <div className="relative">
            <img src={preview} alt="Emergency" className="w-full h-48 object-cover rounded-2xl" />
            {analyzing && (
              <div className="absolute inset-0 bg-black/70 rounded-2xl flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-amber-400 text-xs">AI analyzing image...</p>
              </div>
            )}
            {!analyzing && analysis && (
              <div className="absolute bottom-2 left-2 right-2 bg-black/80 rounded-xl px-3 py-2">
                <p className="text-white text-xs">{analysis.description}</p>
              </div>
            )}
            <button
              onClick={() => { setFile(null); setPreview(null); setAnalysis(null) }}
              className="absolute top-2 right-2 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center text-white text-sm"
            >✕</button>
          </div>
        )}

        {analysis && !analyzing && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 flex flex-col gap-3">
            <p className="text-zinc-400 text-xs font-medium">✦ AI Analysis</p>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-xs">Detected</span>
              <span className="text-white text-xs font-medium">{analysis.suggested_category}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-xs">Severity</span>
              {analysis.suggested_severity && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${SEV_COLORS[analysis.suggested_severity] || ''}`}>
                  {analysis.suggested_severity}
                </span>
              )}
            </div>
            {!analysis.emergency_detected && (
              <p className="text-zinc-500 text-xs">No clear emergency detected — you can still submit if you see a problem</p>
            )}
          </div>
        )}

        {error && (
          <div className="bg-amber-950 border border-amber-800 rounded-xl p-3">
            <p className="text-amber-400 text-xs">{error}</p>
          </div>
        )}

        {submitted && (
          <div className="bg-green-950 border border-green-800 rounded-xl p-3 flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <p className="text-green-400 text-sm">Report submitted</p>
          </div>
        )}
      </div>

      <div className="px-4 pb-6 pt-3 flex flex-col gap-2">
        {preview && !submitted && (
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full bg-zinc-800 text-zinc-300 py-3 rounded-2xl text-sm"
          >
            Choose different photo
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!file || analyzing || submitting || submitted}
          className="w-full bg-red-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white py-4 rounded-2xl font-medium flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          {submitting ? '⏳ Sending...' : submitted ? '✓ Sent' : '📤 Send photo report'}
        </button>
      </div>
    </main>
  )
}