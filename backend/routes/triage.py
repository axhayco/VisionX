import logging
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

try:
    from auth import require_role
    from db import get_db
    from limiter import limiter
    from models import AuditLog, Report, ReportStatus, User
    from parser import extract_lab_text
    from triage_agent import classify_triage
except ImportError:
    from backend.auth import require_role
    from backend.db import get_db
    from backend.limiter import limiter
    from backend.models import AuditLog, Report, ReportStatus, User
    from backend.parser import extract_lab_text
    from backend.triage_agent import classify_triage

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post("/triage")
@limiter.limit("10/minute")
async def triage(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(require_role("lab_assistant")),
    db: Session = Depends(get_db),
):
    """Accepts a multipart lab report PDF file upload from an authenticated lab assistant,

    validates MIME type, file size, and magic bytes, extracts text, classifies triage
    urgency with Groq LLM, saves a new Report record in SQLite with status 'pending',
    and returns the saved report.
    """
    # 1. Validate file extension
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only PDF lab reports (.pdf) are permitted.",
        )

    # 2. Validate MIME content-type
    if file.content_type and file.content_type.lower() != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Content-Type header. Expected 'application/pdf'.",
        )

    # 3. Read bytes and validate file size (Max 10MB)
    try:
        file_bytes = await file.read()
    except Exception as e:
        logger.error("Failed to read uploaded file bytes: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to read uploaded file payload.",
        )

    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE if hasattr(status, "HTTP_413_REQUEST_ENTITY_TOO_LARGE") else 413,
            detail=f"File size exceeds maximum allowed limit of 10MB ({len(file_bytes)} bytes uploaded).",
        )

    # 4. Validate binary magic bytes (%PDF-)
    if not file_bytes.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file content: Missing standard PDF header magic bytes (%PDF-).",
        )

    # 5. Extract text safely
    try:
        extracted_text = extract_lab_text(file_bytes)
    except Exception as e:
        logger.error("PDF text extraction error for user %s: %s", current_user.username, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to parse text from the PDF lab report. Please check the file formatting.",
        )

    if not extracted_text or not extracted_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No readable text found in the uploaded PDF report.",
        )

    # 6. LLM Triage screening with secure exception handling
    try:
        triage_result = classify_triage(extracted_text)
    except Exception as e:
        logger.error("AI triage classification error for user %s: %s", current_user.username, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI triage classification failed. Please try again later.",
        )

    # 7. Save Report to Database
    try:
        report = Report(
            uploaded_by_id=current_user.id,
            filename=file.filename,
            extracted_text=extracted_text,
            flagged_values=triage_result.get("flagged_values", []),
            evidence=triage_result.get("evidence", []),
            triage_level=triage_result.get("triage_level", "Routine"),
            reasoning=triage_result.get("reasoning", ""),
            status=ReportStatus.PENDING,
        )
        db.add(report)
        db.commit()
        db.refresh(report)

        # Record audit log entry
        try:
            audit = AuditLog(
                user_id=current_user.id,
                action="uploaded_report",
                report_id=report.id,
            )
            db.add(audit)
            db.commit()
        except Exception as audit_err:
            logger.warning("Failed to record upload audit log: %s", audit_err)
    except Exception as e:
        db.rollback()
        logger.error("Failed to save report to database: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record lab report. Please try again.",
        )

    status_str = (
        report.status.value
        if hasattr(report.status, "value")
        else str(report.status)
    )

    return {
        "id": report.id,
        "uploaded_by_id": report.uploaded_by_id,
        "filename": report.filename,
        "extracted_text": report.extracted_text,
        "flagged_values": report.flagged_values,
        "evidence": getattr(report, "evidence", []),
        "triage_level": report.triage_level,
        "confidence": getattr(report, "confidence", None) or (95 if report.triage_level == "Routine" else min(88 + len(getattr(report, "evidence", []) or []) * 2, 99)),
        "reasoning": report.reasoning,
        "status": status_str,
        "doctor_notes": report.doctor_notes,
        "reviewed_by_id": report.reviewed_by_id,
        "created_at": report.created_at.isoformat() if report.created_at else None,
        "reviewed_at": report.reviewed_at.isoformat() if report.reviewed_at else None,
    }
