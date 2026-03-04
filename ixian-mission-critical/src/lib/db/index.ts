/**
 * Database module exports
 */

export { db, initDatabase, closeDatabase, DEFAULT_TAGS, TAG_COLORS, RECURRENCE_OPTIONS } from './schema';
export type { Task, TaskTag, Tag, SyncStatus, SyncMeta, RecurrenceType } from './schema';

export {
	createTask,
	updateTask,
	deleteTask,
	hardDeleteTask,
	toggleTaskComplete,
	toggleTaskImportant,
	clearCompletedTasks,
	getTask,
	getAllTasks,
	createTasksQuery,
	createTaskCountsQuery,
	getPendingTasks,
	markTaskSynced,
	upsertTasksFromServer,
	purgeSyncedDeletedTasks,
	createNextRecurrence
} from './tasks.svelte';
export type { TaskFilter } from './tasks.svelte';

export {
	initSync,
	stopSync,
	triggerSync,
	syncWithServer,
	forceFullSync,
	getSyncState
} from './sync.svelte';

export {
	initDefaultTags,
	createTag,
	updateTag,
	deleteTag,
	getTag,
	getTagByName,
	getAllTags,
	createTagsQuery,
	getTagColor,
	getTagColorAsync,
	refreshTagColorCache,
	getPendingTags,
	markTagSynced,
	upsertTagsFromServer,
	purgeSyncedDeletedTags
} from './tags.svelte';
