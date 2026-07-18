/**
 * Tests for tag CRUD operations
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from './schema';
import {
	initDefaultTags,
	createTag,
	updateTag,
	deleteTag,
	getAllTags,
	getPendingTags,
	markTagSynced,
	upsertTagsFromServer,
	purgeSyncedDeletedTags,
	getTagColor
} from './tags.svelte';

let uuidCounter = 0;
vi.stubGlobal('crypto', {
	randomUUID: () =>
		`00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, '0')}`,
	getRandomValues: (arr: Uint8Array) => {
		for (let i = 0; i < arr.length; i++) arr[i] = i + 1;
		return arr;
	}
});

vi.mock('./sync.svelte', () => ({
	triggerSync: vi.fn()
}));

describe('Tag CRUD', () => {
	beforeEach(async () => {
		uuidCounter = 0;
		await db.tags.clear();
	});

	afterEach(async () => {
		await db.tags.clear();
	});

	it('seeds default tags on first run', async () => {
		await initDefaultTags();
		const tags = await getAllTags();
		expect(tags.length).toBeGreaterThanOrEqual(5);
		expect(tags.every((t) => t.isDefault)).toBe(true);
	});

	it('creates a custom tag as pending', async () => {
		await initDefaultTags();
		const tag = await createTag('Custom');
		expect(tag.name).toBe('Custom');
		expect(tag.isDefault).toBe(false);
		expect(tag.syncStatus).toBe('pending');
		expect(await getPendingTags()).toHaveLength(1);
	});

	it('rejects duplicate tag names', async () => {
		await initDefaultTags();
		await createTag('Unique');
		await expect(createTag('unique')).rejects.toThrow(/already exists/i);
	});

	it('soft deletes non-default tags', async () => {
		await initDefaultTags();
		const tag = await createTag('Temp');
		await deleteTag(tag.id);
		const stored = await db.tags.get(tag.id);
		expect(stored?.deletedAt).not.toBeNull();
		expect(stored?.syncStatus).toBe('pending');
	});

	it('refuses to delete default tags', async () => {
		await initDefaultTags();
		const defaults = await getAllTags();
		await expect(deleteTag(defaults[0].id)).rejects.toThrow(/default/i);
	});

	it('updates tag name and marks pending', async () => {
		await initDefaultTags();
		const tag = await createTag('Old');
		await markTagSynced(tag.id, tag.id);
		await updateTag(tag.id, { name: 'New' });
		const updated = await db.tags.get(tag.id);
		expect(updated?.name).toBe('New');
		expect(updated?.syncStatus).toBe('pending');
	});

	it('upserts tags from server using shared ids', async () => {
		const serverId = '22222222-2222-4222-8222-222222222222';
		await upsertTagsFromServer([
			{
				id: serverId,
				name: 'ServerTag',
				color: '#14b8a6',
				isDefault: false,
				createdAt: 1,
				updatedAt: 2,
				deletedAt: null
			}
		]);
		const tag = await db.tags.get(serverId);
		expect(tag?.name).toBe('ServerTag');
		expect(tag?.serverId).toBe(serverId);
		expect(getTagColor('ServerTag')).toBe('#14b8a6');
	});

	it('purges synced deleted tags', async () => {
		const tag = await createTag('Gone');
		await markTagSynced(tag.id, tag.id);
		await deleteTag(tag.id);
		await markTagSynced(tag.id, tag.id);
		const removed = await purgeSyncedDeletedTags();
		expect(removed).toBe(1);
		expect(await db.tags.get(tag.id)).toBeUndefined();
	});
});
