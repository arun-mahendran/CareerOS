import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.core.config import get_settings
from app.routers import ai, data, admin, admin_analytics, analytics, applications, auth, companies, interviews, jobs, notifications, resumes, roadmap, skills, users

log = logging.getLogger("careeros")
settings = get_settings()

app = FastAPI(
    title="CareerOS API",
    version="1.0.0",
    docs_url="/docs",
    openapi_tags=[{"name": n} for n in (
        "Authentication", "Users", "Jobs", "Companies", "Skill Gap", "Roadmap", "Resources", "Resumes",
        "Interviews", "Applications", "Calendar", "Notifications", "Analytics", "Admin")],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# ---- Consistent error shape: {"error": {"status": int, "message": str, "details"?: any}} ----
def _err(status: int, message: str, details=None) -> JSONResponse:
    body = {"error": {"status": status, "message": message}}
    if details is not None:
        body["error"]["details"] = details
    return JSONResponse(status_code=status, content=body)


@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException):
    return _err(exc.status_code, str(exc.detail))


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    details = [{"field": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()]
    return _err(422, "Some fields are invalid", details)


@app.exception_handler(IntegrityError)
async def integrity_error(_: Request, exc: IntegrityError):
    log.warning("Integrity error: %s", exc.orig)
    return _err(409, "This conflicts with existing data")


@app.exception_handler(SQLAlchemyError)
async def db_error(_: Request, exc: SQLAlchemyError):
    log.exception("Database error")
    return _err(500, "Something went wrong. Please try again.")


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    log.exception("Unhandled error")
    return _err(500, "Something went wrong. Please try again.")


for r in (auth.router, users.router, jobs.router, jobs.opportunities, companies.router, skills.router, roadmap.router, roadmap.resources,
          resumes.router, interviews.router, applications.router, notifications.router, notifications.calendar,
          analytics.router, analytics.dashboard, admin.router, admin_analytics.router, data.router, ai.router):
    app.include_router(r, prefix="/api/v1")


@app.get("/api/v1/health", tags=["Admin"])
def health():
    return {"status": "ok"}
