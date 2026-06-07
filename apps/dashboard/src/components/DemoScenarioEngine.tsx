'use client'
import { useState, useRef, useCallback } from 'react'
import { submitIncident } from '@/lib/api'

const EVENT_ID = process.env.NEXT_PUBLIC_EVENT_ID!

const LOCATIONS = {
  gate7:   { lat: 25.4372, lng: 81.8480, label: 'Gate 7, Sector C' },
  gate4:   { lat: 25.4350, lng: 81.8455, label: 'Gate 4, Sector B' },
  main:    { lat: 25.4340, lng: 81.8442, label: 'Main Entrance Plaza' },
  ganga:   { lat: 25.4310, lng: 81.8420, label: 'Ganga Ghat Bathing Zone' },
  sector5: { lat: 25.4390, lng: 81.8510, label: 'Sector 5, Central Zone' },
}

interface ScenarioStep {
  delay: number
  log: string
  action?: () => Promise<void>
}

interface Scenario {
  id: number
  name: string
  icon: string
  description: string
  color: string
  bgColor: string
  borderColor: string
  steps: ScenarioStep[]
}

export default function DemoScenarioEngine({
  onIncidentCreated,
  onRefreshNeeded,
}: {
  onIncidentCreated?: (id: string) => void
  onRefreshNeeded?: () => void
}) {
  const [running, setRunning] = useState<number | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [done, setDone] = useState<number | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, msg])
    setTimeout(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
    }, 50)
  }, [])

  const clearTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = [] }

  const runScenario = useCallback(async (scenario: Scenario) => {
    clearTimers()
    setRunning(scenario.id)
    setDone(null)
    setLogs([`▶ ${scenario.name}`, '─'.repeat(32)])

    for (const step of scenario.steps) {
      await new Promise<void>(resolve => {
        const t = setTimeout(async () => {
          addLog(step.log)
          if (step.action) {
            try {
              await step.action()
            } catch (err: any) {
              addLog(`⚠ ${err.message || 'API error'}`)
            }
          }
          resolve()
        }, step.delay)
        timersRef.current.push(t)
      })
    }

    addLog('─'.repeat(32))
    addLog('✅ Scenario complete — check map & queue')
    setRunning(null)
    setDone(scenario.id)
    // Trigger parent refresh so map/queue update
    onRefreshNeeded?.()
  }, [addLog, onRefreshNeeded])

  const makeScenarios = (): Scenario[] => [
    {
      id: 1, name: 'Crowd Surge — Gate 7', icon: '👥',
      description: 'Volunteer reports crowd pushing → Police dispatched',
      color: 'text-amber-400', bgColor: 'bg-amber-950', borderColor: 'border-amber-800',
      steps: [
        { delay: 0,    log: '👥 Volunteer opens app at Gate 7...' },
        { delay: 800,  log: '💬 Typing: "Heavy crowd pushing, people falling near Gate 7"' },
        { delay: 1800, log: '📡 Submitting to Sanjeevani backend...', action: async () => {
          const res = await submitIncident({
            report_method: 'text',
            raw_input: 'Heavy crowd pushing near Gate 7, people are falling and getting crushed. Very dangerous situation needs immediate police control.',
            latitude: LOCATIONS.gate7.lat, longitude: LOCATIONS.gate7.lng,
            location_label: LOCATIONS.gate7.label, event_id: EVENT_ID,
          })
          addLog(`✓ Incident ID: ${res.id.slice(0, 12)}...`)
          onIncidentCreated?.(res.id)
          // Refresh map after creation
          setTimeout(() => onRefreshNeeded?.(), 1000)
          setTimeout(() => onRefreshNeeded?.(), 4000)
        }},
        { delay: 2400, log: '🤖 Groq Llama 3.3 classifying...' },
        { delay: 4200, log: '✓ Crowd Surge · HIGH · Score 7/10' },
        { delay: 4800, log: '✓ Check the map — red marker appeared at Gate 7' },
        { delay: 5400, log: '🚔 Dispatcher assigns Police Team → EN ROUTE' },
      ],
    },
    {
      id: 2, name: 'Medical Emergency — SOS', icon: '🚑',
      description: 'Pilgrim collapses, presses SOS → Ambulance dispatched',
      color: 'text-red-400', bgColor: 'bg-red-950', borderColor: 'border-red-800',
      steps: [
        { delay: 0,    log: '👴 Elderly pilgrim collapses near Gate 4...' },
        { delay: 700,  log: '🚨 One tap SOS — GPS sent automatically' },
        { delay: 1400, log: '📡 SOS reaching command center...', action: async () => {
          const res = await submitIncident({
            report_method: 'sos',
            raw_input: 'SOS — elderly pilgrim collapsed, unresponsive, possible cardiac event near Gate 4',
            latitude: LOCATIONS.gate4.lat, longitude: LOCATIONS.gate4.lng,
            location_label: LOCATIONS.gate4.label, event_id: EVENT_ID,
          })
          addLog(`✓ SOS logged: ${res.id.slice(0, 12)}...`)
          onIncidentCreated?.(res.id)
          setTimeout(() => onRefreshNeeded?.(), 1000)
          setTimeout(() => onRefreshNeeded?.(), 4000)
        }},
        { delay: 2000, log: '🤖 AI: Medical Emergency · CRITICAL · 9/10' },
        { delay: 2600, log: '✓ Red pulsing marker on map at Gate 4' },
        { delay: 3200, log: '🚑 Nearest ambulance (400m) auto-recommended' },
        { delay: 3800, log: '✓ ETA 2 minutes — paramedic alerted' },
      ],
    },
    {
      id: 3, name: 'Lost Child — Voice Report', icon: '👶',
      description: 'Citizen voice report → Lost & Found assigned',
      color: 'text-yellow-400', bgColor: 'bg-yellow-950', borderColor: 'border-yellow-800',
      steps: [
        { delay: 0,    log: '👨 Citizen sees child alone, crying...' },
        { delay: 700,  log: '🎙️ Voice: "Small child 5 years, crying at main entrance, red shirt"' },
        { delay: 1500, log: '🔤 Groq Whisper transcribing audio...' },
        { delay: 2200, log: '📡 Submitting voice report...', action: async () => {
          const res = await submitIncident({
            report_method: 'voice',
            raw_input: 'Small child, approximately 5 years old, crying alone near main entrance. Wearing red shirt. No parents visible. Needs lost and found team immediately.',
            latitude: LOCATIONS.main.lat, longitude: LOCATIONS.main.lng,
            location_label: LOCATIONS.main.label, event_id: EVENT_ID,
          })
          addLog(`✓ Incident: ${res.id.slice(0, 12)}...`)
          onIncidentCreated?.(res.id)
          setTimeout(() => onRefreshNeeded?.(), 1000)
          setTimeout(() => onRefreshNeeded?.(), 4000)
        }},
        { delay: 2800, log: '🤖 AI: Lost Child · MEDIUM · Score 5/10' },
        { delay: 3400, log: '✓ Yellow marker on map at Main Entrance' },
        { delay: 4000, log: '🙋 Volunteer Squad assigned — PA announcement triggered' },
      ],
    },
    {
      id: 4, name: 'Drowning — Ganga Ghat', icon: '🌊',
      description: 'Photo report from ghat → AI detects → Rescue dispatched',
      color: 'text-blue-400', bgColor: 'bg-blue-950', borderColor: 'border-blue-800',
      steps: [
        { delay: 0,    log: '📱 Bystander sees person struggling in water...' },
        { delay: 700,  log: '📷 Takes photo → AI Vision analyzing...' },
        { delay: 1500, log: '🔍 AI: person in distress detected in water' },
        { delay: 2200, log: '📡 Image report submitted...', action: async () => {
          const res = await submitIncident({
            report_method: 'image',
            raw_input: 'AI vision detected: person struggling in water at Ganga Ghat bathing zone. Bystanders visible on bank. Immediate water rescue needed.',
            latitude: LOCATIONS.ganga.lat, longitude: LOCATIONS.ganga.lng,
            location_label: LOCATIONS.ganga.label, event_id: EVENT_ID,
          })
          addLog(`✓ Incident: ${res.id.slice(0, 12)}...`)
          onIncidentCreated?.(res.id)
          setTimeout(() => onRefreshNeeded?.(), 1000)
          setTimeout(() => onRefreshNeeded?.(), 4000)
        }},
        { delay: 2800, log: '🤖 AI: Drowning · CRITICAL · 9/10' },
        { delay: 3400, log: '✓ Critical red marker on map at Ganga Ghat' },
        { delay: 4000, log: '⛑️ Water Rescue Team dispatched — ETA 90 seconds' },
        { delay: 4600, log: '🚑 Ambulance on standby at ghat entry' },
      ],
    },
    {
      id: 5, name: 'Earthquake — BT Relay', icon: '🌍',
      description: 'No network → Bluetooth mesh delivers alert',
      color: 'text-purple-400', bgColor: 'bg-purple-950', borderColor: 'border-purple-800',
      steps: [
        { delay: 0,    log: '🌍 Seismic event — infrastructure down' },
        { delay: 600,  log: '📵 No mobile signal in affected zone' },
        { delay: 1200, log: '📱 Victim taps SOS — network fails' },
        { delay: 1800, log: '🔄 Auto-switching to Bluetooth relay mode' },
        { delay: 2400, log: '→ Hop 1: Device BT-3F7A (12m) ✓' },
        { delay: 3200, log: '→ Hop 2: Device DEV-9A21 (38m) ✓' },
        { delay: 4000, log: '→ Hop 3: Internet found — uploading...', action: async () => {
          const res = await submitIncident({
            report_method: 'sos',
            raw_input: 'DISASTER EVENT: Earthquake. Victim trapped in Sector 5. Relayed via Bluetooth mesh through 2 hops. Immediate rescue required.',
            latitude: LOCATIONS.sector5.lat, longitude: LOCATIONS.sector5.lng,
            location_label: LOCATIONS.sector5.label, event_id: EVENT_ID,
          })
          addLog(`✓ Alert delivered: ${res.id.slice(0, 12)}...`)
          onIncidentCreated?.(res.id)
          setTimeout(() => onRefreshNeeded?.(), 1000)
          setTimeout(() => onRefreshNeeded?.(), 4000)
        }},
        { delay: 4600, log: '🤖 AI: Disaster Event · CRITICAL · 10/10' },
        { delay: 5200, log: '✓ Purple marker on map — Sector 5' },
        { delay: 5800, log: '⛑️ NDRF rescue team dispatched' },
        { delay: 6400, log: `✅ Relay time: 4.2s across 2 hops` },
      ],
    },
  ]

  const scenarios = makeScenarios()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-sm">Demo Scenarios</h2>
        {running !== null && (
          <button
            onClick={() => { clearTimers(); setRunning(null) }}
            className="text-xs text-zinc-500 border border-zinc-700 rounded-lg px-2 py-1"
          >Stop</button>
        )}
      </div>

      <p className="text-zinc-600 text-xs">Each scenario makes real API calls — incidents appear live on the map and queue.</p>

      <div className="flex flex-col gap-2">
        {scenarios.map(s => (
          <button
            key={s.id}
            onClick={() => running === null && runScenario(s)}
            disabled={running !== null}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all
              ${done === s.id ? 'bg-green-950 border-green-800' :
                running === s.id ? `${s.bgColor} ${s.borderColor}` :
                'bg-zinc-900 border-zinc-800 hover:border-zinc-600'}
              disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span className="text-xl flex-shrink-0">{s.icon}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${running === s.id ? s.color : 'text-white'}`}>{s.name}</p>
              <p className="text-zinc-500 text-xs mt-0.5 truncate">{s.description}</p>
            </div>
            {running === s.id && (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0"
                   style={{ color: s.color.replace('text-', '') }} />
            )}
            {done === s.id && <span className="text-green-400 flex-shrink-0">✓</span>}
          </button>
        ))}
      </div>

      {logs.length > 0 && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
          <p className="text-zinc-600 text-xs font-mono mb-2">scenario.log</p>
          <div ref={logRef} className="font-mono text-xs flex flex-col gap-0.5 max-h-44 overflow-y-auto">
            {logs.map((log, i) => (
              <p key={i} className={
                log.startsWith('✅') ? 'text-green-400' :
                log.startsWith('✓') ? 'text-green-500' :
                log.startsWith('🤖') ? 'text-blue-400' :
                log.startsWith('⚠') ? 'text-red-400' :
                log.startsWith('─') ? 'text-zinc-800' :
                'text-zinc-400'
              }>{log}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}