from datetime import datetime, timezone
import enum
from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

try:
    from .db import Base
except ImportError:
    try:
        from db import Base
    except ImportError:
        from backend.db import Base


class UserRole(str, enum.Enum):
    DOCTOR = "doctor"
    LAB_ASSISTANT = "lab_assistant"


class ReportStatus(str, enum.Enum):
    PENDING = "pending"
    REVIEWED = "reviewed"


class AuditAction(str, enum.Enum):
    VIEWED_REPORT = "viewed_report"
    REVIEWED_REPORT = "reviewed_report"
    UPLOADED_REPORT = "uploaded_report"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole, name="user_role", values_callable=lambda x: [e.value for e in x]), nullable=False)

    # Relationships
    uploaded_reports = relationship(
        "Report",
        foreign_keys="[Report.uploaded_by_id]",
        back_populates="uploaded_by",
        cascade="all, delete-orphan",
    )
    reviewed_reports = relationship(
        "Report",
        foreign_keys="[Report.reviewed_by_id]",
        back_populates="reviewed_by",
    )

    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', role='{self.role}')>"


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    filename = Column(String(255), nullable=False)
    extracted_text = Column(Text, nullable=False)
    flagged_values = Column(JSON, nullable=False, default=list)
    evidence = Column(JSON, nullable=False, default=list)
    triage_level = Column(String(50), nullable=False)
    final_triage_level = Column(String(50), nullable=True)
    reasoning = Column(Text, nullable=False)
    status = Column(
        Enum(ReportStatus, name="report_status", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=ReportStatus.PENDING,
    )
    doctor_notes = Column(Text, nullable=True)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id], back_populates="uploaded_reports")
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id], back_populates="reviewed_reports")

    def __repr__(self):
        return f"<Report(id={self.id}, filename='{self.filename}', triage_level='{self.triage_level}', status='{self.status}')>"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(50), nullable=False)  # "viewed_report" | "reviewed_report" | "uploaded_report"
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False, index=True)
    timestamp = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    user = relationship("User")
    report = relationship("Report")

    def __repr__(self):
        return f"<AuditLog(id={self.id}, user_id={self.user_id}, action='{self.action}', report_id={self.report_id})>"
