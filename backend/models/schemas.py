from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ReportMethod(str, Enum):
    sos = "sos"
    voice = "voice"
    text = "text"
    image = "image"


class Severity(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"


class IncidentStatus(str, Enum):
    reported = "reported"
    analyzing = "analyzing"
    verified = "verified"
    assigned = "assigned"
    en_route = "en_route"
    on_site = "on_site"
    resolved = "resolved"


class ResourceType(str, Enum):
    ambulance = "ambulance"
    police = "police"
    volunteer = "volunteer"
    rescue = "rescue"
    medical_post = "medical_post"


class ResourceStatus(str, Enum):
    available = "available"
    dispatched = "dispatched"
    unavailable = "unavailable"


# ── Incident ──────────────────────────────────────────────────

class IncidentCreate(BaseModel):
    report_method: ReportMethod
    raw_input: Optional[str] = None
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    location_label: Optional[str] = None
    event_id: Optional[str] = None
    reporter_id: Optional[str] = None


class AIAnalysis(BaseModel):
    category: str
    severity: Severity
    severity_score: int = Field(..., ge=1, le=10)
    ai_summary: str
    recommended_resource_type: str


class DeduplicationResult(BaseModel):
    action: str  # "new" | "merged"
    canonical_id: Optional[str] = None
    confirmation_count: int = 1


class IncidentResponse(BaseModel):
    id: str
    report_method: str
    raw_input: Optional[str]
    category: Optional[str]
    severity: Optional[str]
    severity_score: Optional[int]
    ai_summary: Optional[str]
    recommended_resource_type: Optional[str]
    latitude: float
    longitude: float
    location_label: Optional[str]
    status: str
    confirmation_count: int
    event_id: Optional[str]
    created_at: str
    updated_at: str
    dedup: Optional[DeduplicationResult] = None


class IncidentListResponse(BaseModel):
    incidents: List[IncidentResponse]
    meta: dict


class IncidentStatusUpdate(BaseModel):
    status: IncidentStatus
    note: Optional[str] = None
    actor: Optional[str] = "dispatcher"


# ── Resource ──────────────────────────────────────────────────

class ResourceResponse(BaseModel):
    id: str
    name: str
    type: str
    status: str
    latitude: float
    longitude: float
    event_id: Optional[str]
    updated_at: str


class ResourceListResponse(BaseModel):
    resources: List[ResourceResponse]


# ── Dispatch ──────────────────────────────────────────────────

class DispatchCreate(BaseModel):
    incident_id: str
    resource_id: str
    notes: Optional[str] = None


class RoutePoint(BaseModel):
    lat: float
    lng: float


class DispatchResponse(BaseModel):
    id: str
    incident_id: str
    resource_id: str
    dispatched_at: str
    route: List[RoutePoint]
    eta_seconds: int
    resource: Optional[ResourceResponse] = None


# ── AI Brief ──────────────────────────────────────────────────

class SituationBrief(BaseModel):
    brief: str
    stats: dict
    generated_at: str


# ── Voice / Image ─────────────────────────────────────────────

class VoiceTranscriptionResponse(BaseModel):
    transcript: str
    language: Optional[str]
    duration_seconds: Optional[float]


class YOLODetection(BaseModel):
    label: str
    confidence: float
    bbox: List[float]  # [x1, y1, x2, y2] normalized


class ImageAnalysisResponse(BaseModel):
    detections: List[YOLODetection]
    emergency_detected: bool
    suggested_category: Optional[str]
    suggested_severity: Optional[Severity]