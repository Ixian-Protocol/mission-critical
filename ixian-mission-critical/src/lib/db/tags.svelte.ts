/**
 * Tag CRUD operations with reactive queries
 *
 * Uses Dexie's liveQuery for automatic UI updates when data changes.
 * All mutations mark tags as 'pending' for sync.
 */

import { liveQuery, type Observable } from 'dexie';
import { db, type Tag, DEFAULT_TAGS, TAG_COLORS } from './schema';
import { triggerSync } from './sync.svelte';
import { createUuid } from './uuid';

/**
 * Initialize default tags if they don't exist
 * Called on app startup
 */
export async function initDefaultTags(): Promise<void> {
	const existingTags = await db.tags.toArray();

	// If we already have tags, just refresh cache
	if (existingTags.length > 0) {
		await refreshTagColorCache();
		return;
	}

	const now = Date.now();

	// Create default tags with preset colors
	// Mark as 'synced' since default tags are also seeded on the server
	// They will get their serverId on first sync pull
	for (let i = 0; i < DEFAULT_TAGS.length; i++) {
		const tag: Tag = {
			id: createUuid(),
			name: DEFAULT_TAGS[i],
			color: TAG_COLORS[i % TAG_COLORS.length],
			isDefault: true,
			createdAt: now,
			updatedAt: now,
			deletedAt: null,
			syncStatus: 'synced',
			serverId: null
		};
		await db.tags.add(tag);
	}

	await refreshTagColorCache();
}

/**
 * Get the next color for a new tag (cycles through palette)
 */
async function getNextTagColor(): Promise<string> {
	const tags = await db.tags.filter((t) => t.deletedAt === null).toArray();
	const colorIndex = tags.length % TAG_COLORS.length;
	return TAG_COLORS[colorIndex];
}

/**
 * Create a new custom tag
 */
export async function createTag(name: string): Promise<Tag> {
	// Check for duplicate name
	const existing = await db.tags
		.filter((t) => t.name.toLowerCase() === name.toLowerCase() && t.deletedAt === null)
		.first();

	if (existing) {
		throw new Error(`Tag "${name}" already exists`);
	}

	const now = Date.now();
	const color = await getNextTagColor();

	const tag: Tag = {
		id: createUuid(),
		name: name.trim(),
		color,
		isDefault: false,
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
		syncStatus: 'pending',
		serverId: null
	};

	await db.tags.add(tag);
	await refreshTagColorCache();
	triggerSync();
	return tag;
}

/**
 * Update an existing tag
 */
export async function updateTag(
	id: string,
	updates: Partial<Pick<Tag, 'name'>>
): Promise<void> {
	if (updates.name) {
		// Check for duplicate name (excluding current tag)
		const existing = await db.tags
			.filter(
				(t) =>
					t.id !== id && t.name.toLowerCase() === updates.name!.toLowerCase() && t.deletedAt === null
			)
			.first();

		if (existing) {
			throw new Error(`Tag "${updates.name}" already exists`);
		}
	}

	await db.tags.update(id, {
		...updates,
		updatedAt: Date.now(),
		syncStatus: 'pending'
	});
	triggerSync();
}

/**
 * Soft delete a tag
 */
export async function deleteTag(id: string): Promise<void> {
	const tag = await db.tags.get(id);

	if (tag?.isDefault) {
		throw new Error('Cannot delete default tags');
	}

	await db.tags.update(id, {
		deletedAt: Date.now(),
		updatedAt: Date.now(),
		syncStatus: 'pending'
	});
	triggerSync();
}

/**
 * Get a single tag by ID
 */
export async function getTag(id: string): Promise<Tag | undefined> {
	return db.tags.get(id);
}

/**
 * Get a tag by name
 */
export async function getTagByName(name: string): Promise<Tag | undefined> {
	return db.tags.filter((t) => t.name === name && t.deletedAt === null).first();
}

/**
 * Get all non-deleted tags
 */
export async function getAllTags(): Promise<Tag[]> {
	const tags = await db.tags.filter((t) => t.deletedAt === null).toArray();
	return sortTags(tags);
}

/**
 * Sort tags: default tags first (in original order), then custom tags by name
 */
function sortTags(tags: Tag[]): Tag[] {
	return tags.sort((a, b) => {
		// Default tags first
		if (a.isDefault !== b.isDefault) {
			return a.isDefault ? -1 : 1;
		}
		// Among default tags, maintain original order
		if (a.isDefault && b.isDefault) {
			const aIndex = DEFAULT_TAGS.indexOf(a.name as (typeof DEFAULT_TAGS)[number]);
			const bIndex = DEFAULT_TAGS.indexOf(b.name as (typeof DEFAULT_TAGS)[number]);
			return aIndex - bIndex;
		}
		// Custom tags sorted alphabetically
		return a.name.localeCompare(b.name);
	});
}

