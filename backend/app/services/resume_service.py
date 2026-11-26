import io

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Certification, Education, Experience, Job, Profile, Project, Resume, ResumeVersion, UserSkill
from app.services import get_owned
from app.services.job_service import get_job


def candidate_facts(db: Session, user_id: str) -> dict:
    """Everything the candidate has entered. AI grounding and resume drafts use ONLY this."""
    p = db.scalar(select(Profile).where(Profile.user_id == user_id))
    q = lambda m: db.scalars(select(m).where(m.user_id == user_id)).all()  # noqa: E731
    return {
        "name": p.full_name if p else "", "headline": p.headline if p else None, "target_role": p.target_role if p else None,
        "education": [{"institution": e.institution, "degree": e.degree, "field": e.field,
                       "start": str(e.start_date or ""), "end": str(e.end_date or "")} for e in q(Education)],
        "experience": [{"company": e.company, "title": e.title, "start": str(e.start_date or ""),
                        "end": str(e.end_date or ""), "description": e.description} for e in q(Experience)],
        "projects": [{"name": x.name, "description": x.description, "technologies": x.technologies} for x in q(Project)],
        "certifications": [{"name": c.name, "issuer": c.issuer} for c in q(Certification)],
        "skills": [s.skill.name for s in q(UserSkill)],
    }


def sections_from_facts(f: dict) -> list[dict]:
    return [
        {"type": "summary", "title": "Summary", "items": [{"text": f.get("headline") or ""}]},
        {"type": "experience", "title": "Experience", "items": f["experience"]},
        {"type": "projects", "title": "Projects", "items": f["projects"]},
        {"type": "education", "title": "Education", "items": f["education"]},
        {"type": "skills", "title": "Skills", "items": [{"text": ", ".join(f["skills"])}]},
        {"type": "certifications", "title": "Certifications", "items": f["certifications"]},
    ]


def latest(r: Resume) -> ResumeVersion | None:
    return r.versions[0] if r.versions else None


def out(r: Resume) -> dict:
    v = latest(r)
    return {"id": r.id, "title": r.title, "template": r.template, "is_master": r.is_master,
            "target_job_id": r.target_job_id, "version": v.version if v else 0,
            "sections": v.sections if v else [], "updated_at": r.updated_at}


def create(db: Session, user_id: str, data) -> Resume:
    sections = [s.model_dump() for s in data.sections] if data.sections else sections_from_facts(candidate_facts(db, user_id))
    if data.is_master:
        for other in db.scalars(select(Resume).where(Resume.user_id == user_id, Resume.is_master.is_(True))):
            other.is_master = False
    r = Resume(user_id=user_id, title=data.title, template=data.template, is_master=data.is_master,
               target_job_id=data.target_job_id)
    r.versions.append(ResumeVersion(version=1, sections=sections))
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


def update(db: Session, user_id: str, rid: str, data) -> Resume:
    r = get_owned(db, Resume, rid, user_id)
    for k in ("title", "template", "target_job_id"):
        v = getattr(data, k)
        if v is not None:
            setattr(r, k, v)
    if data.sections is not None:
        cur = latest(r)
        r.versions.insert(0, ResumeVersion(version=(cur.version if cur else 0) + 1,
                                           sections=[s.model_dump() for s in data.sections], note=data.note))
    db.commit()
    db.refresh(r)
    return r


def _text(sections: list) -> str:
    parts = []
    for s in sections:
        for it in s.get("items", []):
            parts.extend(str(v) for v in it.values() if v)
    return " ".join(parts).lower()


def analyze(db: Session, user_id: str, rid: str, job_id: str | None) -> dict:
    r = get_owned(db, Resume, rid, user_id)
    jid = job_id or r.target_job_id
    text = _text(latest(r).sections if latest(r) else [])
    if not jid:
        return {"job_id": None, "covered_keywords": [], "missing_keywords": [], "alignment": 0,
                "tips": ["Pick a target job to compare this resume against."]}
    job = get_job(db, jid)
    kws = [s.skill.name for s in job.skills]
    covered = [k for k in kws if k.lower() in text]
    missing = [k for k in kws if k not in covered]
    tips = [f"If you genuinely have {k} experience, add a specific example of it." for k in missing]
    return {"job_id": job.id, "covered_keywords": covered, "missing_keywords": missing,
            "alignment": round(100 * len(covered) / len(kws)) if kws else 0, "tips": tips}


def job_brief(db: Session, job_id: str | None) -> dict | None:
    if not job_id:
        return None
    j = db.get(Job, job_id) or get_job(db, job_id)
    return {"title": j.title, "skills": [s.skill.name for s in j.skills], "requirements": j.requirements}


def _lines(sections: list) -> list[tuple[str, list[str]]]:
    out_ = []
    for s in sections:
        rows = []
        for it in s.get("items", []):
            if "text" in it:
                rows.append(str(it["text"]))
            else:
                head = " — ".join(str(it[k]) for k in ("title", "degree", "name") if it.get(k))
                sub = " · ".join(str(it[k]) for k in ("company", "institution", "issuer", "technologies") if it.get(k))
                rows.append(" | ".join(x for x in (head, sub) if x))
                if it.get("description"):
                    rows.append(str(it["description"]))
        out_.append((s.get("title", ""), [r for r in rows if r]))
    return out_


def export_pdf(r: Resume, name: str) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

    buf = io.BytesIO()
    st = getSampleStyleSheet()
    story = [Paragraph(name, st["Title"])]
    for title, rows in _lines(latest(r).sections if latest(r) else []):
        if not rows:
            continue
        story += [Spacer(1, 8), Paragraph(title, st["Heading2"])] + [Paragraph(x, st["BodyText"]) for x in rows]
    SimpleDocTemplate(buf, pagesize=A4).build(story)
    return buf.getvalue()


def export_docx(r: Resume, name: str) -> bytes:
    from docx import Document

    d = Document()
    d.add_heading(name, 0)
    for title, rows in _lines(latest(r).sections if latest(r) else []):
        if not rows:
            continue
        d.add_heading(title, 1)
        for x in rows:
            d.add_paragraph(x)
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue()
