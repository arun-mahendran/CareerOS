"""All Gemini calls live here. The API key is read from the server environment and never sent to the browser.

Every prompt includes a grounding rule: the model may only rephrase or organize facts the candidate supplied.
Outputs are returned as *suggestions* for the user to review and edit — never written straight into records.
"""

import json
import logging

from fastapi import HTTPException

from app.core.config import get_settings

log = logging.getLogger("careeros.ai")

GROUNDING = (
    "You are a careful career assistant. Use ONLY the facts provided in CANDIDATE_FACTS. "
    "Never invent projects, employers, job titles, dates, certifications, achievements, metrics, "
    "technologies, or education. If information is missing, say what the candidate should add instead. "
    "Never estimate hiring, interview, or selection probability. Respond with valid JSON only."
)


def _client():
    key = get_settings().GEMINI_API_KEY
    if not key:
        raise HTTPException(503, "AI assistance is not configured on this server")
    from google import genai

    return genai.Client(api_key=key)


def _json(prompt: str) -> dict | list:
    try:
        client = _client()
        resp = client.models.generate_content(
            model=get_settings().GEMINI_MODEL,
            contents=f"{GROUNDING}\n\n{prompt}",
            config={"response_mime_type": "application/json", "temperature": 0.3},
        )
        return json.loads(resp.text or "{}")
    except HTTPException:
        raise
    except Exception:  # never leak provider errors to the client
        log.exception("Gemini request failed")
        raise HTTPException(502, "AI assistance is temporarily unavailable. Please try again.")


def extract_skills(text: str) -> list[str]:
    data = _json(f'Extract technical and professional skill names explicitly mentioned in TEXT. '
                 f'Return {{"skills": [string]}}.\nTEXT:\n{text[:8000]}')
    return [s for s in data.get("skills", []) if isinstance(s, str)][:50] if isinstance(data, dict) else []


def analyze_job_requirements(description: str) -> dict:
    return _json('From JOB_DESCRIPTION return {"required_skills":[string],"preferred_skills":[string],'
                 f'"min_years": number}}.\nJOB_DESCRIPTION:\n{description[:8000]}')  # type: ignore[return-value]


def skill_gap_actions(facts: dict, gaps: list[dict]) -> dict[str, str]:
    data = _json('For each GAP give one concrete, short next action. Return {"actions": {skill: action}}.\n'
                 f"CANDIDATE_FACTS:\n{json.dumps(facts)}\nGAPS:\n{json.dumps(gaps)}")
    return data.get("actions", {}) if isinstance(data, dict) else {}


def resume_suggestions(facts: dict, sections: list, job: dict | None) -> list[dict]:
    data = _json('Suggest improved wording for resume bullet points. Only rephrase existing content; '
                 'do not add new claims. Return {"suggestions":[{"section":str,"original":str,"suggested":str,"reason":str}]}.\n'
                 f"CANDIDATE_FACTS:\n{json.dumps(facts, default=str)}\nRESUME:\n{json.dumps(sections)}\n"
                 f"TARGET_JOB:\n{json.dumps(job or {}, default=str)}")
    return data.get("suggestions", []) if isinstance(data, dict) else []


def interview_questions(kind: str, role: str | None, company: str | None, count: int) -> list[dict]:
    data = _json(f'Generate {count} {kind} interview practice questions for role "{role or "general"}"'
                 f'{" at " + company if company else ""}. Return {{"questions":[{{"category":str,"question":str}}]}}.')
    return data.get("questions", [])[:count] if isinstance(data, dict) else []


def mock_feedback(question: str, answer: str) -> str:
    data = _json('Give concise, constructive PRACTICE feedback (structure, clarity, specificity, what to add). '
                 'Do not score likelihood of success. Return {"feedback": string}.\n'
                 f"QUESTION:\n{question}\nANSWER:\n{answer[:6000]}")
    return data.get("feedback", "") if isinstance(data, dict) else ""


def career_assist(facts: dict, question: str) -> str:
    data = _json(f'Answer the candidate\'s question using their facts. Return {{"answer": string}}.\n'
                 f"CANDIDATE_FACTS:\n{json.dumps(facts, default=str)}\nQUESTION:\n{question[:2000]}")
    return data.get("answer", "") if isinstance(data, dict) else ""
