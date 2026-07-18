"""
Background scheduler for task reminder notifications.
"""
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import and_, select

from app.db.session import AsyncSessionLocal
from app.models.task import Task, now_ms
from app.services.notification_service import send_task_reminder

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

# In-memory tracking of reminded tasks: task_id -> reminded_at (ms)
reminded_tasks: dict[str, int] = {}


async def check_upcoming_tasks() -> None:
    """
    Check for tasks due in approximately 15 minutes and send reminders.

    Runs every minute. Uses a 1-minute window (14.5-15.5 min) to account
    for scheduler timing variations.
    """
    now = now_ms()

    # Reminder window: 15 minutes from now, +/- 30 seconds
    reminder_window_start = now + (15 * 60 * 1000) - 30000  # 14:30 from now
    reminder_window_end = now + (15 * 60 * 1000) + 30000  # 15:30 from now

    async with AsyncSessionLocal() as session:
        stmt = select(Task).where(
            and_(
                Task.due_at.isnot(None),
                Task.due_at >= reminder_window_start,
                Task.due_at <= reminder_window_end,
                Task.completed.is_(False),
                Task.deleted_at.is_(None),
            )
        )

        result = await session.execute(stmt)
        tasks = result.scalars().all()

        for task in tasks:
            task_id = str(task.id)

            if task_id in reminded_tasks:
                continue

            success = await send_task_reminder(
                task_id=task_id,
                task_text=task.text,
                due_at=task.due_at,
            )

            if success:
                reminded_tasks[task_id] = now
                logger.info("Sent reminder for task: %s", task.text)
            else:
                logger.warning("Failed to send reminder for task: %s", task.text)

    # Prune entries older than 1 hour
    cleanup_threshold = now - (60 * 60 * 1000)
    stale_ids = [tid for tid, reminded_at in reminded_tasks.items() if reminded_at < cleanup_threshold]
    for tid in stale_ids:
        del reminded_tasks[tid]


def start_scheduler() -> None:
    """Start the background scheduler for task reminders."""
    scheduler.add_job(
        check_upcoming_tasks,
        trigger=IntervalTrigger(minutes=1),
        id="task_reminders",
        name="Check for tasks due in 15 minutes",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Task reminder scheduler started")


def stop_scheduler() -> None:
    """Stop the background scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Task reminder scheduler stopped")
