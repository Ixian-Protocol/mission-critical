"""
Tests for the Task API endpoints.

Uses pytest-describe for BDD-style test organization.
"""
import uuid
from typing import Any

import pytest
from httpx import AsyncClient

from app.models.task import Task, now_ms


def describe_tasks_api():
    """Tests for /api/v1/tasks endpoints."""

    def describe_create_task():
        """POST /api/v1/tasks endpoint tests."""

        @pytest.mark.asyncio
        async def it_creates_a_task_with_valid_data(
            client: AsyncClient, sample_task_data: dict[str, Any]
        ):
            # Act
            response = await client.post("/api/v1/tasks", json=sample_task_data)

            # Assert
            assert response.status_code == 201
            data = response.json()
            assert data["text"] == sample_task_data["text"]
            assert data["description"] == sample_task_data["description"]
            assert data["completed"] == sample_task_data["completed"]
            assert data["important"] == sample_task_data["important"]
            assert data["tag"] == sample_task_data["tag"]
            assert "id" in data
            assert "created_at" in data
            assert "updated_at" in data
            assert data["deleted_at"] is None

        @pytest.mark.asyncio
        async def it_creates_a_task_with_minimal_data(client: AsyncClient):
            # Arrange - only required field is text
            task_data = {"text": "Minimal task"}

            # Act
            response = await client.post("/api/v1/tasks", json=task_data)

            # Assert
            assert response.status_code == 201
            data = response.json()
            assert data["text"] == "Minimal task"
            assert data["description"] == ""
            assert data["completed"] is False
            assert data["important"] is False
            assert data["tag"] == "General"
            assert data["recurrence"] == "none"

        @pytest.mark.asyncio
        async def it_honors_client_id_and_timestamps(client: AsyncClient):
            task_id = str(uuid.uuid4())
            created_at = 1_700_000_000_000
            updated_at = 1_700_000_100_000
            task_data = {
                "id": task_id,
                "text": "Client timed task",
                "created_at": created_at,
                "updated_at": updated_at,
            }

            response = await client.post("/api/v1/tasks", json=task_data)

            assert response.status_code == 201
            data = response.json()
            assert data["id"] == task_id
            assert data["created_at"] == created_at
            assert data["updated_at"] == updated_at

        @pytest.mark.asyncio
        async def it_creates_a_task_with_all_tags(client: AsyncClient):
            # Test each valid tag
            tags = ["General", "Work", "Personal", "Research", "Design"]

            for tag in tags:
                # Act
                response = await client.post(
                    "/api/v1/tasks",
                    json={"text": f"Task with {tag} tag", "tag": tag}
                )

                # Assert
                assert response.status_code == 201
                assert response.json()["tag"] == tag

        @pytest.mark.asyncio
        async def it_creates_a_task_with_recurrence(client: AsyncClient):
            # Test each recurrence type
            recurrences = ["none", "daily", "weekly", "monthly"]

            for recurrence in recurrences:
                # Act
                response = await client.post(
                    "/api/v1/tasks",
                    json={
                        "text": f"Task with {recurrence} recurrence",
                        "recurrence": recurrence
                    }
                )

                # Assert
                assert response.status_code == 201
                assert response.json()["recurrence"] == recurrence

        @pytest.mark.asyncio
        async def it_creates_a_task_with_due_date(client: AsyncClient):
            # Arrange
            due_at = now_ms() + 86400000  # Tomorrow

            # Act
            response = await client.post(
                "/api/v1/tasks",
                json={"text": "Task with due date", "due_at": due_at}
            )

            # Assert
            assert response.status_code == 201
            assert response.json()["due_at"] == due_at

        @pytest.mark.asyncio
        async def it_returns_422_for_empty_text(client: AsyncClient):
            # Act
            response = await client.post("/api/v1/tasks", json={"text": ""})

            # Assert
            assert response.status_code == 422
            data = response.json()
            # API uses custom error structure with "error" key
            assert "error" in data
            assert data["error"]["type"] == "ValidationError"

        @pytest.mark.asyncio
        async def it_returns_422_for_missing_text(client: AsyncClient):
            # Act
            response = await client.post("/api/v1/tasks", json={})

            # Assert
            assert response.status_code == 422

        @pytest.mark.asyncio
        async def it_returns_422_for_text_too_long(client: AsyncClient):
            # Arrange - text max length is 500
            long_text = "a" * 501

            # Act
            response = await client.post("/api/v1/tasks", json={"text": long_text})

            # Assert
            assert response.status_code == 422

        @pytest.mark.asyncio
        async def it_accepts_custom_tag_names(client: AsyncClient):
            # Tags are now dynamic - any string up to 50 chars is valid
            # Act
            response = await client.post(
                "/api/v1/tasks",
                json={"text": "Task", "tag": "CustomTag"}
            )

            # Assert
            assert response.status_code == 201
            assert response.json()["tag"] == "CustomTag"

        @pytest.mark.asyncio
        async def it_returns_422_for_invalid_recurrence(client: AsyncClient):
            # Act
            response = await client.post(
                "/api/v1/tasks",
                json={"text": "Task", "recurrence": "yearly"}
            )

            # Assert
            assert response.status_code == 422

    def describe_get_tasks():
        """GET /api/v1/tasks endpoint tests."""

        @pytest.mark.asyncio
        async def it_returns_empty_list_when_no_tasks_exist(client: AsyncClient):
            # Act
            response = await client.get("/api/v1/tasks")

            # Assert
            assert response.status_code == 200
            assert response.json() == []

        @pytest.mark.asyncio
        async def it_returns_all_non_deleted_tasks(
            client: AsyncClient, multiple_tasks: list[Task]
        ):
            # Act
            response = await client.get("/api/v1/tasks")

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert len(data) == len(multiple_tasks)

        @pytest.mark.asyncio
        async def it_excludes_soft_deleted_tasks(
            client: AsyncClient,
            existing_task: Task,
            deleted_task: Task,
        ):
            # Act
            response = await client.get("/api/v1/tasks")

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["id"] == existing_task.id

        @pytest.mark.asyncio
        async def it_filters_by_tag(
            client: AsyncClient, multiple_tasks: list[Task]
        ):
            # Act
            response = await client.get("/api/v1/tasks", params={"tag": "Work"})

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2
            for task in data:
                assert task["tag"] == "Work"

        @pytest.mark.asyncio
        async def it_filters_by_completed(
            client: AsyncClient, multiple_tasks: list[Task]
        ):
            # Act - get completed tasks
            response = await client.get("/api/v1/tasks", params={"completed": True})

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["completed"] is True

        @pytest.mark.asyncio
        async def it_filters_by_not_completed(
            client: AsyncClient, multiple_tasks: list[Task]
        ):
            # Act - get incomplete tasks
            response = await client.get("/api/v1/tasks", params={"completed": False})

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 3
            for task in data:
                assert task["completed"] is False

        @pytest.mark.asyncio
        async def it_filters_by_important(
            client: AsyncClient, multiple_tasks: list[Task]
        ):
            # Act
            response = await client.get("/api/v1/tasks", params={"important": True})

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2
            for task in data:
                assert task["important"] is True

        @pytest.mark.asyncio
        async def it_combines_multiple_filters(
            client: AsyncClient, multiple_tasks: list[Task]
        ):
            # Act - get incomplete, important tasks
            response = await client.get(
                "/api/v1/tasks",
                params={"completed": False, "important": True}
            )

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2
            for task in data:
                assert task["completed"] is False
                assert task["important"] is True

        @pytest.mark.asyncio
        async def it_returns_empty_when_no_tasks_match_filter(
            client: AsyncClient, multiple_tasks: list[Task]
        ):
            # Act - no Design tasks exist
            response = await client.get("/api/v1/tasks", params={"tag": "Design"})

            # Assert
            assert response.status_code == 200
            assert response.json() == []

        @pytest.mark.asyncio
        async def it_filters_by_since(
            client: AsyncClient, multiple_tasks: list[Task]
        ):
            # Arrange - only the newest task should be newer than this timestamp
            since = multiple_tasks[1].updated_at

            # Act
            response = await client.get("/api/v1/tasks", params={"since": since})

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["id"] == multiple_tasks[0].id

        @pytest.mark.asyncio
        async def it_includes_soft_deleted_tasks_when_filtering_by_since(
            client: AsyncClient, existing_task: Task, deleted_task: Task
        ):
            # Arrange - since-based pulls are used for sync and must carry tombstones
            since = deleted_task.updated_at - 10000

            # Act
            response = await client.get("/api/v1/tasks", params={"since": since})

            # Assert
            assert response.status_code == 200
            ids = {task["id"] for task in response.json()}
            assert existing_task.id in ids
            assert deleted_task.id in ids

    def describe_get_task():
        """GET /api/v1/tasks/{id} endpoint tests."""

        @pytest.mark.asyncio
        async def it_returns_task_by_id(
            client: AsyncClient, existing_task: Task
        ):
            # Act
            response = await client.get(f"/api/v1/tasks/{existing_task.id}")

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == existing_task.id
            assert data["text"] == existing_task.text
            assert data["description"] == existing_task.description

        @pytest.mark.asyncio
        async def it_returns_404_for_nonexistent_task(client: AsyncClient):
            # Arrange
            nonexistent_id = str(uuid.uuid4())

            # Act
            response = await client.get(f"/api/v1/tasks/{nonexistent_id}")

            # Assert
            assert response.status_code == 404

        @pytest.mark.asyncio
        async def it_returns_422_for_invalid_uuid(client: AsyncClient):
            # Act
            response = await client.get("/api/v1/tasks/not-a-uuid")

            # Assert
            assert response.status_code == 422

        @pytest.mark.asyncio
        async def it_can_retrieve_soft_deleted_task(
            client: AsyncClient, deleted_task: Task
        ):
            # Note: get_task does not filter by deleted_at, so deleted tasks
            # can still be retrieved by ID
            # Act
            response = await client.get(f"/api/v1/tasks/{deleted_task.id}")

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == deleted_task.id
            assert data["deleted_at"] is not None

    def describe_update_task():
        """PATCH /api/v1/tasks/{id} endpoint tests."""

        @pytest.mark.asyncio
        async def it_updates_task_text(
            client: AsyncClient, existing_task: Task
        ):
            # Act
            response = await client.patch(
                f"/api/v1/tasks/{existing_task.id}",
                json={"text": "Updated text"}
            )

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert data["text"] == "Updated text"
            assert data["description"] == existing_task.description  # Unchanged

        @pytest.mark.asyncio
        async def it_updates_multiple_fields(
            client: AsyncClient, existing_task: Task
        ):
            # Arrange
            update_data = {
                "text": "New text",
                "description": "New description",
                "completed": True,
                "important": True,
                "tag": "Work",
            }

            # Act
            response = await client.patch(
                f"/api/v1/tasks/{existing_task.id}",
                json=update_data
            )

            # Assert
            assert response.status_code == 200
            data = response.json()
            assert data["text"] == "New text"
            assert data["description"] == "New description"
            assert data["completed"] is True
            assert data["important"] is True
            assert data["tag"] == "Work"

        @pytest.mark.asyncio
        async def it_updates_updated_at_timestamp(
            client: AsyncClient, existing_task: Task
        ):
            # Arrange
            original_updated_at = existing_task.updated_at

            # Act
            response = await client.patch(
                f"/api/v1/tasks/{existing_task.id}",
                json={"text": "Updated"}
            )

            # Assert
            assert response.status_code == 200
            assert response.json()["updated_at"] > original_updated_at

        @pytest.mark.asyncio
        async def it_returns_404_for_nonexistent_task(client: AsyncClient):
            # Arrange
            nonexistent_id = str(uuid.uuid4())

            # Act
            response = await client.patch(
                f"/api/v1/tasks/{nonexistent_id}",
                json={"text": "Updated"}
            )

            # Assert
            assert response.status_code == 404

        @pytest.mark.asyncio
        async def it_returns_422_for_empty_text(
            client: AsyncClient, existing_task: Task
        ):
            # Act
            response = await client.patch(
                f"/api/v1/tasks/{existing_task.id}",
                json={"text": ""}
            )

            # Assert
            assert response.status_code == 422

        @pytest.mark.asyncio
        async def it_accepts_custom_tag_on_update(
            client: AsyncClient, existing_task: Task
        ):
            # Tags are now dynamic - any string up to 50 chars is valid
            # Act
            response = await client.patch(
                f"/api/v1/tasks/{existing_task.id}",
                json={"tag": "CustomTag"}
            )

            # Assert
            assert response.status_code == 200
            assert response.json()["tag"] == "CustomTag"

        @pytest.mark.asyncio
        async def it_allows_empty_update(
            client: AsyncClient, existing_task: Task
        ):
            # Act - sending empty update is valid (no changes)
            response = await client.patch(
                f"/api/v1/tasks/{existing_task.id}",
                json={}
            )

            # Assert
            assert response.status_code == 200

    def describe_delete_task():
        """DELETE /api/v1/tasks/{id} (soft delete) endpoint tests."""

        @pytest.mark.asyncio
        async def it_soft_deletes_task(
            client: AsyncClient, existing_task: Task
        ):
            # Act
            response = await client.delete(f"/api/v1/tasks/{existing_task.id}")

            # Assert
            assert response.status_code == 204

            # Verify task is soft-deleted (still retrievable but has deleted_at)
            get_response = await client.get(f"/api/v1/tasks/{existing_task.id}")
            assert get_response.status_code == 200
            assert get_response.json()["deleted_at"] is not None

        @pytest.mark.asyncio
        async def it_excludes_soft_deleted_from_list(
            client: AsyncClient, existing_task: Task
        ):
            # Arrange - soft delete the task
            await client.delete(f"/api/v1/tasks/{existing_task.id}")

            # Act
            response = await client.get("/api/v1/tasks")

            # Assert - task should not appear in list
            assert response.status_code == 200
            assert response.json() == []

        @pytest.mark.asyncio
        async def it_returns_404_for_nonexistent_task(client: AsyncClient):
            # Arrange
            nonexistent_id = str(uuid.uuid4())

            # Act
            response = await client.delete(f"/api/v1/tasks/{nonexistent_id}")

            # Assert
            assert response.status_code == 404

        @pytest.mark.asyncio
        async def it_returns_422_for_invalid_uuid(client: AsyncClient):
            # Act
            response = await client.delete("/api/v1/tasks/not-a-uuid")

            # Assert
            assert response.status_code == 422

    def describe_hard_delete_task():
        """DELETE /api/v1/tasks/{id}/hard endpoint tests."""

        @pytest.mark.asyncio
        async def it_permanently_deletes_task(
            client: AsyncClient, existing_task: Task
        ):
            # Act
            response = await client.delete(f"/api/v1/tasks/{existing_task.id}/hard")

            # Assert
            assert response.status_code == 204

            # Verify task is completely gone
            get_response = await client.get(f"/api/v1/tasks/{existing_task.id}")
            assert get_response.status_code == 404

        @pytest.mark.asyncio
        async def it_can_hard_delete_soft_deleted_task(
            client: AsyncClient, deleted_task: Task
        ):
            # Act
            response = await client.delete(f"/api/v1/tasks/{deleted_task.id}/hard")

            # Assert
            assert response.status_code == 204

            # Verify task is completely gone
            get_response = await client.get(f"/api/v1/tasks/{deleted_task.id}")
            assert get_response.status_code == 404

        @pytest.mark.asyncio
        async def it_returns_404_for_nonexistent_task(client: AsyncClient):
            # Arrange
            nonexistent_id = str(uuid.uuid4())

            # Act
            response = await client.delete(f"/api/v1/tasks/{nonexistent_id}/hard")

            # Assert
            assert response.status_code == 404
