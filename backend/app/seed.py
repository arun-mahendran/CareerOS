"""Create the configured administrator after running Alembic migrations.

No candidate, company, job, learning, notification or application demo records are created.
Run: `python -m app.seed`
"""

from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import Profile, Role, User


def run() -> None:
    settings = get_settings()
    if not settings.ADMIN_EMAIL or not settings.ADMIN_PASSWORD:
        print("ADMIN_EMAIL and ADMIN_PASSWORD are not set; no account created.")
        return

    db = SessionLocal()
    try:
        email = settings.ADMIN_EMAIL.lower()
        if db.scalar(select(User).where(User.email == email)):
            print("Admin account already exists; nothing changed.")
            return
        admin = User(email=email, password_hash=hash_password(settings.ADMIN_PASSWORD), role=Role.ADMIN)
        admin.profile = Profile(full_name="CareerOS Admin", onboarded=True)
        db.add(admin)
        db.commit()
        print(f"Created admin {email}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
