import io
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

try:
    from auth import create_access_token, seed_demo_users
    from db import SessionLocal, create_tables
    from main import app
    from models import AuditAction, AuditLog, Report, ReportStatus, User
    from test_parser import create_sample_pdf_bytes
except ImportError:
    from backend.auth import create_access_token, seed_demo_users
    from backend.db import SessionLocal, create_tables
    from backend.main import app
    from backend.models import AuditAction, AuditLog, Report, ReportStatus, User
    from backend.test_parser import create_sample_pdf_bytes

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    create_tables()
    seed_demo_users()


def get_assistant_auth_header():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "lab_assistant").first()
        token = create_access_token(
            data={"sub": user.username, "user_id": user.id, "role": user.role.value}
        )
        return {"Authorization": f"Bearer {token}"}
    finally:
        db.close()


def get_doctor_auth_header():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "doctor").first()
        token = create_access_token(
            data={"sub": user.username, "user_id": user.id, "role": user.role.value}
        )
        return {"Authorization": f"Bearer {token}"}
    finally:
        db.close()


@patch("routes.triage.classify_triage")
def test_audit_log_lifecycle(mock_classify):
    mock_classify.return_value = {
        "triage_level": "Priority",
        "reasoning": "Slight glucose elevation.",
        "flagged_values": ["Glucose"],
        "evidence": [{"value_text": "Glucose: 135 mg/dL", "reason": "Slight elevation"}],
    }

    assistant_headers = get_assistant_auth_header()
    doc_headers = get_doctor_auth_header()
    pdf_bytes = create_sample_pdf_bytes()

    # 1. Upload report as lab_assistant -> logs "uploaded_report"
    upload_res = client.post(
        "/triage",
        files={"file": ("audit_sample.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        headers=assistant_headers,
    )
    assert upload_res.status_code == 200
    report_id = upload_res.json()["id"]

    # 2. View report as doctor -> logs "viewed_report"
    view_res = client.get(f"/reports/{report_id}", headers=doc_headers)
    assert view_res.status_code == 200

    # 3. Review report as doctor -> logs "reviewed_report"
    review_res = client.patch(
        f"/reports/{report_id}/review",
        json={"final_triage_level": "Priority", "doctor_notes": "Confirmed priority follow-up."},
        headers=doc_headers,
    )
    assert review_res.status_code == 200

    # 4. Fetch audit logs as doctor -> GET /audit/{report_id}
    audit_res = client.get(f"/audit/{report_id}", headers=doc_headers)
    assert audit_res.status_code == 200
    logs = audit_res.json()

    assert len(logs) >= 3
    actions = [log["action"] for log in logs]
    assert "uploaded_report" in actions
    assert "viewed_report" in actions
    assert "reviewed_report" in actions

    # Check user identity in audit logs
    uploader_log = next(l for l in logs if l["action"] == "uploaded_report")
    assert uploader_log["username"] == "lab_assistant"
    assert uploader_log["user_role"] == "lab_assistant"
    assert uploader_log["report_id"] == report_id
    assert "timestamp" in uploader_log

    viewer_log = next(l for l in logs if l["action"] == "viewed_report")
    assert viewer_log["username"] == "doctor"
    assert viewer_log["user_role"] == "doctor"


def test_audit_rbac():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "doctor").first()
        sample_report = Report(
            uploaded_by_id=user.id,
            filename="rbac_test.pdf",
            extracted_text="Sample text",
            flagged_values=[],
            evidence=[],
            triage_level="Routine",
            reasoning="Normal",
            status=ReportStatus.PENDING,
        )
        db.add(sample_report)
        db.commit()
        report_id = sample_report.id
    finally:
        db.close()

    # 1. Unauthenticated -> 401
    res_unauth = client.get(f"/audit/{report_id}")
    assert res_unauth.status_code == 401

    # 2. Lab assistant -> 403 Forbidden (Doctor only)
    assistant_headers = get_assistant_auth_header()
    res_assistant = client.get(f"/audit/{report_id}", headers=assistant_headers)
    assert res_assistant.status_code == 403

    # 3. Doctor -> 200 OK
    doc_headers = get_doctor_auth_header()
    res_doc = client.get(f"/audit/{report_id}", headers=doc_headers)
    assert res_doc.status_code == 200

    # 4. Non-existent report -> 404
    res_not_found = client.get("/audit/999999", headers=doc_headers)
    assert res_not_found.status_code == 404
