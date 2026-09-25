from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.db import engine, Base
from app.database import models
from app.api.health import router as health_router
from app.api.routes import router as routes_router
from app.api.index import router as index_router
from app.api.analytics import router as analytics_router
from app.api.ingest import router as ingest_router
from app.api.dashboard import router as dashboard_router
from app.api.backtest import router as backtest_router
from app.api.fares import router as fares_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create local SQLite tables; cloud PostgreSQL uses Prisma migrations."""
    if engine.dialect.name == "sqlite":
        Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(
    title="VAYUSETU - Real-time Airfare Price Index API",
    description="""
    ## Real-time Airfare Price Index for India
    Augmentation of Consumer Price Index (CPI) transport basket using automated scraping
    and DGCA domestic city-pair passenger traffic weights.
    
    ### Key Modules:
    - **Airfare Price Index**: DGCA-weighted matched price-relative index with base period 100.
    - **Routes & Weights**: Normalized DGCA city-pair traffic weights ($\\sum w_r = 1.0$).
    - **Data Ingestion**: High-throughput scraper ingestion API.
    - **Analytics**: 7-day price changes, rolling averages, and Z-score anomaly detection.
    """,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

DEFAULT_FRONTEND_ORIGINS = (
    "https://vayusetu-ten.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)
allowed_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("FRONTEND_ORIGINS", ",".join(DEFAULT_FRONTEND_ORIGINS)).split(",")
    if origin.strip()
]

# Permit only the deployed frontend and explicitly configured local/preview origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers (Direct root paths + /api prefix for versatility)
app.include_router(health_router)
app.include_router(routes_router)
app.include_router(index_router)
app.include_router(analytics_router)
app.include_router(ingest_router)
app.include_router(dashboard_router)
app.include_router(backtest_router)
app.include_router(fares_router)

# Also mount under /api prefix
app.include_router(health_router, prefix="/api")
app.include_router(routes_router, prefix="/api")
app.include_router(index_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(ingest_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(backtest_router, prefix="/api")
app.include_router(fares_router, prefix="/api")

@app.get("/", tags=["Root"], summary="API Root Overview")
def root():
    return {
        "name": "VAYUSETU - Real-time Airfare Price Index for India",
        "status": "online",
        "documentation": "/docs",
        "endpoints": {
            "health": "/health",
            "routes": "/routes",
            "index": "/index",
            "index_history": "/index/history",
            "analytics": "/analytics",
            "fare_status": "/fare-status",
            "ingest_fare": "/ingest/fare",
            "ingest_bulk": "/ingest/bulk",
            "compute_weights": "/ingest/compute-weights",
            "backtest": "/backtest?advance_purchase=7",
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("RELOAD", "false").lower() in {"1", "true", "yes"},
    )
