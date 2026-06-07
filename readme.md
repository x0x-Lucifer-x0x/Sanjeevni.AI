
# 🚨 Sanjeevani AI
### AI-Powered Emergency Response Coordination Platform

*Built for Mahakumbh. Designed for every large-scale event.*

</div>

---

## Why We Built This

India hosts the world's largest public gatherings. Mahakumbh 2025 drew over 400 million visitors. At that scale, a single delayed emergency response can cost a life.

Current systems fail in three critical ways: fragmented reporting across radio, phone, and walkie-talkie; manual triage by exhausted dispatchers handling dozens of simultaneous incidents; and complete breakdown when network infrastructure fails under load.

We built Sanjeevani AI to answer one question: **how do you get the right emergency resource to the right place in the shortest possible time, even when communication infrastructure is degraded?**

---

## What We Built

A two-app platform. One for people on the ground, one for the command center.

**Citizen App** — A mobile-first emergency reporting interface that works across four modes: one-tap SOS with automatic GPS capture, voice reporting transcribed in real-time by Groq Whisper, text reporting with AI classification, and image reporting with computer vision analysis. When the network fails entirely, reports hop peer-to-peer via Bluetooth relay until they reach a connected node.

**Command Center Dashboard** — A real-time operations interface for dispatchers. Every incoming incident is automatically classified, severity-scored, and deduplicated by AI before a human reads it. Dispatchers see a pre-triaged priority queue, a live map with emoji-coded resources, and a one-click dispatch workflow. Supabase Realtime means zero-poll live updates — the map and queue update the instant a new report arrives.

---

## Core Features

**Multi-modal reporting** — Citizens report via SOS, voice, text, or photo. No single failure point.

**AI triage in the critical path** — Every incident is classified by Groq Llama 3.3 70B within seconds of submission. The dispatcher sees category, severity score (1–10), recommended resource type, and an AI summary before they even open the incident.

**Intelligent deduplication** — When 50 people report the same crowd surge, the system clusters them into one incident with a confirmation count. Dispatchers see signal, not noise.

**Network resilience** — Four degradation levels: normal API submission, SMS fallback, local IndexedDB queue with automatic retry, and Bluetooth mesh relay simulation. Reports survive total network failure.

**Real-time situational awareness** — Live map with incident markers sized and emoji-coded by severity, resource markers with contact details, animated dispatch routes, and a canvas-based heatmap for crowd density. The AI generates a two-sentence flash brief that updates every 90 seconds.

**5 demo scenarios** — Pre-scripted but using real API calls: crowd surge, medical SOS, lost child, drowning via image, and earthquake with BT relay. Each scenario makes actual backend calls and shows up live on the map.

---

## How It Works

```
Citizen reports incident (SOS / Voice / Text / Image)
         ↓
FastAPI backend receives report → saves immediately (status: analyzing)
         ↓
Background task: Groq Llama 3.3 classifies → severity scored → resource recommended
         ↓
Dedup engine: haversine clustering (150m radius, 10-min window)
         ↓
Supabase Realtime broadcasts update to all connected dashboards
         ↓
Dispatcher sees pre-triaged incident in queue → selects resource → dispatches
         ↓
Animated route drawn on map → resource marker moves toward incident
         ↓
Status progresses: Reported → Analyzing → Verified → Assigned → En Route → On Site → Resolved
```

---

## What Makes This Different

Most emergency tools are passive dashboards — they display information and wait for humans to act. Sanjeevani puts AI in the critical path between "incident reported" and "dispatcher reads it."

By the time a dispatcher opens an incident, they already know the category, severity, recommended resource, and whether 40 other people confirmed the same event. They confirm decisions, they don't decode inputs.

The Bluetooth relay layer addresses a problem no consumer emergency app has solved: what happens when the network that powers your emergency platform goes down during the emergency. Our answer is a mesh protocol where unaffected devices relay compressed emergency packets until they reach a connected node.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Citizen App | Next.js 14, TypeScript, Tailwind CSS |
| Dashboard | Next.js 14, React Leaflet, Framer Motion |
| Backend | FastAPI, Python 3.11 |
| AI Inference | Groq API — Llama 3.3 70B + Whisper Large v3 |
| Image Analysis | YOLOv8 (ultralytics) |
| Database | Supabase PostgreSQL |
| Realtime | Supabase Realtime (WebSocket) |
| Offline Queue | IndexedDB (browser-native) |
| Maps | React Leaflet + CartoDB Dark tiles |
| Deployment | Vercel (frontend) + Railway (backend) |

---

## Future Scope

**True Bluetooth mesh networking** — Replace the simulation with a production BLE mesh using Android/iOS APIs. The protocol design is complete; implementation is a native module away.

**Predictive crowd modeling** — Use historical incident patterns and real-time density data to predict surge zones 10–15 minutes in advance and pre-position resources.

**Multi-agency coordination** — Role-based access with separate views for police, EMS, fire, and event management. Shared incident ownership across agencies.

**Radio integration** — Ingest voice communications from existing radio systems via Whisper transcription, classify them as incidents automatically, eliminating manual re-entry.

**Regional language support** — Whisper already supports Hindi, Bengali, Tamil, and 90+ languages. Surface this for voice reports so first responders and citizens interact in their native language.

**Offline-first architecture** — Full CRDT-based conflict resolution so the citizen app and dashboard both function completely offline and sync when connectivity returns.

---

## License

MIT. Built with ❤️ for public safety.
