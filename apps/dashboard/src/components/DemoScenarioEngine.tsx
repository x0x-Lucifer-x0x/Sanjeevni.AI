'use client'
import { useState, useRef, useCallback } from 'react'
import { submitIncident } from '@/lib/api'

const EVENT_ID = process.env.NEXT_PUBLIC_EVENT_ID!

// Mahakumbh GPS coords for each scenario
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
}: {
  onIncidentCreated?: (id: string) => void
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

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }

  const runScenario = useCallback(async (scenario: Scenario) => {
    clearTimers()
    setRunning(scenario.id)
    setDone(null)
    setLogs([`▶ Starting: ${scenario.name}`, '─'.repeat(36)])

    for (const step of scenario.steps) {
      await new Promise<void>(resolve => {
        const t = setTimeout(async () => {
          addLog(step.log)
          if (step.action) {
            try {
              await step.action()
            } catch (err: any) {
              addLog(`⚠ API error: ${err.message}`)
            }
          }
          resolve()
        }, step.delay)
        timersRef.current.push(t)
      })
    }

    addLog('─'.repeat(36))
    addLog('✅ Demo scenario complete — check the dashboard')
    setRunning(null)
    setDone(scenario.id)
  }, [addLog])

  const scenarios: Scenario[] = [
    {
      id: 1,
      name: 'Mahakumbh Crowd Surge',
      icon: '👥',
      description: 'Volunteer reports crowd pushing at Gate 7 → Police dispatched',
      color: 'text-amber-400',
      bgColor: 'bg-amber-950',
      borderColor: 'border-amber-800',
      steps: [
        { delay: 0,    log: '👥 Volunteer Ravi opens Sanjeevani app...' },
        { delay: 800,  log: '💬 Typing: "Heavy crowd pushing near Gate 7, people falling"' },
        { delay: 1800, log: '📡 Submitting text report to backend...',
          action: async () => {
            const res = await submitIncident({
              report_method: 'text',
              raw_input: 'Heavy crowd pushing near Gate 7, people are falling and getting crushed. Very dangerous situation.',
              latitude: LOCATIONS.gate7.lat, longitude: LOCATIONS.gate7.lng,
              location_label: LOCATIONS.gate7.label, event_id: EVENT_ID,
            })
            addLog(`✓ Incident created: ${res.id.slice(0, 8)}...`)
            onIncidentCreated?.(res.id)
          }
        },
        { delay: 2200, log: '🤖 Groq Llama 3.3 classifying incident...' },
        { delay: 3500, log: '✓ AI result: Crowd Surge · Severity: HIGH · Score: 7/10' },
        { delay: 4000, log: '✓ Recommended resource: Police team' },
        { delay: 4500, log: '📍 Dispatcher sees incident on map — assigns Police Team Alpha' },
        { delay: 5200, log: '🚔 Police Team Alpha en route to Gate 7' },
        { delay: 5800, log: '✓ Status: EN ROUTE → ETA 3 minutes' },
      ],
    },
    {
      id: 2,
      name: 'Medical Emergency — SOS',
      icon: '🚑',
      description: 'Pilgrim collapses, presses SOS → Nearest ambulance dispatched',
      color: 'text-red-400',
      bgColor: 'bg-red-950',
      borderColor: 'border-red-800',
      steps: [
        { delay: 0,    log: '👴 Elderly pilgrim near Gate 4 feels unwell...' },
        { delay: 800,  log: '🚨 Presses SOS button — GPS captured automatically' },
        { delay: 1400, log: '📡 SOS packet sent to backend...',
          action: async () => {
            const res = await submitIncident({
              report_method: 'sos',
              raw_input: 'SOS emergency alert — elderly pilgrim, possible cardiac event',
              latitude: LOCATIONS.gate4.lat, longitude: LOCATIONS.gate4.lng,
              location_label: LOCATIONS.gate4.label, event_id: EVENT_ID,
            })
            addLog(`✓ SOS logged: ${res.id.slice(0, 8)}...`)
            onIncidentCreated?.(res.id)
          }
        },
        { delay: 1800, log: '🤖 AI: Medical Emergency · CRITICAL · Score: 9/10' },
        { delay: 2400, log: '✓ Recommended: Ambulance + paramedic' },
        { delay: 3000, log: '🚑 Ambulance Unit 2 (nearest, 400m) assigned' },
        { delay: 3600, log: '📍 Route animated on command center map' },
        { delay: 4200, log: '✓ ETA: 2 minutes — paramedic alerted via radio' },
      ],
    },
    {
      id: 3,
      name: 'Lost Child Report',
      icon: '👶',
      description: 'Citizen reports lost child → Lost & Found team assigned',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-950',
      borderColor: 'border-yellow-800',
      steps: [
        { delay: 0,    log: '👨 Citizen notices young child crying alone...' },
        { delay: 700,  log: '💬 Voice report: "There is a small child, maybe 5 years old, crying near main entrance. No parents visible."' },
        { delay: 1500, log: '🎙️ Whisper transcribes audio → text extracted' },
        { delay: 2200, log: '📡 Submitting voice report...',
          action: async () => {
            const res = await submitIncident({
              report_method: 'voice',
              raw_input: 'There is a small child, maybe 5 years old, crying near main entrance. No parents visible. Child is wearing a red shirt.',
              latitude: LOCATIONS.main.lat, longitude: LOCATIONS.main.lng,
              location_label: LOCATIONS.main.label, event_id: EVENT_ID,
            })
            addLog(`✓ Incident created: ${res.id.slice(0, 8)}...`)
            onIncidentCreated?.(res.id)
          }
        },
        { delay: 2800, log: '🤖 AI: Lost Child · MEDIUM · Score: 5/10' },
        { delay: 3400, log: '✓ Recommended: Volunteer / Lost & Found team' },
        { delay: 4000, log: '🙋 Volunteer Squad A assigned to main entrance' },
        { delay: 4600, log: '📢 PA system announcement triggered for child description' },
      ],
    },
    {
      id: 4,
      name: 'Drowning — Image Upload',
      icon: '🌊',
      description: 'User uploads photo from Ganga ghat → YOLO detects → Rescue dispatched',
      color: 'text-blue-400',
      bgColor: 'bg-blue-950',
      borderColor: 'border-blue-800',
      steps: [
        { delay: 0,    log: '📱 Bystander sees person struggling in water at Ganga ghat...' },
        { delay: 700,  log: '📷 Opens Sanjeevani → Image report → Takes photo' },
        { delay: 1400, log: '🔍 YOLOv8 analyzing image on backend server...' },
        { delay: 2200, log: '✓ YOLO detects: person_in_water (0.89), crowd_near_water (0.76)' },
        { delay: 2800, log: '📡 Submitting image report with YOLO data...',
          action: async () => {
            const res = await submitIncident({
              report_method: 'image',
              raw_input: 'YOLO detected: person struggling in water near Ganga ghat. High confidence drowning event. Bystanders visible on bank.',
              latitude: LOCATIONS.ganga.lat, longitude: LOCATIONS.ganga.lng,
              location_label: LOCATIONS.ganga.label, event_id: EVENT_ID,
            })
            addLog(`✓ Incident logged: ${res.id.slice(0, 8)}...`)
            onIncidentCreated?.(res.id)
          }
        },
        { delay: 3400, log: '🤖 AI: Drowning · CRITICAL · Score: 9/10' },
        { delay: 4000, log: '⛑️ Water Rescue Team 1 dispatched immediately' },
        { delay: 4600, log: '🚑 Ambulance on standby at ghat entry point' },
        { delay: 5200, log: '✓ ETA: 90 seconds — NDRF team alerted' },
      ],
    },
    {
      id: 5,
      name: 'Earthquake / Network Down',
      icon: '🌍',
      description: 'Disaster event, no internet → BT relay activates → Command center reached',
      color: 'text-purple-400',
      bgColor: 'bg-purple-950',
      borderColor: 'border-purple-800',
      steps: [
        { delay: 0,    log: '🌍 Seismic event detected — infrastructure down' },
        { delay: 600,  log: '📵 Mobile internet unavailable in affected zone' },
        { delay: 1200, log: '📱 Victim presses SOS — network call fails' },
        { delay: 1800, log: '🔄 App switches to Bluetooth relay mode automatically' },
        { delay: 2400, log: '📡 Emergency packet compressed (340 bytes)' },
        { delay: 3000, log: '→ Hop 1: Volunteer Ravi K. (12m) — RSSI -65dBm ✓' },
        { delay: 3800, log: '→ Hop 2: Security Post B (38m) — relaying forward ✓' },
        { delay: 4600, log: '→ Hop 3: Security Post B has internet → uploading...',
          action: async () => {
            const res = await submitIncident({
              report_method: 'sos',
              raw_input: 'DISASTER: Earthquake event. Victim trapped. Network unavailable — relayed via Bluetooth mesh. Location: Sector 5.',
              latitude: LOCATIONS.sector5.lat, longitude: LOCATIONS.sector5.lng,
              location_label: LOCATIONS.sector5.label, event_id: EVENT_ID,
            })
            addLog(`✓ Incident reached command center: ${res.id.slice(0, 8)}...`)
            onIncidentCreated?.(res.id)
          }
        },
        { delay: 5400, log: '✓ AI: Disaster Event · CRITICAL · Score: 10/10' },
        { delay: 6000, log: '⛑️ NDRF rescue team dispatched' },
        { delay: 6600, log: '✅ Total relay time: 4.2 seconds across 3 hops' },
      ],
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-sm">Demo Scenario Engine</h2>
        {running !== null && (
          <button
            onClick={() => { clearTimers(); setRunning(null) }}
            className="text-xs text-zinc-500 border border-zinc-700 rounded-lg px-2 py-1"
          >
            Stop
          </button>
        )}
      </div>

      {/* Scenario grid */}
      <div className="grid grid-cols-1 gap-2">
        {scenarios.map(s => (
          <button
            key={s.id}
            onClick={() => running === null && runScenario(s)}
            disabled={running !== null}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all
              ${done === s.id
                ? 'bg-green-950 border-green-800'
                : running === s.id
                  ? `${s.bgColor} ${s.borderColor}`
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600'
              }
              disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span className="text-xl">{s.icon}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${running === s.id ? s.color : 'text-white'}`}>
                {s.name}
              </p>
              <p className="text-zinc-500 text-xs mt-0.5 truncate">{s.description}</p>
            </div>
            {running === s.id && (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
            )}
            {done === s.id && <span className="text-green-400 flex-shrink-0">✓</span>}
          </button>
        ))}
      </div>

      {/* Log output */}
      {logs.length > 0 && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
          <p className="text-zinc-600 text-xs font-mono mb-2">scenario.log</p>
          <div
            ref={logRef}
            className="font-mono text-xs flex flex-col gap-0.5 max-h-40 overflow-y-auto"
          >
            {logs.map((log, i) => (
              <p
                key={i}
                className={
                  log.startsWith('✅') ? 'text-green-400' :
                  log.startsWith('✓') ? 'text-green-500' :
                  log.startsWith('🤖') ? 'text-blue-400' :
                  log.startsWith('⚠') ? 'text-red-400' :
                  log.startsWith('─') ? 'text-zinc-800' :
                  'text-zinc-400'
                }
              >
                {log}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}