from datetime import timedelta
import jwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

try:
    from auth import (
        ALGORITHM,
        SECRET_KEY,
        create_access_token,
        get_current_user,
        get_password_hash,
        require_role,
        seed_demo_users,
        verify_password,
    )
    from db import Base, SessionLocal, create_tables, engine
    from main import app
    from models import User, UserRole
except ImportError:
    from backend.auth import (
        ALGORITHM,
        SECRET_KEY,
        create_access_token,
        get_current_user,
        get_password_hash,
        require_role,
        seed_demo_users,
        verify_password,
    )
    from backend.db import Base, SessionLocal, create_tables, engine
    from backend.main import app
    from backend.models import User, UserRole

# Protected app for testing dependency guards
protected_app = FastAPI()


@protected_app.get("/doctor-only")
def doctor_route(user: User = Depends(require_role(UserRole.DOCTOR))):
    return {"status": "ok", "user": user.username, "role": user.role.value}


@protected_app.get("/assistant-only")
def assistant_route(user: User = Depends(require_role(UserRole.LAB_ASSISTANT))):
    return {"status": "ok", "user": user.username, "role": user.role.value}


@pytest.fixture(autouse=True)
def setup_db():
    create_tables()
    seed_demo_users()


def test_password_hashing():
    pw = "SecretPassword123!"
    hashed = get_password_hash(pw)
    assert hashed != pw
    assert verify_password(pw, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_seed_demo_users():
    db = SessionLocal()
    try:
        doctor = db.query(User).filter(User.username == "doctor").first()
        assistant = db.query(User).filter(User.username == "lab_assistant").first()

        assert doctor is not None
        assert doctor.role == UserRole.DOCTOR
        assert verify_password("doctor123", doctor.password_hash) is True

        assert assistant is not None
        assert assistant.role == UserRole.LAB_ASSISTANT
        assert verify_password("assistant123", assistant.password_hash) is True

        # Running seed again should be idempotent
        seed_demo_users(db)
        doctor_count = db.query(User).filter(User.username == "doctor").count()
        assert doctor_count == 1
    finally:
        db.close()


def test_register_and_login_flow():
    client = TestClient(app)

    # Register new doctor
    reg_payload = {
        "username": "new_registered_doctor",
        "password": "strongPassword123",
        "role": "doctor",
    }
    reg_res = client.post("/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["username"] == "new_registered_doctor"
    assert reg_data["user"]["role"] == "doctor"

    # Register duplicate username
    dup_res = client.post("/auth/register", json=reg_payload)
    assert dup_res.status_code == 400

    # Login with valid credentials
    login_res = client.post(
        "/auth/login",
        json={"username": "new_registered_doctor", "password": "strongPassword123"},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data

    # Decode token and verify embedded role claim
    token = login_data["access_token"]
    decoded = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert decoded["sub"] == "new_registered_doctor"
    assert decoded["role"] == "doctor"
    assert "user_id" in decoded

    # Login with incorrect password
    bad_login = client.post(
        "/auth/login",
        json={"username": "new_registered_doctor", "password": "incorrectPassword"},
    )
    assert bad_login.status_code == 401

    # Login with non-existent user
    non_user_login = client.post(
        "/auth/login",
        json={"username": "non_existent_user_999", "password": "anyPassword"},
    )
    assert non_user_login.status_code == 401

    # Cleanup created user
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "new_registered_doctor").first()
        if user:
            db.delete(user)
            db.commit()
    finally:
        db.close()


def test_demo_user_logins():
    client = TestClient(app)

    # Doctor login
    doc_res = client.post(
        "/auth/login",
        json={"username": "doctor", "password": "doctor123"},
    )
    assert doc_res.status_code == 200
    doc_data = doc_res.json()
    assert doc_data["user"]["role"] == "doctor"
    token = doc_data["access_token"]
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    assert payload["role"] == "doctor"

    # Lab assistant login
    asst_res = client.post(
        "/auth/login",
        json={"username": "lab_assistant", "password": "assistant123"},
    )
    assert asst_res.status_code == 200
    asst_data = asst_res.json()
    assert asst_data["user"]["role"] == "lab_assistant"


def test_require_role_guards():
    client = TestClient(protected_app)

    # Obtain doctor token
    doc_token = create_access_token(
        data={"sub": "doctor", "user_id": 1, "role": "doctor"}
    )
    # Obtain assistant token
    asst_token = create_access_token(
        data={"sub": "lab_assistant", "user_id": 2, "role": "lab_assistant"}
    )

    doc_headers = {"Authorization": f"Bearer {doc_token}"}
    asst_headers = {"Authorization": f"Bearer {asst_token}"}

    # Doctor accessing doctor-only endpoint -> 200
    res = client.get("/doctor-only", headers=doc_headers)
    assert res.status_code == 200
    assert res.json()["role"] == "doctor"

    # Assistant accessing doctor-only endpoint -> 403 Forbidden
    res = client.get("/doctor-only", headers=asst_headers)
    assert res.status_code == 403

    # Assistant accessing assistant-only endpoint -> 200
    res = client.get("/assistant-only", headers=asst_headers)
    assert res.status_code == 200
    assert res.json()["role"] == "lab_assistant"

    # Doctor accessing assistant-only endpoint -> 403 Forbidden
    res = client.get("/assistant-only", headers=doc_headers)
    assert res.status_code == 403

    # No authorization header -> 401 Unauthorized
    res = client.get("/doctor-only")
    assert res.status_code == 401

    # Invalid token -> 401 Unauthorized
    res = client.get("/doctor-only", headers={"Authorization": "Bearer invalid.token.payload"})
    assert res.status_code == 401

    # Expired token -> 401 Unauthorized
    expired_token = create_access_token(
        data={"sub": "doctor", "user_id": 1, "role": "doctor"},
        expires_delta=timedelta(seconds=-10),
    )
    res = client.get("/doctor-only", headers={"Authorization": f"Bearer {expired_token}"})
    assert res.status_code == 401
