import io
import logging
from PIL import Image
from core.config import get_settings
from models.schemas import YOLODetection, Severity

logger = logging.getLogger(__name__)

# Labels that indicate emergency situations
EMERGENCY_LABELS = {
    "person": None,  # context-dependent
    "fire": ("Fire", Severity.critical),
    "smoke": ("Fire", Severity.high),
    "crowd": ("Crowd Surge", Severity.high),
    "fallen_person": ("Medical Emergency", Severity.critical),
    "person_down": ("Medical Emergency", Severity.critical),
}

# Map YOLO COCO labels to emergency categories
COCO_EMERGENCY_MAP = {
    "fire": ("Fire", Severity.critical, 9),
    "smoke": ("Fire", Severity.high, 7),
}

_model = None


def get_yolo_model():
    global _model
    if _model is None:
        settings = get_settings()
        if not settings.yolo_enabled:
            return None
        try:
            from ultralytics import YOLO
            _model = YOLO(settings.yolo_model)
            logger.info("YOLOv8 model loaded")
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            _model = None
    return _model


def analyze_image(image_bytes: bytes) -> dict:
    """
    Run YOLOv8 on image bytes.
    Returns detections, emergency_detected, suggested_category, suggested_severity.
    """
    model = get_yolo_model()

    if model is None:
        return {
            "detections": [],
            "emergency_detected": False,
            "suggested_category": None,
            "suggested_severity": None,
            "error": "YOLO model not available",
        }

    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        results = model(image, verbose=False)

        detections = []
        person_count = 0
        emergency_category = None
        emergency_severity = None
        max_severity_score = 0

        img_w, img_h = image.size

        for result in results:
            for box in result.boxes:
                label = result.names[int(box.cls)]
                confidence = float(box.conf)
                x1, y1, x2, y2 = box.xyxy[0].tolist()

                # Normalize bbox
                bbox_norm = [x1/img_w, y1/img_h, x2/img_w, y2/img_h]

                detections.append(YOLODetection(
                    label=label,
                    confidence=round(confidence, 3),
                    bbox=bbox_norm,
                ))

                if label == "person":
                    person_count += 1

                if label in COCO_EMERGENCY_MAP:
                    cat, sev, score = COCO_EMERGENCY_MAP[label]
                    if score > max_severity_score:
                        emergency_category = cat
                        emergency_severity = sev
                        max_severity_score = score

        # Heuristic: large crowd detected
        if person_count >= 10 and emergency_category is None:
            emergency_category = "Crowd Surge"
            emergency_severity = Severity.high if person_count >= 20 else Severity.medium
        elif person_count >= 1 and emergency_category is None:
            emergency_category = "Medical Emergency"
            emergency_severity = Severity.medium

        return {
            "detections": [d.model_dump() for d in detections],
            "emergency_detected": emergency_category is not None,
            "suggested_category": emergency_category,
            "suggested_severity": emergency_severity.value if emergency_severity else None,
            "person_count": person_count,
        }

    except Exception as e:
        logger.error(f"YOLO analysis failed: {e}")
        return {
            "detections": [],
            "emergency_detected": False,
            "suggested_category": None,
            "suggested_severity": None,
            "error": str(e),
        }