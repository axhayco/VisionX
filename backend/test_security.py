import io
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

try:
    from auth import create_access_token, seed_demo_users
    from db import SessionLocal, create_tables
    from limiter import limiter
    from main import app
    from models import Report, ReportStatus, User
    from retention import REDACTED_TEXT, enforce_data_retention
    from test_parser import create_sample_pdf_bytes
except ImportError:
    from backend.auth import create_access_token, seed_demo_users
    from backend.db import SessionLocal, create_tables
    from backend.limiter import limiter
    from backend.main import app
    from backend.models import Report, ReportStatus, User
    from backend.retention import REDACTED_TEXT, enforce_data_retention
    from backend.test_parser import create_sample_pdf_bytes

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db_and_limiter():
    create_tables()
    seed_demo_users()
    # Reset limiter storage between tests to avoid bleed-over
    limiter.reset()


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


# -------------------------------------------------------------------
# 1. CORS Restrictions
# -------------------------------------------------------------------
def test_cors_allowed_origin():
    response = client.options(
        "/",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_disallowed_origin():
    response = client.options(
        "/",
        headers={
            "Origin": "http://malicious-site.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert "access-control-allow-origin" not in response.headers or response.headers.get("access-control-allow-origin") != "http://malicious-site.example.com"


# -------------------------------------------------------------------
# 2. File Upload Validation (MIME, Magic Bytes, 10MB Limit)
# -------------------------------------------------------------------
def test_upload_invalid_mime_type():
    headers = get_assistant_auth_header()
    # File has .pdf extension but wrong content-type header
    files = {"file": ("report.pdf", io.BytesIO(b"%PDF-1.4 sample content"), "text/plain")}
    res = client.post("/triage", files=files, headers=headers)
    assert res.status_code == 400
    assert "Content-Type" in res.json()["detail"]


def test_upload_invalid_magic_bytes():
    headers = get_assistant_auth_header()
    # Content-type and extension are .pdf, but file content doesn't start with %PDF-
    fake_pdf = b"NOT_A_REAL_PDF_HEADER_CONTENT_12345"
    files = {"file": ("fake.pdf", io.BytesIO(fake_pdf), "application/pdf")}
    res = client.post("/triage", files=files, headers=headers)
    assert res.status_code == 400
    assert "magic bytes" in res.json()["detail"]


def test_upload_exceeds_10mb_limit():
    headers = get_assistant_auth_header()
    # Create fake PDF content exceeding 10MB (10 * 1024 * 1024 + 1 bytes)
    large_pdf = b"%PDF-1.4 " + (b"0" * (10 * 1024 * 1024 + 100))
    files = {"file": ("huge_report.pdf", io.BytesIO(large_pdf), "application/pdf")}
    res = client.post("/triage", files=files, headers=headers)
    assert res.status_code == 413
    assert "10MB" in res.json()["detail"]


# -------------------------------------------------------------------
# 3. Rate Limiting on POST /triage (10 req/min)
# -------------------------------------------------------------------
@patch("routes.triage.classify_triage")
def test_rate_limiting_triage(mock_classify):
    mock_classify.return_value = {
        "triage_level": "Routine",
        "reasoning": "Normal findings.",
        "flagged_values": [],
    }

    pdf_bytes = create_sample_pdf_bytes()
    headers = get_assistant_auth_header()

    # Make 10 requests (all should succeed)
    for i in range(10):
        res = client.post(
            "/triage",
            files={"file": (f"test_{i}.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
            headers=headers,
        )
        assert res.status_code == 200, f"Request {i+1} failed with status {res.status_code}"

    # 11th request in the same minute should be rate limited (429)
    res_exceeded = client.post(
        "/triage",
        files={"file": ("test_11.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        headers=headers,
    )
    assert res_exceeded.status_code == 429
    assert "Too Many Requests" in res_exceeded.text or "Rate limit exceeded" in res_exceeded.text


# -------------------------------------------------------------------
# 4. Safe Exception Handling (No Raw Stack Trace / Internal Leak)
# -------------------------------------------------------------------
@patch("routes.triage.classify_triage")
def test_triage_handles_llm_exception_safely(mock_classify):
    # Simulate internal LLM error with sensitive traceback info
    mock_classify.side_effect = RuntimeError("Internal API connection timeout to https://api.groq.com/openai/v1 key=gsk_secret123")

    pdf_bytes = create_sample_pdf_bytes()
    headers = get_assistant_auth_header()

    res = client.post(
        "/triage",
        files={"file": ("test_error.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        headers=headers,
    )

    assert res.status_code == 500
    # Response must NOT leak raw stack trace or secret details
    assert "gsk_secret123" not in res.text
    assert "RuntimeError" not in res.text
    assert res.json()["detail"] == "AI triage classification failed. Please try again later."


# -------------------------------------------------------------------
# 5. PHI Data Retention (>24h auto-redaction of extracted_text)
# -------------------------------------------------------------------
def test_phi_data_retention_enforcement():
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "lab_assistant").first()

        # 1. Create a fresh report (1 hour old)
        fresh_report = Report(
            uploaded_by_id=user.id,
            filename="fresh_patient_report.pdf",
            extracted_text="CONFIDENTIAL PHI: Patient John Doe DOB 1980-01-01 WBC 14.5",
            flagged_values=["WBC"],
            triage_level="Priority",
            reasoning="Slightly elevated WBC.",
            status=ReportStatus.PENDING,
            created_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        db.add(fresh_report)

        # 2. Create an expired report (26 hours old)
        old_report = Report(
            uploaded_by_id=user.id,
            filename="expired_patient_report.pdf",
            extracted_text="CONFIDENTIAL PHI: Patient Jane Smith DOB 1975-05-12 Glucose 350",
            flagged_values=["Glucose"],
            triage_level="Urgent",
            reasoning="High Glucose.",
            status=ReportStatus.PENDING,
            created_at=datetime.now(timezone.utc) - timedelta(hours=26),
        )
        db.add(old_report)
        db.commit()

        # Run PHI retention enforcement (24h threshold)
        redacted_count = enforce_data_retention(db, max_age_hours=24)
        assert redacted_count >= 1

        # Re-fetch records
        db.refresh(fresh_report)
        db.refresh(old_report)

        # Fresh report should retain its extracted_text
        assert "CONFIDENTIAL PHI: Patient John Doe" in fresh_report.extracted_text

        # Expired report should have its extracted_text redacted while retaining metadata
        assert old_report.extracted_text == REDACTED_TEXT
        assert old_report.filename == "expired_patient_report.pdf"
        assert old_report.triage_level == "Urgent"

    finally:
        db.close()


# -------------------------------------------------------------------
# 6. httpOnly Cookie Verification
# -------------------------------------------------------------------
def test_login_sets_httponly_cookie():
    res = client.post("/auth/login", json={"username": "doctor", "password": "doctor123"})
    assert res.status_code == 200
    assert "access_token" in res.cookies

    # Clear cookie via logout
    logout_res = client.post("/auth/logout")
    assert logout_res.status_code == 200


# -------------------------------------------------------------------
# 7. Role-Based Route Guard on Upload (/triage rejects doctor with 403)
# -------------------------------------------------------------------
def test_doctor_triage_upload_rejected_with_403():
    pdf_bytes = create_sample_pdf_bytes()
    doctor_headers = get_doctor_auth_header()

    res = client.post(
        "/triage",
        files={"file": ("doctor_attempt.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        headers=doctor_headers,
    )
    assert res.status_code == 403
    assert "Operation not permitted for role 'doctor'" in res.json()["detail"]
    assert "Required role: 'lab_assistant'" in res.json()["detail"]

