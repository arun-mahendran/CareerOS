from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import LearningResource, Profile, Roadmap, RoadmapItem, SkillGap
from app.services import get_owned
from app.services import skill_service
from app.utils import utcnow

STAGE_FOR = {"MISSING": "Foundation", "PARTIAL": "Core Skills"}


def progress(r: Roadmap) -> int:
    return round(100 * sum(1 for i in r.items if i.completed_at) / len(r.items)) if r.items else 0


def out(r: Roadmap) -> dict:
    return {"id": r.id, "title": r.title, "target_role": r.target_role, "is_active": r.is_active,
            "created_at": r.created_at, "progress": progress(r), "items": r.items}


def generate(db: Session, user_id: str, target_role: str | None, gap_id: str | None, desired: list[str]) -> Roadmap:
    if gap_id:
        gap = get_owned(db, SkillGap, gap_id, user_id)
    else:
        role = target_role or db.scalar(select(Profile.target_role).where(Profile.user_id == user_id)) or "Frontend Engineer"
        gap = skill_service.analyze(db, user_id, "ROLE", role, None)
    role = gap.target_role or target_role or "Target role"
    db.execute(update(Roadmap).where(Roadmap.user_id == user_id).values(is_active=False))
    r = Roadmap(user_id=user_id, title=f"Path to {role}", target_role=role, skill_gap_id=gap.id)
    pos = 0
    for it in gap.items:
        if it.state == "STRONG":
            continue
        res = db.scalar(select(LearningResource).where(LearningResource.skill_id == it.skill_id))
        gap_pts = it.required_level - it.current_level
        for kind, title in (("LEARN", f"Learn {it.skill.name}"), ("PRACTICE", f"Practice {it.skill.name}"),
                            ("VERIFY", f"Verify {it.skill.name} with a small deliverable")):
            r.items.append(RoadmapItem(stage=STAGE_FOR[it.state] if kind != "VERIFY" else "Advanced Skills",
                                       kind=kind, title=title, detail=it.recommended_action,
                                       hours=max(1, gap_pts // 10), position=pos, skill_id=it.skill_id,
                                       resource_id=res.id if res and kind == "LEARN" else None))
            pos += 1
    for s in desired:
        r.items.append(RoadmapItem(stage="Advanced Skills", kind="LEARN", title=f"Explore {s}", hours=4, position=pos)); pos += 1
    r.items.append(RoadmapItem(stage="Projects", kind="PRACTICE", title=f"Ship a portfolio project for {role}", hours=16, position=pos)); pos += 1
    r.items.append(RoadmapItem(stage="Interview Readiness", kind="VERIFY", title="Complete two mock interviews", hours=4, position=pos))
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def set_item(db: Session, user_id: str, item_id: str, done: bool) -> RoadmapItem:
    item = db.get(RoadmapItem, item_id)
    if not item or db.get(Roadmap, item.roadmap_id).user_id != user_id:  # type: ignore[union-attr]
        from fastapi import HTTPException
        raise HTTPException(404, "Not found")
    item.completed_at = utcnow() if done else None
    db.commit()
    return item


def set_progress(db: Session, user_id: str, roadmap_id: str, completed: list[str]) -> Roadmap:
    r = get_owned(db, Roadmap, roadmap_id, user_id)
    done = set(completed)
    for i in r.items:
        if i.id in done and not i.completed_at:
            i.completed_at = utcnow()
        elif i.id not in done:
            i.completed_at = None
    db.commit()
    return r
