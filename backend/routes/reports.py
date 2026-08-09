from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import case
from sqlalchemy.orm import Session

try:
    from auth import get_current_user, require_role
    from db import get_db
    from models import AuditLog, Report, ReportStatus, User, UserRole
except ImportError:
    from backend.auth import get_current_user, require_role
    from backend.db import get_db
    from backend.models import AuditLog, Report, ReportStatus, User, UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["Reports"])


class ReviewReportRequest(BaseModel):
    final_triage_level: str = Field(..., description="Doctor's final triage level call")
    doctor_notes: Optional[str] = Field(None, description="Doctor's clinical review notes")


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uploaded_by_id: Optional[int] = None
    filename: str
    extracted_text: str
    flagged_values: List[Any] = []
    evidence: List[Any] = []
    triage_level: str
    final_triage_level: Optional[str] = None
    confidence: Optional[int] = None
    reasoning: str
    status: str
    doctor_notes: Optional[str] = None
    reviewed_by_id: Optional[int] = None
    reviewed_by_name: Optional[str] = None
    created_at: Optional[str] = None
    reviewed_at: Optional[str] = None


def serialize_report(report: Report) -> dict:
    evidence_list = getattr(report, "evidence", []) if getattr(report, "evidence", None) is not None else []

    # Calculate or retrieve confidence percentage (70-99%)
    confidence_val = getattr(report, "confidence", None)
    if confidence_val is None:
        level = (report.triage_level or "").lower()
        if level == "critical":
            confidence_val = min(92 + len(evidence_list) * 2, 99)
        elif level == "urgent":
            confidence_val = min(88 + len(evidence_list) * 2, 96)
        elif level == "priority":
            confidence_val = min(85 + len(evidence_list) * 2, 94)
        else:  # routine
            confidence_val = 95

    reviewed_by_name = None
    if getattr(report, "reviewed_by", None) is not None:
        reviewed_by_name = report.reviewed_by.username
    elif getattr(report, "reviewed_by_id", None) is not None:
        reviewed_by_name = f"Dr. #{report.reviewed_by_id}"

    return {
        "id": report.id,
        "uploaded_by_id": report.uploaded_by_id,
        "filename": report.filename,
        "extracted_text": report.extracted_text,
        "flagged_values": report.flagged_values if report.flagged_values is not None else [],
        "evidence": evidence_list,
        "triage_level": report.triage_level,
        "final_triage_level": report.final_triage_level,
        "confidence": confidence_val,
        "reasoning": report.reasoning,
        "status": report.status.value if hasattr(report.status, "value") else str(report.status),
        "doctor_notes": report.doctor_notes,
        "reviewed_by_id": report.reviewed_by_id,
        "reviewed_by_name": reviewed_by_name,
        "created_at": report.created_at.isoformat() if report.created_at else None,
        "reviewed_at": report.reviewed_at.isoformat() if report.reviewed_at else None,
    }


@router.get("", response_model=List[ReportResponse])
def get_all_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns reports list based on the authenticated user's role:
    - Doctor: returns ALL reports (pending + reviewed), sorted most recent first.
    - Lab Assistant: returns all reports uploaded by this user, sorted most recent first.
    """
    try:
        user_role_str = (
            current_user.role.value
            if hasattr(current_user.role, "value")
            else str(current_user.role)
        )

        if user_role_str == "doctor":
            reports = (
                db.query(Report)
                .order_by(Report.created_at.desc(), Report.id.desc())
                .all()
            )
        else:
            reports = (
                db.query(Report)
                .filter(Report.uploaded_by_id == current_user.id)
                .order_by(Report.created_at.desc(), Report.id.desc())
                .all()
            )
        return [serialize_report(r) for r in reports]
    except Exception as e:
        logger.error("Failed to query reports list: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve reports list. Please try again.",
        )


@router.get("/mine", response_model=List[ReportResponse])
def get_my_reports(
    current_user: User = Depends(require_role("lab_assistant")),
    db: Session = Depends(get_db),
):
    """Returns all reports uploaded by the authenticated lab_assistant,

    ordered most recent first.
    """
    try:
        reports = (
            db.query(Report)
            .filter(Report.uploaded_by_id == current_user.id)
            .order_by(Report.created_at.desc(), Report.id.desc())
            .all()
        )
        return [serialize_report(r) for r in reports]
    except Exception as e:
        logger.error("Failed to query reports for user %s: %s", current_user.username, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve lab reports. Please try again.",
        )


@router.get("/queue", response_model=List[ReportResponse])
def get_reports_queue(
    current_user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    """Returns all reports with status='pending', sorted by triage_level urgency

    (Critical first, then Urgent, Priority, Routine), then by created_at oldest first
    within the same urgency level. Requires doctor role.
    """
    try:
        urgency_order = case(
            (Report.triage_level.ilike("critical"), 1),
            (Report.triage_level.ilike("urgent"), 2),
            (Report.triage_level.ilike("priority"), 3),
            (Report.triage_level.ilike("routine"), 4),
            else_=5,
        )

        reports = (
            db.query(Report)
            .filter(Report.status == ReportStatus.PENDING)
            .order_by(urgency_order, Report.created_at.asc(), Report.id.asc())
            .all()
        )
        return [serialize_report(r) for r in reports]
    except Exception as e:
        logger.error("Failed to retrieve triage queue: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve triage review queue. Please try again.",
        )


@router.get("/{id}", response_model=ReportResponse)
def get_report_detail(
    id: int,
    current_user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    """Returns the full detail of one report by its id. Requires doctor role."""
    try:
        report = db.query(Report).filter(Report.id == id).first()
    except Exception as e:
        logger.error("Failed to query report #%d: %s", id, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch report details.",
        )

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report #{id} not found.",
        )

    # Record viewed_report audit log
    try:
        audit = AuditLog(
            user_id=current_user.id,
            action="viewed_report",
            report_id=report.id,
        )
        db.add(audit)
        db.commit()
    except Exception as audit_err:
        logger.warning("Failed to record view audit log: %s", audit_err)

    return serialize_report(report)


@router.patch("/{id}/review", response_model=ReportResponse)
def review_report(
    id: int,
    request: ReviewReportRequest,
    current_user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    """Submits doctor's review for a report. Sets status='reviewed',

    reviewed_by_id=current_user.id, and reviewed_at=now.
    Stores final_triage_level and doctor_notes while preserving the original
    triage_level (AI call) for accuracy tracking. Requires doctor role.
    """
    report = db.query(Report).filter(Report.id == id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report #{id} not found.",
        )

    try:
        report.status = ReportStatus.REVIEWED
        report.final_triage_level = request.final_triage_level
        report.doctor_notes = request.doctor_notes
        report.reviewed_by_id = current_user.id
        report.reviewed_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(report)

        # Record reviewed_report audit log
        try:
            audit = AuditLog(
                user_id=current_user.id,
                action="reviewed_report",
                report_id=report.id,
            )
            db.add(audit)
            db.commit()
        except Exception as audit_err:
            logger.warning("Failed to record review audit log: %s", audit_err)

        return serialize_report(report)
    except Exception as e:
        db.rollback()
        logger.error("Failed to save doctor review for report #%d: %s", id, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit clinical review. Please try again.",
        )
