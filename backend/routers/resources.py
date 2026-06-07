from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime, timezone

from db.client import get_supabase
from models.schemas import ResourceListResponse, ResourceResponse

router = APIRouter(prefix="/resources", tags=["resources"])


def _serialize_resource(row: dict) -> ResourceResponse:
    return ResourceResponse(
        id=row["id"],
        name=row["name"],
        type=row["type"],
        status=row["status"],
        latitude=float(row["latitude"]),
        longitude=float(row["longitude"]),
        event_id=row.get("event_id"),
        updated_at=str(row.get("updated_at", "")),
    )


@router.get("", response_model=ResourceListResponse)
async def list_resources(
    event_id: Optional[str] = None,
    status: Optional[str] = None,
    type: Optional[str] = None,
):
    sb = get_supabase()
    query = sb.table("resources").select("*").order("type")
    if event_id:
        query = query.eq("event_id", event_id)
    if status:
        query = query.eq("status", status)
    if type:
        query = query.eq("type", type)

    result = query.execute()
    return ResourceListResponse(resources=[_serialize_resource(r) for r in (result.data or [])])


@router.patch("/{resource_id}/location")
async def update_resource_location(resource_id: str, latitude: float, longitude: float):
    sb = get_supabase()
    result = sb.table("resources").update({
        "latitude": latitude,
        "longitude": longitude,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", resource_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Resource not found")
    return {"ok": True}