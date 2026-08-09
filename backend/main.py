import asyncio
from contextlib import asynccontextmanager
import logging
import os
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

# Configure server-side logging format
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("vx.backend")

try:
    from auth import seed_demo_users
    from db import SessionLocal, create_tables
    from limiter import limiter
    from retention import enforce_data_retention
    from routes.audit import router as audit_router
    from routes.auth import router as auth_router
    from routes.reports import router as reports_router
    from routes.triage import router as triage_router
except ImportError:
    from backend.auth import seed_demo_users
    from backend.db import SessionLocal, create_tables
    from backend.limiter import limiter
    from backend.retention import enforce_data_retention
    from backend.routes.audit import router as audit_router
    from backend.routes.auth import router as auth_router
    from backend.routes.reports import router as reports_router
    from backend.routes.triage import router as triage_router

# Background retention task loop
async def retention_cleanup_worker():
    """Runs periodic PHI data retention cleanup every hour in the background."""
    while True:
        try:
            await asyncio.sleep(3600)  # Run every 1 hour
            with SessionLocal() as db:
                enforce_data_retention(db, max_age_hours=24)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Error in PHI data retention background task: %s", e, exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize SQLite database tables and seed demo users
    create_tables()
    seed_demo_users()

    # 2. Run initial PHI data retention cleanup on startup
    with SessionLocal() as db:
        enforce_data_retention(db, max_age_hours=24)

    # 3. Start background periodic cleanup worker
    worker_task = asyncio.create_task(retention_cleanup_worker())

    yield

    # Clean up worker on shutdown
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="AI-Powered Lab Report Triage API",
    description="HIPAA/PHI-conscious laboratory triage API with ML screening and role-based access control.",
    version="1.0.0",
    lifespan=lifespan,
)

# Attach SlowAPI limiter state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Restrict CORS to explicit frontend origins (default localhost:5173 for Vite dev)
allowed_origins_env = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global generic exception handler for unhandled exceptions to prevent stack trace leaks
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log the full exception and traceback on server side
    logger.error("Unhandled Exception processing %s %s: %s", request.method, request.url.path, exc, exc_info=True)

    # Return a safe, generic JSON response to the client
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please try again later."},
    )


# Include application routers
app.include_router(auth_router)
app.include_router(reports_router)
app.include_router(triage_router)
app.include_router(audit_router)


@app.get("/")
def read_root():
    return {"message": "Backend API is running"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
