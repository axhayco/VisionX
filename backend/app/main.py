import os
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import case, text

from app.database import engine, Base, get_db
from app import models, schemas
from app.classifier import classify_report
from app.llm_summary import generate_summary
from app.services.llm_extractor import extract_lab_values

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables for any NEW models (does not modify existing tables)
    try:
        Base.metadata.create_all(bind=engine)
        print("Database tables initialized successfully.")
    except Exception as e:
        print(f"Warning: Database initialization failed (check DATABASE_URL or password): {e}")


    # Lightweight SQLite migration — add new nullable columns to existing tables.
    # Uses try/except because SQLite raises OperationalError if column already exists.
    # This is the recommended zero-downtime migration pattern for SQLite MVPs.
    migration_stmts = [
        "ALTER TABLE lab_reports ADD COLUMN processing_time_ms INTEGER",
        "ALTER TABLE lab_reports ADD COLUMN confidence_score    REAL",
    ]
    # Try to add columns to the table if they are missing (for existing SQLite databases)
    # On PostgreSQL/Supabase, if the table is new, create_all already created them.
    for stmt in migration_stmts:
        try:
            with engine.begin() as conn:
                conn.execute(text(stmt))
        except Exception:
            pass  # Ignored if column already exists (sqlite/postgresql duplicate column error)
    yield


app = FastAPI(
    title="AI Lab Report Triage API",
    description="Backend API for classifying and summarizing medical lab reports.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for cross-origin development (Vite runs on port 5173, FastAPI on 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API ENDPOINTS ---

@app.post("/api/reports", response_model=schemas.LabReport, status_code=status.HTTP_201_CREATED)
def create_report(report_in: schemas.LabReportCreate, db: Session = Depends(get_db)):
    t_start = time.perf_counter()

    # 1. Run core classification engine
    priority, flagged_values = classify_report(report_in.test_values)

    # 2. Run LLM summary logic
    clinician_summary, patient_summary = generate_summary(
        patient_name=report_in.patient_name,
        flagged_values=flagged_values,
        priority=priority
    )

    # 3. Compute processing telemetry
    processing_time_ms = int((time.perf_counter() - t_start) * 1000)
    # Confidence: percentage of the 8 standard parameters that contain a real numeric value
    total_params = 8
    provided     = sum(1 for v in report_in.test_values.values() if v is not None and not (isinstance(v, float) and v != v))
    confidence_score = round((provided / total_params) * 100, 1)

    # 4. Store in SQLite
    db_report = models.LabReport(
        patient_name=report_in.patient_name,
        test_values=report_in.test_values,
        priority=priority,
        flagged_values=flagged_values,
        clinician_summary=clinician_summary,
        patient_summary=patient_summary,
        processing_time_ms=processing_time_ms,
        confidence_score=confidence_score,
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


@app.post("/api/extract", response_model=schemas.ExtractionResult)
async def extract_report_values(file: UploadFile = File(...)):
    """
    Stateless extraction endpoint.
    Reads an uploaded PDF or image, runs PyMuPDF + LLM extraction,
    and returns structured {patient_name, test_values} WITHOUT saving to DB.
    The frontend shows these values in a verify table before the user confirms.
    """
    allowed_exts = {"pdf", "png", "jpg", "jpeg"}
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported file type '.{ext}'. Upload a PDF, PNG, JPG, or JPEG."
        )
    try:
        file_bytes = await file.read()
        result = extract_lab_values(file_bytes, file.filename)
        return result
    except ValueError as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Extraction failed: {str(e)}"
        )

@app.get("/api/reports", response_model=list[schemas.LabReport])
def list_reports(db: Session = Depends(get_db)):
    # Sort order: Critical (1) -> Urgent (2) -> Normal (3), then by submitted_at (newest first)
    priority_order = case(
        {
            "Critical": 1,
            "Urgent": 2,
            "Normal": 3
        },
        value=models.LabReport.priority
    )
    reports = db.query(models.LabReport).order_by(
        priority_order,
        models.LabReport.submitted_at.desc()
    ).all()
    return reports

@app.get("/api/reports/{report_id}", response_model=schemas.LabReport)
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(models.LabReport).filter(models.LabReport.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lab report with ID {report_id} not found"
        )
    return report

@app.delete("/api/reports/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(report_id: int, db: Session = Depends(get_db)):
    """Hard-delete a lab report record. Used by testers and the dashboard UI."""
    report = db.query(models.LabReport).filter(models.LabReport.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lab report with ID {report_id} not found"
        )
    db.delete(report)
    db.commit()

@app.get("/api/health")
def health_check():
    """Liveness probe for load balancers, Docker healthchecks, and uptime monitors."""
    return {"status": "ok", "version": "1.0.0", "service": "VisionX Triage API"}

# --- STATIC FRONTEND ASSETS ---

# Locate the static build folder compiled by Vite (frontend/dist -> backend/app/static)
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    # Mount the /assets subfolder for React bundle files
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
        
    # Catch-all to serve index.html for standard paths (excluding /api)
    @app.get("/{catchall:path}")
    def serve_frontend(catchall: str):
        if catchall.startswith("api"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        index_path = os.path.join(static_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {"message": "Static folder is present but index.html is missing. Run frontend build first."}
else:
    @app.get("/{catchall:path}")
    def serve_fallback(catchall: str):
        if catchall.startswith("api"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        return {"message": "Frontend build assets not found. Run 'run.py' or build the Vite app."}
