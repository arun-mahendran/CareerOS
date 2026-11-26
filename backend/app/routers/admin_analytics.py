"""Admin platform analytics — real PostgreSQL aggregations, admin-only.

Every endpoint takes the same date range: either `days` (1-365, default 30) or an explicit
`start`/`end` date pair. Series are aggregated daily in the database, then bucketed to
weekly/monthly in Python so the same code runs on PostgreSQL and SQLite (tests).
No metric is fabricated: when there is no data the response carries empty series/zero counts,
and growth percentages are null unless the previous period had a non-zero base.
"""

from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import distinct, func, select

from app.models import (
    ActivityEvent, Application, Company, FollowedCompany, Job, JobSource, Notification, User,
)
from app.routers import DB, AdminUser
from app.utils import utcnow

router = APIRouter(prefix="/admin/analytics", tags=["Admin Analytics"])

MAX_SPAN_DAYS = 730


# ------------------------------------------------------------------ range helpers

def _resolve_range(days: int | None, start: date | None, end: date | None) -> tuple[datetime, datetime, int, str]:
    """Return (since, until, span_days, bucket). bucket is daily|weekly|monthly."""
    now = utcnow()
    if start or end:
        if not (start and end):
            raise HTTPException(422, "Custom ranges need both start and end dates")
        if end < start:
            raise HTTPException(422, "end must be on or after start")
        span = (end - start).days + 1
        if span > MAX_SPAN_DAYS:
            raise HTTPException(422, f"Date range cannot exceed {MAX_SPAN_DAYS} days")
        since = datetime.combine(start, time.min, tzinfo=timezone.utc)
        until = datetime.combine(end, time.max, tzinfo=timezone.utc)
        if until > now:
            until = now
    else:
        span = days if days is not None else 30
        if not 1 <= span <= 365:
            raise HTTPException(422, "days must be between 1 and 365")
        until = now
        since = now - timedelta(days=span)
    bucket = "daily" if span <= 31 else "weekly" if span <= 120 else "monthly"
    return since, until, span, bucket


def _bucket_key(d: date, bucket: str) -> str:
    if bucket == "daily":
        return d.isoformat()
    if bucket == "weekly":
        return (d - timedelta(days=d.weekday())).isoformat()  # week starting Monday
    return d.strftime("%Y-%m")


def _bucket_labels(since: datetime, until: datetime, bucket: str) -> list[str]:
    labels: list[str] = []
    d = since.date()
    last = until.date()
    while d <= last:
        key = _bucket_key(d, bucket)
        if not labels or labels[-1] != key:
            labels.append(key)
        d += timedelta(days=1)
    return labels


def _daily_counts(db, col, since: datetime, until: datetime, *filters) -> dict[str, int]:
    stmt = select(func.date(col), func.count()).where(col >= since, col <= until, *filters).group_by(func.date(col))
    return {str(d): n for d, n in db.execute(stmt).all()}


def _series(db, col, since: datetime, until: datetime, bucket: str, *filters) -> list[dict]:
    daily = _daily_counts(db, col, since, until, *filters)
    out = []
    for label in _bucket_labels(since, until, bucket):
        total = 0
        for dstr, n in daily.items():
            if _bucket_key(date.fromisoformat(dstr), bucket) == label:
                total += n
        out.append({"period": label, "count": total})
    return out


def _count(db, model, *filters) -> int:
    return db.scalar(select(func.count()).select_from(model).where(*filters)) or 0


def _growth(current: int, previous: int) -> float | None:
    """Percentage growth vs the previous period; null when there is no valid base."""
    if previous <= 0:
        return None
    return round(100.0 * (current - previous) / previous, 1)


def _distinct_users(db, since: datetime, until: datetime | None = None) -> int:
    stmt = select(func.count(distinct(ActivityEvent.user_id))).where(ActivityEvent.created_at >= since)
    if until:
        stmt = stmt.where(ActivityEvent.created_at <= until)
    return db.scalar(stmt) or 0


# ------------------------------------------------------------------ endpoints