/**
 * Create a reactive query for all tags
 */
export function createTagsQuery(): Observable<Tag[]> {
	return liveQuery(async () => {
		const tags = await db.tags.filter((t) => t.deletedAt === null).toArray();
		return sortTags(tags);
	});
}

/**
 * Get color for a tag by name (async)
 */
export async function getTagColorAsync(name: string): Promise<string> {
	const tag = await getTagByName(name);
	return tag?.color ?? TAG_COLORS[0];
}

// Cache for tag colors to enable synchronous lookup
let tagColorCache = $state<Map<string, string>>(new Map());

/**
 * Update the tag color cache (call this when tags change)
 */
export async function refreshTagColorCache(): Promise<void> {
	const tags = await getAllTags();
	const newCache = new Map<string, string>();
	for (const tag of tags) {
		newCache.set(tag.name, tag.color);
	}
	tagColorCache = newCache;
}

/**
 * Get color for a tag by name (synchronous, uses cache)
 * Returns undefined if tag not in cache (caller should handle default)
 */
export function getTagColor(name: string): string | undefined {
	return tagColorCache.get(name);
}

/**
 * Get tags that need to be synced (pending status)
 */
export async function getPendingTags(): Promise<Tag[]> {
	return db.tags.where('syncStatus').equals('pending').toArray();
}

/**
 * Mark a tag as synced
 */
export async function markTagSynced(id: string, serverId: string): Promise<void> {
	await db.tags.update(id, {
		syncStatus: 'synced',
		serverId
	});
}

/**
 * Clear server id when the remote tag no longer exists. Sync-only; no triggerSync().
 */
export async function clearTagServerLink(id: string): Promise<void> {
	await db.tags.update(id, { serverId: null, syncStatus: 'pending' });
}

/**
 * Bulk upsert tags from server (for sync)
 */
export async function upsertTagsFromServer(
	serverTags: Array<{
		id: string;
		name: string;
		color: string;
		isDefault: boolean;
		createdAt: number;
		updatedAt: number;
		deletedAt: number | null;
	}>
): Promise<void> {
	if (serverTags.length === 0) return;

	await db.transaction('rw', db.tags, async () => {
		const allLocal = await db.tags.toArray();
		const byServerId = new Map<string, Tag>();
		const byLocalId = new Map<string, Tag>();
		const byNameUnlinked = new Map<string, Tag>();

		for (const local of allLocal) {
			byLocalId.set(local.id, local);
			if (local.serverId) {
				byServerId.set(local.serverId, local);
			} else {
				byNameUnlinked.set(local.name, local);
			}
		}

		const toPut: Tag[] = [];

		for (const serverTag of serverTags) {
			const localTag =
				byServerId.get(serverTag.id) ??
				byLocalId.get(serverTag.id) ??
				byNameUnlinked.get(serverTag.name);

			if (localTag) {
				if (serverTag.updatedAt > localTag.updatedAt || !localTag.serverId) {
					toPut.push({
						...localTag,
						name: serverTag.name,
						color: serverTag.color,
						isDefault: serverTag.isDefault,
						updatedAt: serverTag.updatedAt,
						deletedAt: serverTag.deletedAt,
						syncStatus: 'synced',
						serverId: serverTag.id
					});
				}
			} else {
				toPut.push({
					id: serverTag.id,
					name: serverTag.name,
					color: serverTag.color,
					isDefault: serverTag.isDefault,
					createdAt: serverTag.createdAt,
					updatedAt: serverTag.updatedAt,
					deletedAt: serverTag.deletedAt,
					syncStatus: 'synced',
					serverId: serverTag.id
				});
			}
		}

		if (toPut.length > 0) {
			await db.tags.bulkPut(toPut);
		}
	});
	await refreshTagColorCache();
}

/**
 * Purge soft-deleted tags that have been synced
 */
export async function purgeSyncedDeletedTags(): Promise<number> {
	const deletedAndSynced = await db.tags
		.where('syncStatus')
		.equals('synced')
		.filter((t) => t.deletedAt !== null)
		.toArray();

	const ids = deletedAndSynced.map((t) => t.id);
	if (ids.length > 0) {
		await db.tags.bulkDelete(ids);
	}

	return ids.length;
}
