import io
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Lab Report Triage Backend is running."}


def test_triage_file_upload():
    # Simulate a file upload
    file_content = b"Mock lab report text content"
    files = {"file": ("report.txt", io.BytesIO(file_content), "text/plain")}

    response = client.post("/triage", files=files)
    assert response.status_code == 200
    assert response.json() == {
        "urgency": "Routine",
        "reasoning": "test",
    }
