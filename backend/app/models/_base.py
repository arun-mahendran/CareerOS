import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column


def uuid_pk() -> Mapped[str]:
    return mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))


def user_fk(index: bool = True) -> Mapped[str]:
    return mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=index, nullable=False)
