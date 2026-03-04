/**
 * Task CRUD operations with reactive queries
 *
 * Uses Dexie's liveQuery for automatic UI updates when data changes.
 * All mutations mark tasks as 'pending' for sync.
 */

import { liveQuery, type Observable } from 'dexie';
import { db, type Task, type TaskTag, type RecurrenceType } from './schema';
import { triggerSync } from './sync.svelte';

/**
 * Filter type for task lists
 */
export type TaskFilter = 'all' | 'today' | 'important';

/**
 * Create a new task
 */
export async function createTask(data: {
	text: string;
	description?: string;
	important?: boolean;
	tag?: TaskTag;
	dueAt?: number | null;
	recurrence?: RecurrenceType;
	recurrenceAlt?: boolean;
}): Promise<Task> {
	const now = Date.now();
	const task: Task = {
		id: crypto.randomUUID(),
		text: data.text,
		description: data.description ?? '',
		completed: false,
		important: data.important ?? false,
		tag: data.tag ?? 'General',
		dueAt: data.dueAt ?? null,
		recurrence: data.recurrence ?? 'none',
		recurrenceAlt: data.recurrenceAlt ?? false,
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
		syncStatus: 'pending',
		serverId: null
	};

	await db.tasks.add(task);
	triggerSync();
	return task;
}

/**
 * Update an existing task
 */
export async function updateTask(
	id: string,
	updates: Partial<
		Pick<Task, 'text' | 'description' | 'completed' | 'important' | 'tag' | 'dueAt' | 'recurrence' | 'recurrenceAlt'>
	>
): Promise<void> {
	await db.tasks.update(id, {
		...updates,
		updatedAt: Date.now(),
		syncStatus: 'pending'
	});
	triggerSync();
}

/**
 * Calculate next due date for a recurring task
 *
 * If the task is overdue (due date has passed), the next occurrence is
 * scheduled from today. Otherwise, it's scheduled from the original due date
 * to preserve the user's intended schedule for on-time completions.
 */
function calculateNextDueDate(task: Task): number | null {
	if (task.recurrence === 'none' || !task.dueAt) return null;

	const multiplier = task.recurrenceAlt ? 2 : 1;
	const now = Date.now();

	let baseTime: number;
	if (task.dueAt < now) {
		// Task is overdue: advance to today's date but keep original time-of-day
		const originalDue = new Date(task.dueAt);
		const today = new Date(now);
		today.setHours(originalDue.getHours(), originalDue.getMinutes(), originalDue.getSeconds(), originalDue.getMilliseconds());
		baseTime = today.getTime();
	} else {
		baseTime = task.dueAt;
	}

	switch (task.recurrence) {
		case 'daily':
			return baseTime + multiplier * 24 * 60 * 60 * 1000;
		case 'weekly':
			return baseTime + multiplier * 7 * 24 * 60 * 60 * 1000;
		case 'monthly': {
			const baseDate = new Date(baseTime);
			baseDate.setMonth(baseDate.getMonth() + multiplier);
			return baseDate.getTime();
		}
		default:
			return null;
	}
}

/**
 * Create the next occurrence of a recurring task
 */
export async function createNextRecurrence(task: Task): Promise<Task | null> {
	const nextDueAt = calculateNextDueDate(task);
	if (!nextDueAt) return null;

	return createTask({
		text: task.text,
		description: task.description,
		important: task.important,
		tag: task.tag,
		dueAt: nextDueAt,
		recurrence: task.recurrence,
		recurrenceAlt: task.recurrenceAlt
	});
}

/**
 * Toggle task completion status
 * If completing a recurring task, automatically creates the next occurrence
 */
export async function toggleTaskComplete(id: string): Promise<Task | null> {
	const task = await db.tasks.get(id);
	if (!task) return null;

	const wasCompleted = task.completed;
	await updateTask(id, { completed: !wasCompleted });

	// If we just completed a recurring task, create the next occurrence
	if (!wasCompleted && task.recurrence !== 'none' && task.dueAt) {
		return createNextRecurrence(task);
	}

	return null;
}

/**
 * Toggle task important status
 */
export async function toggleTaskImportant(id: string): Promise<void> {
	const task = await db.tasks.get(id);
	if (task) {
		await updateTask(id, { important: !task.important });
	}
}

/**
 * Soft delete a task (marks for sync then removal)
 */
export async function deleteTask(id: string): Promise<void> {
	await db.tasks.update(id, {
		deletedAt: Date.now(),
		updatedAt: Date.now(),
		syncStatus: 'pending'
	});
	triggerSync();
}

/**
 * Permanently delete a task (use after successful sync)
 */
export async function hardDeleteTask(id: string): Promise<void> {
	await db.tasks.delete(id);
}

/**
 * Clear all completed tasks (soft delete)
 */
export async function clearCompletedTasks(): Promise<number> {
	const now = Date.now();
	const completedTasks = await db.tasks.filter((t) => t.completed && t.deletedAt === null).toArray();

	for (const task of completedTasks) {
		await db.tasks.update(task.id, {
			deletedAt: now,
			updatedAt: now,
			syncStatus: 'pending'
		});
	}

	if (completedTasks.length > 0) {
		triggerSync();
	}

	return completedTasks.length;
}

