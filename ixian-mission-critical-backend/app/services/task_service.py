"""
Task service for CRUD operations.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task, now_ms
from app.schemas.task import TaskCreate, TaskUpdate

# Hard cap for list endpoints (sync and UI)
DEFAULT_TASK_LIMIT = 1000


class TaskService:
    """Service for task CRUD operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, task_id: str) -> Task | None:
        """Get a task by ID."""
        result = await self.db.execute(select(Task).where(Task.id == task_id))
        return result.scalar_one_or_none()

    async def get_all(
        self,
        tag: str | None = None,
        completed: bool | None = None,
        important: bool | None = None,
        since: int | None = None,
        include_deleted: bool = False,
        limit: int = DEFAULT_TASK_LIMIT,
    ) -> list[Task]:
        """
        Get all tasks with optional filters.

        Args:
            tag: Filter by tag name
            completed: Filter by completion status
            important: Filter by importance
            since: If provided, return tasks updated after this timestamp
            include_deleted: If True, include soft-deleted tasks
            limit: Maximum rows to return
        """
        query = select(Task)

        if since is not None:
            query = query.where(Task.updated_at > since)
            include_deleted = True

        if not include_deleted:
            query = query.where(Task.deleted_at.is_(None))

        if tag is not None:
            query = query.where(Task.tag == tag)

        if completed is not None:
            query = query.where(Task.completed == completed)

        if important is not None:
            query = query.where(Task.important == important)

        if since is not None:
            query = query.order_by(Task.updated_at.desc())
        else:
            query = query.order_by(Task.created_at.desc())

        query = query.limit(min(max(limit, 1), DEFAULT_TASK_LIMIT))

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def create(self, task_in: TaskCreate) -> Task:
        """Create a new task, honoring optional client id and timestamps."""
        current_time = now_ms()
        created_at = task_in.created_at if task_in.created_at is not None else current_time
        updated_at = task_in.updated_at if task_in.updated_at is not None else current_time

        task_kwargs: dict = {
            "text": task_in.text,
            "description": task_in.description,
            "completed": task_in.completed,
            "important": task_in.important,
            "tag": task_in.tag,
            "due_at": task_in.due_at,
            "recurrence": task_in.recurrence.value,
            "recurrence_alt": task_in.recurrence_alt,
            "created_at": created_at,
            "updated_at": updated_at,
            "deleted_at": task_in.deleted_at,
        }
        if task_in.id is not None:
            task_kwargs["id"] = str(task_in.id)

        task = Task(**task_kwargs)
        self.db.add(task)
        await self.db.flush()
        await self.db.refresh(task)
        return task

    async def update(self, task_id: str, task_in: TaskUpdate) -> Task | None:
        """
        Update an existing task.

        Returns None if task not found.
        """
        task = await self.get_by_id(task_id)
        if task is None:
            return None

        update_data = task_in.model_dump(exclude_unset=True)
        client_updated_at = update_data.pop("updated_at", None)

        for field, value in update_data.items():
            if field == "recurrence" and value is not None:
                value = value.value
            setattr(task, field, value)

        task.updated_at = client_updated_at if client_updated_at is not None else now_ms()
        await self.db.flush()
        await self.db.refresh(task)
        return task

    async def soft_delete(self, task_id: str) -> bool:
        """
        Soft delete a task by setting deleted_at.

        Returns True if task was deleted, False if not found.
        """
        task = await self.get_by_id(task_id)
        if task is None:
            return False

        task.deleted_at = now_ms()
        task.updated_at = now_ms()
        await self.db.flush()
        return True

    async def hard_delete(self, task_id: str) -> bool:
        """
        Permanently delete a task.

        Returns True if task was deleted, False if not found.
        """
        task = await self.get_by_id(task_id)
        if task is None:
            return False

        await self.db.delete(task)
        await self.db.flush()
        return True
