'use client'
import { useState, useRef, useCallback } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useNetwork } from '@/hooks/useNetwork'
import { transcribeAudio, submitIncident } from '@/lib/api'
import { enqueueReport } from '@/lib/offlineQueue'
import { useRouter } from 'next/navigation'

type Phase = 'idle' | 'recording' | 'transcribing' | 'analyzing' | 'ready' | 'submitting' | 'done'

export default function VoiceReportPage() {
  const router = useRouter()
  const { coords } = useGeolocation()
  const { networkState } = useNetwork()

  const [phase, setPhase] = useState<Phase>('idle')
  const [transcript, setTranscript] = useState('')
  const [analysis, setAnalysis] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [bars, setBars] = useState<number[]>(Array(20).fill(4))

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const animFrameRef = useRef<number>()
  const analyserRef = useRef<AnalyserNode | null>(null)

  const animateBars = useCallback(() => {
    if (!analyserRef.current) return
    const data = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(data)
    const step = Math.floor(data.length / 20)
    const newBars = Array.from({ length: 20 }, (_, i) => {
      const val = data[i * step] / 255
      return Math.max(4, Math.floor(val * 56))
    })
    setBars(newBars)
    animFrameRef.current = requestAnimationFrame(animateBars)
  }, [])

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Set up audio analyser for waveform
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      // Use supported mimeType - webm for Chrome, mp4 for Safari
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm'
      const mr = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        cancelAnimationFrame(animFrameRef.current!)
        stream.getTracks().forEach(t => t.stop())
        await processRecording()
      }
      mr.start(100)
      mediaRecorderRef.current = mr
      setPhase('recording')
      animFrameRef.current = requestAnimationFrame(animateBars)
    } catch (err: any) {
      setError(`Microphone access denied: ${err.message}`)
    }
  }, [animateBars])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    setPhase('transcribing')
  }, [])

  const processRecording = async () => {
    try {
      const mimeUsed = mediaRecorderRef.current?.mimeType || 'audio/webm'
      const ext = mimeUsed.includes('mp4') ? 'mp4' : 'webm'
      const blob = new Blob(chunksRef.current, { type: mimeUsed })

      // 1. Transcribe with Groq Whisper
      setPhase('transcribing')
      const { transcript: text } = await transcribeAudio(blob, `recording.${ext}`)
      setTranscript(text)

      // 2. Submit to backend for AI classification (quick preview)
      setPhase('analyzing')
      const incident = await submitIncident({
        report_method: 'voice',
        raw_input: text,
        latitude: coords.lat,
        longitude: coords.lng,
        event_id: process.env.NEXT_PUBLIC_EVENT_ID,
      })
      setAnalysis(incident)
      setPhase('ready')
    } catch (err: any) {
      setError(`Processing failed: ${err.message}`)
      setPhase('idle')
    }
  }

  const handleSubmit = async () => {
    setPhase('submitting')
    // Already submitted in processRecording — just navigate
    setTimeout(() => {
      setPhase('done')
      router.push('/history')
    }, 1000)
  }

  const PHASE_LABELS: Record<Phase, string> = {
    idle:        'Tap to start recording',
    recording:   'Recording... tap to stop',
    transcribing:'Transcribing with Groq Whisper...',
    analyzing:   'AI classifying incident...',
    ready:       'Analysis complete — review and submit',
    submitting:  'Sending to command center...',
    done:        'Sent ✓',
  }

  const SEV_COLORS: Record<string, string> = {
    critical: 'text-red-400 bg-red-950 border-red-800',
    high:     'text-amber-400 bg-amber-950 border-amber-800',
    medium:   'text-yellow-400 bg-yellow-950 border-yellow-800',
    low:      'text-green-400 bg-green-950 border-green-800',
  }

  return (
    <main className="min-h-screen bg-black flex flex-col max-w-sm mx-auto">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-zinc-800">
        <button onClick={() => router.back()} className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400">
          ←
        </button>
        <h1 className="text-white font-medium">Voice report</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-red-950 text-red-400 border border-red-800">
          Whisper AI
        </span>
      </header>

      <div className="flex-1 px-4 py-6 flex flex-col gap-5">
        {/* Waveform */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 h-20 flex items-center justify-center gap-0.5">
          {bars.map((h, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full bg-red-500 transition-all duration-75"
              style={{ height: `${h}px`, opacity: phase === 'recording' ? 1 : 0.3 }}
            />
          ))}
        </div>

        {/* Transcript */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 min-h-24">
          {transcript
            ? <p className="text-white text-sm leading-relaxed">{transcript}</p>
            : <p className="text-zinc-600 text-sm italic">Transcript will appear here after recording...</p>
          }
        </div>

        {/* Status */}
        <p className="text-zinc-400 text-sm text-center">{PHASE_LABELS[phase]}</p>

        {/* AI analysis panel */}
        {analysis && (
          <div className="bg-blue-950 border border-blue-800 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-blue-400 text-sm font-medium">✦ AI Analysis</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-300 text-xs">Category</span>
              <span className="text-white text-xs font-medium">{analysis.category || 'Analyzing...'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-300 text-xs">Severity</span>
              {analysis.severity && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${SEV_COLORS[analysis.severity] || ''}`}>
                  {analysis.severity}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-blue-300 text-xs">Recommended</span>
              <span className="text-white text-xs">{analysis.recommended_resource_type || '—'}</span>
            </div>
            {analysis.confirmation_count > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-blue-300 text-xs">Confirmations</span>
                <span className="text-amber-400 text-xs font-medium">{analysis.confirmation_count} reports clustered</span>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-950 border border-red-800 rounded-xl p-3">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}
      </div>

      {/* Mic button */}
      <div className="px-4 pb-4 flex flex-col gap-3">
        <div className="flex justify-center">
          <button
            onClick={phase === 'recording' ? stopRecording : phase === 'idle' ? startRecording : undefined}
            disabled={!['idle', 'recording'].includes(phase)}
            className={`
              w-20 h-20 rounded-full flex items-center justify-center text-3xl
              transition-all duration-200 active:scale-95
              ${phase === 'recording' ? 'bg-red-700 animate-pulse' : 'bg-red-600'}
              disabled:opacity-40 disabled:cursor-not-allowed
            `}
          >
            {phase === 'recording' ? '⏹' : '🎙️'}
          </button>
        </div>

        {phase === 'ready' && (
          <button
            onClick={handleSubmit}
            className="w-full bg-red-600 text-white py-4 rounded-2xl font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            ✈ Send emergency report
          </button>
        )}
      </div>
    </main>
  )
}