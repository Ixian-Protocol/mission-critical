/**
 * Sync engine for synchronizing local tasks with the server
 *
 * Uses optimistic updates with last-write-wins conflict resolution.
 * All mutations happen locally first, then sync in the background.
 */

import { getIsOnline, onOnline } from '$lib/api/offline';
import { getApiUrl } from '$lib/stores/config.svelte';
import { apiClient } from '$lib/api';
import { isApiError, NetworkError, TimeoutError, OfflineError } from '$lib/api/errors';
import type { ServerTask } from '$lib/api/endpoints/tasks';
import type { ServerTag } from '$lib/api/endpoints/tags';
import {
	db,
	getPendingTasks,
	markTaskSynced,
	clearTaskServerLink,
	upsertTasksFromServer,
	purgeSyncedDeletedTasks,
	hardDeleteTask,
	getPendingTags,
	markTagSynced,
	clearTagServerLink,
	upsertTagsFromServer,
	purgeSyncedDeletedTags
} from './index';
import type { Task, Tag, SyncMeta } from './schema';

// Sync state using Svelte 5 runes
let syncState = $state<{
	isSyncing: boolean;
	lastSyncAt: number | null;
	pendingCount: number;
	error: string | null;
}>({
	isSyncing: false,
	lastSyncAt: null,
	pendingCount: 0,
	error: null
});

// Cleanup function for online listener
let onlineCleanup: (() => void) | null = null;

// Debounce timer for sync triggers
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const SYNC_CONCURRENCY = 12;

/**
 * Run async work over items with bounded concurrency
 */
async function mapWithConcurrency<T>(
	items: T[],
	concurrency: number,
	worker: (item: T) => Promise<void>
): Promise<void> {
	if (items.length === 0) return;

	let nextIndex = 0;
	const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
		while (nextIndex < items.length) {
			const index = nextIndex++;
			await worker(items[index]);
		}
	});
	await Promise.all(runners);
}

/**
 * Get the current sync state
 */
export function getSyncState() {
	return syncState;
}

/**
 * Initialize the sync engine
 */
export function initSync(): void {
	// Set up listener to sync when coming back online
	onlineCleanup = onOnline(() => {
		triggerSync();
	});

	// Initial sync if online
	if (getIsOnline()) {
		triggerSync();
	}

	// Update pending count
	updatePendingCount();
}

/**
 * Stop the sync engine
 */
export function stopSync(): void {
	if (onlineCleanup) {
		onlineCleanup();
		onlineCleanup = null;
	}
	if (syncDebounceTimer) {
		clearTimeout(syncDebounceTimer);
		syncDebounceTimer = null;
	}
}

/**
 * Trigger a sync (debounced)
 */
export function triggerSync(): void {
	if (syncDebounceTimer) {
		clearTimeout(syncDebounceTimer);
	}

	syncDebounceTimer = setTimeout(() => {
		syncWithServer();
	}, 500); // Debounce for 500ms
}

/**
 * Update the pending count (tasks + tags)
 */
async function updatePendingCount(): Promise<void> {
	try {
		const pendingTasks = await getPendingTasks();
		const pendingTags = await getPendingTags();
		syncState.pendingCount = pendingTasks.length + pendingTags.length;
	} catch (error) {
		console.error('Failed to update pending count:', error);
	}
}

/**
 * Get sync metadata
 */
async function getSyncMeta(): Promise<SyncMeta | undefined> {
	return db.syncMeta.get('sync_meta');
}

/**
 * Update sync metadata
 */
async function updateSyncMeta(lastSyncAt: number): Promise<void> {
	await db.syncMeta.put({
		id: 'sync_meta',
		lastSyncAt,
		serverVersion: 0
	});
	syncState.lastSyncAt = lastSyncAt;
}

/**
 * Main sync function - syncs local changes with server
 */
