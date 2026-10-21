"""widen user passcode so it can store a hash

Revision ID: widen_user_passcode
Revises: 8dbd628619db
Create Date: 2026-10-21 13:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "widen_user_passcode"
down_revision: Union[str, None] = "8dbd628619db"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "user",
        "passcode",
        existing_type=sa.String(16),
        type_=sa.String(64),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "user",
        "passcode",
        existing_type=sa.String(64),
        type_=sa.String(16),
        existing_nullable=True,
    )
