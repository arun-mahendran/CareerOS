from datetime import timedelta

from fastapi import APIRouter
from sqlalchemy import func, select

from app.models import (
    ActivityEvent, Application, CalendarEvent, FollowedCompany, Interview, InterviewQuestion, Job, Notification,
    Profile, Roadmap, RoadmapItem, SavedJob, SkillGap,
)
from app.routers import DB, CurrentUser
from app.services import company_service, job_service, roadmap_service
from app.utils import utcnow

router = APIRouter(prefix="/analytics", tags=["Analytics"])
dashboard = APIRouter(tags=["Analytics"])


def _count(db, stmt) -> int:
    return db.scalar(select(func.count()).select_from(stmt.subquery())) or 0


def _active_roadmap(db, uid):
    return db.scalar(select(Roadmap).where(Roadmap.user_id == uid, Roadmap.is_active.is_(True)))


@router.get("/dashboard")
def summary(user: CurrentUser, db: DB):
    uid = user.id
    rm = _active_roadmap(db, uid)
    return {
        "jobs_discovered": _count(db, select(ActivityEvent).where(ActivityEvent.user_id == uid, ActivityEvent.kind == "JOB_VIEWED")),
        "jobs_saved": _count(db, select(SavedJob).where(SavedJob.user_id == uid)),
        "applications": _count(db, select(Application).where(Application.user_id == uid)),
        "interviews": _count(db, select(Interview).where(Interview.user_id == uid)),
        "roadmap_progress": roadmap_service.progress(rm) if rm else 0,
        "practice_answers": _count(db, select(InterviewQuestion).join(Interview).where(Interview.user_id == uid, InterviewQuestion.answer.is_not(None))),
    }


@router.get("/applications")
def applications(user: CurrentUser, db: DB):
    rows = db.execute(select(Application.status, func.count()).where(Application.user_id == user.id).group_by(Application.status)).all()
    return {"by_status": {s.value: n for s, n in rows}}


@router.get("/skills")
def skills(user: CurrentUser, db: DB):
    gaps = db.scalars(select(SkillGap).where(SkillGap.user_id == user.id).order_by(SkillGap.created_at)).all()
    return {"history": [{"at": g.created_at, "strong": sum(1 for i in g.items if i.state == "STRONG"),
                         "total": len(g.items)} for g in gaps]}


@router.get("/activity")
def activity(user: CurrentUser, db: DB, days: int = 30):
    since = utcnow() - timedelta(days=days)
    rows = db.execute(select(func.date(ActivityEvent.created_at), func.count())
                      .where(ActivityEvent.user_id == user.id, ActivityEvent.created_at >= since)
                      .group_by(func.date(ActivityEvent.created_at))).all()
    done = db.execute(select(func.date(RoadmapItem.completed_at), func.count()).join(Roadmap)
                      .where(Roadmap.user_id == user.id, RoadmapItem.completed_at >= since)
                      .group_by(func.date(RoadmapItem.completed_at))).all()
    return {"events": [{"date": str(d), "count": n} for d, n in rows],
            "roadmap_completions": [{"date": str(d), "count": n} for d, n in done]}


@dashboard.get("/dashboard")
def get_dashboard(user: CurrentUser, db: DB):
    uid = user.id
    p = db.scalar(select(Profile).where(Profile.user_id == uid))
    rm = _active_roadmap(db, uid)
    gap = db.scalar(select(SkillGap).where(SkillGap.user_id == uid).order_by(SkillGap.created_at.desc()))
    readiness = round(100 * sum(1 for i in gap.items if i.state == "STRONG") / len(gap.items)) if gap and gap.items else 0
    return {
        "target_role": p.target_role if p else None,
        "career_readiness": {"value": readiness, "basis": "Share of target-role skills at the required level (informational)."},
        "recent_jobs": job_service.list_jobs(db, uid, None, None, None, None, None, "newest", 1, 3)["items"],
        "saved_jobs": job_service.saved(db, uid)[:5],
        "followed_companies": company_service.followed(db, uid)[:6],
        "applications": _count(db, select(Application).where(Application.user_id == uid)),
        "roadmap_progress": roadmap_service.progress(rm) if rm else 0,
        "upcoming_interviews": [
            {"id": e.id, "title": e.title, "starts_at": e.starts_at}
            for e in db.scalars(select(CalendarEvent).where(CalendarEvent.user_id == uid, CalendarEvent.type == "INTERVIEW",
                                                            CalendarEvent.starts_at >= utcnow()).order_by(CalendarEvent.starts_at).limit(5))
        ],
        "unread_notifications": _count(db, select(Notification).where(Notification.user_id == uid, Notification.read_at.is_(None))),
    }


_ = (FollowedCompany, Job)
