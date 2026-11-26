from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Company, FollowedCompany, Job


def _followed(db: Session, user_id: str) -> set[str]:
    return set(db.scalars(select(FollowedCompany.company_id).where(FollowedCompany.user_id == user_id)).all())


def _counts(db: Session) -> dict[str, int]:
    rows = db.execute(select(Job.company_id, func.count()).where(Job.status == "ACTIVE").group_by(Job.company_id)).all()
    return {cid: n for cid, n in rows}


def out(c: Company, counts: dict[str, int], followed: set[str]) -> dict:
    d = {k: getattr(c, k) for k in ("id", "slug", "name", "industry", "headquarters", "size", "description",
                                    "website_url", "careers_url", "logo_url")}
    d["active_jobs"] = counts.get(c.id, 0)
    d["followed"] = c.id in followed
    return d


def list_companies(db: Session, user_id: str, q: str | None = None) -> list[dict]:
    stmt = select(Company).order_by(Company.name)
    if q:
        stmt = stmt.where(or_(Company.name.ilike(f"%{q}%"), Company.industry.ilike(f"%{q}%")))
    counts, f = _counts(db), _followed(db, user_id)
    return [out(c, counts, f) for c in db.scalars(stmt).all()]


def get(db: Session, user_id: str, cid: str) -> dict:
    c = db.scalar(select(Company).where(or_(Company.id == cid, Company.slug == cid)))
    if not c:
        raise HTTPException(404, "Company not found")
    return out(c, _counts(db), _followed(db, user_id))


def follow(db: Session, user_id: str, cid: str, on: bool) -> None:
    c = get(db, user_id, cid)
    row = db.scalar(select(FollowedCompany).where(FollowedCompany.user_id == user_id, FollowedCompany.company_id == c["id"]))
    if on and not row:
        db.add(FollowedCompany(user_id=user_id, company_id=c["id"]))
    elif not on and row:
        db.delete(row)
    db.commit()


def followed(db: Session, user_id: str) -> list[dict]:
    return [c for c in list_companies(db, user_id) if c["followed"]]
