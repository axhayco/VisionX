import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Union

import jwt
from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

try:
    from db import get_db, SessionLocal
    from models import User, UserRole
except ImportError:
    from backend.db import get_db, SessionLocal
    from backend.models import User, UserRole

logger = logging.getLogger(__name__)

# Password Hashing Setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Configuration (Read from environment, with secure fallback)
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "vx_super_secret_lab_triage_jwt_key_2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

# Security Scheme (Optional bearer fallback)
security = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain text password against a bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hashes a plain text password using bcrypt."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed JWT token with embedded claims and expiration time."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def set_auth_cookie(response: Response, token: str) -> None:
    """Sets a secure httpOnly cookie containing the JWT access token.

    httpOnly protects the token from Cross-Site Scripting (XSS) attacks in healthcare apps.
    """
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    """Clears the httpOnly authentication cookie."""
    response.delete_cookie(
        key="access_token",
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        path="/",
    )


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """FastAPI dependency that decodes the JWT and returns the User object.

    Checks:
    1. httpOnly cookie ('access_token')
    2. Authorization Bearer header ('Authorization: Bearer <token>')

    Raises HTTP 401 if token is missing, invalid, expired, or user does not exist.
    """
    token: Optional[str] = None

    # 1. Check httpOnly cookie
    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        token = cookie_token
    elif credentials and credentials.credentials:
        token = credentials.credentials

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except jwt.PyJWTError as e:
        logger.warning("JWT verification failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication session",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_role(required_role: Union[UserRole, str]):
    """Dependency factory returning a validator that raises HTTP 403 if the

    current authenticated user's role does not match the required role.
    """
    target_role = (
        required_role.value if hasattr(required_role, "value") else str(required_role)
    )

    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role_str = (
            current_user.role.value
            if hasattr(current_user.role, "value")
            else str(current_user.role)
        )
        if user_role_str != target_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted for role '{user_role_str}'. Required role: '{target_role}'.",
            )
        return current_user

    return role_checker


def seed_demo_users(db: Optional[Session] = None) -> None:
    """Seeds default demo users (doctor and lab_assistant) if they do not exist."""
    close_session = False
    if db is None:
        db = SessionLocal()
        close_session = True

    try:
        # Doctor demo user
        doctor_user = db.query(User).filter(User.username == "doctor").first()
        if not doctor_user:
            doctor_user = User(
                username="doctor",
                password_hash=get_password_hash("doctor123"),
                role=UserRole.DOCTOR,
            )
            db.add(doctor_user)

        # Lab Assistant demo user
        lab_user = db.query(User).filter(User.username == "lab_assistant").first()
        if not lab_user:
            lab_user = User(
                username="lab_assistant",
                password_hash=get_password_hash("assistant123"),
                role=UserRole.LAB_ASSISTANT,
            )
            db.add(lab_user)

        db.commit()
    except Exception as e:
        db.rollback()
        logger.error("Failed to seed demo users: %s", e, exc_info=True)
    finally:
        if close_session:
            db.close()
