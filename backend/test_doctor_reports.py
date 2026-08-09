import time
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

try:
    from auth import create_access_token, seed_demo_users
    from db import SessionLocal, create_tables
    from main import app
    from models import Report, ReportStatus, User, UserRole
except ImportError:
    from backend.auth import create_access_token, seed_demo_users
    from backend.db import SessionLocal, create_tables
    from backend.main import app
    from backend.models import Report, ReportStatus, User, UserRole

client = TestClient(app)


@pytest.fixture(autouse=True)
def init_db():
    create_tables()
    seed_demo_users()


def get_token_header(username: str, role: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        token = create_access_token(
            data={"sub": user.username, "user_id": user.id, "role": user.role.value if hasattr(user.role, "value") else str(user.role)}
        )
        return {"Authorization": f"Bearer {token}"}
    finally:
        db.close()


def test_doctor_queue_sorting_and_permissions():
    doc_headers = get_token_header("doctor", "doctor")
    asst_headers = get_token_header("lab_assistant", "lab_assistant")

    # Unauthenticated -> 401
    assert client.get("/reports/queue").status_code == 401
    # Lab Assistant -> 403
    assert client.get("/reports/queue", headers=asst_headers).status_code == 403

    # Seed reports with different triage levels and timestamps
    db = SessionLocal()
    try:
        # Clear existing reports for predictable queue test
        db.query(Report).delete()
        db.commit()

        asst = db.query(User).filter(User.username == "lab_assistant").first()

        now = datetime.now(timezone.utc)
        r_routine = Report(
            uploaded_by_id=asst.id,
            filename="routine.pdf",
            extracted_text="normal",
            flagged_values=[],
            triage_level="Routine",
            reasoning="All normal",
            status=ReportStatus.PENDING,
            created_at=now - timedelta(minutes=10),
        )
        r_urgent_old = Report(
            uploaded_by_id=asst.id,
            filename="urgent_old.pdf",
            extracted_text="urgent old",
            flagged_values=[],
            triage_level="Urgent",
            reasoning="Elevated marker",
            status=ReportStatus.PENDING,
            created_at=now - timedelta(minutes=20),
        )
        r_urgent_new = Report(
            uploaded_by_id=asst.id,
            filename="urgent_new.pdf",
            extracted_text="urgent new",
            flagged_values=[],
            triage_level="Urgent",
            reasoning="Elevated marker",
            status=ReportStatus.PENDING,
            created_at=now - timedelta(minutes=5),
        )
        r_critical = Report(
            uploaded_by_id=asst.id,
            filename="critical.pdf",
            extracted_text="critical",
            flagged_values=[],
            triage_level="Critical",
            reasoning="Extreme values",
            status=ReportStatus.PENDING,
            created_at=now - timedelta(minutes=2),
        )
        r_priority = Report(
            uploaded_by_id=asst.id,
            filename="priority.pdf",
            extracted_text="priority",
            flagged_values=[],
            triage_level="Priority",
            reasoning="Borderline values",
            status=ReportStatus.PENDING,
            created_at=now - timedelta(minutes=15),
        )
        r_reviewed = Report(
            uploaded_by_id=asst.id,
            filename="already_reviewed.pdf",
            extracted_text="reviewed",
            flagged_values=[],
            triage_level="Critical",
            reasoning="Was critical",
            status=ReportStatus.REVIEWED,
            created_at=now - timedelta(minutes=30),
        )

        db.add_all([r_routine, r_urgent_old, r_urgent_new, r_critical, r_priority, r_reviewed])
        db.commit()
    finally:
        db.close()

    # Query queue as doctor
    res = client.get("/reports/queue", headers=doc_headers)
    assert res.status_code == 200
    queue = res.json()

    # Should only contain pending reports (5 reports, r_reviewed excluded)
    assert len(queue) == 5

    # Check order: Critical -> Urgent (oldest first) -> Urgent (newer) -> Priority -> Routine
    filenames = [item["filename"] for item in queue]
    assert filenames == [
        "critical.pdf",
        "urgent_old.pdf",
        "urgent_new.pdf",
        "priority.pdf",
        "routine.pdf",
    ]


def test_get_report_detail_and_review():
    doc_headers = get_token_header("doctor", "doctor")
    asst_headers = get_token_header("lab_assistant", "lab_assistant")

    # Create a pending report
    db = SessionLocal()
    try:
        asst = db.query(User).filter(User.username == "lab_assistant").first()
        report = Report(
            uploaded_by_id=asst.id,
            filename="patient_cbc.pdf",
            extracted_text="Hemoglobin 7.1 g/dL",
            flagged_values=[{"test": "Hemoglobin", "value": "7.1", "flag": "Low"}],
            triage_level="Urgent",
            reasoning="AI assessed moderate-severe anemia.",
            status=ReportStatus.PENDING,
        )
        db.add(report)
        db.commit()
        db.refresh(report)
        report_id = report.id
    finally:
        db.close()

    # Permissions on GET /reports/{id}
    assert client.get(f"/reports/{report_id}").status_code == 401
    assert client.get(f"/reports/{report_id}", headers=asst_headers).status_code == 403

    # Doctor gets detail
    detail_res = client.get(f"/reports/{report_id}", headers=doc_headers)
    assert detail_res.status_code == 200
    detail_data = detail_res.json()
    assert detail_data["id"] == report_id
    assert detail_data["triage_level"] == "Urgent"
    assert detail_data["final_triage_level"] is None
    assert detail_data["status"] == "pending"

    # Non-existent report -> 404
    assert client.get("/reports/999999", headers=doc_headers).status_code == 404
    assert client.patch("/reports/999999/review", json={"final_triage_level": "Critical"}, headers=doc_headers).status_code == 404

    # Doctor submits review with modified final_triage_level
    review_payload = {
        "final_triage_level": "Critical",
        "doctor_notes": "Patient is symptomatic with critical Hb drop. Immediate transfusion workup required.",
    }
    review_res = client.patch(
        f"/reports/{report_id}/review",
        json=review_payload,
        headers=doc_headers,
    )
    assert review_res.status_code == 200
    reviewed_data = review_res.json()

    # Verify updated fields
    assert reviewed_data["status"] == "reviewed"
    assert reviewed_data["doctor_notes"] == review_payload["doctor_notes"]
    assert reviewed_data["final_triage_level"] == "Critical"
    # Original AI triage level MUST be preserved for accuracy comparison
    assert reviewed_data["triage_level"] == "Urgent"
    assert reviewed_data["reviewed_by_id"] is not None
    assert reviewed_data["reviewed_at"] is not None

    # Verify report is no longer in pending queue
    queue_res = client.get("/reports/queue", headers=doc_headers)
    assert queue_res.status_code == 200
    queue_ids = [r["id"] for r in queue_res.json()]
    assert report_id not in queue_ids


def test_get_all_reports_role_based():
    doc_headers = get_token_header("doctor", "doctor")
    asst_headers = get_token_header("lab_assistant", "lab_assistant")

    # Unauthenticated -> 401
    assert client.get("/reports").status_code == 401

    # Doctor gets ALL reports (both pending and reviewed)
    doc_res = client.get("/reports", headers=doc_headers)
    assert doc_res.status_code == 200
    all_reports = doc_res.json()
    assert isinstance(all_reports, list)

    # Lab assistant gets only their reports
    asst_res = client.get("/reports", headers=asst_headers)
    assert asst_res.status_code == 200
    my_reports = asst_res.json()
    assert isinstance(my_reports, list)

