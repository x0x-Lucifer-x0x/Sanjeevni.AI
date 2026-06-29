import math
import logging
from datetime import datetime, timedelta, timezone
from db.client import get_supabase
from models.schemas import DeduplicationResult

logger = logging.getLogger(__name__)

# Incidents within this radius (meters) and time window are considered duplicates
DEDUP_RADIUS_METERS = 150
DEDUP_TIME_WINDOW_MINUTES = 10


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in meters between two GPS coordinates."""
    R = 6_371_000  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def find_or_create_canonical(
    latitude: float,
    longitude: float,
    category: str,
    event_id: str | None,
    new_incident_id: str,
) -> DeduplicationResult:
    """
    Search recent incidents for a duplicate within the geo-time window.
    If found, increment confirmation_count and link canonical_id.
    If not found, this incident becomes the canonical one.
    """
    sb = get_supabase()
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=DEDUP_TIME_WINDOW_MINUTES)).isoformat()

    try:
        # Fetch recent unresolved incidents for this event
        query = (
            sb.table("incidents")
            .select("id, latitude, longitude, category, confirmation_count, canonical_id, status")
            .gte("created_at", cutoff)
            .not_.in_("status", ["resolved"])
            .is_("canonical_id", "null")  # Only look at canonical (parent) incidents
        )
        if event_id:
            query = query.eq("event_id", event_id)

        result = query.execute()
        candidates = result.data or []

        for candidate in candidates:
            # Skip self
            if candidate["id"] == new_incident_id:
                continue

            # Same category check
            if candidate.get("category") != category:
                continue

            # Distance check
            dist = haversine_meters(
                latitude, longitude,
                float(candidate["latitude"]),
                float(candidate["longitude"]),
            )

            if dist <= DEDUP_RADIUS_METERS:
                canonical_id = candidate["id"]
                new_count = candidate["confirmation_count"] + 1

                # Update canonical incident's confirmation count
                sb.table("incidents").update({
                    "confirmation_count": new_count,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", canonical_id).execute()

                # Link the duplicate to canonical
                sb.table("incidents").update({
                    "canonical_id": canonical_id,
                    "status": "reported",
                }).eq("id", new_incident_id).execute()

                logger.info(f"Dedup: incident {new_incident_id} merged into {canonical_id} (dist={dist:.0f}m, confirmations={new_count})")

                return DeduplicationResult(
                    action="merged",
                    canonical_id=canonical_id,
                    confirmation_count=new_count,
                )

        # No duplicate found — this is a new canonical incident
        return DeduplicationResult(
            action="new",
            canonical_id=None,
            confirmation_count=1,
        )

    except Exception as e:
        logger.error(f"Dedup engine error: {e}")
        return DeduplicationResult(action="new", canonical_id=None, confirmation_count=1)