"""Job source synchronization.

Real listings come only from configured sources whose `provider` is a supported official public job-board API
(see job_providers.py). Sync is idempotent: jobs are keyed by (source_id, external_id).
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from sqlalchemy import or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Company, FollowedCompany, Job, JobSkill, JobSource, Notification
from app.services.job_providers import PROVIDERS, NormalizedJob, ProviderError
from app.services.skill_service import get_or_create_skill
from app.utils import utcnow

log = logging.getLogger("careeros.sync")
LOCK_TTL = timedelta(minutes=15)
EXPIRE_AFTER = timedelta(hours=6)  # a job must be absent from successful fetches this long before it is expired


# ---------------------------------------------------------------- real provider sync
@dataclass
class SyncResult:
    ok: bool
    fetched: int = 0
    new: int = 0
    updated: int = 0
    unchanged: int = 0
    expired: int = 0
    notifications: int = 0
    error_kind: str | None = None
    error: str | None = None
    skipped: bool = False

    def as_dict(self) -> dict:
        return self.__dict__.copy()


def _hash(n: NormalizedJob) -> str:
    keys = ("title", "description", "location", "department", "employment_type", "work_mode", "salary", "apply_url")
    return hashlib.sha256(json.dumps({k: getattr(n, k) for k in keys}, sort_keys=True, default=str).encode()).hexdigest()


def _slug(source: JobSource, ext: str) -> str:
    base = re.sub(r"[^a-z0-9-]+", "-", f"{source.provider}-{source.board_token}-{ext}".lower()).strip("-")
    return base[:110] + "-" + hashlib.md5(ext.encode()).hexdigest()[:8] if len(base) > 118 else base


def acquire_lock(db: Session, source_id: str) -> bool:
    now = utcnow()
    res = db.execute(update(JobSource).where(JobSource.id == source_id).where(
        or_(JobSource.sync_started_at.is_(None), JobSource.sync_started_at < now - LOCK_TTL)
    ).values(sync_started_at=now))
    db.commit()
    return res.rowcount == 1


def release_lock(db: Session, source_id: str) -> None:
    db.execute(update(JobSource).where(JobSource.id == source_id).values(sync_started_at=None))
    db.commit()


def notify_followers(db: Session, job: Job) -> int:
    """One notification per (user, job discovery). Unique constraint guards against races."""
    sent = 0
    key = f"job-new:{job.id}"
    followers = db.scalars(select(FollowedCompany.user_id).where(FollowedCompany.company_id == job.company_id)).all()
    for uid in followers:
        if db.scalar(select(Notification.id).where(Notification.user_id == uid, Notification.dedupe_key == key)):
            continue
        try:
            with db.begin_nested():
                db.add(Notification(user_id=uid, type="COMPANY_ALERT", dedupe_key=key,
                                    title=f"New role at {job.company.name}: {job.title}"[:200],
                                    body=job.location, link=f"/jobs/{job.id}"))
            sent += 1
        except IntegrityError:
            pass
    return sent


def apply_listings(db: Session, source: JobSource, listings: list[NormalizedJob]) -> SyncResult:
    """Insert new, update changed, touch unchanged, and safely expire listings no longer published."""
    now = utcnow()
    r = SyncResult(ok=True, fetched=len(listings))
    existing = {j.external_id: j for j in db.scalars(select(Job).where(Job.source_id == source.id)).all()}
    seen: set[str] = set()
    new_jobs: list[Job] = []
    for n in listings:
        if n.external_id in seen:
            continue
        seen.add(n.external_id)
        h = _hash(n)
        job = existing.get(n.external_id)
        if job is None:
            job = Job(source_id=source.id, external_id=n.external_id, slug=_slug(source, n.external_id),
                      company_id=source.company_id, first_seen_at=now, level="Not specified", min_experience_years=0)
            db.add(job)
            new_jobs.append(job)
            r.new += 1
        elif job.content_hash != h:
            r.updated += 1
        else:
            r.unchanged += 1
        if job.content_hash != h:
            job.title = n.title[:200]
            job.description = n.description or ""
            job.location = (n.location or "Not specified")[:160]
            job.work_mode = n.work_mode or "Not specified"
            job.department = (n.department or None) and n.department[:160]
            job.employment_type = (n.employment_type or None) and n.employment_type[:60]
            job.salary = (n.salary or None) and n.salary[:80]
            job.official_url = n.official_url[:400]
            job.apply_url = n.apply_url[:400]
            job.content_hash = h
        job.posted_at = n.published_at or job.posted_at or job.first_seen_at or now
        job.posted_at_known = n.published_at is not None
        job.source_updated_at = n.source_updated_at
        job.last_seen_at = now
        job.missing_since = None
        if job.status != "ACTIVE" and job.status in ("EXPIRED",):
            job.status = "ACTIVE"
    # Reconcile: only after a successful fetch, and only after a grace period of continued absence.
    for ext, job in existing.items():
        if ext in seen or job.status != "ACTIVE":
            continue
        if job.missing_since is None:
            job.missing_since = now
        elif now - _aware(job.missing_since) >= EXPIRE_AFTER:
            job.status = "EXPIRED"
            r.expired += 1
    db.flush()
    for job in new_jobs:
        db.refresh(job)
        r.notifications += notify_followers(db, job)
    return r


def _aware(d: datetime) -> datetime:
    from datetime import timezone
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def test_source(source: JobSource) -> SyncResult:
    """Fetch and parse without writing jobs."""
    p = PROVIDERS.get(source.provider or "")
    if not p:
        return SyncResult(ok=False, error_kind="UNSUPPORTED", error="No supported provider configured")
    try:
        return SyncResult(ok=True, fetched=len(p.fetch(source.board_token or "", source.region)))
    except ProviderError as e:
        return SyncResult(ok=False, error_kind=e.kind, error=str(e))


def run_sync(db: Session, source: JobSource) -> SyncResult:
    """Sync one source. Failures are recorded on the source; existing jobs are never deleted on failure."""
    source.last_checked_at = utcnow()
    if source.is_demo:
        source.status, source.last_error = "OK", None
        db.commit()
        return SyncResult(ok=True, error="Demo source: listings come from the dev seed, nothing fetched")
    if not source.enabled:
        db.commit()
        return SyncResult(ok=False, error_kind="DISABLED", error="Source is disabled")
    p = PROVIDERS.get(source.provider or "")
    if not p or not source.company_id:
        source.status, source.last_error = "ERROR", "Source needs a supported provider, board identifier and company"
        db.commit()
        return SyncResult(ok=False, error_kind="UNSUPPORTED", error=source.last_error)
    if not acquire_lock(db, source.id):
        return SyncResult(ok=False, skipped=True, error_kind="IN_PROGRESS", error="A sync is already running for this source")
    try:
        try:
            listings = p.fetch(source.board_token or "", source.region)
        except ProviderError as e:
            db.rollback()
            source.status, source.last_error = "ERROR", f"{e.kind}: {e}"[:500]
            db.commit()
            log.warning("sync %s failed: %s", source.key, source.last_error)
            return SyncResult(ok=False, error_kind=e.kind, error=str(e))
        try:
            r = apply_listings(db, source, listings)
            source.status, source.last_error, source.last_success_at = "OK", None, utcnow()
            source.validated_at = source.validated_at or utcnow()
            source.last_fetched_count, source.last_new_count = r.fetched, r.new
            source.last_updated_count, source.last_expired_count = r.updated, r.expired
            db.commit()
            log.info("sync %s ok: %s", source.key, r.as_dict())
            return r
        except Exception:
            db.rollback()
            log.exception("sync %s database error", source.key)
            source = db.get(JobSource, source.id)
            source.status, source.last_error = "ERROR", "DATABASE: could not store listings"
            db.commit()
            return SyncResult(ok=False, error_kind="DATABASE", error="Could not store listings")
    finally:
        release_lock(db, source.id)


def sync_all(db: Session) -> dict[str, dict]:
    """Sync every enabled, real source; one failure never stops the others."""
    ids = db.scalars(select(JobSource.id).where(JobSource.enabled.is_(True), JobSource.is_demo.is_(False),
                                                JobSource.provider.is_not(None))).all()
    out = {}
    for sid in ids:
        s = db.get(JobSource, sid)
        try:
            out[s.key] = run_sync(db, s).as_dict()
        except Exception as e:  # pragma: no cover - defensive
            db.rollback()
            log.exception("sync %s crashed", sid)
            out[sid] = {"ok": False, "error": type(e).__name__}
    return out
