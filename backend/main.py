import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from core.config import get_settings
from routers import incidents, resources, dispatch, ai, events

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info(f"Sanjeevani AI backend starting — env={settings.app_env}")
    logger.info(f"CORS origins: {settings.cors_origins_list}")
    logger.info(f"YOLO enabled: {settings.yolo_enabled}")
    if settings.yolo_enabled:
        try:
            from services.yolo_service import get_yolo_model
            get_yolo_model()
        except Exception as e:
            logger.warning(f"YOLO preload failed (non-fatal): {e}")
    yield
    logger.info("Sanjeevani AI backend shutting down")


app = FastAPI(
    title="Sanjeevani AI — Emergency Response API",
    description="AI-powered emergency coordination for large-scale events",
    version="1.0.0",
    lifespan=lifespan,
)

settings = get_settings()

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    # In development allow all origins; in production restrict to listed origins
    allow_origins=["*"] if settings.app_env == "development" else settings.cors_origins_list,
    allow_credentials=False,  # Must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(incidents.router)
app.include_router(resources.router)
app.include_router(dispatch.router)
app.include_router(ai.router)
app.include_router(events.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "sanjeevani-ai", "version": "1.0.0"}


@app.get("/")
async def root():
    return {
        "message": "Sanjeevani AI Emergency Response API",
        "docs": "/docs",
        "health": "/health",
    }

from core.config import get_settings

settings = get_settings()
print("SUPABASE_URL =", settings.supabase_url)