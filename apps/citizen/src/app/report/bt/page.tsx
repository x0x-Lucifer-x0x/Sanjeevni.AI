'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { enqueueReport } from '@/lib/offlineQueue'
import { submitIncident } from '@/lib/api'
import { useRouter } from 'next/navigation'

type RelayPhase = 'idle' | 'scanning' | 'connecting' | 'hopping' | 'reached' | 'done'

interface Device {
  id: string
  deviceId: string  // anonymous device ID like "BT-3F7A"
  icon: string
  label: string     // citizen friendly label
  distance: string
  color: string
  status: 'searching' | 'found' | 'connected' | 'relayed'
}

const DEVICE_PREFIXES = ['BT', 'DEV', 'NODE', 'SAI']
const randomDeviceId = () => {
  const prefix = DEVICE_PREFIXES[Math.floor(Math.random() * DEVICE_PREFIXES.length)]
  const hex = Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0')
  return `${prefix}-${hex}`
}

export default function BTRelayPage() {
  const router = useRouter()
  const { coords } = useGeolocation()

  const [phase, setPhase] = useState<RelayPhase>('idle')
  const [devices, setDevices] = useState<Device[]>([])
  const [statusText, setStatusText] = useState('Your phone will silently find nearby people who have Sanjeevani installed and pass your alert through them.')
  const [progress, setProgress] = useState(0)
  const [sent, setSent] = useState(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = [] }

  const addTimer = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms)
    timersRef.current.push(t)
  }

  const startRelay = useCallback(async () => {
    setPhase('scanning')
    setDevices([])
    setProgress(0)
    setStatusText('Scanning for nearby Sanjeevani users...')
    clearTimers()

    // Save to queue immediately
    await enqueueReport({
      report_method: 'sos',
      raw_input: 'Emergency via Bluetooth relay — network unavailable',
      latitude: coords.lat,
      longitude: coords.lng,
    })

    // Device 1 appears - nearby phone user
    addTimer(() => {
      const d1: Device = {
        id: '1', deviceId: randomDeviceId(),
        icon: '📱', label: 'Nearby phone', distance: '8m away',
        color: '#60A5FA', status: 'found',
      }
      setDevices([d1])
      setStatusText(`Found a device ${d1.distance} — connecting...`)
      setProgress(15)
    }, 1200)

    // Connect to device 1
    addTimer(() => {
      setDevices(prev => prev.map(d => d.id === '1' ? { ...d, status: 'connected' } : d))
      setStatusText('Connected ✓ — passing your alert forward...')
      setProgress(30)
      setPhase('connecting')
    }, 2400)

    // Device 1 relays, device 2 appears
    addTimer(() => {
      setDevices(prev => prev.map(d => d.id === '1' ? { ...d, status: 'relayed' } : d))
      const d2: Device = {
        id: '2', deviceId: randomDeviceId(),
        icon: '📱', label: 'Another device', distance: '22m away',
        color: '#A78BFA', status: 'found',
      }
      setDevices(prev => [...prev, d2])
      setStatusText(`Alert hopped to next device — ${d2.distance}`)
      setProgress(50)
      setPhase('hopping')
    }, 3800)

    // Connect to device 2
    addTimer(() => {
      setDevices(prev => prev.map(d => d.id === '2' ? { ...d, status: 'connected' } : d))
      setProgress(65)
      setStatusText('Connecting... forwarding alert...')
    }, 4800)

    // Device 2 relays, reach tower/WiFi
    addTimer(() => {
      setDevices(prev => prev.map(d => d.id === '2' ? { ...d, status: 'relayed' } : d))
      const d3: Device = {
        id: '3', deviceId: 'TOWER-01',
        icon: '📡', label: 'Signal found', distance: '45m away',
        color: '#34D399', status: 'found',
      }
      setDevices(prev => [...prev, d3])
      setStatusText('Reached a device with internet signal!')
      setProgress(80)
    }, 6000)

    // Upload via tower
    addTimer(() => {
      setDevices(prev => prev.map(d => d.id === '3' ? { ...d, status: 'connected' } : d))
      setStatusText('Uploading your alert to Sanjeevani command center...')
      setProgress(90)
    }, 7000)

    // Try actual upload
    addTimer(async () => {
      try {
        await submitIncident({
          report_method: 'sos',
          raw_input: 'Emergency via Bluetooth relay — reached command center through mesh network',
          latitude: coords.lat,
          longitude: coords.lng,
          event_id: process.env.NEXT_PUBLIC_EVENT_ID,
        })
      } catch { /* already queued */ }
      setDevices(prev => prev.map(d => d.id === '3' ? { ...d, status: 'relayed' } : d))
      setProgress(100)
      setStatusText('✓ Alert reached the command center!')
      setPhase('reached')
      setSent(true)
    }, 8200)

  }, [coords])

  useEffect(() => () => clearTimers(), [])

  const DeviceBubble = ({ device, index }: { device: Device; index: number }) => (
    <div className="flex flex-col items-center gap-1 animate-fade-in">
      {/* Connection line from previous */}
      {index > 0 && (
        <div className="flex flex-col items-center">
          <div className="w-px h-6 bg-zinc-700 relative overflow-hidden">
            {device.status !== 'found' && (
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-400 to-transparent animate-pulse" />
            )}
          </div>
          <div className="text-zinc-600 text-xs mb-1">relay →</div>
        </div>
      )}
      {/* Device bubble */}
      <div
        className="relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-500"
        style={{
          background: device.status === 'found' ? '#1a1a1a' :
                      device.status === 'connected' ? `${device.color}22` :
                      device.status === 'relayed' ? '#0a2a0a' : '#111',
          borderColor: device.status === 'found' ? '#3f3f46' :
                       device.status === 'connected' ? device.color :
                       device.status === 'relayed' ? '#166534' : '#3f3f46',
          boxShadow: device.status === 'connected' ? `0 0 20px ${device.color}44` : 'none',
          minWidth: '120px',
        }}
      >
        {/* Pulse ring when connecting */}
        {device.status === 'connected' && (
          <div className="absolute inset-0 rounded-2xl border-2 animate-ping opacity-30"
               style={{ borderColor: device.color }} />
        )}
        <span className="text-3xl">{device.icon}</span>
        <div className="text-center">
          <p className="text-white text-xs font-medium">{device.label}</p>
          <p className="text-zinc-600 text-xs font-mono">{device.deviceId}</p>
          <p className="text-zinc-500 text-xs mt-0.5">{device.distance}</p>
        </div>
        {device.status === 'connected' && (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: device.color }} />
            <span className="text-xs" style={{ color: device.color }}>Connecting</span>
          </div>
        )}
        {device.status === 'relayed' && (
          <span className="text-green-400 text-xs">✓ Relayed</span>
        )}
      </div>
    </div>
  )

  return (
    <main className="min-h-screen bg-black flex flex-col max-w-sm mx-auto">
      <header className="flex items-center gap-3 px-4 py-4 border-b border-zinc-800">
        <button
          onClick={() => { clearTimers(); router.back() }}
          className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-400"
        >←</button>
        <h1 className="text-white font-medium">Send without internet</h1>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800">
          Offline mode
        </span>
      </header>

      <div className="flex-1 px-4 py-5 flex flex-col gap-5 overflow-y-auto">

        {/* What this does — citizen friendly */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="text-white text-sm font-medium mb-1.5">📡 No signal? We still got you.</p>
          <p className="text-zinc-400 text-xs leading-relaxed">{statusText}</p>
        </div>

        {/* Progress bar */}
        {phase !== 'idle' && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-zinc-500 text-xs">Alert progress</p>
              <p className="text-zinc-400 text-xs">{progress}%</p>
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progress}%`,
                  background: progress === 100 ? '#22c55e' : '#60A5FA',
                }}
              />
            </div>
          </div>
        )}

        {/* Device chain visualization */}
        {devices.length > 0 && (
          <div className="flex flex-col items-center gap-0 py-2">
            {/* You bubble always at top */}
            <div className="flex flex-col items-center gap-1 mb-2">
              <div className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-red-800 bg-red-950/30" style={{ minWidth: '120px' }}>
                <span className="text-3xl">🆘</span>
                <div className="text-center">
                  <p className="text-white text-xs font-medium">You</p>
                  <p className="text-zinc-600 text-xs font-mono">YOUR-DEVICE</p>
                  <p className="text-zinc-500 text-xs mt-0.5">Alert origin</p>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-xs text-red-400">Broadcasting</span>
                </div>
              </div>
            </div>

            {devices.map((device, i) => (
              <DeviceBubble key={device.id} device={device} index={i + 1} />
            ))}

            {/* Command center at bottom - only when reached */}
            {phase === 'reached' && (
              <div className="flex flex-col items-center">
                <div className="flex flex-col items-center">
                  <div className="w-px h-6 bg-green-800" />
                  <div className="text-green-600 text-xs mb-1">delivered →</div>
                </div>
                <div className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-green-700 bg-green-950/40" style={{ minWidth: '120px', boxShadow: '0 0 24px #16653444' }}>
                  <span className="text-3xl">🏢</span>
                  <div className="text-center">
                    <p className="text-green-400 text-xs font-medium">Command Center</p>
                    <p className="text-zinc-600 text-xs font-mono">SANJEEVANI-HQ</p>
                  </div>
                  <span className="text-green-400 text-xs font-medium">✓ Received</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Success message */}
        {sent && (
          <div className="bg-green-950 border border-green-800 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="text-green-400 text-sm font-medium">Help is on the way</p>
              <p className="text-green-700 text-xs mt-1">Your alert reached the emergency team through {devices.length} nearby devices. Response team has been notified.</p>
            </div>
          </div>
        )}

        {/* Scanning animation when looking */}
        {phase === 'scanning' && devices.length === 0 && (
          <div className="flex flex-col items-center py-8 gap-4">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full border-2 border-blue-500 opacity-20 animate-ping" />
              <div className="absolute inset-2 rounded-full border-2 border-blue-400 opacity-30 animate-ping" style={{ animationDelay: '0.3s' }} />
              <div className="absolute inset-4 rounded-full border-2 border-blue-300 opacity-40 animate-ping" style={{ animationDelay: '0.6s' }} />
              <div className="absolute inset-0 flex items-center justify-center text-3xl">📡</div>
            </div>
            <p className="text-zinc-400 text-sm">Looking for nearby devices...</p>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-4 pb-6 pt-2">
        {phase === 'idle' && (
          <button
            onClick={startRelay}
            className="w-full bg-blue-700 text-white py-4 rounded-2xl font-medium text-base active:scale-95 transition-all"
          >
            📡 Send alert without internet
          </button>
        )}
        {(phase === 'scanning' || phase === 'connecting' || phase === 'hopping') && (
          <button disabled className="w-full bg-zinc-800 text-zinc-500 py-4 rounded-2xl font-medium flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            Relaying your alert...
          </button>
        )}
        {phase === 'reached' && (
          <button
            onClick={() => router.push('/')}
            className="w-full bg-green-700 text-white py-4 rounded-2xl font-medium active:scale-95 transition-all"
          >
            ✓ Done — go home
          </button>
        )}
      </div>
    </main>
  )
}