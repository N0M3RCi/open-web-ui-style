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

"""Admin user management endpoints."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi_babel import _
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, col, func, select

from app.core import code
from app.core.database import session
from app.core.encrypt import password_hash
from app.model.user.user import Role, Status, User
from app.model.user.user_stat import UserStat, UserStatOut
from app.shared.auth import auth_must
from app.shared.auth.user_auth import V1UserAuth
from app.shared.exception import NoPermissionException, UserException

router = APIRouter(prefix="/admin/users", tags=["Admin - Users"])


def _require_admin(auth: V1UserAuth):
    """Check that the authenticated user has admin role."""
    if auth.user.role != Role.Admin.value:
        raise NoPermissionException(_("Admin access required"))


class UserListItem(BaseModel):
    id: int
    email: str
    username: str | None = None
    nickname: str | None = None
    fullname: str | None = None
    credits: int = 0
    status: int
    role: str = "user"
    created_at: datetime | None = None
    updated_at: datetime | None = None


class UserListResponse(BaseModel):
    items: list[UserListItem]
    total: int
    page: int
    page_size: int


class CreateUserIn(BaseModel):
    email: EmailStr
    password: str
    username: str | None = None
    nickname: str | None = None
    fullname: str | None = None
    credits: int = 0
    role: str = "user"


class UpdateUserIn(BaseModel):
    email: EmailStr | None = None
    username: str | None = None
    nickname: str | None = None
    fullname: str | None = None
    work_desc: str | None = None
    credits: int | None = None
    status: int | None = None
    role: str | None = None


class AdminUserDetail(BaseModel):
    id: int
    email: str
    username: str | None = None
    nickname: str | None = None
    fullname: str | None = None
    work_desc: str = ""
    credits: int = 0
    status: int
    role: str = "user"
    created_at: datetime | None = None
    updated_at: datetime | None = None
    stats: UserStatOut | None = None


@router.get("", name="list users", response_model=UserListResponse)
def list_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str = Query(default="", max_length=255),
    status: int | None = Query(default=None),
    db_session: Session = Depends(session),
    auth: V1UserAuth = Depends(auth_must),
):
    """List all users with pagination and optional search/filter."""
    _require_admin(auth)
    conditions = [User.deleted_at.is_(None)]

    if search:
        like = f"%{search}%"
        conditions.append(
            User.email.ilike(like)
            | User.username.ilike(like)
            | User.nickname.ilike(like)
            | User.fullname.ilike(like)
        )

    if status is not None:
        conditions.append(User.status == status)

    total = User.count(*conditions, s=db_session)
    offset = (page - 1) * page_size
    users = User.by(
        *conditions,
        order_by=User.created_at.desc(),
        limit=page_size,
        offset=offset,
        s=db_session,
    ).all()

    items = [
        UserListItem(
            id=u.id,
            email=u.email,
            username=u.username,
            nickname=u.nickname,
            fullname=u.fullname,
            credits=u.credits,
            status=u.status.value if hasattr(u.status, "value") else u.status,
            role=u.role or "user",
            created_at=u.created_at,
            updated_at=u.updated_at,
        )
        for u in users
    ]

    return UserListResponse(items=items, total=total, page=page, page_size=page_size)


@router.post("", name="create user", response_model=UserListItem)
def create_user(
    data: CreateUserIn,
    db_session: Session = Depends(session),
    auth: V1UserAuth = Depends(auth_must),
):
    """Create a new user account."""
    _require_admin(auth)
    existing = User.by(User.email == data.email, s=db_session).one_or_none()
    if existing:
        raise UserException(code.error, _("Email already registered"))

    # Validate role value
    role_value = data.role
    valid_roles = {r.value for r in Role}
    if role_value not in valid_roles:
        raise UserException(code.error, _("Invalid role. Must be one of: admin, user, student"))

    user = User(
        email=data.email,
        password=password_hash(data.password),
        username=data.username,
        nickname=data.nickname,
        fullname=data.fullname,
        credits=data.credits,
        role=role_value,
        status=Status.Normal,
    )
    user.save(db_session)
    db_session.refresh(user)

    return UserListItem(
        id=user.id,
        email=user.email,
        username=user.username,
        nickname=user.nickname,
        fullname=user.fullname,
        credits=user.credits,
        status=user.status.value if hasattr(user.status, "value") else user.status,
        role=user.role or "user",
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.get("/{user_id}", name="get user detail", response_model=AdminUserDetail)
def get_user(
    user_id: int,
    db_session: Session = Depends(session),
    auth: V1UserAuth = Depends(auth_must),
):
    """Get detailed user info including stats."""
    _require_admin(auth)
    user = db_session.get(User, user_id)
    if not user or user.deleted_at is not None:
        raise UserException(code.not_found, _("User not found"))

    stat = db_session.exec(select(UserStat).where(UserStat.user_id == user_id)).first()
    stats = UserStatOut()
    if stat:
        stats = UserStatOut(**stat.model_dump())

    return AdminUserDetail(
        id=user.id,
        email=user.email,
        username=user.username,
        nickname=user.nickname,
        fullname=user.fullname,
        work_desc=user.work_desc,
        credits=user.credits,
        status=user.status.value if hasattr(user.status, "value") else user.status,
        role=user.role or "user",
        created_at=user.created_at,
        updated_at=user.updated_at,
        stats=stats,
    )


@router.put("/{user_id}", name="update user", response_model=UserListItem)
def update_user(
    user_id: int,
    data: UpdateUserIn,
    db_session: Session = Depends(session),
    auth: V1UserAuth = Depends(auth_must),
):
    """Update user fields (email, username, nickname, credits, status, role, etc.)."""
    _require_admin(auth)
    user = db_session.get(User, user_id)
    if not user or user.deleted_at is not None:
        raise UserException(code.not_found, _("User not found"))

    # Prevent admin from removing their own admin role
    if data.role is not None and user.id == auth.id and data.role != Role.Admin.value:
        raise UserException(code.error, _("You cannot remove your own admin role"))

    update_dict = data.model_dump(exclude_unset=True, exclude_none=True)
    if "email" in update_dict and update_dict["email"] != user.email:
        existing = User.by(User.email == update_dict["email"], s=db_session).one_or_none()
        if existing:
            raise UserException(code.error, _("Email already in use"))

    # Validate role if provided
    if "role" in update_dict:
        valid_roles = {r.value for r in Role}
        if update_dict["role"] not in valid_roles:
            raise UserException(code.error, _("Invalid role. Must be one of: admin, user, student"))

    user.update_fields(update_dict)
    user.save(db_session)
    db_session.refresh(user)

    return UserListItem(
        id=user.id,
        email=user.email,
        username=user.username,
        nickname=user.nickname,
        fullname=user.fullname,
        credits=user.credits,
        status=user.status.value if hasattr(user.status, "value") else user.status,
        role=user.role or "user",
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.delete("/{user_id}", name="soft-delete user")
def delete_user(
    user_id: int,
    db_session: Session = Depends(session),
    auth: V1UserAuth = Depends(auth_must),
):
    """Soft-delete a user account."""
    _require_admin(auth)
    # Prevent deleting yourself
    if user_id == auth.id:
        raise UserException(code.error, _("You cannot delete your own account"))
    user = db_session.get(User, user_id)
    if not user or user.deleted_at is not None:
        raise UserException(code.not_found, _("User not found"))

    user.delete(db_session)
    return {"success": True}
