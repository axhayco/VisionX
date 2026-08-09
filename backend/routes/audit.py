import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

try:
    from auth import require_role
    from db import get_db
    from models import AuditLog, Report, User
except ImportError:
    from backend.auth import require_role
    from backend.db import get_db
    from backend.models import AuditLog, Report, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/audit", tags=["Audit Logs"])


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    username: Optional[str] = None
    user_role: Optional[str] = None
    action: str
    report_id: int
    timestamp: str


@router.get("/{report_id}", response_model=List[AuditLogResponse])
def get_report_audit_logs(
    report_id: int,
    current_user: User = Depends(require_role("doctor")),
    db: Session = Depends(get_db),
):
    """Returns all audit log entries for a given report_id, showing who accessed

    the report and when. Requires doctor role.
    """
    try:
        report = db.query(Report).filter(Report.id == report_id).first()
    except Exception as e:
        logger.error("Database error querying report #%d: %s", report_id, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve audit log details.",
        )

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report #{report_id} not found.",
        )

    try:
        logs = (
            db.query(AuditLog)
            .filter(AuditLog.report_id == report_id)
            .order_by(AuditLog.timestamp.desc(), AuditLog.id.desc())
            .all()
        )

        results = []
        for log in logs:
            username = log.user.username if log.user else f"User #{log.user_id}"
            role_val = (
                log.user.role.value
                if log.user and hasattr(log.user.role, "value")
                else str(log.user.role)
                if log.user
                else "unknown"
            )
            results.append(
                AuditLogResponse(
                    id=log.id,
                    user_id=log.user_id,
                    username=username,
                    user_role=role_val,
                    action=log.action,
                    report_id=log.report_id,
                    timestamp=log.timestamp.isoformat() if log.timestamp else "",
                )
            )
        return results
    except Exception as e:
        logger.error("Failed to query audit logs for report #%d: %s", report_id, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve audit logs.",
        )
