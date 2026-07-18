/**
 * Tags API endpoint for sync operations
 *
 * Handles CRUD operations for tags with the backend server.
 * Uses snake_case for API payloads (Python backend convention).
 */
import { z } from 'zod';
import { api } from '../client';
import type { Tag } from '$lib/db/schema';

export const serverTagSchema = z.object({
	id: z.string().uuid(),
	name: z.string(),
	color: z.string(),
	is_default: z.boolean(),
	created_at: z.number(),
	updated_at: z.number(),
	deleted_at: z.number().nullable()
});

export type ServerTag = z.infer<typeof serverTagSchema>;

const serverTagListSchema = z.array(serverTagSchema);

interface TagPayload {
	id: string;
	name: string;
	color: string;
	created_at: number;
	updated_at: number;
}

/**
 * Convert local Tag to API payload (camelCase -> snake_case)
 */
function toPayload(tag: Tag): TagPayload {
	return {
		id: tag.serverId ?? tag.id,
		name: tag.name,
		color: tag.color,
		created_at: tag.createdAt,
		updated_at: tag.updatedAt
	};
}

/**
 * Fetch all tags, optionally filtering by updated timestamp
 */
export async function getAll(since?: number): Promise<ServerTag[]> {
	const endpoint = since && since > 0 ? `/tags?since=${since}` : '/tags';
	return api.getWithValidation(endpoint, serverTagListSchema, { timeout: 10000 });
}

/**
 * Create a new tag on the server
 */
export async function create(tag: Tag): Promise<ServerTag> {
	return api.postWithValidation('/tags', serverTagSchema, toPayload(tag), {
		timeout: 10000
	});
}

/**
 * Update an existing tag on the server
 */
export async function update(serverId: string, tag: Tag): Promise<ServerTag> {
	return api.patchWithValidation(
		`/tags/${serverId}`,
		serverTagSchema,
		{
			name: tag.name,
			color: tag.color,
			updated_at: tag.updatedAt
		},
		{ timeout: 10000 }
	);
}

/**
 * Soft-delete a tag from the server
 */
export async function remove(serverId: string): Promise<void> {
	await api.delete<void>(`/tags/${serverId}`, { timeout: 10000 });
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
