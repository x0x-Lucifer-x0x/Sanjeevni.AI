from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone

from db.client import get_supabase
from models.schemas import DispatchCreate, DispatchResponse, ResourceResponse
from services.route_service import generate_route

router = APIRouter(prefix="/dispatch", tags=["dispatch"])


@router.post("", response_model=DispatchResponse)
async def dispatch_resource(payload: DispatchCreate):
    sb = get_supabase()

    # Fetch incident
    inc_res = sb.table("incidents").select("*").eq("id", payload.incident_id).single().execute()
    if not inc_res.data:
        raise HTTPException(status_code=404, detail="Incident not found")
    incident = inc_res.data

    # Fetch resource and verify availability
    res_res = sb.table("resources").select("*").eq("id", payload.resource_id).single().execute()
    if not res_res.data:
        raise HTTPException(status_code=404, detail="Resource not found")
    resource = res_res.data

    if resource["status"] != "available":
        raise HTTPException(status_code=409, detail=f"Resource is {resource['status']}, not available")

    # Create dispatch record
    dispatch_insert = {
        "incident_id": payload.incident_id,
        "resource_id": payload.resource_id,
        "notes": payload.notes,
    }
    disp_res = sb.table("dispatches").insert(dispatch_insert).execute()
    if not disp_res.data:
        raise HTTPException(status_code=500, detail="Failed to create dispatch")
    dispatch = disp_res.data[0]

    # Update resource status → dispatched
    sb.table("resources").update({
        "status": "dispatched",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", payload.resource_id).execute()

    # Update incident status → assigned
    sb.table("incidents").update({
        "status": "assigned",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", payload.incident_id).execute()

    # Timeline entry
    sb.table("incident_events").insert({
        "incident_id": payload.incident_id,
        "status": "assigned",
        "actor": "dispatcher",
        "note": f"{resource['name']} dispatched",
    }).execute()

    # Generate route for map animation
    route, eta = generate_route(
        resource_lat=float(resource["latitude"]),
        resource_lng=float(resource["longitude"]),
        incident_lat=float(incident["latitude"]),
        incident_lng=float(incident["longitude"]),
    )

    return DispatchResponse(
        id=dispatch["id"],
        incident_id=payload.incident_id,
        resource_id=payload.resource_id,
        dispatched_at=str(dispatch["dispatched_at"]),
        route=route,
        eta_seconds=eta,
        resource=ResourceResponse(
            id=resource["id"],
            name=resource["name"],
            type=resource["type"],
            status="dispatched",
            latitude=float(resource["latitude"]),
            longitude=float(resource["longitude"]),
            event_id=resource.get("event_id"),
            updated_at=str(resource.get("updated_at", "")),
        ),
    )


@router.patch("/{dispatch_id}/arrived")
async def mark_arrived(dispatch_id: str):
    sb = get_supabase()
    disp = sb.table("dispatches").select("*").eq("id", dispatch_id).single().execute()
    if not disp.data:
        raise HTTPException(status_code=404, detail="Dispatch not found")

    now = datetime.now(timezone.utc).isoformat()
    sb.table("dispatches").update({"arrived_at": now}).eq("id", dispatch_id).execute()
    sb.table("incidents").update({"status": "on_site", "updated_at": now}).eq("id", disp.data["incident_id"]).execute()
    sb.table("incident_events").insert({
        "incident_id": disp.data["incident_id"],
        "status": "on_site",
        "actor": "system",
        "note": "Resource arrived on site",
    }).execute()
    return {"ok": True}


@router.patch("/{dispatch_id}/resolve")
async def resolve_incident(dispatch_id: str, notes: str = ""):
    sb = get_supabase()
    disp = sb.table("dispatches").select("*").eq("id", dispatch_id).single().execute()
    if not disp.data:
        raise HTTPException(status_code=404, detail="Dispatch not found")

    now = datetime.now(timezone.utc).isoformat()
    sb.table("dispatches").update({"resolved_at": now, "notes": notes}).eq("id", dispatch_id).execute()
    sb.table("incidents").update({"status": "resolved", "updated_at": now}).eq("id", disp.data["incident_id"]).execute()
    sb.table("resources").update({"status": "available", "updated_at": now}).eq("id", disp.data["resource_id"]).execute()
    sb.table("incident_events").insert({
        "incident_id": disp.data["incident_id"],
        "status": "resolved",
        "actor": "dispatcher",
        "note": notes or "Incident resolved",
    }).execute()
    return {"ok": True}