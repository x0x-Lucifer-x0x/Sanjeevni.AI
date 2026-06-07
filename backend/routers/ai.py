import logging
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
from datetime import datetime, timezone

from db.client import get_supabase
from models.schemas import SituationBrief, VoiceTranscriptionResponse, ImageAnalysisResponse
from services.ai_service import generate_situation_brief, transcribe_audio
from services.yolo_service import analyze_image

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/brief", response_model=SituationBrief)
async def get_situation_brief(event_id: Optional[str] = None):
    """Generate a real-time AI situation summary for the command center."""
    sb = get_supabase()

    # Fetch active incidents
    query = (
        sb.table("incidents")
        .select("*")
        .neq("status", "resolved")
        .is_("canonical_id", "null")
        .order("severity_score", desc=True)
        .limit(20)
    )
    if event_id:
        query = query.eq("event_id", event_id)
    inc_result = query.execute()
    incidents = inc_result.data or []

    # Fetch resource stats
    res_result = sb.table("resources").select("status")
    if event_id:
        res_result = res_result.eq("event_id", event_id)
    res_result = res_result.execute()
    resources = res_result.data or []

    stats = {
        "total": len(incidents),
        "critical": sum(1 for i in incidents if i.get("severity") == "critical"),
        "high": sum(1 for i in incidents if i.get("severity") == "high"),
        "medium": sum(1 for i in incidents if i.get("severity") == "medium"),
        "low": sum(1 for i in incidents if i.get("severity") == "low"),
        "resources_available": sum(1 for r in resources if r.get("status") == "available"),
        "resources_dispatched": sum(1 for r in resources if r.get("status") == "dispatched"),
    }

    brief_text = await generate_situation_brief(event_id or "global", stats, incidents)

    return SituationBrief(
        brief=brief_text,
        stats=stats,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


@router.post("/transcribe", response_model=VoiceTranscriptionResponse)
async def transcribe_voice(
    audio: UploadFile = File(...),
):
    """Transcribe voice memo using Groq Whisper."""
    # Accept audio/* and video/mp4 (Safari records audio as video/mp4)
    ct = audio.content_type or ""
    if not (ct.startswith("audio/") or ct in ("video/mp4", "video/webm", "application/octet-stream")):
        raise HTTPException(status_code=400, detail="File must be an audio file")

    audio_bytes = await audio.read()
    if len(audio_bytes) > 25 * 1024 * 1024:  # 25MB limit
        raise HTTPException(status_code=413, detail="Audio file too large (max 25MB)")

    try:
        result = await transcribe_audio(audio_bytes, filename=audio.filename or "audio.webm")
        return VoiceTranscriptionResponse(
            transcript=result["transcript"],
            language=result.get("language"),
            duration_seconds=result.get("duration_seconds"),
        )
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")


@router.post("/analyze-image", response_model=ImageAnalysisResponse)
async def analyze_emergency_image(
    image: UploadFile = File(...),
):
    """Run YOLOv8 on an uploaded image and return emergency detections."""
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_bytes = await image.read()
    if len(image_bytes) > 10 * 1024 * 1024:  # 10MB
        raise HTTPException(status_code=413, detail="Image too large (max 10MB)")

    result = analyze_image(image_bytes)

    return ImageAnalysisResponse(
        detections=result.get("detections", []),
        emergency_detected=result.get("emergency_detected", False),
        suggested_category=result.get("suggested_category"),
        suggested_severity=result.get("suggested_severity"),
    )