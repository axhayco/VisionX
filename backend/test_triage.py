import io
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

try:
    from auth import create_access_token, seed_demo_users
    from db import create_tables, SessionLocal
    from main import app
    from models import Report, User, UserRole
    from test_parser import create_sample_pdf_bytes
except ImportError:
    from backend.auth import create_access_token, seed_demo_users
    from backend.db import create_tables, SessionLocal
    from backend.main import app
    from backend.models import Report, User, UserRole
    from backend.test_parser import create_sample_pdf_bytes

client = TestClient(app)


@pytest.fixture(autouse=True)
def init_db():
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


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Backend API is running"}


def test_triage_requires_auth():
    pdf_bytes = create_sample_pdf_bytes()
    files = {"file": ("sample_report.pdf", io.BytesIO(pdf_bytes), "application/pdf")}

    # No auth header -> 401
    response = client.post("/triage", files=files)
    assert response.status_code == 401

    # Doctor auth header -> 403 Forbidden
    doc_headers = get_doctor_auth_header()
    response_doc = client.post("/triage", files={"file": ("sample_report.pdf", io.BytesIO(pdf_bytes), "application/pdf")}, headers=doc_headers)
    assert response_doc.status_code == 403


@patch("routes.triage.classify_triage")
def test_triage_pdf_upload_and_save(mock_classify):
    mock_classify.return_value = {
        "triage_level": "Routine",
        "reasoning": "All lab values are within normal reference ranges.",
        "flagged_values": [],
        "evidence": [],
    }

    pdf_bytes = create_sample_pdf_bytes()
    files = {"file": ("sample_report.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    headers = get_assistant_auth_header()

    response = client.post("/triage", files=files, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert data["id"] is not None
    assert data["triage_level"] == "Routine"
    assert data["status"] == "pending"
    assert data["filename"] == "sample_report.pdf"
    assert "reasoning" in data
    assert data["flagged_values"] == []
    assert "evidence" in data
    assert data["evidence"] == []


def test_triage_non_pdf():
    files = {"file": ("sample.txt", io.BytesIO(b"hello world"), "text/plain")}
    headers = get_assistant_auth_header()
    response = client.post("/triage", files=files, headers=headers)
    assert response.status_code == 400


@patch("routes.triage.classify_triage")
def test_get_my_reports(mock_classify):
    mock_classify.return_value = {
        "triage_level": "Critical",
        "reasoning": "Critically elevated troponin levels.",
        "flagged_values": [{"test": "Troponin I", "value": "2.5", "flag": "High"}],
    }

    headers = get_assistant_auth_header()
    pdf_bytes = create_sample_pdf_bytes()

    # Upload report 1
    client.post(
        "/triage",
        files={"file": ("report_1.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        headers=headers,
    )

    # Upload report 2
    client.post(
        "/triage",
        files={"file": ("report_2.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        headers=headers,
    )

    # Query /reports/mine
    mine_res = client.get("/reports/mine", headers=headers)
    assert mine_res.status_code == 200
    reports = mine_res.json()
    assert len(reports) >= 2
    assert reports[0]["filename"] == "report_2.pdf"  # Most recent first
    assert reports[0]["status"] == "pending"

    # Doctor forbidden from /reports/mine
    doc_headers = get_doctor_auth_header()
    doc_res = client.get("/reports/mine", headers=doc_headers)
    assert doc_res.status_code == 403

    # Unauthenticated forbidden
    unauth_res = client.get("/reports/mine")
    assert unauth_res.status_code == 401
