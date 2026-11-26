"""AI helpers used by the Interview Prep and Resume Builder screens. Gemini is called only from the server.

Responses are {"ok": true, ...} on success or {"ok": false, "error": "..."} when the AI could not respond.
A failure is never replaced by made-up feedback.
"""

import json
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.routers import CurrentUser
from app.services import ai_service

router = APIRouter(prefix="/ai", tags=["AI"])
_pool = ThreadPoolExecutor(max_workers=4)

COACH = (
    "You are an interview practice coach. This is practice feedback, not an employer assessment. "
    "Judge only what the candidate wrote. Never invent experience, projects, employers, metrics or achievements. "
    "Do not predict whether they would pass. Do not give numeric scores. Be concise, specific and kind."
)
WORDING = (
    "Rewrite resume text for clarity and professional tone. Use ONLY facts present in the input. Never add skills, "
    "tools, employers, dates, certifications, achievements, metrics or results. Keep roughly the same length. Plain text."
)


class InterviewIn(BaseModel):
    question: str = Field(min_length=5, max_length=500)
    kind: Literal["technical", "behavioral", "project", "hr"]
    topic: str = Field(max_length=80)
    role: str | None = Field(default=None, max_length=120)
    answer: str | None = Field(default=None, max_length=6000)


class WordingIn(BaseModel):
    kind: Literal["summary", "bullet", "project"]
    text: str = Field(min_length=10, max_length=2000)
    role: str | None = Field(default=None, max_length=120)


def _run(prompt: str) -> dict:
    fut = _pool.submit(ai_service._json, prompt)  # grounding rules are prepended inside ai_service
    try:
        data = fut.result(timeout=get_settings().AI_TIMEOUT_SECONDS)
    except FutureTimeout:
        raise HTTPException(504, "The AI took too long to respond. Please try again.")
    if not isinstance(data, dict):
        raise HTTPException(502, "The AI returned an unreadable response. Try again.")
    return data


def _safe(fn):
    try:
        return fn()
    except HTTPException as e:
        return {"ok": False, "error": str(e.detail)}


def _ctx(d: InterviewIn) -> str:
    return f"Question type: {d.kind}\nTopic: {d.topic}\n" + (f"Target role: {d.role}\n" if d.role else "") + f"Question: {d.question}\n"


@router.post("/interview/feedback")
def interview_feedback(body: InterviewIn, _: CurrentUser):
    if not body.answer or len(body.answer) < 20:
        raise HTTPException(422, "Write at least a few sentences before asking for feedback.")
    keys = ["strengths", "missing", "clarity", "suggestions", "structure", "follow_ups"]

    def go():
        data = _run(f"{COACH}\n{_ctx(body)}\nCandidate answer:\n{body.answer}\n\nReturn JSON with keys "
                    f"{json.dumps(keys)}: strengths, missing, suggestions, structure, follow_ups are string arrays; clarity is a string.")
        if not all(k in data for k in keys):
            raise HTTPException(502, "The coach returned an incomplete response. Try again.")
        return {"ok": True, "data": {k: data[k] for k in keys}}
    return _safe(go)


@router.post("/interview/model-answer")
def interview_model_answer(body: InterviewIn, _: CurrentUser):
    keys = ["key_points", "example", "why", "mistakes", "follow_ups"]

    def go():
        data = _run(f"{COACH}\n{_ctx(body)}\nWrite a suggested answer guide. For behavioral/HR/project questions the example "
                    "must be a generic template with [placeholders], never a made-up personal story; under 150 words. "
                    f"Return JSON with keys {json.dumps(keys)}: key_points, mistakes, follow_ups are string arrays; example and why are strings.")
        if not all(k in data for k in keys):
            raise HTTPException(502, "The coach returned an incomplete response. Try again.")
        return {"ok": True, "data": {k: data[k] for k in keys}}
    return _safe(go)


@router.post("/resume/improve")
def improve_wording(body: WordingIn, _: CurrentUser):
    def go():
        data = _run(f"{WORDING}\nType: {body.kind}\n" + (f"Target role: {body.role}\n" if body.role else "") +
                    f'Text:\n{body.text}\n\nReturn {{"text": string}}.')
        text = str(data.get("text", "")).strip()
        return {"ok": True, "text": text} if text else {"ok": False, "error": "No suggestion returned."}
    return _safe(go)
