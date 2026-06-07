import logging
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Optional
from datetime import datetime, timezone

from db.client import get_supabase
from models.schemas import (
    IncidentCreate, IncidentResponse, IncidentListResponse,
    IncidentStatusUpdate, AIAnalysis, Severity,
)
from services.ai_service import classify_incident
from services.dedup_service import find_or_create_canonical

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/incidents", tags=["incidents"])


def _serialize_incident(row: dict) -> IncidentResponse:
    return IncidentResponse(
        id=row["id"],
        report_method=row["report_method"],
        raw_input=row.get("raw_input"),
        category=row.get("category"),
        severity=row.get("severity"),
        severity_score=row.get("severity_score"),
        ai_summary=row.get("ai_summary"),
        recommended_resource_type=row.get("recommended_resource_type"),
        latitude=float(row["latitude"]),
        longitude=float(row["longitude"]),
        location_label=row.get("location_label"),
        status=row["status"],
        confirmation_count=row.get("confirmation_count", 1),
        event_id=row.get("event_id"),
        created_at=str(row.get("created_at", "")),
        updated_at=str(row.get("updated_at", "")),
    )


@router.post("", response_model=IncidentResponse)
async def create_incident(payload: IncidentCreate, background_tasks: BackgroundTasks):
    """
    Submit a new incident. Immediately saves to DB, then runs AI triage
    and dedup in background, updating the record when complete.
    """
    sb = get_supabase()

    # 1. Insert raw incident immediately (status: analyzing)
    insert_data = {
        "report_method": payload.report_method.value,
        "raw_input": payload.raw_input,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "location_label": payload.location_label,
        "event_id": payload.event_id,
        "reporter_id": payload.reporter_id,
        "status": "analyzing",
    }

    result = sb.table("incidents").insert(insert_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create incident")

    incident = result.data[0]
    incident_id = incident["id"]

    # 2. Log timeline entry
    sb.table("incident_events").insert({
        "incident_id": incident_id,
        "status": "analyzing",
        "actor": "system",
        "note": f"Incident received via {payload.report_method.value}",
    }).execute()

    # 3. Run AI + dedup in background to not block response
    background_tasks.add_task(
        _run_ai_triage,
        incident_id=incident_id,
        raw_input=payload.raw_input or f"SOS from {payload.location_label or 'unknown location'}",
        report_method=payload.report_method.value,
        latitude=payload.latitude,
        longitude=payload.longitude,
        event_id=payload.event_id,
    )

    return _serialize_incident(incident)


async def _run_ai_triage(
    incident_id: str,
    raw_input: str,
    report_method: str,
    latitude: float,
    longitude: float,
    event_id: Optional[str],
):
    """Background task: AI classify → dedup → update incident record."""
    sb = get_supabase()
    try:
        # AI classification
        analysis: AIAnalysis = await classify_incident(raw_input, report_method)

        # Deduplication check
        dedup = await find_or_create_canonical(
            latitude=latitude,
            longitude=longitude,
            category=analysis.category,
            event_id=event_id,
            new_incident_id=incident_id,
        )

        # Update incident with AI results
        update_data = {
            "category": analysis.category,
            "severity": analysis.severity.value,
            "severity_score": analysis.severity_score,
            "ai_summary": analysis.ai_summary,
            "recommended_resource_type": analysis.recommended_resource_type,
            "status": "verified",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        if dedup.action == "merged" and dedup.canonical_id:
            update_data["canonical_id"] = dedup.canonical_id

        sb.table("incidents").update(update_data).eq("id", incident_id).execute()

        # Timeline entry
        sb.table("incident_events").insert({
            "incident_id": incident_id,
            "status": "verified",
            "actor": "ai",
            "note": f"AI classified as {analysis.category} · Severity {analysis.severity.value} ({analysis.severity_score}/10) · {dedup.action} (dedup)",
        }).execute()

        logger.info(f"AI triage complete for {incident_id}: {analysis.category} / {analysis.severity.value}")

    except Exception as e:
        logger.error(f"AI triage failed for {incident_id}: {e}")
        sb.table("incidents").update({
            "status": "reported",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", incident_id).execute()


@router.get("", response_model=IncidentListResponse)
async def list_incidents(
    event_id: Optional[str] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 50,
    exclude_duplicates: bool = True,
):
    """Fetch incident queue for the dashboard."""
    sb = get_supabase()

    query = (
        sb.table("incidents")
        .select("*")
        .order("severity_score", desc=True, nullsfirst=False)
        .order("created_at", desc=True)
        .limit(limit)
    )

    if event_id:
        query = query.eq("event_id", event_id)
    if status:
        query = query.eq("status", status)
    if severity:
        query = query.eq("severity", severity)
    if exclude_duplicates:
        query = query.is_("canonical_id", "null")

    result = query.execute()
    incidents = result.data or []

    # Stats
    stats = {"total": len(incidents), "critical": 0, "high": 0, "medium": 0, "low": 0}
    for inc in incidents:
        sev = inc.get("severity")
        if sev in stats:
            stats[sev] += 1

    return IncidentListResponse(
        incidents=[_serialize_incident(i) for i in incidents],
        meta=stats,
    )


@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident(incident_id: str):
    sb = get_supabase()
    result = sb.table("incidents").select("*").eq("id", incident_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Incident not found")
    return _serialize_incident(result.data)


@router.patch("/{incident_id}/status", response_model=IncidentResponse)
async def update_incident_status(incident_id: str, payload: IncidentStatusUpdate):
    sb = get_supabase()

    update = {
        "status": payload.status.value,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = sb.table("incidents").update(update).eq("id", incident_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Incident not found")

    sb.table("incident_events").insert({
        "incident_id": incident_id,
        "status": payload.status.value,
        "actor": payload.actor or "dispatcher",
        "note": payload.note or f"Status updated to {payload.status.value}",
    }).execute()

    return _serialize_incident(result.data[0])


@router.get("/{incident_id}/timeline")
async def get_incident_timeline(incident_id: str):
    sb = get_supabase()
    result = (
        sb.table("incident_events")
        .select("*")
        .eq("incident_id", incident_id)
        .order("created_at")
        .execute()
    )
    return {"timeline": result.data or []}