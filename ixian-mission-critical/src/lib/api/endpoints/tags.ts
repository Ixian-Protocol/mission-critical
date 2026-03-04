/**
 * Tags API endpoint for sync operations
 *
 * Handles CRUD operations for tags with the backend server.
 * Uses snake_case for API payloads (Python backend convention).
 */
import { api } from '../client';
import type { Tag } from '$lib/db/schema';

// Backend uses snake_case
interface TagPayload {
	name: string;
	color: string;
	is_default: boolean;
	created_at: number;
	updated_at: number;
}

// Server response format (snake_case)
export interface ServerTag {
	id: string;
	name: string;
	color: string;
	is_default: boolean;
	created_at: number;
	updated_at: number;
	deleted_at: number | null;
}

/**
 * Convert local Tag to API payload (camelCase -> snake_case)
 */
function toPayload(tag: Tag): TagPayload {
	return {
		name: tag.name,
		color: tag.color,
		is_default: tag.isDefault,
		created_at: tag.createdAt,
		updated_at: tag.updatedAt
	};
}

/**
 * Fetch all tags, optionally filtering by updated timestamp
 */
export async function getAll(since?: number) {
	const endpoint = since && since > 0 ? `/tags?since=${since}` : '/tags';
	return api.get<{ data: ServerTag[] } | ServerTag[]>(endpoint, { timeout: 10000 });
}

/**
 * Create a new tag on the server
 */
export async function create(tag: Tag) {
	return api.post<{ data?: { id: string }; id?: string }>('/tags', toPayload(tag), {
		timeout: 10000
	});
}

/**
 * Update an existing tag on the server
 */
export async function update(serverId: string, tag: Tag) {
	return api.patch<void>(`/tags/${serverId}`, toPayload(tag), {
		timeout: 10000
	});
}

/**
 * Delete a tag from the server
 */
export async function remove(serverId: string) {
	return api.delete<void>(`/tags/${serverId}`, { timeout: 10000 });
}

/**
 * Tags endpoint namespace
 */
export const tags = {
	getAll,
	create,
	update,
	remove
};