@router.get("/overview")
def overview(admin: AdminUser, db: DB, days: int | None = Query(None), start: date | None = None, end: date | None = None):
    since, until, span, bucket = _resolve_range(days, start, end)
    prev_since = since - (until - since)

    users_total = _count(db, User)
    users_new = _count(db, User, User.created_at >= since, User.created_at <= until)
    users_prev = _count(db, User, User.created_at >= prev_since, User.created_at < since)

    jobs_active = _count(db, Job, Job.status == "ACTIVE")
    jobs_new = _count(db, Job, Job.first_seen_at >= since, Job.first_seen_at <= until)

    companies_total = _count(db, Company)
    companies_with_sources = db.scalar(
        select(func.count(distinct(JobSource.company_id))).where(JobSource.company_id.is_not(None))) or 0
    companies_new = _count(db, Company, Company.created_at >= since, Company.created_at <= until)

    apps_total = _count(db, Application)
    apps_new = _count(db, Application, Application.created_at >= since, Application.created_at <= until)

    return {
        "range": {"start": since.date().isoformat(), "end": until.date().isoformat(), "days": span, "bucket": bucket},
        "users": {"total": users_total, "new": users_new, "growth_pct": _growth(users_new, users_prev)},
        "jobs": {"active": jobs_active, "new": jobs_new},
        "companies": {"total": companies_total, "with_sources": companies_with_sources, "new": companies_new},
        "active_users": {"daily": _distinct_users(db, until - timedelta(days=1), until),
                         "monthly": _distinct_users(db, until - timedelta(days=30), until)},
        "applications": {"total": apps_total, "new": apps_new},
        "engagement": {"events": _count(db, ActivityEvent, ActivityEvent.created_at >= since,
                                        ActivityEvent.created_at <= until)},
    }


@router.get("/users")
def users(admin: AdminUser, db: DB, days: int | None = Query(None), start: date | None = None, end: date | None = None):
    since, until, span, bucket = _resolve_range(days, start, end)
    registrations = _series(db, User.created_at, since, until, bucket)
    base = _count(db, User, User.created_at < since)
    cumulative = []
    run = base
    for point in registrations:
        run += point["count"]
        cumulative.append({"period": point["period"], "count": run})
    return {
        "range": {"start": since.date().isoformat(), "end": until.date().isoformat(), "days": span, "bucket": bucket},
        "registrations": registrations,
        "cumulative": cumulative,
        "activity": _series(db, ActivityEvent.created_at, since, until, bucket),
    }


@router.get("/jobs")
def jobs(admin: AdminUser, db: DB, days: int | None = Query(None), start: date | None = None, end: date | None = None):
    since, until, span, bucket = _resolve_range(days, start, end)

    by_company = db.execute(
        select(Company.name, func.count()).join(Job, Job.company_id == Company.id)
        .where(Job.status == "ACTIVE").group_by(Company.name).order_by(func.count().desc()).limit(10)).all()
    by_role = db.execute(
        select(Job.title, func.count()).where(Job.status == "ACTIVE")
        .group_by(Job.title).order_by(func.count().desc()).limit(10)).all()
    by_location = db.execute(
        select(Job.location, func.count()).where(Job.status == "ACTIVE")
        .group_by(Job.location).order_by(func.count().desc()).limit(10)).all()

    sources = []
    for s in db.scalars(select(JobSource).order_by(JobSource.name)).all():
        job_count = _count(db, Job, Job.source_id == s.id, Job.status == "ACTIVE")
        sources.append({
            "id": s.id, "name": s.name, "provider": s.provider, "status": s.status, "enabled": s.enabled,
            "is_demo": s.is_demo, "jobs": job_count,
            "last_fetched": s.last_fetched_count, "last_new": s.last_new_count,
            "last_updated": s.last_updated_count, "last_expired": s.last_expired_count,
            "last_success_at": s.last_success_at, "last_error": s.last_error,
        })

    return {
        "range": {"start": since.date().isoformat(), "end": until.date().isoformat(), "days": span, "bucket": bucket},
        "new_per_period": _series(db, Job.first_seen_at, since, until, bucket),
        "by_company": [{"name": n, "jobs": c} for n, c in by_company],
        "by_role": [{"name": n, "jobs": c} for n, c in by_role],
        "by_location": [{"name": n, "jobs": c} for n, c in by_location],
        "sources": sources,
    }


@router.get("/engagement")
def engagement(admin: AdminUser, db: DB, days: int | None = Query(None), start: date | None = None, end: date | None = None):
    since, until, span, bucket = _resolve_range(days, start, end)

    followed = db.execute(
        select(Company.name, func.count()).join(FollowedCompany, FollowedCompany.company_id == Company.id)
        .group_by(Company.name).order_by(func.count().desc()).limit(10)).all()

    in_range = (ActivityEvent.created_at >= since, ActivityEvent.created_at <= until)
    searches = db.execute(
        select(ActivityEvent.ref_id, func.count()).where(*in_range, ActivityEvent.kind == "JOB_SEARCHED",
                                                         ActivityEvent.ref_id.is_not(None))
        .group_by(ActivityEvent.ref_id).order_by(func.count().desc()).limit(10)).all()
    feature_rows = db.execute(
        select(ActivityEvent.kind, func.count(), func.count(distinct(ActivityEvent.user_id)))
        .where(*in_range).group_by(ActivityEvent.kind).order_by(func.count().desc())).all()

    new_regs = _count(db, User, User.created_at >= since, User.created_at <= until)
    active_in_range = _distinct_users(db, since, until)
    returning = db.scalar(
        select(func.count(distinct(ActivityEvent.user_id)))
        .where(*in_range, ActivityEvent.user_id.in_(select(User.id).where(User.created_at < since)))) or 0

    return {
        "range": {"start": since.date().isoformat(), "end": until.date().isoformat(), "days": span, "bucket": bucket},
        "most_followed": [{"name": n, "followers": c} for n, c in followed],
        "searched_roles": [{"term": t, "count": c} for t, c in searches],
        "feature_usage": [{"kind": k, "events": e, "users": u} for k, e, u in feature_rows],
        "activity": {
            "daily_active": _distinct_users(db, until - timedelta(days=1), until),
            "weekly_active": _distinct_users(db, until - timedelta(days=7), until),
            "monthly_active": _distinct_users(db, until - timedelta(days=30), until),
            "new_registrations": new_regs,
            "returning_users": returning,
            "active_in_range": active_in_range,
        },
    }


