from fastapi import APIRouter, status
from sqlalchemy import select

from app.models import SkillGap
from app.routers import DB, CurrentUser
from app.schemas.skill import SkillGapAnalyzeIn, SkillGapOut
from app.services import ai_service, get_owned, skill_service
from app.services.resume_service import candidate_facts

router = APIRouter(prefix="/skill-gaps", tags=["Skill Gap"])


@router.post("/analyze", response_model=SkillGapOut, status_code=status.HTTP_201_CREATED)
def analyze(body: SkillGapAnalyzeIn, user: CurrentUser, db: DB):
    gap = skill_service.analyze(db, user.id, body.target_type, body.target_role, body.job_id)
    from app.models import ActivityEvent
    db.add(ActivityEvent(user_id=user.id, kind="SKILL_GAP_ANALYZED", ref_id=gap.id))
    db.commit()
    if body.use_ai_actions:
        open_items = [{"skill": i.skill.name, "current": i.current_level, "required": i.required_level}
                      for i in gap.items if i.state != "STRONG"]
        actions = ai_service.skill_gap_actions(candidate_facts(db, user.id), open_items)
        for i in gap.items:
            if i.skill.name in actions:
                i.recommended_action = actions[i.skill.name]
        db.commit()
    return skill_service.gap_out(gap)


@router.get("", response_model=list[SkillGapOut])
def list_gaps(user: CurrentUser, db: DB):
    rows = db.scalars(select(SkillGap).where(SkillGap.user_id == user.id).order_by(SkillGap.created_at.desc()).limit(20)).all()
    return [skill_service.gap_out(g) for g in rows]


@router.get("/{gap_id}", response_model=SkillGapOut)
def get_gap(gap_id: str, user: CurrentUser, db: DB):
    return skill_service.gap_out(get_owned(db, SkillGap, gap_id, user.id))
