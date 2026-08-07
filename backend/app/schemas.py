from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Dict, List, Any, Optional

class LabReportBase(BaseModel):
    patient_name: str
    # Optional[float] allows null values for partially-extracted reports
    # (e.g. a real PDF that only contains 5 of the 8 standard parameters)
    test_values: Dict[str, Optional[float]]

class LabReportCreate(LabReportBase):
    pass

class LabReport(LabReportBase):
    id: int
    submitted_at: datetime
    priority: str                          # "Critical" | "Urgent" | "Normal"
    flagged_values: List[Dict[str, Any]]   # [{test_name, value, reason}]
    clinician_summary: str
    patient_summary: str
    processing_time_ms: Optional[int]  = None
    confidence_score:   Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class ExtractionResult(BaseModel):
    """Returned by POST /api/extract — extracted values before DB commit."""
    patient_name: str
    test_values: Dict[str, Optional[float]]