@router.get("/notifications")
def notifications(admin: AdminUser, db: DB, days: int | None = Query(None), start: date | None = None, end: date | None = None):
    since, until, span, bucket = _resolve_range(days, start, end)
    in_range = (Notification.created_at >= since, Notification.created_at <= until)
    by_type = db.execute(
        select(Notification.type, func.count()).where(*in_range).group_by(Notification.type)
        .order_by(func.count().desc())).all()
    read = _count(db, Notification, *in_range, Notification.read_at.is_not(None))
    total = _count(db, Notification, *in_range)
    return {
        "range": {"start": since.date().isoformat(), "end": until.date().isoformat(), "days": span, "bucket": bucket},
        "total": total,
        "read": read,
        "by_type": [{"type": t, "count": c} for t, c in by_type],
        "series": _series(db, Notification.created_at, since, until, bucket),
        # No email provider is wired up, so delivery/open/click metrics honestly do not exist.
        "email": {"configured": False,
                  "note": "Email delivery, open and click-through tracking is not configured. "
                          "In-app notifications are recorded; email metrics require an email provider with webhooks."},
    }


@router.get("/insights")
def insights(admin: AdminUser, db: DB, days: int | None = Query(None), start: date | None = None, end: date | None = None):
    """Rule-based observations computed from the same aggregates the charts show."""
    since, until, span, _bucket = _resolve_range(days, start, end)
    prev_since = since - (until - since)
    out: list[dict] = []

    new_users = _count(db, User, User.created_at >= since, User.created_at <= until)
    prev_users = _count(db, User, User.created_at >= prev_since, User.created_at < since)
    g = _growth(new_users, prev_users)
    if g is not None:
        direction = "increased" if g >= 0 else "decreased"
        out.append({"kind": "users", "text": f"User registrations {direction} {abs(g)}% compared with the previous period "
                                             f"({new_users} vs {prev_users})."})
    elif new_users:
        out.append({"kind": "users", "text": f"{new_users} users registered in the selected period; "
                                             "there is no earlier period to compare against."})

    top_company = db.execute(
        select(Company.name, func.count()).join(FollowedCompany, FollowedCompany.company_id == Company.id)
        .group_by(Company.name).order_by(func.count().desc()).limit(1)).first()
    if top_company:
        out.append({"kind": "company", "text": f"{top_company[0]} is the most followed company "
                                               f"({top_company[1]} follower{'s' if top_company[1] != 1 else ''})."})

    top_role = db.execute(
        select(Job.title, func.count()).where(Job.status == "ACTIVE")
        .group_by(Job.title).order_by(func.count().desc()).limit(1)).first()
    if top_role:
        out.append({"kind": "role", "text": f"“{top_role[0]}” has the most open roles ({top_role[1]} active jobs)."})

    best_source = None
    for s in db.scalars(select(JobSource).where(JobSource.last_success_at.is_not(None))).all():
        if best_source is None or s.last_new_count > best_source.last_new_count:
            best_source = s
    if best_source:
        out.append({"kind": "source", "text": f"{best_source.name} is the most productive job source "
                                              f"({best_source.last_new_count} new jobs in its last sync)."})

    top_feature = db.execute(
        select(ActivityEvent.kind, func.count()).where(ActivityEvent.created_at >= since, ActivityEvent.created_at <= until)
        .group_by(ActivityEvent.kind).order_by(func.count().desc()).limit(1)).first()
    if top_feature:
        out.append({"kind": "feature", "text": f"The most used feature in this period is {top_feature[0].replace('_', ' ').lower()} "
                                               f"({top_feature[1]} events)."})

    return {"range": {"start": since.date().isoformat(), "end": until.date().isoformat(), "days": span},
            "insights": out}
