"""
Background scheduler — APScheduler running in the FastAPI asyncio event loop.

Two jobs:
  sync_all_users          — every 6 hours: full sync (accounts + transactions)
  daily_balance_snapshot  — midnight UTC: balance-only snapshot

Both jobs are idempotent. Errors are per-item isolated so one broken
institution never blocks syncing the rest.
"""
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.plaid_item import PlaidItem
from app.services.sync import fetch_accounts, sync_item

logger = logging.getLogger(__name__)

# One scheduler instance shared across startup/shutdown hooks
scheduler = AsyncIOScheduler(timezone="UTC")


# ---------------------------------------------------------------------------
# Job helpers — each item runs in its own session to prevent one failure
# from rolling back work already done for other items.
# ---------------------------------------------------------------------------

async def _sync_item_safe(item_id: str) -> None:
    """Load a PlaidItem in a fresh session and run a full sync."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(PlaidItem).where(PlaidItem.id == item_id)
        )
        item = result.scalar_one_or_none()
        if item is None:
            return
        await sync_item(item, db)


async def _snapshot_item_safe(item_id: str) -> None:
    """Load a PlaidItem in a fresh session and take a balance snapshot."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(PlaidItem).where(PlaidItem.id == item_id)
        )
        item = result.scalar_one_or_none()
        if item is None:
            return
        await fetch_accounts(item, db)


async def _get_all_item_ids() -> list:
    """Return all PlaidItem primary keys in a short-lived session."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(PlaidItem.id))
        return result.scalars().all()


# ---------------------------------------------------------------------------
# Scheduled jobs
# ---------------------------------------------------------------------------

async def job_sync_all_users() -> None:
    """Full sync (accounts + transactions) for every linked institution."""
    logger.info("Scheduler: starting full sync for all users")
    item_ids = await _get_all_item_ids()
    synced = 0
    errors = 0

    for item_id in item_ids:
        try:
            await _sync_item_safe(item_id)
            synced += 1
        except Exception as exc:
            errors += 1
            logger.error(
                "Scheduler: sync_all_users — item_id=%s error: %s",
                item_id,
                exc,
            )

    logger.info(
        "Scheduler: full sync complete — %d succeeded, %d failed",
        synced,
        errors,
    )


async def job_daily_balance_snapshot() -> None:
    """Capture a balance snapshot for every institution at midnight UTC."""
    logger.info("Scheduler: starting midnight balance snapshot")
    item_ids = await _get_all_item_ids()
    snapped = 0
    errors = 0

    for item_id in item_ids:
        try:
            await _snapshot_item_safe(item_id)
            snapped += 1
        except Exception as exc:
            errors += 1
            logger.error(
                "Scheduler: daily_balance_snapshot — item_id=%s error: %s",
                item_id,
                exc,
            )

    logger.info(
        "Scheduler: balance snapshot complete — %d succeeded, %d failed",
        snapped,
        errors,
    )


# ---------------------------------------------------------------------------
# Lifecycle helpers — called from main.py lifespan
# ---------------------------------------------------------------------------

def start_scheduler() -> None:
    """Register jobs and start the scheduler. Called once at app startup."""
    scheduler.add_job(
        job_sync_all_users,
        trigger="cron",
        hour="*/6",          # 00:00, 06:00, 12:00, 18:00 UTC
        minute=0,
        id="sync_all_users",
        replace_existing=True,
        misfire_grace_time=300,  # allow up to 5-min late start
    )
    scheduler.add_job(
        job_daily_balance_snapshot,
        trigger="cron",
        hour=0,
        minute=0,
        id="daily_balance_snapshot",
        replace_existing=True,
        misfire_grace_time=300,
    )
    scheduler.start()
    logger.info(
        "Scheduler started — sync every 6 h, balance snapshot at midnight UTC"
    )


def stop_scheduler() -> None:
    """Gracefully stop the scheduler. Called on app shutdown."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