/**
 * Get a single task by ID
 */
export async function getTask(id: string): Promise<Task | undefined> {
	return db.tasks.get(id);
}

/**
 * Get all non-deleted tasks (for direct access, not reactive)
 */
export async function getAllTasks(): Promise<Task[]> {
	const tasks = await db.tasks.where('deletedAt').equals(null as unknown as number).toArray();
	return sortTasks(tasks);
}

/**
 * Sort tasks: incomplete first, then by importance, then by creation date
 */
function sortTasks(tasks: Task[]): Task[] {
	return tasks.sort((a, b) => {
		// Incomplete tasks first
		if (a.completed !== b.completed) {
			return a.completed ? 1 : -1;
		}
		// Important tasks first
		if (a.important !== b.important) {
			return b.important ? 1 : -1;
		}
		// Newer tasks first
		return b.createdAt - a.createdAt;
	});
}

/**
 * Create a reactive query for tasks with filtering
 *
 * @param filter - Filter type ('all', 'today', 'important')
 * @param tagFilter - Optional tag filter
 * @returns Observable that emits sorted task arrays
 */
export function createTasksQuery(
	filter: TaskFilter = 'all',
	tagFilter: TaskTag | null = null
): Observable<Task[]> {
	return liveQuery(async () => {
		// Start with non-deleted tasks
		let tasks = await db.tasks.toArray();

		// Filter out deleted tasks
		tasks = tasks.filter((t) => t.deletedAt === null);

		// Apply filter
		switch (filter) {
			case 'important':
				tasks = tasks.filter((t) => t.important);
				break;
			case 'today':
				// "Today" shows incomplete tasks
				tasks = tasks.filter((t) => !t.completed);
				break;
			case 'all':
			default:
				// Show all non-deleted tasks
				break;
		}

		// Apply tag filter if specified
		if (tagFilter) {
			tasks = tasks.filter((t) => t.tag === tagFilter);
		}

		return sortTasks(tasks);
	});
}

/**
 * Create a reactive query for task counts
 *
 * @returns Observable that emits count object
 */
export function createTaskCountsQuery(): Observable<{
	all: number;
	today: number;
	important: number;
}> {
	return liveQuery(async () => {
		const tasks = await db.tasks.toArray();
		const nonDeleted = tasks.filter((t) => t.deletedAt === null);

		return {
			all: nonDeleted.length,
			today: nonDeleted.filter((t) => !t.completed).length,
			important: nonDeleted.filter((t) => t.important).length
		};
	});
}

/**
 * Get tasks that need to be synced (pending status)
 */
export async function getPendingTasks(): Promise<Task[]> {
	return db.tasks.where('syncStatus').equals('pending').toArray();
}

/**
 * Mark a task as synced
 */
export async function markTaskSynced(id: string, serverId: string): Promise<void> {
	await db.tasks.update(id, {
		syncStatus: 'synced',
		serverId
	});
}

/**
 * Bulk upsert tasks from server (for sync)
 */
export async function upsertTasksFromServer(
	serverTasks: Array<{
		id: string;
		text: string;
		description: string;
		completed: boolean;
		important: boolean;
		tag: TaskTag;
		dueAt: number | null;
		recurrence: RecurrenceType;
		recurrenceAlt: boolean;
		createdAt: number;
		updatedAt: number;
		deletedAt: number | null;
	}>
): Promise<void> {
	await db.transaction('rw', db.tasks, async () => {
		for (const serverTask of serverTasks) {
			const localTask = await db.tasks.where('serverId').equals(serverTask.id).first();

			if (localTask) {
				// Update if server is newer
				if (serverTask.updatedAt > localTask.updatedAt) {
					await db.tasks.update(localTask.id, {
						text: serverTask.text,
						description: serverTask.description,
						completed: serverTask.completed,
						important: serverTask.important,
						tag: serverTask.tag,
						dueAt: serverTask.dueAt,
						recurrence: serverTask.recurrence,
						recurrenceAlt: serverTask.recurrenceAlt,
						updatedAt: serverTask.updatedAt,
						deletedAt: serverTask.deletedAt,
						syncStatus: 'synced'
					});
				}
			} else {
				// Insert new task from server
				await db.tasks.add({
					id: crypto.randomUUID(),
					text: serverTask.text,
					description: serverTask.description,
					completed: serverTask.completed,
					important: serverTask.important,
					tag: serverTask.tag,
					dueAt: serverTask.dueAt,
					recurrence: serverTask.recurrence,
					recurrenceAlt: serverTask.recurrenceAlt,
					createdAt: serverTask.createdAt,
					updatedAt: serverTask.updatedAt,
					deletedAt: serverTask.deletedAt,
					syncStatus: 'synced',
					serverId: serverTask.id
				});
			}
		}
	});
}

/**
 * Purge soft-deleted tasks that have been synced
 */
export async function purgeSyncedDeletedTasks(): Promise<number> {
	const deletedAndSynced = await db.tasks
		.filter((t) => t.deletedAt !== null && t.syncStatus === 'synced')
		.toArray();

	for (const task of deletedAndSynced) {
		await db.tasks.delete(task.id);
	}

	return deletedAndSynced.length;
}
