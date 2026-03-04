/**
 * Tasks API endpoint for sync operations
 *
 * Handles CRUD operations for tasks with the backend server.
 * Uses snake_case for API payloads (Python backend convention).
 */
import { api } from '../client';
import type { Task, TaskTag, RecurrenceType } from '$lib/db/schema';

// Backend uses snake_case
interface TaskPayload {
	text: string;
	description: string;
	completed: boolean;
	important: boolean;
	tag: TaskTag;
	due_at: number | null;
	recurrence: RecurrenceType;
	recurrence_alt: boolean;
	created_at: number;
	updated_at: number;
}

// Server response format (snake_case)
export interface ServerTask {
	id: string;
	text: string;
	description: string;
	completed: boolean;
	important: boolean;
	tag: TaskTag;
	due_at: number | null;
	recurrence: RecurrenceType;
	recurrence_alt: boolean;
	created_at: number;
	updated_at: number;
	deleted_at: number | null;
}

/**
 * Convert local Task to API payload (camelCase -> snake_case)
 */
function toPayload(task: Task): TaskPayload {
	return {
		text: task.text,
		description: task.description,
		completed: task.completed,
		important: task.important,
		tag: task.tag,
		due_at: task.dueAt,
		recurrence: task.recurrence,
		recurrence_alt: task.recurrenceAlt,
		created_at: task.createdAt,
		updated_at: task.updatedAt
	};
}

/**
 * Fetch all tasks, optionally filtering by updated timestamp
 */
export async function getAll(since?: number) {
	const endpoint = since && since > 0 ? `/tasks?since=${since}` : '/tasks';
	return api.get<{ data: ServerTask[] } | ServerTask[]>(endpoint, { timeout: 10000 });
}

/**
 * Create a new task on the server
 */
export async function create(task: Task) {
	return api.post<{ data?: { id: string }; id?: string }>('/tasks', toPayload(task), {
		timeout: 10000
	});
}

/**
 * Update an existing task on the server
 */
export async function update(serverId: string, task: Task) {
	return api.patch<void>(`/tasks/${serverId}`, toPayload(task), {
		timeout: 10000
	});
}

/**
 * Delete a task from the server
 */
export async function remove(serverId: string) {
	return api.delete<void>(`/tasks/${serverId}`, { timeout: 10000 });
}

/**
 * Tasks endpoint namespace
 */
export const tasks = {
	getAll,
	create,
	update,
	remove
};
