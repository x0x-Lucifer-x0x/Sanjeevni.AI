'use client'
import { useState, useRef, useCallback } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useNetwork } from '@/hooks/useNetwork'
import { analyzeImage, submitIncident } from '@/lib/api'
import { useRouter } from 'next/navigation'

const SEV_COLORS: Record<string, string> = {
  critical: 'text-red-400 bg-red-950 border-red-800',
  high:     'text-amber-400 bg-amber-950 border-amber-800',
  medium:   'text-yellow-400 bg-yellow-950 border-yellow-800',
  low:      'text-green-400 bg-green-950 border-green-800',
}

export default function ImageReportPage() {
  const router = useRouter()
  const { coords } = useGeolocation()
  const { networkState } = useNetwork()

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [yoloResult, setYoloResult] = useState<any>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(async (f: File) => {
    setFile(f)
    setYoloResult(null)
    setError(null)

    // Preview
    const url = URL.createObjectURL(f)
    setPreview(url)

    // YOLO analysis
    setAnalyzing(true)
    try {
      const result = await analyzeImage(f)
      setYoloResult(result)
    } catch (err: any) {
      setError(`Image analysis failed: ${err.message}`)
    } finally {
      setAnalyzing(false)
    }
  }, [])

  const handleSubmit = async () => {
    if (!file) return
    setSubmitting(true)

    const rawInput = yoloResult?.suggested_category
      ? `Image report: ${yoloResult.suggested_category} detected via YOLO (${yoloResult.detections?.length || 0} detections)`
      : 'Emergency situation — image uploaded'

    try {
      await submitIncident({
        report_method: 'image',
        raw_input: rawInput,
        latitude: coords.lat,
        longitude: coords.lng,
        event_id: process.env.NEXT_PUBLIC_EVENT_ID,
      })
      setSubmitted(true)
      setTimeout(() => router.push('/history'), 1800)
    } catch (err: any) {
      setError(`Submit failed: ${err.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-black flex flex-col max-w-sm mx-auto">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-zinc-800">
        <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400">
          ←
        </button>
        <h1 className="text-white font-medium">Image report</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800">
          YOLOv8
        </span>
      </header>

      <div className="flex-1 px-4 py-5 flex flex-col gap-5">
        {/* Upload area */}
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
            className="w-full h-44 border-2 border-dashed border-zinc-700 rounded-2xl flex flex-col items-center justify-center gap-3 text-zinc-500 hover:border-red-600 hover:text-red-500 transition-colors"
          >
            <span className="text-4xl">📷</span>
            <p className="text-sm">Tap to capture or select photo</p>
            <p className="text-xs text-zinc-700">Camera · Gallery · Files</p>
          </button>
        ) : (
          <div className="relative">
            <img
              src={preview}
              alt="Emergency report"
              className="w-full h-44 object-cover rounded-2xl"
            />
            {analyzing && (
              <div className="absolute inset-0 bg-black/70 rounded-2xl flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-amber-400 text-xs">YOLOv8 analyzing...</p>
                </div>
              </div>
            )}
            <button
              onClick={() => { setFile(null); setPreview(null); setYoloResult(null) }}
              className="absolute top-2 right-2 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center text-white text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* YOLO results */}
        {yoloResult && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 text-sm font-medium">🔍 YOLO Detection Results</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-400 text-xs">Objects detected</span>
              <span className="text-white text-xs">{yoloResult.detections?.length || 0}</span>
            </div>
            {yoloResult.suggested_category && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-xs">Suggested category</span>
                <span className="text-white text-xs font-medium">{yoloResult.suggested_category}</span>
              </div>
            )}
            {yoloResult.suggested_severity && (
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-xs">Severity</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${SEV_COLORS[yoloResult.suggested_severity] || ''}`}>
                  {yoloResult.suggested_severity}
                </span>
              </div>
            )}
            {yoloResult.detections?.slice(0, 4).map((d: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-1.5">
                <span className="text-zinc-300 text-xs">{d.label}</span>
                <span className="text-zinc-500 text-xs">{(d.confidence * 100).toFixed(0)}%</span>
              </div>
            ))}
            {!yoloResult.emergency_detected && (
              <p className="text-zinc-500 text-xs">No emergency detected automatically — you can still submit manually</p>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-950 border border-red-800 rounded-xl p-3">
            <p className="text-red-400 text-xs">{error}</p>
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
        {preview && (
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full bg-zinc-800 text-zinc-300 py-3 rounded-2xl text-sm"
          >
            Change photo
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!file || analyzing || submitting || submitted}
          className="w-full bg-red-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white py-4 rounded-2xl font-medium flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          {submitting ? '⏳ Sending...' : submitted ? '✓ Sent' : '✈ Submit image report'}
        </button>
      </div>
    </main>
  )
}