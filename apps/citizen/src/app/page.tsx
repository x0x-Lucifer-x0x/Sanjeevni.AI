'use client'
import { useState, useCallback } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useNetwork } from '@/hooks/useNetwork'
import { submitIncident } from '@/lib/api'
import { enqueueReport } from '@/lib/offlineQueue'
import Link from 'next/link'

const NETWORK_STYLES = {
  online:       { bg: 'bg-green-950 border-green-700', dot: 'bg-green-400', text: 'text-green-400', label: 'Online' },
  offline:      { bg: 'bg-red-950 border-red-800', dot: 'bg-red-400', text: 'text-red-400', label: 'Offline' },
  reconnecting: { bg: 'bg-yellow-950 border-yellow-700', dot: 'bg-yellow-400', text: 'text-yellow-400', label: 'Reconnecting' },
}

export default function HomePage() {
  const { coords, loading: gpsLoading, error: gpsError } = useGeolocation()
  const { networkState, pendingCount, attemptFlush } = useNetwork()
  const [sosState, setSosState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [toast, setToast] = useState<string | null>(null)

  const ns = NETWORK_STYLES[networkState]

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const handleSOS = useCallback(async () => {
    if (sosState !== 'idle') return
    setSosState('sending')

    const payload = {
      report_method: 'sos',
      raw_input: 'SOS emergency alert triggered',
      latitude: coords.lat,
      longitude: coords.lng,
      location_label: `${coords.lat.toFixed(4)}°N, ${coords.lng.toFixed(4)}°E`,
      event_id: process.env.NEXT_PUBLIC_EVENT_ID,
    }

    try {
      if (networkState === 'offline') {
        await enqueueReport(payload)
        showToast('SOS queued — will send when online')
      } else {
        await submitIncident(payload)
        showToast('SOS sent — command center alerted')
      }
      setSosState('sent')
      setTimeout(() => setSosState('idle'), 4000)
    } catch (err) {
      await enqueueReport(payload)
      showToast('SOS queued (network error)')
      setSosState('idle')
    }
  }, [sosState, coords, networkState])

  return (
    <main className="min-h-screen bg-black flex flex-col max-w-sm mx-auto">
      {/* Status bar */}
      <div className="bg-black px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">S</span>
          </div>
          <div>
            <p className="text-white text-sm font-medium leading-none">Sanjeevani AI</p>
            <p className="text-zinc-500 text-xs">Emergency Response</p>
          </div>
        </div>
        {/* Network badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${ns.bg} ${ns.text}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${ns.dot} animate-pulse`} />
          {ns.label}
        </div>
      </div>

      {/* GPS indicator */}
      <div className="mx-4 mt-2 flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
        <div className={`w-2 h-2 rounded-full ${gpsLoading ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
        <span className="text-zinc-400 text-xs">GPS</span>
        <span className="text-zinc-200 text-xs font-mono ml-auto">
          {gpsLoading ? 'Acquiring...' : `${coords.lat.toFixed(4)}°N, ${coords.lng.toFixed(4)}°E`}
        </span>
      </div>

      {/* Offline queue banner */}
      {pendingCount > 0 && (
        <div className="mx-4 mt-2 flex items-center gap-2 bg-amber-950 border border-amber-700 rounded-xl px-3 py-2">
          <span className="text-amber-400 text-xs flex-1">
            {pendingCount} report{pendingCount > 1 ? 's' : ''} queued — waiting for connection
          </span>
          <button
            onClick={attemptFlush}
            className="text-amber-400 text-xs border border-amber-600 rounded-full px-2 py-0.5"
          >
            Retry
          </button>
        </div>
      )}

      {/* SOS Button */}
      <div className="flex-1 flex flex-col items-center justify-center py-8 px-4">
        <div className={`relative transition-all duration-300 ${sosState === 'sending' ? 'scale-95' : ''}`}>
          {/* Pulse rings */}
          {sosState === 'sending' && (
            <>
              <div className="absolute inset-0 rounded-full bg-red-500 opacity-20 animate-ping scale-125" />
              <div className="absolute inset-0 rounded-full bg-red-500 opacity-10 animate-ping scale-150 delay-150" />
            </>
          )}
          <button
            onClick={handleSOS}
            disabled={sosState === 'sending'}
            className={`
              w-52 h-52 rounded-full border-4 flex flex-col items-center justify-center gap-2
              transition-all duration-200 active:scale-95 select-none
              ${sosState === 'sent'
                ? 'bg-green-700 border-green-500'
                : 'bg-red-600 border-red-400 active:bg-red-700'
              }
            `}
          >
            <span className="text-5xl">{sosState === 'sent' ? '✓' : '🚨'}</span>
            <span className="text-white text-xl font-bold tracking-widest">
              {sosState === 'sending' ? 'SENDING...' : sosState === 'sent' ? 'SENT' : 'SOS'}
            </span>
            <span className="text-red-200 text-xs">
              {sosState === 'idle' ? 'Tap to send alert' : ''}
            </span>
          </button>
        </div>

        <p className="text-zinc-600 text-xs mt-6 text-center">
          Sends your GPS location immediately to the command center
        </p>
      </div>

      {/* Report methods */}
      <div className="px-4 pb-4 grid grid-cols-2 gap-3">
        {[
          { href: '/report/voice', icon: '🎙️', title: 'Voice report', sub: 'Speak your emergency', color: 'border-red-900' },
          { href: '/report/text',  icon: '💬', title: 'Text report',  sub: 'Type what happened',  color: 'border-zinc-700' },
          { href: '/report/image', icon: '📷', title: 'Image report', sub: 'Photo + YOLO AI',     color: 'border-amber-900' },
          { href: '/report/bt',   icon: '📡', title: 'BT relay',     sub: 'Works offline',       color: 'border-blue-900' },
        ].map(m => (
          <Link
            key={m.href}
            href={m.href}
            className={`bg-zinc-900 border ${m.color} rounded-2xl p-4 flex flex-col gap-2 active:scale-95 transition-transform`}
          >
            <span className="text-2xl">{m.icon}</span>
            <p className="text-white text-sm font-medium">{m.title}</p>
            <p className="text-zinc-500 text-xs">{m.sub}</p>
          </Link>
        ))}
      </div>

      {/* Nav bar */}
      <nav className="bg-zinc-950 border-t border-zinc-800 grid grid-cols-3 pb-safe">
        <Link href="/" className="flex flex-col items-center py-3 gap-1 text-red-500">
          <span className="text-xl">🚨</span>
          <span className="text-xs font-medium">SOS</span>
        </Link>
        <Link href="/report/text" className="flex flex-col items-center py-3 gap-1 text-zinc-500">
          <span className="text-xl">📋</span>
          <span className="text-xs">Report</span>
        </Link>
        <Link href="/history" className="flex flex-col items-center py-3 gap-1 text-zinc-500">
          <span className="text-xl">🕐</span>
          <span className="text-xs">History</span>
        </Link>
      </nav>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-600 rounded-full px-4 py-2 flex items-center gap-2 z-50 whitespace-nowrap">
          <span className="text-green-400 text-sm">✓</span>
          <span className="text-white text-sm">{toast}</span>
        </div>
      )}
    </main>
  )
}