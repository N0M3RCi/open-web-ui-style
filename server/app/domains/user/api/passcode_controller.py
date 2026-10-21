# ========= Copyright 2025-2026 @ M3RCI - UniMind All Rights Reserved. =========
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ========= Copyright 2025-2026 @ M3RCI - UniMind All Rights Reserved. =========

"""Passcode-based student auto-login system."""

import hashlib
import hmac
import secrets
import string
import time
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi_babel import _
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core import code
from app.core.database import session
from app.core.environment import env_not_empty
from app.model.user.user import Role, Status, User
from app.shared.auth import auth_must
from app.shared.auth.user_auth import V1UserAuth, create_access_token
from app.shared.exception import UserException
from app.shared.middleware.rate_limit import login_rate_limiter

_LOGIN_FAILURES: list[float] = []

router = APIRouter(tags=["Passcode Auth"])


# ─── Request / Response models ────────────────────────────────────────────────


class PasscodeRegisterIn(BaseModel):
    name: str


class PasscodeRegisterOut(BaseModel):
    passcode: str
    token: str
    email: str
    user_id: int
    name: str


class PasscodeLoginIn(BaseModel):
    passcode: str


class PasscodeLoginOut(BaseModel):
    token: str
    email: str
    user_id: int
    name: str


class StudentListItem(BaseModel):
    id: int
    email: str
    name: str | None = None
    passcode: str | None = None
    created_at: datetime | None = None
    last_active: datetime | None = None


class StudentListResponse(BaseModel):
    items: list[StudentListItem]
    total: int


# ─── Helper ───────────────────────────────────────────────────────────────────


def _passcode_digest(plain: str) -> str:
    """Deterministic hash so a passcode can be looked up without storing it."""
    key = env_not_empty("secret_key").encode()
    return hmac.new(key, plain.encode(), hashlib.sha256).hexdigest()


def _generate_passcode() -> str:
    """Generate a random 6-digit numeric passcode."""
    return "".join(secrets.choice(string.digits) for _ in range(6))


def _require_instructor(auth: V1UserAuth) -> None:
    if auth.user.role != Role.Admin.value:
        raise HTTPException(status_code=403, detail="Instructor access required")


def _too_many_login_failures() -> bool:
    now = time.time()
    while _LOGIN_FAILURES and now - _LOGIN_FAILURES[0] > 60:
        _LOGIN_FAILURES.pop(0)
    return len(_LOGIN_FAILURES) >= 20


def _note_login_failure() -> None:
    _LOGIN_FAILURES.append(time.time())


def _generate_email_from_name(name: str) -> str:
    """Generate a unique email from a student name."""
    safe = "".join(c for c in name if c.isalnum() or c in "._-").lower() or "student"
    ts = datetime.utcnow().strftime("%H%M%S%f")[-6:]
    return f"{safe}.{ts}@student.local"


# ─── Public endpoints (no auth required) ──────────────────────────────────────


@router.post("/auth/passcode-register", name="register with passcode", dependencies=[login_rate_limiter])
async def passcode_register(
    data: PasscodeRegisterIn,
    db_session: Session = Depends(session),
):
    """Create a new student account with a random 6-digit passcode."""
    if not data.name or not data.name.strip():
        raise UserException(code.error, _("Name is required"))

    name = data.name.strip()

    while True:
        passcode = _generate_passcode()
        digest = _passcode_digest(passcode)
        existing = db_session.exec(
            select(User).where((User.passcode == digest) | (User.passcode == passcode))
        ).first()
        if not existing:
            break

    email = _generate_email_from_name(name)

    user = User(
        email=email,
        username=name,
        nickname=name,
        fullname=name,
        passcode=digest,
        status=Status.Normal,
        role=Role.Student.value,
    )
    user.save(db_session)
    db_session.refresh(user)

    token = create_access_token(user.id)

    return PasscodeRegisterOut(
        passcode=passcode,
        token=token,
        email=email,
        user_id=user.id,
        name=name,
    )


