"""Auth controller — user registration and login.

Routes:
    POST /api/auth/register -> register a new user
    POST /api/auth/login    -> login (validates credentials)
    GET  /api/auth/user/{user_id} -> get user profile
"""
from __future__ import annotations

import hashlib

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.models.domain.user import User
from app.repositories import get_repository

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _hash_password(password: str) -> str:
    """Simple password hash for demo purposes."""
    return hashlib.sha256(password.encode()).hexdigest()


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)
    preferences: list[str] = Field(default_factory=list)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)


class AuthResponse(BaseModel):
    user_id: str
    name: str
    email: str
    role: str = "user"
    preferences: list[str] = Field(default_factory=list)


# In-memory password store (for memory backend) and user-email index
_passwords: dict[str, str] = {}  # user_id -> hashed password
_email_index: dict[str, str] = {}  # email -> user_id


@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest) -> AuthResponse:
    """Register a new user. Persists to the configured backend (memory or DynamoDB)."""
    repo = get_repository()
    email_lower = req.email.strip().lower()

    # Check if email already registered
    if email_lower in _email_index:
        existing_uid = _email_index[email_lower]
        existing = await repo.get_user(existing_uid)
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

    # Generate user_id from email prefix (deterministic and readable)
    user_id = email_lower.split("@")[0].replace(".", "-").replace("+", "-")

    # Check if user_id already exists
    existing = await repo.get_user(user_id)
    if existing:
        # Email might just be different — check if credentials match
        if email_lower in _email_index:
            raise HTTPException(status_code=409, detail="User already exists")
        # Otherwise create with a suffix
        user_id = f"{user_id}-{len(_email_index) + 1}"

    user = User(
        user_id=user_id,
        name=req.name.strip(),
        email=email_lower,
        preferences=req.preferences,
    )

    await repo.upsert_user(user)
    _passwords[user_id] = _hash_password(req.password)
    _email_index[email_lower] = user_id

    return AuthResponse(
        user_id=user.user_id,
        name=user.name,
        email=user.email,
        role="user",
        preferences=user.preferences,
    )


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest) -> AuthResponse:
    """Login a user. Returns user profile if credentials are valid."""
    repo = get_repository()
    email_lower = req.email.strip().lower()

    # Find user by email
    user_id = _email_index.get(email_lower)

    if not user_id:
        # Try to find by scanning (fallback for seeded users)
        # Check common patterns
        possible_ids = [
            email_lower.split("@")[0].replace(".", "-"),
            email_lower.split("@")[0],
        ]
        for pid in possible_ids:
            user = await repo.get_user(pid)
            if user and user.email.lower() == email_lower:
                user_id = pid
                _email_index[email_lower] = user_id
                break

    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = await repo.get_user(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # For seeded users without passwords, accept any password (demo convenience)
    if user_id in _passwords:
        if _passwords[user_id] != _hash_password(req.password):
            raise HTTPException(status_code=401, detail="Invalid email or password")

    return AuthResponse(
        user_id=user.user_id,
        name=user.name,
        email=user.email,
        role="user",
        preferences=user.preferences,
    )


@router.get("/user/{user_id}")
async def get_user_profile(user_id: str):
    """Get user profile by ID."""
    repo = get_repository()
    user = await repo.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "user_id": user.user_id,
        "name": user.name,
        "email": user.email,
        "preferences": user.preferences,
        "dietary_tags": user.dietary_tags,
        "price_tier": user.price_tier,
    }
