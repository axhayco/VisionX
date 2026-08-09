import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

try:
    from models import Report
except ImportError:
    from backend.models import Report

logger = logging.getLogger(__name__)

REDACTED_TEXT = "[REDACTED - PHI Retention Expired (>24h)]"


def enforce_data_retention(db: Session, max_age_hours: int = 24) -> int:
    """Enforces data minimization and retention policies by redacting extracted PHI text

    from Report records that were created more than `max_age_hours` ago.

    Args:
        db: Active SQLAlchemy database session.
        max_age_hours: Threshold in hours beyond which raw lab text is wiped (default 24h).

    Returns:
        int: Number of reports sanitized.
    """
    cutoff_time = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)

    expired_reports = (
        db.query(Report)
        .filter(
            Report.created_at <= cutoff_time,
            Report.extracted_text != REDACTED_TEXT,
        )
        .all()
    )

    count = len(expired_reports)
    if count > 0:
        for report in expired_reports:
            report.extracted_text = REDACTED_TEXT
        db.commit()
        logger.info(
            "PHI Data Retention Policy: Successfully redacted raw text for %d report(s) older than %d hours.",
            count,
            max_age_hours,
        )

    return count
