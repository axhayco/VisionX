from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

try:
    from auth import (
        clear_auth_cookie,
        create_access_token,
        get_current_user,
        get_password_hash,
        set_auth_cookie,
        verify_password,
    )
    from db import get_db
    from models import User, UserRole
except ImportError:
    from backend.auth import (
        clear_auth_cookie,
        create_access_token,
        get_current_user,
        get_password_hash,
        set_auth_cookie,
        verify_password,
    )
    from backend.db import get_db
    from backend.models import User, UserRole

router = APIRouter(prefix="/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=4)
    role: UserRole


class LoginRequest(BaseModel):
    username: str = Field(...)
    password: str = Field(...)


class UserInfoResponse(BaseModel):
    id: int
    username: str
    role: str


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfoResponse


@router.post("/register", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    """Registers a new user, hashes password, saves User to SQLite, sets a secure

    httpOnly cookie, and returns the signed JWT token.
    """
    existing_user = db.query(User).filter(User.username == request.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username '{request.username}' is already registered.",
        )

    hashed_pw = get_password_hash(request.password)
    new_user = User(
        username=request.username,
        password_hash=hashed_pw,
        role=request.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    role_val = new_user.role.value if hasattr(new_user.role, "value") else str(new_user.role)
    token = create_access_token(
        data={
            "sub": new_user.username,
            "user_id": new_user.id,
            "role": role_val,
        }
    )

    set_auth_cookie(response, token)

    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserInfoResponse(
            id=new_user.id,
            username=new_user.username,
            role=role_val,
        ),
    )


@router.post("/login", response_model=AuthTokenResponse)
def login(request: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Verifies credentials, sets a secure httpOnly cookie, and returns the signed JWT token."""
    user = db.query(User).filter(User.username == request.username).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    token = create_access_token(
        data={
            "sub": user.username,
            "user_id": user.id,
            "role": role_val,
        }
    )

    set_auth_cookie(response, token)

    return AuthTokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserInfoResponse(
            id=user.id,
            username=user.username,
            role=role_val,
        ),
    )


@router.post("/logout")
def logout(response: Response):
    """Clears the authentication httpOnly cookie."""
    clear_auth_cookie(response)
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserInfoResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Returns the authenticated user details from the active session."""
    role_val = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    return UserInfoResponse(
        id=current_user.id,
        username=current_user.username,
        role=role_val,
    )
