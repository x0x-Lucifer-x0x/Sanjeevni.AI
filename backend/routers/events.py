from fastapi import APIRouter, HTTPException
from db.client import get_supabase

router = APIRouter(prefix="/events", tags=["events"])


@router.get("")
async def list_events():
    sb = get_supabase()
    result = sb.table("events").select("*").eq("active", True).execute()
    return {"events": result.data or []}


@router.get("/{event_id}")
async def get_event(event_id: str):
    sb = get_supabase()
    result = sb.table("events").select("*").eq("id", event_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Event not found")
    return result.data


@router.get("/{event_id}/stats")
async def get_event_stats(event_id: str):
    """Dashboard summary stats for a specific event."""
    sb = get_supabase()

    inc = sb.table("incidents").select("severity, status").eq("event_id", event_id).is_("canonical_id", "null").execute()
    res = sb.table("resources").select("status, type").eq("event_id", event_id).execute()

    incidents = inc.data or []
    resources = res.data or []

    return {
        "incidents": {
            "total": len(incidents),
            "active": sum(1 for i in incidents if i["status"] != "resolved"),
            "resolved": sum(1 for i in incidents if i["status"] == "resolved"),
            "critical": sum(1 for i in incidents if i.get("severity") == "critical"),
            "high": sum(1 for i in incidents if i.get("severity") == "high"),
            "medium": sum(1 for i in incidents if i.get("severity") == "medium"),
            "low": sum(1 for i in incidents if i.get("severity") == "low"),
        },
        "resources": {
            "total": len(resources),
            "available": sum(1 for r in resources if r["status"] == "available"),
            "dispatched": sum(1 for r in resources if r["status"] == "dispatched"),
            "unavailable": sum(1 for r in resources if r["status"] == "unavailable"),
            "by_type": {
                t: sum(1 for r in resources if r["type"] == t)
                for t in ["ambulance", "police", "volunteer", "rescue", "medical_post"]
            },
        },
    }