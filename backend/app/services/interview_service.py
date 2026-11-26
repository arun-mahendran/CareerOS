from sqlalchemy.orm import Session

from app.models import Company, Interview, InterviewQuestion
from app.services import ai_service, get_owned

FALLBACK = {
    "HR": ["Tell me about yourself.", "Why this company?", "Describe a time you handled conflict.",
           "What are you looking for in your next role?"],
    "TECHNICAL": ["Walk through a project you built end to end.", "How do you debug a production issue?",
                  "Explain a data structure you use often and why.", "How would you test this feature?"],
    "ROLE": ["What does success look like in this role in 90 days?", "Which skill of yours fits this role best?",
             "How do you prioritise competing tasks?"],
    "COMPANY": ["What do you know about our product?", "Which of our values resonates with you?",
                "How would you improve one of our products?"],
}


def add_questions(db: Session, user_id: str, iid: str, count: int, use_ai: bool) -> Interview:
    iv = get_owned(db, Interview, iid, user_id)
    company = db.get(Company, iv.company_id).name if iv.company_id else None  # type: ignore[union-attr]
    qs: list[dict] = []
    if use_ai:
        qs = ai_service.interview_questions(iv.kind, iv.role, company, count)
    if not qs:
        qs = [{"category": iv.kind, "question": q} for q in FALLBACK[iv.kind][:count]]
    start = len(iv.questions)
    for i, q in enumerate(qs):
        iv.questions.append(InterviewQuestion(category=q.get("category", iv.kind), question=q["question"], position=start + i))
    db.commit()
    db.refresh(iv)
    return iv


def answer(db: Session, user_id: str, iid: str, qid: str, text: str, with_feedback: bool) -> InterviewQuestion:
    iv = get_owned(db, Interview, iid, user_id)
    q = next((x for x in iv.questions if x.id == qid), None)
    if not q:
        from fastapi import HTTPException
        raise HTTPException(404, "Question not found")
    q.answer = text
    if with_feedback:
        q.feedback = ai_service.mock_feedback(q.question, text)
    db.commit()
    return q
