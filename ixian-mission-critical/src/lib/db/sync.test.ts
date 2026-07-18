/**
 * Tests for the sync engine
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db, type Task, type Tag } from './schema';

const { mockTasks, mockTags, mockGetIsOnline, mockGetApiUrl } = vi.hoisted(() => ({
	mockTasks: {
		getAll: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		remove: vi.fn()
	},
	mockTags: {
		getAll: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		remove: vi.fn()
	},
	mockGetIsOnline: vi.fn(() => true),
	mockGetApiUrl: vi.fn(() => 'http://localhost:8000/api/v1')
}));

vi.mock('$lib/api', () => ({
	apiClient: {
		tasks: mockTasks,
		tags: mockTags
	}
}));

vi.mock('$lib/api/offline', () => ({
	getIsOnline: () => mockGetIsOnline(),
	onOnline: () => () => {}
}));

vi.mock('$lib/stores/config.svelte', () => ({
	getApiUrl: () => mockGetApiUrl()
}));

import { syncWithServer, getSyncState, forceFullSync, stopSync } from './sync.svelte';
import { ApiError } from '$lib/api/errors';

function pendingTask(overrides: Partial<Task> = {}): Task {
	const now = Date.now();
	const id = overrides.id ?? 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
	return {
		id,
		text: 'Local task',
		description: '',
		completed: false,
		important: false,
		tag: 'General',
		dueAt: null,
		recurrence: 'none',
		recurrenceAlt: false,
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
		syncStatus: 'pending',
		serverId: null,
		...overrides
	};
}

function pendingTag(overrides: Partial<Tag> = {}): Tag {
	const now = Date.now();
	const id = overrides.id ?? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
	return {
		id,
		name: 'CustomTag',
		color: '#14b8a6',
		isDefault: false,
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
		syncStatus: 'pending',
		serverId: null,
		...overrides
	};
}

describe('sync engine', () => {
	beforeEach(async () => {
		stopSync();
		await db.tasks.clear();
		await db.tags.clear();
		await db.syncMeta.clear();
		vi.clearAllMocks();
		mockGetIsOnline.mockReturnValue(true);
		mockGetApiUrl.mockReturnValue('http://localhost:8000/api/v1');
		mockTasks.getAll.mockResolvedValue([]);
		mockTags.getAll.mockResolvedValue([]);
	});

	afterEach(async () => {
		stopSync();
		await db.tasks.clear();
		await db.tags.clear();
		await db.syncMeta.clear();
	});

	it('skips sync when offline', async () => {
		mockGetIsOnline.mockReturnValue(false);
		await db.tasks.add(pendingTask());

		await syncWithServer();

		expect(mockTasks.getAll).not.toHaveBeenCalled();
		expect(mockTasks.create).not.toHaveBeenCalled();
	});

	it('skips sync when API URL is not configured', async () => {
		mockGetApiUrl.mockReturnValue(null);
		await db.tasks.add(pendingTask());

		await syncWithServer();

		expect(mockTasks.getAll).not.toHaveBeenCalled();
	});

	it('pulls server tasks and upserts locally', async () => {
		const serverId = '11111111-1111-4111-8111-111111111111';
		mockTasks.getAll.mockResolvedValue([
			{
				id: serverId,
				text: 'From server',
				description: '',
				completed: false,
				important: false,
				tag: 'General',
				due_at: null,
				recurrence: 'none',
				recurrence_alt: false,
				created_at: 1000,
				updated_at: 2000,
				deleted_at: null
			}
		]);

		await syncWithServer();

		const local = await db.tasks.get(serverId);
		expect(local?.text).toBe('From server');
		expect(local?.serverId).toBe(serverId);
		expect(local?.syncStatus).toBe('synced');
	});

	it('pushes pending task creates to the server', async () => {
		const task = pendingTask();
		await db.tasks.add(task);
		mockTasks.create.mockResolvedValue({
			id: task.id,
			text: task.text,
			description: '',
			completed: false,
			important: false,
			tag: 'General',
			due_at: null,
			recurrence: 'none',
			recurrence_alt: false,
			created_at: task.createdAt,
			updated_at: task.updatedAt,
			deleted_at: null
		});

		await syncWithServer();

		expect(mockTasks.create).toHaveBeenCalledOnce();
		const synced = await db.tasks.get(task.id);
		expect(synced?.syncStatus).toBe('synced');
		expect(synced?.serverId).toBe(task.id);
	});

	it('recreates task on server after 404 on update', async () => {
		const task = pendingTask({
			serverId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
			text: 'Updated'
		});
		await db.tasks.add(task);

		mockTasks.update.mockRejectedValueOnce(
			new ApiError(404, 'Not Found', null, `/tasks/${task.serverId}`)
		);
		mockTasks.create.mockResolvedValue({
			id: task.id,
			text: 'Updated',
			description: '',
			completed: false,
			important: false,
			tag: 'General',
			due_at: null,
			recurrence: 'none',
			recurrence_alt: false,
			created_at: task.createdAt,
			updated_at: Date.now(),
			deleted_at: null
		});

		await syncWithServer();

		expect(mockTasks.update).toHaveBeenCalled();
		expect(mockTasks.create).toHaveBeenCalled();
	});

	it('pushes pending tags', async () => {
		const tag = pendingTag();
		await db.tags.add(tag);
		mockTags.create.mockResolvedValue({
			id: tag.id,
			name: tag.name,
			color: tag.color,
			is_default: false,
			created_at: tag.createdAt,
			updated_at: tag.updatedAt,
			deleted_at: null
		});

		await syncWithServer();

		expect(mockTags.create).toHaveBeenCalledOnce();
		expect((await db.tags.get(tag.id))?.syncStatus).toBe('synced');
	});

	it('forceFullSync clears meta and pulls without since filter', async () => {
		await db.syncMeta.put({ id: 'sync_meta', lastSyncAt: 9999, serverVersion: 0 });
		mockTasks.getAll.mockResolvedValue([]);

		await forceFullSync();

		expect(mockTasks.getAll).toHaveBeenCalledWith(0);
		expect(getSyncState().lastSyncAt).toBeNull();
	});
});