export async function syncWithServer(): Promise<void> {
	const apiUrl = getApiUrl();

	// Skip if offline or no API URL configured
	if (!getIsOnline() || !apiUrl) {
		return;
	}

	// Skip if already syncing
	if (syncState.isSyncing) {
		return;
	}

	syncState.isSyncing = true;
	syncState.error = null;

	try {
		// Get sync metadata
		const meta = await getSyncMeta();
		const lastSyncAt = meta?.lastSyncAt || 0;
		let nextLastSyncAt = lastSyncAt;

		// Step 1: Pull changes from server (tasks + tags)
		nextLastSyncAt = Math.max(nextLastSyncAt, await pullTasksFromServer(lastSyncAt));
		nextLastSyncAt = Math.max(nextLastSyncAt, await pullTagsFromServer(lastSyncAt));

		// Step 2: Push local changes to server (tasks + tags)
		await pushTasksToServer();
		await pushTagsToServer();

		// Step 3: Purge synced deleted items
		await purgeSyncedDeletedTasks();
		await purgeSyncedDeletedTags();

		// Step 4: Update sync metadata using server item timestamps, not client wall-clock time.
		if (nextLastSyncAt > lastSyncAt) {
			await updateSyncMeta(nextLastSyncAt);
		}

		// Update pending count
		await updatePendingCount();
	} catch (error) {
		console.error('Sync failed:', error);
		syncState.error = error instanceof Error ? error.message : 'Sync failed';
	} finally {
		syncState.isSyncing = false;
	}
}

/**
 * Convert server task (snake_case) to local format (camelCase)
 */
function serverTaskToLocal(task: ServerTask) {
	return {
		id: task.id,
		text: task.text,
		description: task.description,
		completed: task.completed,
		important: task.important,
		tag: task.tag,
		dueAt: task.due_at,
		recurrence: task.recurrence,
		recurrenceAlt: task.recurrence_alt,
		createdAt: task.created_at,
		updatedAt: task.updated_at,
		deletedAt: task.deleted_at
	};
}

/**
 * Pull task changes from server since last sync
 */
async function pullTasksFromServer(since: number): Promise<number> {
	try {
		const serverTasks = await apiClient.tasks.getAll(since);

		if (serverTasks.length > 0) {
			const tasksForLocal = serverTasks.map(serverTaskToLocal);
			await upsertTasksFromServer(tasksForLocal);
			return Math.max(...tasksForLocal.map((task) => task.updatedAt));
		}
	} catch (error) {
		// Reachability failures should surface in the UI; partial API errors stay non-fatal
		if (
			error instanceof NetworkError ||
			error instanceof TimeoutError ||
			error instanceof OfflineError
		) {
			throw error;
		}
		console.warn('Failed to pull tasks from server:', error);
	}
	return since;
}

/**
 * Push a single pending task to the server
 */
async function pushOneTask(task: Task): Promise<void> {
	try {
		if (task.deletedAt !== null) {
			if (task.serverId) {
				await deleteTaskOnServer(task.serverId);
			}
			await hardDeleteTask(task.id);
		} else if (task.serverId) {
			try {
				await updateTaskOnServer(task);
			} catch (error) {
				if (isApiError(error) && error.status === 404) {
					await clearTaskServerLink(task.id);
					const refreshed = await db.tasks.get(task.id);
					if (refreshed) await createTaskOnServer(refreshed);
				} else {
					console.error(`Failed to sync task ${task.id}:`, error);
				}
			}
		} else {
			await createTaskOnServer(task);
		}
	} catch (error) {
		console.error(`Failed to sync task ${task.id}:`, error);
	}
}

/**
 * Push local pending task changes to server
 */
async function pushTasksToServer(): Promise<void> {
	const pendingTasks = await getPendingTasks();
	await mapWithConcurrency(pendingTasks, SYNC_CONCURRENCY, pushOneTask);
}

/**
 * Create a task on the server
 */
async function createTaskOnServer(task: Task): Promise<void> {
	const data = await apiClient.tasks.create(task);
	await markTaskSynced(task.id, data.id);
}

