from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Job, Skill, SkillGap, SkillGapItem, UserSkill

# Role templates used for ROLE-based analysis: skill -> (required level, importance, category)
ROLE_TEMPLATES: dict[str, dict[str, tuple[int, str, str]]] = {
    "Frontend Engineer": {
        "React": (80, "REQUIRED", "Core"), "TypeScript": (80, "REQUIRED", "Core"),
        "CSS & Layout": (70, "REQUIRED", "Core"), "Testing": (70, "REQUIRED", "Quality"),
        "Accessibility": (65, "REQUIRED", "Quality"), "System Design": (60, "PREFERRED", "Advanced"),
        "SQL": (55, "PREFERRED", "Advanced"),
    },
    "Backend Engineer": {
        "Python": (80, "REQUIRED", "Core"), "SQL": (75, "REQUIRED", "Core"),
        "REST APIs": (75, "REQUIRED", "Core"), "System Design": (65, "REQUIRED", "Advanced"),
        "Testing": (65, "REQUIRED", "Quality"), "Docker": (55, "PREFERRED", "Advanced"),
    },
    "Data Analyst": {
        "SQL": (80, "REQUIRED", "Core"), "Python": (65, "REQUIRED", "Core"),
        "Statistics": (65, "REQUIRED", "Core"), "Data Visualization": (70, "REQUIRED", "Core"),
        "Communication": (60, "PREFERRED", "Soft"),
    },
}

ACTIONS = {
    "MISSING": "Start with a fundamentals course, then build one small project using {s}.",
    "PARTIAL": "Practice {s} on a real project and close the remaining gap with targeted exercises.",
    "STRONG": "Keep {s} sharp — reference it with concrete evidence on your resume.",
}


def get_or_create_skill(db: Session, name: str, category: str = "Core") -> Skill:
    s = db.scalar(select(Skill).where(Skill.name.ilike(name.strip())))
    if not s:
        s = Skill(name=name.strip(), category=category)
        db.add(s)
        db.flush()
    return s


def user_levels(db: Session, user_id: str) -> dict[str, int]:
    rows = db.scalars(select(UserSkill).where(UserSkill.user_id == user_id)).all()
    return {r.skill_id: r.level for r in rows}


def classify(current: int, required: int) -> str:
    if current >= required:
        return "STRONG"
    if current >= max(1, required // 2):
        return "PARTIAL"
    return "MISSING"


def analyze(db: Session, user_id: str, target_type: str, target_role: str | None, job_id: str | None,
            ai_actions: dict[str, str] | None = None) -> SkillGap:
    levels = user_levels(db, user_id)
    reqs: list[tuple[Skill, int, str]] = []
    if target_type == "JOB":
        from app.services.job_service import get_job

        job = get_job(db, job_id or "")
        job_id = job.id
        reqs = [(js.skill, js.required_level, js.importance) for js in job.skills]
    else:
        tpl = ROLE_TEMPLATES.get(target_role or "", ROLE_TEMPLATES["Frontend Engineer"])
        reqs = [(get_or_create_skill(db, n, c), lvl, imp) for n, (lvl, imp, c) in tpl.items()]

    gap = SkillGap(user_id=user_id, target_type=target_type, target_role=target_role, job_id=job_id)
    for i, (skill, req, imp) in enumerate(reqs):
        cur = levels.get(skill.id, 0)
        state = classify(cur, req)
        action = (ai_actions or {}).get(skill.name) or ACTIONS[state].format(s=skill.name)
        gap.items.append(SkillGapItem(skill_id=skill.id, current_level=cur, required_level=req,
                                      importance=imp, state=state, recommended_action=action, position=i))
    db.add(gap)
    db.commit()
    db.refresh(gap)
    return gap


def gap_out(gap: SkillGap) -> dict:
    groups: dict[str, list] = {"STRONG": [], "PARTIAL": [], "MISSING": []}
    hours = 0
    for it in gap.items:
        groups[it.state].append({
            "skill": it.skill.name, "category": it.skill.category, "current_level": it.current_level,
            "required_level": it.required_level, "importance": it.importance, "state": it.state,
            "recommended_action": it.recommended_action,
        })
        hours += max(0, it.required_level - it.current_level) // 5
    return {"id": gap.id, "target_type": gap.target_type, "target_role": gap.target_role, "job_id": gap.job_id,
            "created_at": gap.created_at, "strong": groups["STRONG"], "partial": groups["PARTIAL"],
            "missing": groups["MISSING"], "estimated_hours": hours}
