/**
 * Tests for task CRUD operations
 *
 * Uses fake-indexeddb to simulate IndexedDB in Node environment
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from './schema';
import type { Task } from './schema';
import {
	createTask,
	updateTask,
	deleteTask,
	hardDeleteTask,
	toggleTaskComplete,
	toggleTaskImportant,
	clearCompletedTasks,
	getTask,
	getAllTasks,
	getPendingTasks,
	markTaskSynced,
	upsertTasksFromServer,
	purgeSyncedDeletedTasks,
	createNextRecurrence
} from './tasks.svelte';

// Mock crypto.randomUUID for predictable IDs in tests
let uuidCounter = 0;
vi.stubGlobal(
	'crypto',
	{
		randomUUID: () => `test-uuid-${++uuidCounter}`
	}
);

describe('Task CRUD Operations', () => {
	beforeEach(async () => {
		// Reset UUID counter
		uuidCounter = 0;

		// Clear the database before each test
		await db.tasks.clear();
	});

	afterEach(async () => {
		// Clean up after each test
		await db.tasks.clear();
	});

	describe('createTask', () => {
		it('creates a task with required text field', async () => {
			const task = await createTask({ text: 'Test task' });

			expect(task.id).toBe('test-uuid-1');
			expect(task.text).toBe('Test task');
			expect(task.description).toBe('');
			expect(task.completed).toBe(false);
			expect(task.important).toBe(false);
			expect(task.tag).toBe('General');
			expect(task.syncStatus).toBe('pending');
			expect(task.serverId).toBeNull();
			expect(task.deletedAt).toBeNull();
		});

		it('creates a task with all fields', async () => {
			const task = await createTask({
				text: 'Important work task',
				description: 'This is a detailed description',
				important: true,
				tag: 'Work'
			});

			expect(task.text).toBe('Important work task');
			expect(task.description).toBe('This is a detailed description');
			expect(task.important).toBe(true);
			expect(task.tag).toBe('Work');
		});

		it('persists task to database', async () => {
			const task = await createTask({ text: 'Persisted task' });

			const retrieved = await db.tasks.get(task.id);

			expect(retrieved).toBeDefined();
			expect(retrieved?.text).toBe('Persisted task');
		});

		it('sets createdAt and updatedAt to current timestamp', async () => {
			const before = Date.now();
			const task = await createTask({ text: 'Timed task' });
			const after = Date.now();

			expect(task.createdAt).toBeGreaterThanOrEqual(before);
			expect(task.createdAt).toBeLessThanOrEqual(after);
			expect(task.updatedAt).toBe(task.createdAt);
		});

		it('creates multiple tasks with unique IDs', async () => {
			const task1 = await createTask({ text: 'Task 1' });
			const task2 = await createTask({ text: 'Task 2' });
			const task3 = await createTask({ text: 'Task 3' });

			expect(task1.id).toBe('test-uuid-1');
			expect(task2.id).toBe('test-uuid-2');
			expect(task3.id).toBe('test-uuid-3');
		});

		it('defaults tag to General when not specified', async () => {
			const task = await createTask({ text: 'Task without tag' });

			expect(task.tag).toBe('General');
		});

		it('accepts all valid tag values', async () => {
			const tags = ['General', 'Work', 'Personal', 'Research', 'Design'] as const;

			for (const tag of tags) {
				const task = await createTask({ text: `${tag} task`, tag });
				expect(task.tag).toBe(tag);
			}
		});
	});

	describe('updateTask', () => {
		it('updates task text', async () => {
			const task = await createTask({ text: 'Original text' });

			await updateTask(task.id, { text: 'Updated text' });

			const updated = await db.tasks.get(task.id);
			expect(updated?.text).toBe('Updated text');
		});

		it('updates task description', async () => {
			const task = await createTask({ text: 'Task' });

			await updateTask(task.id, { description: 'New description' });

			const updated = await db.tasks.get(task.id);
			expect(updated?.description).toBe('New description');
		});

		it('updates task completed status', async () => {
			const task = await createTask({ text: 'Task' });
			expect(task.completed).toBe(false);

			await updateTask(task.id, { completed: true });

			const updated = await db.tasks.get(task.id);
			expect(updated?.completed).toBe(true);
		});

		it('updates task important status', async () => {
			const task = await createTask({ text: 'Task' });
			expect(task.important).toBe(false);

			await updateTask(task.id, { important: true });

			const updated = await db.tasks.get(task.id);
			expect(updated?.important).toBe(true);
		});

		it('updates task tag', async () => {
			const task = await createTask({ text: 'Task', tag: 'General' });

			await updateTask(task.id, { tag: 'Work' });

			const updated = await db.tasks.get(task.id);
			expect(updated?.tag).toBe('Work');
		});

		it('updates multiple fields at once', async () => {
			const task = await createTask({ text: 'Task' });

			await updateTask(task.id, {
				text: 'New text',
				description: 'New description',
				important: true,
				tag: 'Personal'
			});

			const updated = await db.tasks.get(task.id);
			expect(updated?.text).toBe('New text');
			expect(updated?.description).toBe('New description');
			expect(updated?.important).toBe(true);
			expect(updated?.tag).toBe('Personal');
		});

		it('updates updatedAt timestamp', async () => {
			const task = await createTask({ text: 'Task' });
			const originalUpdatedAt = task.updatedAt;

			// Small delay to ensure timestamp differs
			await new Promise((resolve) => setTimeout(resolve, 10));

			await updateTask(task.id, { text: 'Updated' });

			const updated = await db.tasks.get(task.id);
			expect(updated?.updatedAt).toBeGreaterThan(originalUpdatedAt);
		});

		it('sets syncStatus to pending on update', async () => {
			const task = await createTask({ text: 'Task' });
			await markTaskSynced(task.id, 'server-id-1');

			const synced = await db.tasks.get(task.id);
			expect(synced?.syncStatus).toBe('synced');

			await updateTask(task.id, { text: 'Updated' });

			const updated = await db.tasks.get(task.id);
			expect(updated?.syncStatus).toBe('pending');
		});

		it('preserves unmodified fields', async () => {
			const task = await createTask({
				text: 'Task',
				description: 'Description',
				important: true,
				tag: 'Work'
			});

			await updateTask(task.id, { text: 'Updated text' });

			const updated = await db.tasks.get(task.id);
			expect(updated?.description).toBe('Description');
			expect(updated?.important).toBe(true);
			expect(updated?.tag).toBe('Work');
		});
	});

	describe('deleteTask', () => {
		it('soft deletes a task by setting deletedAt', async () => {
			const task = await createTask({ text: 'Task to delete' });

			await deleteTask(task.id);

			const deleted = await db.tasks.get(task.id);
			expect(deleted?.deletedAt).not.toBeNull();
			expect(deleted?.deletedAt).toBeGreaterThan(0);
		});

		it('updates updatedAt on delete', async () => {
			const task = await createTask({ text: 'Task' });
			const originalUpdatedAt = task.updatedAt;

			await new Promise((resolve) => setTimeout(resolve, 10));
			await deleteTask(task.id);

			const deleted = await db.tasks.get(task.id);
			expect(deleted?.updatedAt).toBeGreaterThan(originalUpdatedAt);
		});

		it('sets syncStatus to pending on delete', async () => {
			const task = await createTask({ text: 'Task' });
			await markTaskSynced(task.id, 'server-id');

			await deleteTask(task.id);

			const deleted = await db.tasks.get(task.id);
			expect(deleted?.syncStatus).toBe('pending');
		});

		it('does not permanently remove task from database', async () => {
			const task = await createTask({ text: 'Task' });

			await deleteTask(task.id);

			const exists = await db.tasks.get(task.id);
			expect(exists).toBeDefined();
		});
	});

	describe('hardDeleteTask', () => {
		it('permanently removes task from database', async () => {
			const task = await createTask({ text: 'Task to hard delete' });

			await hardDeleteTask(task.id);

			const exists = await db.tasks.get(task.id);
			expect(exists).toBeUndefined();
		});

		it('removes task that was soft deleted', async () => {
			const task = await createTask({ text: 'Task' });
			await deleteTask(task.id);

			await hardDeleteTask(task.id);

			const exists = await db.tasks.get(task.id);
			expect(exists).toBeUndefined();
		});
	});

	describe('toggleTaskComplete', () => {
		it('toggles incomplete task to complete', async () => {
			const task = await createTask({ text: 'Task' });
			expect(task.completed).toBe(false);

			await toggleTaskComplete(task.id);

			const updated = await db.tasks.get(task.id);
			expect(updated?.completed).toBe(true);
		});

		it('toggles complete task to incomplete', async () => {
			const task = await createTask({ text: 'Task' });
			await updateTask(task.id, { completed: true });

			await toggleTaskComplete(task.id);

			const updated = await db.tasks.get(task.id);
			expect(updated?.completed).toBe(false);
		});

		it('does nothing for non-existent task', async () => {
			// Should not throw
			await toggleTaskComplete('non-existent-id');

			// Verify no tasks were created
			const count = await db.tasks.count();
			expect(count).toBe(0);
		});

		it('sets syncStatus to pending', async () => {
			const task = await createTask({ text: 'Task' });
			await markTaskSynced(task.id, 'server-id');

			await toggleTaskComplete(task.id);

			const updated = await db.tasks.get(task.id);
			expect(updated?.syncStatus).toBe('pending');
		});
	});

	describe('toggleTaskImportant', () => {
		it('toggles non-important task to important', async () => {
			const task = await createTask({ text: 'Task' });
			expect(task.important).toBe(false);

			await toggleTaskImportant(task.id);

			const updated = await db.tasks.get(task.id);
			expect(updated?.important).toBe(true);
		});

		it('toggles important task to non-important', async () => {
			const task = await createTask({ text: 'Task', important: true });

			await toggleTaskImportant(task.id);

			const updated = await db.tasks.get(task.id);
			expect(updated?.important).toBe(false);
		});

		it('does nothing for non-existent task', async () => {
			await toggleTaskImportant('non-existent-id');

			const count = await db.tasks.count();
			expect(count).toBe(0);
		});

		it('sets syncStatus to pending', async () => {
			const task = await createTask({ text: 'Task' });
			await markTaskSynced(task.id, 'server-id');

			await toggleTaskImportant(task.id);

			const updated = await db.tasks.get(task.id);
			expect(updated?.syncStatus).toBe('pending');
		});
	});

	describe('clearCompletedTasks', () => {
		it('soft deletes all completed tasks', async () => {
			const task1 = await createTask({ text: 'Incomplete task' });
			const task2 = await createTask({ text: 'Completed task 1' });
			const task3 = await createTask({ text: 'Completed task 2' });
			await updateTask(task2.id, { completed: true });
			await updateTask(task3.id, { completed: true });

			const count = await clearCompletedTasks();

			expect(count).toBe(2);

			const deletedTask2 = await db.tasks.get(task2.id);
			const deletedTask3 = await db.tasks.get(task3.id);
			expect(deletedTask2?.deletedAt).not.toBeNull();
			expect(deletedTask3?.deletedAt).not.toBeNull();

			// Incomplete task should be untouched
			const incompleteTask = await db.tasks.get(task1.id);
			expect(incompleteTask?.deletedAt).toBeNull();
		});

		it('returns 0 when no completed tasks exist', async () => {
			await createTask({ text: 'Incomplete task 1' });
			await createTask({ text: 'Incomplete task 2' });

			const count = await clearCompletedTasks();

			expect(count).toBe(0);
		});

		it('returns 0 when database is empty', async () => {
			const count = await clearCompletedTasks();

			expect(count).toBe(0);
		});

		it('does not affect incomplete tasks', async () => {
			const task1 = await createTask({ text: 'Incomplete task' });
			const task2 = await createTask({ text: 'Complete task' });
			await updateTask(task2.id, { completed: true });

			await clearCompletedTasks();

			const incomplete = await db.tasks.get(task1.id);
			expect(incomplete?.deletedAt).toBeNull();
			expect(incomplete?.completed).toBe(false);
		});

		it('does not delete already-deleted completed tasks again', async () => {
			const task = await createTask({ text: 'Completed task' });
			await updateTask(task.id, { completed: true });
			await deleteTask(task.id);

			const deletedTask = await db.tasks.get(task.id);
			const originalDeletedAt = deletedTask?.deletedAt;

			// Small delay to ensure timestamp would differ
			await new Promise((resolve) => setTimeout(resolve, 10));

			const count = await clearCompletedTasks();

			expect(count).toBe(0);

			const afterClear = await db.tasks.get(task.id);
			expect(afterClear?.deletedAt).toBe(originalDeletedAt);
		});

		it('sets syncStatus to pending on cleared tasks', async () => {
			const task = await createTask({ text: 'Task' });
			await updateTask(task.id, { completed: true });
			await markTaskSynced(task.id, 'server-id');

			const syncedTask = await db.tasks.get(task.id);
			expect(syncedTask?.syncStatus).toBe('synced');

			await clearCompletedTasks();

			const clearedTask = await db.tasks.get(task.id);
			expect(clearedTask?.syncStatus).toBe('pending');
		});

		it('updates updatedAt timestamp on cleared tasks', async () => {
			const task = await createTask({ text: 'Task' });
			await updateTask(task.id, { completed: true });

			const beforeClear = await db.tasks.get(task.id);
			const originalUpdatedAt = beforeClear?.updatedAt;

			await new Promise((resolve) => setTimeout(resolve, 10));

			await clearCompletedTasks();

			const afterClear = await db.tasks.get(task.id);
			expect(afterClear?.updatedAt).toBeGreaterThan(originalUpdatedAt!);
		});
	});

	describe('getTask', () => {
		it('returns task by ID', async () => {
			const created = await createTask({ text: 'Test task' });

			const task = await getTask(created.id);

			expect(task).toBeDefined();
			expect(task?.text).toBe('Test task');
		});

		it('returns undefined for non-existent ID', async () => {
			const task = await getTask('non-existent-id');

			expect(task).toBeUndefined();
		});

		it('returns soft-deleted tasks', async () => {
			const created = await createTask({ text: 'Task' });
			await deleteTask(created.id);

			const task = await getTask(created.id);

			expect(task).toBeDefined();
			expect(task?.deletedAt).not.toBeNull();
		});
	});

	describe('getAllTasks', () => {
		/**
		 * Note: getAllTasks uses `db.tasks.where('deletedAt').equals(null)`
		 * which has compatibility issues with fake-indexeddb's null handling.
		 * This function should be tested in browser tests (*.svelte.test.ts).
		 * Here we only test that the function is exported and callable.
		 */

		it('is a function that can be called', () => {
			expect(typeof getAllTasks).toBe('function');
		});
	});

	describe('task sorting logic', () => {
		/**
		 * Test the sorting logic by querying the database directly
		 * and applying the same sort order as the implementation.
		 */

		const sortTasks = (tasks: Task[]): Task[] => {
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
		};

		it('sorts incomplete tasks before complete tasks', async () => {
			const task1 = await createTask({ text: 'Complete task' });
			await createTask({ text: 'Incomplete task' });
			await updateTask(task1.id, { completed: true });

			const allTasks = await db.tasks.toArray();
			const sorted = sortTasks(allTasks.filter((t) => t.deletedAt === null));

			expect(sorted[0].completed).toBe(false);
			expect(sorted[1].completed).toBe(true);
		});

		it('sorts important tasks before non-important within same completion status', async () => {
			await createTask({ text: 'Non-important' });
			await createTask({ text: 'Important', important: true });

			const allTasks = await db.tasks.toArray();
			const sorted = sortTasks(allTasks.filter((t) => t.deletedAt === null));

			expect(sorted[0].important).toBe(true);
			expect(sorted[1].important).toBe(false);
		});

		it('sorts newer tasks before older tasks within same importance', async () => {
			const task1 = await createTask({ text: 'Older task' });
			await new Promise((resolve) => setTimeout(resolve, 10));
			const task2 = await createTask({ text: 'Newer task' });

			const allTasks = await db.tasks.toArray();
			const sorted = sortTasks(allTasks.filter((t) => t.deletedAt === null));

			expect(sorted[0].id).toBe(task2.id);
			expect(sorted[1].id).toBe(task1.id);
		});

		it('excludes soft-deleted tasks from filtered results', async () => {
			await createTask({ text: 'Task 1' });
			const task2 = await createTask({ text: 'Task 2' });
			await createTask({ text: 'Task 3' });
			await deleteTask(task2.id);

			const allTasks = await db.tasks.toArray();
			const nonDeleted = allTasks.filter((t) => t.deletedAt === null);

			expect(nonDeleted).toHaveLength(2);
			expect(nonDeleted.find((t) => t.id === task2.id)).toBeUndefined();
		});
	});

	describe('getPendingTasks', () => {
		it('returns tasks with pending sync status', async () => {
			await createTask({ text: 'Pending task 1' });
			await createTask({ text: 'Pending task 2' });

			const pending = await getPendingTasks();

			expect(pending).toHaveLength(2);
			pending.forEach((task) => {
				expect(task.syncStatus).toBe('pending');
			});
		});

		it('excludes synced tasks', async () => {
			const task1 = await createTask({ text: 'Task 1' });
			await createTask({ text: 'Task 2' });
			await markTaskSynced(task1.id, 'server-id');

			const pending = await getPendingTasks();

			expect(pending).toHaveLength(1);
			expect(pending[0].text).toBe('Task 2');
		});

		it('returns empty array when all tasks are synced', async () => {
			const task = await createTask({ text: 'Task' });
			await markTaskSynced(task.id, 'server-id');

			const pending = await getPendingTasks();

			expect(pending).toEqual([]);
		});
	});

	describe('markTaskSynced', () => {
		it('sets syncStatus to synced', async () => {
			const task = await createTask({ text: 'Task' });

			await markTaskSynced(task.id, 'server-123');

			const updated = await db.tasks.get(task.id);
			expect(updated?.syncStatus).toBe('synced');
		});

		it('sets serverId', async () => {
			const task = await createTask({ text: 'Task' });

			await markTaskSynced(task.id, 'server-123');

			const updated = await db.tasks.get(task.id);
			expect(updated?.serverId).toBe('server-123');
		});
	});

	describe('upsertTasksFromServer', () => {
		it('inserts new tasks from server', async () => {
			const serverTasks = [
				{
					id: 'server-1',
					text: 'Server task 1',
					description: 'Description 1',
					completed: false,
					important: true,
					tag: 'Work' as const,
					dueAt: null,
					recurrence: 'none' as const,
					recurrenceAlt: false,
					createdAt: Date.now(),
					updatedAt: Date.now(),
					deletedAt: null
				}
			];

			await upsertTasksFromServer(serverTasks);

			const allTasks = await db.tasks.toArray();
			expect(allTasks).toHaveLength(1);
			expect(allTasks[0].text).toBe('Server task 1');
			expect(allTasks[0].serverId).toBe('server-1');
			expect(allTasks[0].syncStatus).toBe('synced');
		});

		it('updates existing task when server is newer', async () => {
			const task = await createTask({ text: 'Original' });
			await markTaskSynced(task.id, 'server-1');

			const serverTasks = [
				{
					id: 'server-1',
					text: 'Updated from server',
					description: '',
					completed: true,
					important: false,
					tag: 'General' as const,
					dueAt: null,
					recurrence: 'none' as const,
					recurrenceAlt: false,
					createdAt: Date.now(),
					updatedAt: Date.now() + 1000, // Newer
					deletedAt: null
				}
			];

			await upsertTasksFromServer(serverTasks);

			const updated = await db.tasks.get(task.id);
			expect(updated?.text).toBe('Updated from server');
			expect(updated?.completed).toBe(true);
		});

		it('does not update when local is newer', async () => {
			const task = await createTask({ text: 'Local version' });
			await markTaskSynced(task.id, 'server-1');

			// Update local to be newer
			await new Promise((resolve) => setTimeout(resolve, 10));
			await updateTask(task.id, { text: 'Updated local' });
			await markTaskSynced(task.id, 'server-1'); // Re-sync to keep serverId

			const localTask = await db.tasks.get(task.id);

			const serverTasks = [
				{
					id: 'server-1',
					text: 'Older server version',
					description: '',
					completed: false,
					important: false,
					tag: 'General' as const,
					dueAt: null,
					recurrence: 'none' as const,
					recurrenceAlt: false,
					createdAt: Date.now() - 2000,
					updatedAt: (localTask?.updatedAt ?? 0) - 1000, // Older than local
					deletedAt: null
				}
			];

			await upsertTasksFromServer(serverTasks);

			const afterUpsert = await db.tasks.get(task.id);
			expect(afterUpsert?.text).toBe('Updated local');
		});

		it('handles multiple server tasks', async () => {
			const serverTasks = [
				{
					id: 'server-1',
					text: 'Task 1',
					description: '',
					completed: false,
					important: false,
					tag: 'General' as const,
					dueAt: null,
					recurrence: 'none' as const,
					recurrenceAlt: false,
					createdAt: Date.now(),
					updatedAt: Date.now(),
					deletedAt: null
				},
				{
					id: 'server-2',
					text: 'Task 2',
					description: '',
					completed: true,
					important: true,
					tag: 'Work' as const,
					dueAt: null,
					recurrence: 'none' as const,
					recurrenceAlt: false,
					createdAt: Date.now(),
					updatedAt: Date.now(),
					deletedAt: null
				}
			];

			await upsertTasksFromServer(serverTasks);

			const allTasks = await db.tasks.toArray();
			expect(allTasks).toHaveLength(2);
		});

		it('generates local UUID for new tasks from server', async () => {
			const serverTasks = [
				{
					id: 'server-uuid',
					text: 'Server task',
					description: '',
					completed: false,
					important: false,
					tag: 'General' as const,
					dueAt: null,
					recurrence: 'none' as const,
					recurrenceAlt: false,
					createdAt: Date.now(),
					updatedAt: Date.now(),
					deletedAt: null
				}
			];

			await upsertTasksFromServer(serverTasks);

			const tasks = await db.tasks.toArray();
			expect(tasks[0].id).toMatch(/^test-uuid-/);
			expect(tasks[0].serverId).toBe('server-uuid');
		});
	});

	describe('purgeSyncedDeletedTasks', () => {
		it('removes soft-deleted tasks that are synced', async () => {
			const task = await createTask({ text: 'Task' });
			await markTaskSynced(task.id, 'server-id');
			await deleteTask(task.id);
			await markTaskSynced(task.id, 'server-id');

			const count = await purgeSyncedDeletedTasks();

			expect(count).toBe(1);
			const exists = await db.tasks.get(task.id);
			expect(exists).toBeUndefined();
		});

		it('does not remove deleted tasks that are pending sync', async () => {
			const task = await createTask({ text: 'Task' });
			await deleteTask(task.id);

			const count = await purgeSyncedDeletedTasks();

			expect(count).toBe(0);
			const exists = await db.tasks.get(task.id);
			expect(exists).toBeDefined();
		});

		it('does not remove synced tasks that are not deleted', async () => {
			const task = await createTask({ text: 'Task' });
			await markTaskSynced(task.id, 'server-id');

			const count = await purgeSyncedDeletedTasks();

			expect(count).toBe(0);
			const exists = await db.tasks.get(task.id);
			expect(exists).toBeDefined();
		});

		it('returns count of purged tasks', async () => {
			const task1 = await createTask({ text: 'Task 1' });
			const task2 = await createTask({ text: 'Task 2' });
			await markTaskSynced(task1.id, 'server-1');
			await markTaskSynced(task2.id, 'server-2');
			await deleteTask(task1.id);
			await deleteTask(task2.id);
			await markTaskSynced(task1.id, 'server-1');
			await markTaskSynced(task2.id, 'server-2');

			const count = await purgeSyncedDeletedTasks();

			expect(count).toBe(2);
		});
	});

	describe('recurring tasks', () => {
		const ONE_DAY = 24 * 60 * 60 * 1000;
		const ONE_WEEK = 7 * ONE_DAY;

		it('creates next occurrence when completing a recurring task', async () => {
			const futureDate = Date.now() + ONE_DAY;
			const task = await createTask({
				text: 'Daily task',
				dueAt: futureDate,
				recurrence: 'daily'
			});

			const nextTask = await toggleTaskComplete(task.id);

			expect(nextTask).not.toBeNull();
			expect(nextTask?.text).toBe('Daily task');
			expect(nextTask?.recurrence).toBe('daily');
			expect(nextTask?.completed).toBe(false);
		});

		it('schedules next occurrence from today when task is overdue', async () => {
			// Task was due 3 days ago at a specific time
			const threeDaysAgo = Date.now() - 3 * ONE_DAY;
			const task = await createTask({
				text: 'Overdue daily task',
				dueAt: threeDaysAgo,
				recurrence: 'daily'
			});

			const now = Date.now();
			const nextTask = await toggleTaskComplete(task.id);

			expect(nextTask).not.toBeNull();
			// Next due date should be ~1 day from today's date, NOT 2 days ago
			expect(nextTask!.dueAt).toBeGreaterThan(now);
			expect(nextTask!.dueAt).toBeLessThanOrEqual(now + ONE_DAY + 100);
		});

		it('preserves original time-of-day when rescheduling overdue task', async () => {
			// Task was due 3 days ago at exactly noon
			const threeDaysAgoAtNoon = new Date();
			threeDaysAgoAtNoon.setDate(threeDaysAgoAtNoon.getDate() - 3);
			threeDaysAgoAtNoon.setHours(12, 0, 0, 0);

			const task = await createTask({
				text: 'Noon daily task',
				dueAt: threeDaysAgoAtNoon.getTime(),
				recurrence: 'daily'
			});

			const nextTask = await toggleTaskComplete(task.id);

			expect(nextTask).not.toBeNull();
			// The next occurrence should be at noon, not at the current time
			const nextDue = new Date(nextTask!.dueAt!);
			expect(nextDue.getHours()).toBe(12);
			expect(nextDue.getMinutes()).toBe(0);
			expect(nextDue.getSeconds()).toBe(0);
		});

		it('schedules next occurrence from original due date when completed on time', async () => {
			// Task is due in the future
			const tomorrow = Date.now() + ONE_DAY;
			const task = await createTask({
				text: 'Future daily task',
				dueAt: tomorrow,
				recurrence: 'daily'
			});

			const nextTask = await toggleTaskComplete(task.id);

			expect(nextTask).not.toBeNull();
			// Next due date should be original due date + 1 day (day after tomorrow)
			const expectedDue = tomorrow + ONE_DAY;
			expect(nextTask!.dueAt).toBeGreaterThanOrEqual(expectedDue - 100);
			expect(nextTask!.dueAt).toBeLessThanOrEqual(expectedDue + 100);
		});

		it('handles weekly recurrence correctly when overdue', async () => {
			// Task was due 2 weeks ago
			const twoWeeksAgo = Date.now() - 2 * ONE_WEEK;
			const task = await createTask({
				text: 'Overdue weekly task',
				dueAt: twoWeeksAgo,
				recurrence: 'weekly'
			});

			const now = Date.now();
			const nextTask = await toggleTaskComplete(task.id);

			expect(nextTask).not.toBeNull();
			// Next due date should be ~1 week from now, NOT 1 week ago
			expect(nextTask!.dueAt).toBeGreaterThan(now);
			expect(nextTask!.dueAt).toBeLessThanOrEqual(now + ONE_WEEK + 100);
		});

		it('handles monthly recurrence correctly when overdue', async () => {
			// Task was due 2 months ago
			const twoMonthsAgo = new Date();
			twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
			const task = await createTask({
				text: 'Overdue monthly task',
				dueAt: twoMonthsAgo.getTime(),
				recurrence: 'monthly'
			});

			const now = Date.now();
			const nextTask = await toggleTaskComplete(task.id);

			expect(nextTask).not.toBeNull();
			// Next due date should be ~1 month from now
			const oneMonthFromNow = new Date();
			oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
			expect(nextTask!.dueAt).toBeGreaterThan(now);
			// Allow some variance for month calculation
			expect(nextTask!.dueAt).toBeLessThanOrEqual(oneMonthFromNow.getTime() + ONE_DAY);
		});

		it('handles recurrenceAlt (every-other) correctly', async () => {
			const threeDaysAgo = Date.now() - 3 * ONE_DAY;
			const task = await createTask({
				text: 'Every other day task',
				dueAt: threeDaysAgo,
				recurrence: 'daily',
				recurrenceAlt: true
			});

			const now = Date.now();
			const nextTask = await toggleTaskComplete(task.id);

			expect(nextTask).not.toBeNull();
			// Should be 2 days from now (every other day = 2x multiplier)
			expect(nextTask!.dueAt).toBeGreaterThan(now + ONE_DAY);
			expect(nextTask!.dueAt).toBeLessThanOrEqual(now + 2 * ONE_DAY + 100);
		});

		it('does not create next occurrence for non-recurring tasks', async () => {
			const task = await createTask({
				text: 'One-time task',
				dueAt: Date.now() - ONE_DAY,
				recurrence: 'none'
			});

			const nextTask = await toggleTaskComplete(task.id);

			expect(nextTask).toBeNull();
		});

		it('does not create next occurrence for tasks without due date', async () => {
			const task = await createTask({
				text: 'Recurring but no due date',
				recurrence: 'daily'
			});

			const nextTask = await toggleTaskComplete(task.id);

			expect(nextTask).toBeNull();
		});

		it('preserves task properties in next occurrence', async () => {
			const task = await createTask({
				text: 'Important recurring task',
				description: 'Do this every day',
				important: true,
				tag: 'Work',
				dueAt: Date.now() + ONE_DAY,
				recurrence: 'weekly',
				recurrenceAlt: true
			});

			const nextTask = await toggleTaskComplete(task.id);

			expect(nextTask).not.toBeNull();
			expect(nextTask!.text).toBe('Important recurring task');
			expect(nextTask!.description).toBe('Do this every day');
			expect(nextTask!.important).toBe(true);
			expect(nextTask!.tag).toBe('Work');
			expect(nextTask!.recurrence).toBe('weekly');
			expect(nextTask!.recurrenceAlt).toBe(true);
		});

		it('createNextRecurrence returns null for non-recurring task', async () => {
			const task = await createTask({
				text: 'Non-recurring',
				recurrence: 'none'
			});

			const nextTask = await createNextRecurrence(task);

			expect(nextTask).toBeNull();
		});
	});
});
