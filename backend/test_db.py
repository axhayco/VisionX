import os
import pytest
from sqlalchemy import inspect
from fastapi.testclient import TestClient
try:
    from db import Base, engine, create_tables, SessionLocal
    from models import User, Report, UserRole, ReportStatus
    from main import app
except ImportError:
    from backend.db import Base, engine, create_tables, SessionLocal
    from backend.models import User, Report, UserRole, ReportStatus
    from backend.main import app


def test_create_tables_and_models_schema():
    create_tables()
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    assert "users" in tables
    assert "reports" in tables

    # Verify User columns
    user_columns = {col["name"]: col for col in inspector.get_columns("users")}
    assert "id" in user_columns
    assert "username" in user_columns
    assert "password_hash" in user_columns
    assert "role" in user_columns

    # Verify Report columns
    report_columns = {col["name"]: col for col in inspector.get_columns("reports")}
    expected_report_columns = [
        "id",
        "uploaded_by_id",
        "filename",
        "extracted_text",
        "flagged_values",
        "triage_level",
        "final_triage_level",
        "reasoning",
        "status",
        "doctor_notes",
        "reviewed_by_id",
        "created_at",
        "reviewed_at",
    ]
    for col_name in expected_report_columns:
        assert col_name in report_columns, f"Missing column: {col_name}"


def test_app_startup_creates_tables():
    with TestClient(app) as client:
        response = client.get("/")
        assert response.status_code == 200

        inspector = inspect(engine)
        tables = inspector.get_table_names()
        assert "users" in tables
        assert "reports" in tables


def test_db_session_and_model_crud():
    create_tables()
    db = SessionLocal()
    try:
        # Create test user
        user = User(
            username="test_doctor_unique_1",
            password_hash="hashed_pw_123",
            role=UserRole.DOCTOR,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        assert user.id is not None
        assert user.role == UserRole.DOCTOR

        # Create test report
        report = Report(
            uploaded_by_id=user.id,
            filename="cbc_test.pdf",
            extracted_text="Hemoglobin 8.0 g/dL",
            flagged_values=[{"test": "Hemoglobin", "value": "8.0", "flag": "Low"}],
            triage_level="Urgent",
            reasoning="Low Hemoglobin",
            status=ReportStatus.PENDING,
        )
        db.add(report)
        db.commit()
        db.refresh(report)

        assert report.id is not None
        assert report.uploaded_by_id == user.id
        assert report.status == ReportStatus.PENDING
        assert report.doctor_notes is None
        assert report.reviewed_at is None
        assert report.flagged_values[0]["test"] == "Hemoglobin"

        # Cleanup
        db.delete(report)
        db.delete(user)
        db.commit()
    finally:
        db.close()