/**
 * Update a task on the server
 */
async function updateTaskOnServer(task: Task): Promise<void> {
	await apiClient.tasks.update(task.serverId!, task);
	await markTaskSynced(task.id, task.serverId!);
}

/**
 * Delete a task on the server
 */
async function deleteTaskOnServer(serverId: string): Promise<void> {
	try {
		await apiClient.tasks.remove(serverId);
	} catch (error) {
		// 404 is acceptable - task may already be deleted on server
		if (isApiError(error) && error.status === 404) {
			return;
		}
		throw error;
	}
}

// ============================================================================
// Tag Sync Functions
// ============================================================================

/**
 * Convert server tag (snake_case) to local format (camelCase)
 */
function serverTagToLocal(tag: ServerTag) {
	return {
		id: tag.id,
		name: tag.name,
		color: tag.color,
		isDefault: tag.is_default,
		createdAt: tag.created_at,
		updatedAt: tag.updated_at,
		deletedAt: tag.deleted_at
	};
}

/**
 * Pull tag changes from server since last sync
 */
async function pullTagsFromServer(since: number): Promise<number> {
	try {
		const serverTags = await apiClient.tags.getAll(since);

		if (serverTags.length > 0) {
			const tagsForLocal = serverTags.map(serverTagToLocal);
			await upsertTagsFromServer(tagsForLocal);
			return Math.max(...tagsForLocal.map((tag) => tag.updatedAt));
		}
	} catch (error) {
		if (
			error instanceof NetworkError ||
			error instanceof TimeoutError ||
			error instanceof OfflineError
		) {
			throw error;
		}
		console.warn('Failed to pull tags from server:', error);
	}
	return since;
}

/**
 * Push a single pending tag to the server
 */
async function pushOneTag(tag: Tag): Promise<void> {
	try {
		if (tag.deletedAt !== null) {
			if (tag.serverId) {
				await deleteTagOnServer(tag.serverId);
			}
			await db.tags.delete(tag.id);
		} else if (tag.serverId) {
			try {
				await updateTagOnServer(tag);
			} catch (error) {
				if (isApiError(error) && error.status === 404) {
					await clearTagServerLink(tag.id);
					const refreshed = await db.tags.get(tag.id);
					if (refreshed) await createTagOnServer(refreshed);
				} else {
					console.error(`Failed to sync tag ${tag.id}:`, error);
				}
			}
		} else {
			await createTagOnServer(tag);
		}
	} catch (error) {
		console.error(`Failed to sync tag ${tag.id}:`, error);
	}
}

/**
 * Push local pending tag changes to server
 */
async function pushTagsToServer(): Promise<void> {
	const pendingTags = await getPendingTags();
	await mapWithConcurrency(pendingTags, SYNC_CONCURRENCY, pushOneTag);
}

/**
 * Create a tag on the server
 */
async function createTagOnServer(tag: Tag): Promise<void> {
	const data = await apiClient.tags.create(tag);
	await markTagSynced(tag.id, data.id);
}

/**
 * Update a tag on the server
 */
async function updateTagOnServer(tag: Tag): Promise<void> {
	await apiClient.tags.update(tag.serverId!, tag);
	await markTagSynced(tag.id, tag.serverId!);
}

/**
 * Delete a tag on the server
 */
async function deleteTagOnServer(serverId: string): Promise<void> {
	try {
		await apiClient.tags.remove(serverId);
	} catch (error) {
		// 404 is acceptable - tag may already be deleted on server
		if (isApiError(error) && error.status === 404) {
			return;
		}
		throw error;
	}
}

/**
 * Force a full sync (pulls all data, ignoring last sync time)
 */
export async function forceFullSync(): Promise<void> {
	// Reset sync metadata
	await db.syncMeta.delete('sync_meta');
	syncState.lastSyncAt = null;

	// Trigger sync
	await syncWithServer();
}
