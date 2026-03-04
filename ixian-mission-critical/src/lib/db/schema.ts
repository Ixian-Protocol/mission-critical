/**
 * Dexie database schema for offline-first todo storage
 */

import Dexie, { type EntityTable } from 'dexie';

/**
 * Default task tags (seeded on first run)
 */
export const DEFAULT_TAGS = ['General', 'Work', 'Personal', 'Research', 'Design'] as const;

/**
 * Tag is now a string to support custom tags
 */
export type TaskTag = string;

/**
 * Available recurrence options
 */
export const RECURRENCE_OPTIONS = ['none', 'daily', 'weekly', 'monthly'] as const;
export type RecurrenceType = (typeof RECURRENCE_OPTIONS)[number];

/**
 * Sync status for a task
 */
export type SyncStatus = 'synced' | 'pending';

/**
 * Task entity
 */
export interface Task {
	/** Local UUID */
	id: string;
	/** Task title */
	text: string;
	/** Optional description/notes */
	description: string;
	/** Whether the task is completed */
	completed: boolean;
	/** Whether the task is marked as important */
	important: boolean;
	/** Task category tag */
	tag: TaskTag;
	/** Due date/time timestamp (ms) - null if no due date */
	dueAt: number | null;
	/** Recurrence pattern */
	recurrence: RecurrenceType;
	/** Every-other flag (alternates recurrence, e.g., every other day) */
	recurrenceAlt: boolean;
	/** Creation timestamp (ms) */
	createdAt: number;
	/** Last update timestamp (ms) - used for conflict resolution */
	updatedAt: number;
	/** Soft delete timestamp (ms) - null if not deleted */
	deletedAt: number | null;
	/** Sync status with server */
	syncStatus: SyncStatus;
	/** Server-assigned ID (null until synced) */
	serverId: string | null;
}

/**
 * Sync metadata - singleton record tracking sync state
 */
export interface SyncMeta {
	/** Always 'sync_meta' - singleton pattern */
	id: string;
	/** Last successful sync timestamp */
	lastSyncAt: number;
	/** Server version for conflict detection */
	serverVersion: number;
}

/**
 * Color palette for auto-assigning tag colors
 */
export const TAG_COLORS = [
	'#14b8a6', // teal
	'#a855f7', // purple
	'#3b82f6', // blue
	'#22c55e', // green
	'#ec4899', // pink
	'#f97316', // orange
	'#ef4444', // red
	'#eab308' // yellow
] as const;

/**
 * Tag entity for custom tags
 */
export interface Tag {
	/** Local UUID */
	id: string;
	/** Tag name (unique) */
	name: string;
	/** Tag color (hex) */
	color: string;
	/** Whether this is a default/built-in tag */
	isDefault: boolean;
	/** Creation timestamp (ms) */
	createdAt: number;
	/** Last update timestamp (ms) */
	updatedAt: number;
	/** Soft delete timestamp (ms) - null if not deleted */
	deletedAt: number | null;
	/** Sync status with server */
	syncStatus: SyncStatus;
	/** Server-assigned ID (null until synced) */
	serverId: string | null;
}

/**
 * Todo database class using Dexie
 */
export class TodoDatabase extends Dexie {
	tasks!: EntityTable<Task, 'id'>;
	tags!: EntityTable<Tag, 'id'>;
	syncMeta!: EntityTable<SyncMeta, 'id'>;

	constructor() {
		super('TodoDB');

		// Version 1: Initial schema
		this.version(1).stores({
			tasks: 'id, completed, important, tag, createdAt, updatedAt, syncStatus, deletedAt, serverId',
			syncMeta: 'id'
		});

		// Version 2: Add due date and recurrence fields
		this.version(2)
			.stores({
				tasks: 'id, completed, important, tag, createdAt, updatedAt, syncStatus, deletedAt, serverId, dueAt',
				syncMeta: 'id'
			})
			.upgrade((tx) => {
				return tx
					.table('tasks')
					.toCollection()
					.modify((task) => {
						task.dueAt = null;
						task.recurrence = 'none';
						task.recurrenceAlt = false;
					});
			});

		// Version 3: Add tags table for custom tags
		this.version(3).stores({
			tasks: 'id, completed, important, tag, createdAt, updatedAt, syncStatus, deletedAt, serverId, dueAt',
			tags: 'id, name, createdAt, updatedAt, syncStatus, deletedAt, serverId',
			syncMeta: 'id'
		});
	}
}

/**
 * Database singleton instance
 */
export const db = new TodoDatabase();

/**
 * Initialize the database
 * Call this on app startup
 */
export async function initDatabase(): Promise<void> {
	try {
		await db.open();
	} catch (error) {
		console.error('Failed to open database:', error);
		throw error;
	}
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
	db.close();
}
