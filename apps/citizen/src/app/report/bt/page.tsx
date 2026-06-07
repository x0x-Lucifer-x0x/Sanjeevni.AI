'use client'
import { useState, useEffect, useRef } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useNetwork } from '@/hooks/useNetwork'
import { enqueueReport } from '@/lib/offlineQueue'
import { useRouter } from 'next/navigation'

type RelayPhase = 'idle' | 'broadcasting' | 'hopping' | 'reached' | 'done'

interface HopNode {
  id: string
  label: string
  icon: string
  distance: string
  color: string
  borderColor: string
}

const NODES: HopNode[] = [
  { id: 'you',      label: 'You',           icon: '📱', distance: '',       color: '#3B82F6', borderColor: '#1D4ED8' },
  { id: 'vol1',     label: 'Volunteer\nRavi K.', icon: '🙋', distance: '12m', color: '#8B5CF6', borderColor: '#6D28D9' },
  { id: 'sec1',     label: 'Security\nPost B',   icon: '🛡️', distance: '38m', color: '#F59E0B', borderColor: '#D97706' },
  { id: 'cmd',      label: 'Command\nCenter',    icon: '🏢', distance: '95m', color: '#10B981', borderColor: '#059669' },
]

const LOG_STEPS = [
  { node: 1, text: 'Scanning for nearby Bluetooth devices...', delay: 800 },
  { node: 1, text: '✓ Found: Volunteer Ravi K. (12m) — RSSI -65dBm', delay: 1600 },
  { node: 1, text: 'Compressing emergency packet (340 bytes)...', delay: 2200 },
  { node: 1, text: '→ Hop 1: Packet sent to Volunteer Ravi K.', delay: 2800 },
  { node: 2, text: '✓ Hop 1 acknowledged — relaying forward...', delay: 3600 },
  { node: 2, text: '→ Hop 2: Packet sent to Security Post B (38m)', delay: 4200 },
  { node: 3, text: '✓ Hop 2 acknowledged — internet available at node', delay: 5000 },
  { node: 3, text: '→ Uploading to Command Center via Security Post B...', delay: 5600 },
  { node: 3, text: '✓ Incident logged at Command Center', delay: 6400 },
  { node: 3, text: '✓ Response team dispatched — ETA 4 minutes', delay: 7200 },
]

