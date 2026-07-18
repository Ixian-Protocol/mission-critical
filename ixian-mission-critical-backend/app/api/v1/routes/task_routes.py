"""
Task API routes.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.controllers.task_controller import TaskController
from app.db.session import get_db
from app.schemas.task import (
    TaskCreate,
    TaskResponse,
    TaskUpdate,
)

router = APIRouter(tags=["Tasks"])


@router.get(
    "/tasks",
    response_model=list[TaskResponse],
    summary="List tasks",
    description="Get all non-deleted tasks with optional filtering. "
    "Capped at 1000 results.",
)
async def get_tasks(
    tag: str | None = Query(None, description="Filter by tag name"),
    completed: bool | None = Query(None, description="Filter by completion status"),
    important: bool | None = Query(None, description="Filter by importance"),
    since: int | None = Query(
        None,
        ge=0,
        description=(
            "Unix timestamp (ms). Returns tasks with updated_at > since, "
            "including soft-deleted tasks for sync."
        ),
    ),
    limit: int = Query(
        1000,
        ge=1,
        le=1000,
        description="Maximum number of tasks to return",
    ),
    db: AsyncSession = Depends(get_db),
) -> list[TaskResponse]:
    """Get tasks with optional filters; since-based sync includes soft-deleted tasks."""
    controller = TaskController(db)
    return await controller.get_tasks(
        tag=tag,
        completed=completed,
        important=important,
        since=since,
        limit=limit,
    )


@router.get(
    "/tasks/{task_id}",
    response_model=TaskResponse,
    summary="Get task",
    description="Get a single task by its ID.",
    responses={
        200: {"description": "Task found"},
        404: {"description": "Task not found"},
    },
)
async def get_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    """Get a single task by ID."""
    controller = TaskController(db)
    return await controller.get_task(str(task_id))


@router.post(
    "/tasks",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create task",
    description="Create a new task. Optional client id and timestamps are honored for sync.",
)
async def create_task(
    task_in: TaskCreate,
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    """Create a new task."""
    controller = TaskController(db)
    return await controller.create_task(task_in)


@router.patch(
    "/tasks/{task_id}",
    response_model=TaskResponse,
    summary="Update task",
    description="Update an existing task. Only provided fields are updated.",
    responses={
        200: {"description": "Task updated"},
        404: {"description": "Task not found"},
    },
)
async def update_task(
    task_id: UUID,
    task_in: TaskUpdate,
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    """Update an existing task."""
    controller = TaskController(db)
    return await controller.update_task(str(task_id), task_in)


@router.delete(
    "/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete task",
    description="Soft-delete a task by setting deleted_at timestamp.",
    responses={
        204: {"description": "Task deleted"},
        404: {"description": "Task not found"},
    },
)
async def delete_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Soft-delete a task."""
    controller = TaskController(db)
    await controller.delete_task(str(task_id))


@router.delete(
    "/tasks/{task_id}/hard",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Hard delete task",
    description=(
        "Permanently delete a task. Intended for LAN/homelab maintenance only; "
        "prefer soft delete for normal clients."
    ),
    responses={
        204: {"description": "Task permanently deleted"},
        404: {"description": "Task not found"},
    },
    include_in_schema=False,
)
async def hard_delete_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Permanently delete a task."""
    controller = TaskController(db)
    await controller.hard_delete_task(str(task_id))