@router.post("/auth/passcode-login", name="login with passcode", dependencies=[login_rate_limiter])
async def passcode_login(
    data: PasscodeLoginIn,
    db_session: Session = Depends(session),
):
    """Login with a 6-digit passcode. Returns JWT token."""
    if not data.passcode or len(data.passcode) != 6 or not data.passcode.isdigit():
        raise UserException(code.error, _("Invalid passcode"))
    if _too_many_login_failures():
        raise UserException(code.error, _("Too many attempts. Wait a minute and try again."))

    digest = _passcode_digest(data.passcode)
    user = db_session.exec(
        select(User).where(
            User.passcode == digest,
            User.deleted_at.is_(None),
            User.status == Status.Normal.value,
        )
    ).first()

    if not user:
        # Older accounts stored the passcode itself. Accept it once, then store only the hash.
        user = db_session.exec(
            select(User).where(
                User.passcode == data.passcode,
                User.deleted_at.is_(None),
                User.status == Status.Normal.value,
            )
        ).first()
        if user:
            user.passcode = digest
            try:
                user.save(db_session)
            except Exception:
                db_session.rollback()

    if not user:
        _note_login_failure()
        raise UserException(code.not_found, _("Invalid passcode"))

    token = create_access_token(user.id)

    return PasscodeLoginOut(
        token=token,
        email=user.email,
        user_id=user.id,
        name=user.nickname or user.username or "Student",
    )


# ─── Admin endpoints (auth required) ─────────────────────────────────────────


@router.get("/admin/students", name="list student accounts")
async def list_students(
    search: str = Query(default="", max_length=255),
    db_session: Session = Depends(session),
    auth: V1UserAuth = Depends(auth_must),
):
    """List all student accounts (users with passcodes)."""
    _require_instructor(auth)
    conditions = [
        User.deleted_at.is_(None),
        User.passcode.isnot(None),
    ]

    if search:
        like = f"%{search}%"
        conditions.append(User.email.ilike(like) | User.username.ilike(like) | User.nickname.ilike(like))

    users = User.by(
        *conditions,
        order_by=User.created_at.desc(),
        s=db_session,
    ).all()

    items = [
        StudentListItem(
            id=u.id,
            email=u.email,
            name=u.nickname or u.username,
            passcode=None,
            created_at=u.created_at,
            last_active=u.updated_at,
        )
        for u in users
    ]

    return StudentListResponse(items=items, total=len(items))


class ResetPasscodeOut(BaseModel):
    passcode: str


@router.post("/admin/students/{student_id}/reset-passcode", name="reset student passcode")
async def reset_student_passcode(
    student_id: int,
    db_session: Session = Depends(session),
    auth: V1UserAuth = Depends(auth_must),
):
    """Reset a student's passcode to a new random 6-digit code."""
    _require_instructor(auth)
    user = db_session.get(User, student_id)
    if not user or user.deleted_at is not None or user.passcode is None:
        raise UserException(code.not_found, _("Student not found"))

    # Generate unique passcode
    while True:
        new_passcode = _generate_passcode()
        digest = _passcode_digest(new_passcode)
        existing = db_session.exec(
            select(User).where((User.passcode == digest) | (User.passcode == new_passcode))
        ).first()
        if not existing:
            break

    user.passcode = digest
    user.save(db_session)
    db_session.refresh(user)

    return ResetPasscodeOut(passcode=new_passcode)


@router.delete("/admin/students/{student_id}", name="delete student account")
async def delete_student(
    student_id: int,
    db_session: Session = Depends(session),
    auth: V1UserAuth = Depends(auth_must),
):
    """Soft-delete a student account."""
    _require_instructor(auth)
    user = db_session.get(User, student_id)
    if not user or user.deleted_at is not None or user.passcode is None:
        raise UserException(code.not_found, _("Student not found"))

    user.delete(db_session)
    return {"success": True}