export default function BTRelayPage() {
  const router = useRouter()
  const { coords } = useGeolocation()
  const { networkState } = useNetwork()

  const [phase, setPhase] = useState<RelayPhase>('idle')
  const [activeNode, setActiveNode] = useState(0)
  const [completedHops, setCompletedHops] = useState<number[]>([])
  const [logs, setLogs] = useState<{ text: string; node: number }[]>([])
  const [queued, setQueued] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  const startRelay = async () => {
    setPhase('broadcasting')
    setActiveNode(0)
    setCompletedHops([])
    setLogs([])
    clearTimers()

    // Queue the report locally first
    await enqueueReport({
      report_method: 'sos',
      raw_input: 'Emergency via Bluetooth relay — network unavailable',
      latitude: coords.lat,
      longitude: coords.lng,
      relay_mode: true,
    })
    setQueued(true)

    // Animate log steps
    LOG_STEPS.forEach((step, i) => {
      const t = setTimeout(() => {
        setLogs(prev => [...prev, { text: step.text, node: step.node }])
        setActiveNode(step.node)
        if (step.node > 0) {
          setCompletedHops(prev => Array.from(new Set([...prev, step.node - 1])))
        }
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
      }, step.delay)
      timersRef.current.push(t)
    })

    // Final state
    const finalT = setTimeout(() => {
      setPhase('reached')
      setCompletedHops([0, 1, 2])
      setActiveNode(3)
    }, 8000)
    timersRef.current.push(finalT)
  }

  useEffect(() => () => clearTimers(), [])

  const nodeColor = (i: number) => {
    if (completedHops.includes(i - 1) || i === 0) return NODES[i].color
    if (activeNode === i) return NODES[i].color
    return '#3F3F46'
  }

  return (
    <main className="min-h-screen bg-black flex flex-col max-w-sm mx-auto">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-zinc-800">
        <button
          onClick={() => { clearTimers(); router.back() }}
          className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400"
        >←</button>
        <h1 className="text-white font-medium">Bluetooth relay</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800">
          Offline mode
        </span>
      </header>

      <div className="flex-1 px-4 py-5 flex flex-col gap-5">
        {/* Info card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="text-zinc-200 text-sm font-medium mb-1">📡 Mesh relay protocol</p>
          <p className="text-zinc-500 text-xs leading-relaxed">
            When internet is unavailable, your emergency is compressed into a packet
            and relayed hop-by-hop through nearby Sanjeevani app users via Bluetooth
            until it reaches a node with connectivity.
          </p>
        </div>

        {/* Network status */}
        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs
          ${networkState === 'offline'
            ? 'bg-red-950 border-red-800 text-red-400'
            : 'bg-amber-950 border-amber-800 text-amber-400'
          }`}>
          <span>{networkState === 'offline' ? '🔴' : '🟡'}</span>
          <span>
            {networkState === 'offline'
              ? 'No internet — Bluetooth relay will be used'
              : 'Internet available — BT relay shown for demo'}
          </span>
        </div>

        {/* Relay visualization */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <p className="text-zinc-500 text-xs mb-4 text-center">Relay path</p>

          {/* Nodes */}
          <div className="flex items-center justify-between mb-4">
            {NODES.map((node, i) => (
              <div key={node.id} className="flex flex-col items-center gap-2 flex-1">
                {/* Node circle */}
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-xl border-2 transition-all duration-500"
                  style={{
                    background: nodeColor(i) + '22',
                    borderColor: activeNode >= i ? NODES[i].borderColor : '#3F3F46',
                    boxShadow: activeNode === i ? `0 0 16px ${NODES[i].color}66` : 'none',
                  }}
                >
                  {node.icon}
                </div>
                <p className="text-xs text-center leading-tight whitespace-pre-line"
                   style={{ color: activeNode >= i ? '#E4E4E7' : '#52525B' }}>
                  {node.label}
                </p>
                {node.distance && (
                  <p className="text-zinc-700 text-xs">{node.distance}</p>
                )}
              </div>
            ))}
          </div>

          {/* Hop lines */}
          <div className="flex items-center gap-0 px-6">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex-1 flex items-center">
                <div className="flex-1 h-0.5 bg-zinc-800 relative overflow-hidden rounded-full">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                    style={{
                      width: completedHops.includes(i) ? '100%' : activeNode === i + 1 ? '60%' : '0%',
                      background: NODES[i + 1].color,
                    }}
                  />
                </div>
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-500"
                  style={{ background: completedHops.includes(i) ? NODES[i + 1].color : '#3F3F46' }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Log terminal */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3">
          <p className="text-zinc-600 text-xs mb-2 font-mono">relay.log</p>
          <div
            ref={logRef}
            className="font-mono text-xs flex flex-col gap-1 max-h-36 overflow-y-auto"
          >
            {logs.length === 0 && (
              <p className="text-zinc-700">Awaiting relay start...</p>
            )}
            {logs.map((log, i) => (
              <p
                key={i}
                className={i === logs.length - 1
                  ? 'text-blue-400'
                  : log.text.startsWith('✓') ? 'text-green-500' : 'text-zinc-400'}
              >
                {log.text}
              </p>
            ))}
          </div>
        </div>

        {/* Success state */}
        {phase === 'reached' && (
          <div className="bg-green-950 border border-green-800 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="text-green-400 text-sm font-medium">Incident reached command center</p>
              <p className="text-green-700 text-xs mt-0.5">Response team dispatched · ETA 4 min</p>
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-4 pb-6 pt-2 flex flex-col gap-2">
        {phase === 'idle' && (
          <button
            onClick={startRelay}
            className="w-full bg-blue-700 text-white py-4 rounded-2xl font-medium flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            📡 Start Bluetooth relay
          </button>
        )}
        {phase === 'broadcasting' && (
          <button disabled className="w-full bg-zinc-800 text-zinc-500 py-4 rounded-2xl font-medium flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            Relaying...
          </button>
        )}
        {phase === 'reached' && (
          <button
            onClick={() => router.push('/')}
            className="w-full bg-green-700 text-white py-4 rounded-2xl font-medium active:scale-95 transition-all"
          >
            ✓ Back to home
          </button>
        )}
      </div>
    </main>
  )
}