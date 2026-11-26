from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.models import CareerGoal, Certification, Education, Experience, Profile, Project, UserSkill
from app.routers import DB, CurrentUser
from app.schemas.user import (
    CareerGoalIn, CareerGoalOut, CertificationIn, CertificationOut, EducationIn, EducationOut, ExperienceIn,
    ExperienceOut, ProfileOut, ProfileUpdate, ProjectIn, ProjectOut, UserSkillIn, UserSkillOut,
)
from app.services import get_owned, join_csv, split_csv
from app.services.skill_service import get_or_create_skill

router = APIRouter(tags=["Users"])


def _profile(db, user) -> Profile:
    p = db.scalar(select(Profile).where(Profile.user_id == user.id))
    if not p:
        raise HTTPException(404, "Profile not found")
    return p


@router.get("/profile", response_model=ProfileOut)
def get_profile(user: CurrentUser, db: DB):
    return _profile(db, user)


@router.put("/profile", response_model=ProfileOut)
def put_profile(body: ProfileUpdate, user: CurrentUser, db: DB):
    p = _profile(db, user)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    return p


def _crud(path: str, model, In, Out):
    """Owner-scoped list/create/update/delete for simple profile sections."""

    @router.get(f"/profile/{path}", response_model=list[Out], name=f"list_{path}")
    def list_(user: CurrentUser, db: DB):
        return db.scalars(select(model).where(model.user_id == user.id).order_by(model.created_at)).all()

    @router.post(f"/profile/{path}", response_model=Out, status_code=201, name=f"create_{path}")
    def create(body: In, user: CurrentUser, db: DB):  # type: ignore[valid-type]
        row = model(user_id=user.id, **body.model_dump())
        db.add(row)
        db.commit()
        return row

    @router.put(f"/profile/{path}/{{item_id}}", response_model=Out, name=f"update_{path}")
    def update(item_id: str, body: In, user: CurrentUser, db: DB):  # type: ignore[valid-type]
        row = get_owned(db, model, item_id, user.id)
        for k, v in body.model_dump().items():
            setattr(row, k, v)
        db.commit()
        return row

    @router.delete(f"/profile/{path}/{{item_id}}", status_code=204, name=f"delete_{path}")
    def delete(item_id: str, user: CurrentUser, db: DB):
        db.delete(get_owned(db, model, item_id, user.id))
        db.commit()


_crud("education", Education, EducationIn, EducationOut)
_crud("experience", Experience, ExperienceIn, ExperienceOut)
_crud("projects", Project, ProjectIn, ProjectOut)
_crud("certifications", Certification, CertificationIn, CertificationOut)


@router.get("/profile/skills", response_model=list[UserSkillOut])
def list_skills(user: CurrentUser, db: DB):
    rows = db.scalars(select(UserSkill).where(UserSkill.user_id == user.id)).all()
    return [{"id": r.id, "skill_id": r.skill_id, "name": r.skill.name, "category": r.skill.category, "level": r.level} for r in rows]


@router.post("/profile/skills", response_model=UserSkillOut, status_code=201)
def add_skill(body: UserSkillIn, user: CurrentUser, db: DB):
    skill = get_or_create_skill(db, body.name, body.category)
    row = db.scalar(select(UserSkill).where(UserSkill.user_id == user.id, UserSkill.skill_id == skill.id))
    if row:
        row.level = body.level
    else:
        row = UserSkill(user_id=user.id, skill_id=skill.id, level=body.level)
        db.add(row)
    db.commit()
    return {"id": row.id, "skill_id": skill.id, "name": skill.name, "category": skill.category, "level": row.level}


@router.delete("/profile/skills/{item_id}", status_code=204)
def delete_skill(item_id: str, user: CurrentUser, db: DB):
    db.delete(get_owned(db, UserSkill, item_id, user.id))
    db.commit()


def _goal_out(g: CareerGoal) -> dict:
    return {"id": g.id, "is_active": g.is_active, "primary_role": g.primary_role,
            "secondary_roles": split_csv(g.secondary_roles), "preferred_locations": split_csv(g.preferred_locations),
            "industries": split_csv(g.industries), "experience_level": g.experience_level,
            "preferred_companies": split_csv(g.preferred_companies)}


def _apply_goal(g: CareerGoal, body: CareerGoalIn) -> None:
    g.primary_role = body.primary_role
    g.experience_level = body.experience_level
    for k in ("secondary_roles", "preferred_locations", "industries", "preferred_companies"):
        setattr(g, k, join_csv(getattr(body, k)))


@router.get("/career-goals", response_model=list[CareerGoalOut], tags=["Users"])
def list_goals(user: CurrentUser, db: DB):
    return [_goal_out(g) for g in db.scalars(select(CareerGoal).where(CareerGoal.user_id == user.id)).all()]


@router.post("/career-goals", response_model=CareerGoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(body: CareerGoalIn, user: CurrentUser, db: DB):
    for g in db.scalars(select(CareerGoal).where(CareerGoal.user_id == user.id)):
        g.is_active = False
    g = CareerGoal(user_id=user.id, primary_role=body.primary_role)
    _apply_goal(g, body)
    db.add(g)
    _profile(db, user).target_role = body.primary_role
    db.commit()
    return _goal_out(g)


@router.put("/career-goals/{goal_id}", response_model=CareerGoalOut)
def update_goal(goal_id: str, body: CareerGoalIn, user: CurrentUser, db: DB):
    g = get_owned(db, CareerGoal, goal_id, user.id)
    _apply_goal(g, body)
    if g.is_active:
        _profile(db, user).target_role = body.primary_role
    db.commit()
    return _goal_out(g)
