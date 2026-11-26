"""Adapters for official public job-board APIs (Greenhouse, Lever, Ashby).

Each adapter calls the provider's documented public GET endpoint and normalizes the response into
`NormalizedJob`. Missing fields stay None — nothing is invented. No scraping, no auth bypass.
"""
from __future__ import annotations

import html
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone

import httpx

TOKEN_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$")
TIMEOUT = httpx.Timeout(20.0, connect=10.0)
USER_AGENT = "CareerOS-JobSync/1.0 (+public job board API client)"


class ProviderError(Exception):
    """Fetch failed. `kind` is safe to show to admins: NOT_FOUND | RATE_LIMITED | HTTP | NETWORK | INVALID_RESPONSE."""

    def __init__(self, kind: str, message: str):
        super().__init__(message)
        self.kind = kind


@dataclass
class NormalizedJob:
    external_id: str
    title: str
    description: str
    official_url: str
    apply_url: str
    location: str | None = None
    department: str | None = None
    employment_type: str | None = None
    work_mode: str | None = None  # Remote | Hybrid | On-site | None (unknown)
    salary: str | None = None
    published_at: datetime | None = None
    source_updated_at: datetime | None = None
    extra: dict = field(default_factory=dict)


def _strip_html(s: str | None) -> str:
    if not s:
        return ""
    s = html.unescape(s)  # Greenhouse returns HTML-escaped HTML
    s = re.sub(r"<(br|/p|/li|/h\d)\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    return re.sub(r"\n{3,}", "\n\n", s).strip()


def _iso(v) -> datetime | None:
    if not v or not isinstance(v, str):
        return None
    try:
        d = datetime.fromisoformat(v.replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _mode(v: str | None, remote_flag: bool | None = None) -> str | None:
    t = (v or "").lower().replace("-", "").replace("_", "")
    if "remote" in t:
        return "Remote"
    if "hybrid" in t:
        return "Hybrid"
    if "onsite" in t or "inoffice" in t:
        return "On-site"
    return "Remote" if remote_flag else None


def _clean(s) -> str | None:
    return s.strip() or None if isinstance(s, str) else None


def get_json(url: str, client: httpx.Client | None = None, retries: int = 2):
    """GET with timeout, limited retry on network/5xx, and explicit handling of 404 and 429."""
    own = client is None
    client = client or httpx.Client(timeout=TIMEOUT, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        for attempt in range(retries + 1):
            try:
                r = client.get(url)
            except httpx.HTTPError as e:
                if attempt == retries:
                    raise ProviderError("NETWORK", f"Network error contacting provider ({type(e).__name__})") from e
                time.sleep(1.5 * (attempt + 1))
                continue
            if r.status_code == 404:
                raise ProviderError("NOT_FOUND", "Board not found — check the board identifier")
            if r.status_code == 429:
                raise ProviderError("RATE_LIMITED", "Provider rate limit reached; will retry on the next run")
            if r.status_code >= 500 and attempt < retries:
                time.sleep(1.5 * (attempt + 1))
                continue
            if r.status_code >= 400:
                raise ProviderError("HTTP", f"Provider returned HTTP {r.status_code}")
            try:
                return r.json()
            except ValueError as e:
                raise ProviderError("INVALID_RESPONSE", "Provider returned invalid JSON") from e
    finally:
        if own:
            client.close()


class Provider:
    key = ""
    label = ""

    def url(self, token: str, region: str = "global") -> str:
        raise NotImplementedError

    def parse(self, payload, token: str) -> list[NormalizedJob]:
        raise NotImplementedError

    def fetch(self, token: str, region: str = "global", client: httpx.Client | None = None) -> list[NormalizedJob]:
        if not TOKEN_RE.match(token or ""):
            raise ProviderError("INVALID_RESPONSE", "Board identifier contains unsupported characters")
        return self.parse(get_json(self.url(token, region), client), token)


class Greenhouse(Provider):
    key, label = "greenhouse", "Greenhouse"

    def url(self, token, region="global"):
        return f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true"

    def parse(self, payload, token):
        if not isinstance(payload, dict) or not isinstance(payload.get("jobs"), list):
            raise ProviderError("INVALID_RESPONSE", "Unexpected Greenhouse response shape")
        out = []
        for j in payload["jobs"]:
            if not isinstance(j, dict) or not j.get("id") or not j.get("title") or not j.get("absolute_url"):
                continue
            loc = _clean((j.get("location") or {}).get("name"))
            depts = [d.get("name") for d in j.get("departments") or [] if isinstance(d, dict) and d.get("name")]
            out.append(NormalizedJob(
                external_id=str(j["id"]), title=j["title"].strip(), description=_strip_html(j.get("content")),
                official_url=j["absolute_url"], apply_url=j["absolute_url"], location=loc,
                department=", ".join(depts) or None, work_mode=_mode(loc),
                published_at=_iso(j.get("first_published")), source_updated_at=_iso(j.get("updated_at")),
            ))
        return out


class Lever(Provider):
    key, label = "lever", "Lever"

    def url(self, token, region="global"):
        host = "api.eu.lever.co" if region == "eu" else "api.lever.co"
        return f"https://{host}/v0/postings/{token}?mode=json"

    def parse(self, payload, token):
        if not isinstance(payload, list):
            raise ProviderError("INVALID_RESPONSE", "Unexpected Lever response shape")
        out = []
        for j in payload:
            if not isinstance(j, dict) or not j.get("id") or not j.get("text") or not j.get("hostedUrl"):
                continue
            cat = j.get("categories") or {}
            parts = [j.get("descriptionPlain") or _strip_html(j.get("description"))]
            for lst in j.get("lists") or []:
                if isinstance(lst, dict):
                    parts.append(f"{lst.get('text', '')}\n{_strip_html(lst.get('content'))}")
            parts.append(j.get("additionalPlain") or "")
            created = j.get("createdAt")
            sal = j.get("salaryRange") or {}
            salary = None
            if isinstance(sal, dict) and sal.get("min") is not None and sal.get("max") is not None:
                salary = f"{sal.get('currency', '')} {sal['min']:,}–{sal['max']:,} {sal.get('interval', '')}".strip()
            out.append(NormalizedJob(
                external_id=str(j["id"]), title=j["text"].strip(), description="\n\n".join(p for p in parts if p).strip(),
                official_url=j["hostedUrl"], apply_url=j.get("applyUrl") or j["hostedUrl"],
                location=_clean(cat.get("location")), department=_clean(cat.get("team")) or _clean(cat.get("department")),
                employment_type=_clean(cat.get("commitment")), work_mode=_mode(j.get("workplaceType")), salary=salary,
                published_at=datetime.fromtimestamp(created / 1000, tz=timezone.utc) if isinstance(created, (int, float)) else None,
            ))
        return out


class Ashby(Provider):
    key, label = "ashby", "Ashby"

    def url(self, token, region="global"):
        return f"https://api.ashbyhq.com/posting-api/job-board/{token}?includeCompensation=true"

    def parse(self, payload, token):
        if not isinstance(payload, dict) or not isinstance(payload.get("jobs"), list):
            raise ProviderError("INVALID_RESPONSE", "Unexpected Ashby response shape")
        out = []
        for j in payload["jobs"]:
            if not isinstance(j, dict) or j.get("isListed") is False or not j.get("id") or not j.get("title") or not j.get("jobUrl"):
                continue
            comp = j.get("compensation") or {}
            salary = None
            if j.get("shouldDisplayCompensationOnJobPostings") and isinstance(comp, dict):
                salary = _clean(comp.get("compensationTierSummary"))
            et = {"FullTime": "Full-time", "PartTime": "Part-time", "Intern": "Internship", "Contract": "Contract",
                  "Temporary": "Temporary"}.get(j.get("employmentType") or "", _clean(j.get("employmentType")))
            out.append(NormalizedJob(
                external_id=str(j["id"]), title=j["title"].strip(),
                description=(j.get("descriptionPlain") or _strip_html(j.get("descriptionHtml"))).strip(),
                official_url=j["jobUrl"], apply_url=j.get("applyUrl") or j["jobUrl"], location=_clean(j.get("location")),
                department=_clean(j.get("department")), employment_type=et,
                work_mode=_mode(j.get("workplaceType"), j.get("isRemote")), salary=(salary or "")[:80] or None,
                published_at=_iso(j.get("publishedAt")),
            ))
        return out


PROVIDERS: dict[str, Provider] = {p.key: p for p in (Greenhouse(), Lever(), Ashby())}
