/**
 * Tasks API endpoint for sync operations
 *
 * Handles CRUD operations for tasks with the backend server.
 * Uses snake_case for API payloads (Python backend convention).
 */
import { z } from 'zod';
import { api } from '../client';
import type { Task, TaskTag, RecurrenceType } from '$lib/db/schema';

const recurrenceSchema = z.enum(['none', 'daily', 'weekly', 'monthly']);

export const serverTaskSchema = z.object({
	id: z.string().uuid(),
	text: z.string(),
	description: z.string(),
	completed: z.boolean(),
	important: z.boolean(),
	tag: z.string(),
	due_at: z.number().nullable(),
	recurrence: recurrenceSchema,
	recurrence_alt: z.boolean(),
	created_at: z.number(),
	updated_at: z.number(),
	deleted_at: z.number().nullable()
});

export type ServerTask = z.infer<typeof serverTaskSchema>;

const serverTaskListSchema = z.array(serverTaskSchema);

interface TaskPayload {
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
		id: task.serverId ?? task.id,
		text: task.text,
		description: task.description,
		completed: task.completed,
		important: task.important,
		tag: task.tag,
		due_at: task.dueAt,
		recurrence: task.recurrence,
		recurrence_alt: task.recurrenceAlt,
		created_at: task.createdAt,
		updated_at: task.updatedAt,
		deleted_at: task.deletedAt
	};
}

/**
 * Fetch all tasks, optionally filtering by updated timestamp
 */
export async function getAll(since?: number): Promise<ServerTask[]> {
	const endpoint = since && since > 0 ? `/tasks?since=${since}` : '/tasks';
	return api.getWithValidation(endpoint, serverTaskListSchema, { timeout: 10000 });
}

/**
 * Create a new task on the server
 */
export async function create(task: Task): Promise<ServerTask> {
	return api.postWithValidation('/tasks', serverTaskSchema, toPayload(task), {
		timeout: 10000
	});
}

/**
 * Update an existing task on the server
 */
export async function update(serverId: string, task: Task): Promise<ServerTask> {
	return api.patchWithValidation(`/tasks/${serverId}`, serverTaskSchema, toPayload(task), {
		timeout: 10000
	});
}

/**
 * Soft-delete a task from the server
 */
export async function remove(serverId: string): Promise<void> {
	await api.delete<void>(`/tasks/${serverId}`, { timeout: 10000 });
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
