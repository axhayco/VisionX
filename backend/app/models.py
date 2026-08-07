from sqlalchemy import Column, Integer, String, JSON, DateTime, Float
from datetime import datetime
from app.database import Base

class LabReport(Base):
    __tablename__ = "lab_reports"

    id = Column(Integer, primary_key=True, index=True)
    patient_name = Column(String, nullable=False)
    submitted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    test_values = Column(JSON, nullable=False)  # dict: test_name -> value
    priority = Column(String, nullable=False)     # "Critical" | "Urgent" | "Normal"
    flagged_values = Column(JSON, nullable=False) # list: {test_name, value, reason}
    clinician_summary = Column(String, nullable=False)
    patient_summary = Column(String, nullable=False)
    # Processing telemetry — nullable so existing records keep working
    processing_time_ms = Column(Integer, nullable=True)   # wall-clock ms for full pipeline
    confidence_score   = Column(Float,   nullable=True)   # 0–100 based on parameter completeness
