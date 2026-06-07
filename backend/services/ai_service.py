import json
import re
from groq import AsyncGroq
from core.config import get_settings
from models.schemas import AIAnalysis, Severity, SituationBrief
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

CATEGORIES = [
    "Medical Emergency",
    "Crowd Surge",
    "Lost Child",
    "Fire",
    "Drowning",
    "Disaster Event",
    "Security Incident",
    "General Emergency",
]

RESOURCE_MAP = {
    "Medical Emergency": "ambulance",
    "Crowd Surge": "police",
    "Lost Child": "volunteer",
    "Fire": "rescue",
    "Drowning": "rescue",
    "Disaster Event": "rescue",
    "Security Incident": "police",
    "General Emergency": "volunteer",
}

CLASSIFY_SYSTEM = """You are an emergency triage AI for a large public gathering emergency response system called Sanjeevani AI. 
Your job is to analyze emergency reports and return structured JSON.

ALWAYS respond with valid JSON only. No markdown. No explanation. Just the JSON object.

JSON schema:
{
  "category": "<one of: Medical Emergency | Crowd Surge | Lost Child | Fire | Drowning | Disaster Event | Security Incident | General Emergency>",
  "severity": "<one of: critical | high | medium | low>",
  "severity_score": <integer 1-10>,
  "ai_summary": "<1-2 sentence plain English summary of the incident>",
  "recommended_resource_type": "<one of: ambulance | police | volunteer | rescue>"
}

Severity guidelines:
- critical (8-10): Immediate life threat, unconscious person, multiple casualties, fire, drowning
- high (6-7): Serious injury, large crowd surge, missing child, active security threat  
- medium (4-5): Minor injury, small crowd issue, non-urgent assistance needed
- low (1-3): Information request, minor inconvenience, no immediate danger"""


async def classify_incident(raw_input: str, report_method: str) -> AIAnalysis:
    """Call Groq Llama 3.3 to classify an incident and return structured analysis."""
    settings = get_settings()
    client = AsyncGroq(api_key=settings.groq_api_key)

    prompt = f"Emergency report (method: {report_method}):\n\n{raw_input}"

    try:
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": CLASSIFY_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=300,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        data = json.loads(content)

        category = data.get("category", "General Emergency")
        if category not in CATEGORIES:
            category = "General Emergency"

        severity_str = data.get("severity", "medium").lower()
        try:
            severity = Severity(severity_str)
        except ValueError:
            severity = Severity.medium

        score = int(data.get("severity_score", 5))
        score = max(1, min(10, score))

        recommended = data.get("recommended_resource_type", RESOURCE_MAP.get(category, "volunteer"))

        return AIAnalysis(
            category=category,
            severity=severity,
            severity_score=score,
            ai_summary=data.get("ai_summary", raw_input[:200]),
            recommended_resource_type=recommended,
        )

    except Exception as e:
        logger.error(f"Groq classification failed: {e}")
        # Fallback — don't crash the incident submission
        return AIAnalysis(
            category="General Emergency",
            severity=Severity.medium,
            severity_score=5,
            ai_summary=raw_input[:200] if raw_input else "Emergency reported via SOS",
            recommended_resource_type="volunteer",
        )


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> dict:
    """Transcribe audio using Groq Whisper."""
    settings = get_settings()
    client = AsyncGroq(api_key=settings.groq_api_key)

    try:
        transcription = await client.audio.transcriptions.create(
            file=(filename, audio_bytes, "audio/webm"),
            model="whisper-large-v3",
            response_format="verbose_json",
        )
        return {
            "transcript": transcription.text,
            "language": getattr(transcription, "language", None),
            "duration_seconds": getattr(transcription, "duration", None),
        }
    except Exception as e:
        logger.error(f"Whisper transcription failed: {e}")
        raise


async def generate_situation_brief(event_id: str, stats: dict, incidents: list) -> str:
    """Generate an AI situation summary for the command center."""
    settings = get_settings()
    client = AsyncGroq(api_key=settings.groq_api_key)

    incident_summary = "\n".join([
        f"- [{i.get('severity','?').upper()}] {i.get('category','Unknown')}: {i.get('ai_summary', i.get('raw_input',''))[:80]}"
        for i in incidents[:10]
    ])

    prompt = f"""You are the AI briefing system for Sanjeevani AI emergency command center.

Current situation stats:
- Total active incidents: {stats.get('total', 0)}
- Critical: {stats.get('critical', 0)}
- High: {stats.get('high', 0)}
- Medium: {stats.get('medium', 0)}
- Low: {stats.get('low', 0)}
- Resources available: {stats.get('resources_available', 0)}
- Resources dispatched: {stats.get('resources_dispatched', 0)}

Recent active incidents:
{incident_summary if incident_summary else 'No active incidents'}

Write a concise 2-3 sentence operational briefing for the command center operator. 
Be direct, factual, and actionable. Mention specific priorities and any resource concerns."""

    try:
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=200,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Brief generation failed: {e}")
        return f"Situation update: {stats.get('total', 0)} active incidents. {stats.get('critical', 0)} critical. {stats.get('resources_available', 0)} resources available."