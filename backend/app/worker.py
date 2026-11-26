"""Background job-sync worker. Run as its own process (never inside Uvicorn, so reloads/workers don't duplicate it):

    python -m app.worker            # loop every JOB_SYNC_INTERVAL_MINUTES
    python -m app.worker --once     # single pass (cron-friendly)

A Postgres advisory lock keeps a single scheduler active even if several workers start; per-source locks
prevent overlapping syncs of the same source (e.g. a manual admin sync during a scheduled run).
"""
import argparse
import logging
import time

from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import SessionLocal, engine
from app.services.job_sources import sync_all

log = logging.getLogger("careeros.worker")
SCHEDULER_LOCK_ID = 774_201_001


def one_pass() -> None:
    with SessionLocal() as db:
        results = sync_all(db)
    ok = sum(1 for r in results.values() if r.get("ok"))
    log.info("sync pass finished: %d/%d sources ok, %d new jobs", ok, len(results),
             sum(r.get("new", 0) for r in results.values()))


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    ap = argparse.ArgumentParser()
    ap.add_argument("--once", action="store_true")
    args = ap.parse_args()
    if args.once:
        one_pass()
        return
    interval = max(5, get_settings().JOB_SYNC_INTERVAL_MINUTES) * 60
    with engine.connect() as conn:
        if engine.dialect.name == "postgresql" and not conn.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": SCHEDULER_LOCK_ID}).scalar():
            log.warning("another sync worker is already running; exiting")
            return
        log.info("job sync worker started, interval %d min", interval // 60)
        while True:
            try:
                one_pass()
            except Exception:
                log.exception("sync pass failed")
            time.sleep(interval)


if __name__ == "__main__":
    main()
