/**
 * Example API endpoint module
 *
 * This file demonstrates the pattern for creating endpoint modules.
 * Copy this file and adapt it for your actual API resources.
 *
 * Each endpoint module should:
 * 1. Define Zod schemas for request/response validation
 * 2. Export typed functions for each API operation
 * 3. Use the base client for consistent error handling
 */

import { z } from 'zod';
import { api } from '../client';
import {
	createPaginatedSchema,
	createApiResponseSchema,
	uuidSchema,
	dateStringSchema,
	emailSchema
} from '../schemas';
import type { PaginationParams } from '../types';
import { withCache, invalidateCacheByPattern } from '../offline/cache';
import { enqueue } from '../offline/queue.svelte';
import { getIsOnline } from '../offline/connectivity.svelte';
import { getApiBaseUrl } from '../client';

// ============================================================================
// Schemas
// ============================================================================

/**
 * Example resource schema
 * Replace with your actual resource schema
 */
export const exampleResourceSchema = z.object({
	id: uuidSchema,
	name: z.string(),
	email: emailSchema.optional(),
	status: z.enum(['active', 'inactive', 'pending']),
	metadata: z.record(z.string(), z.unknown()).optional(),
	createdAt: dateStringSchema,
	updatedAt: dateStringSchema
});

export type ExampleResource = z.infer<typeof exampleResourceSchema>;

/**
 * Schema for creating a new resource
 */
export const createExampleInputSchema = z.object({
	name: z.string().min(1).max(255),
	email: emailSchema.optional(),
	status: z.enum(['active', 'inactive', 'pending']).default('pending'),
	metadata: z.record(z.string(), z.unknown()).optional()
});

export type CreateExampleInput = z.infer<typeof createExampleInputSchema>;

/**
 * Schema for updating a resource
 */
export const updateExampleInputSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	email: emailSchema.optional(),
	status: z.enum(['active', 'inactive', 'pending']).optional(),
	metadata: z.record(z.string(), z.unknown()).optional()
});

export type UpdateExampleInput = z.infer<typeof updateExampleInputSchema>;

/**
 * Response schemas
 */
const singleResourceSchema = createApiResponseSchema(exampleResourceSchema);
const paginatedResourceSchema = createPaginatedSchema(exampleResourceSchema);

// ============================================================================
// API Functions
// ============================================================================

const ENDPOINT = '/api/examples';

/**
 * Get all resources with pagination
 *
 * @example
 * ```typescript
 * const { data, pagination } = await example.getAll({ page: 1, pageSize: 10 });
 * ```
 */
export async function getAll(params?: PaginationParams) {
	const queryParams = new URLSearchParams();
	if (params?.page) queryParams.set('page', String(params.page));
	if (params?.pageSize) queryParams.set('pageSize', String(params.pageSize));
	if (params?.sortBy) queryParams.set('sortBy', params.sortBy);
	if (params?.sortOrder) queryParams.set('sortOrder', params.sortOrder);

	const query = queryParams.toString();
	const url = query ? `${ENDPOINT}?${query}` : ENDPOINT;

	return api.getWithValidation(url, paginatedResourceSchema);
}

/**
 * Get all resources with caching
 * Use this for data that doesn't change frequently
 *
 * @example
 * ```typescript
 * const { data, pagination } = await example.getAllCached({ page: 1 });
 * ```
 */
export const getAllCached = withCache(
	getAll,
	(params) => `${ENDPOINT}?${JSON.stringify(params ?? {})}`,
	{ ttl: 5 * 60 * 1000 } // 5 minutes
);

/**
 * Get a single resource by ID
 *
 * @example
 * ```typescript
 * const { data } = await example.getById('123');
 * ```
 */
export async function getById(id: string) {
	return api.getWithValidation(`${ENDPOINT}/${id}`, singleResourceSchema);
}

/**
 * Get a single resource by ID with caching
 */
export const getByIdCached = withCache(
	getById,
	(id) => `${ENDPOINT}/${id}`,
	{ ttl: 5 * 60 * 1000 }
);

/**
 * Create a new resource
 *
 * @example
 * ```typescript
 * const { data } = await example.create({ name: 'New Item', status: 'active' });
 * ```
 */
export async function create(input: CreateExampleInput) {
	// Validate input before sending
	const validatedInput = createExampleInputSchema.parse(input);

	// Check if offline - queue the request if so
	if (!getIsOnline()) {
		const baseUrl = getApiBaseUrl();
		enqueue('POST', `${baseUrl}${ENDPOINT}`, validatedInput);
		// Return optimistic response (you might want to handle this differently)
		throw new Error('Request queued for offline sync');
	}

	const result = await api.postWithValidation(ENDPOINT, singleResourceSchema, validatedInput);

	// Invalidate list cache after creation
	invalidateCacheByPattern(ENDPOINT);

	return result;
}

/**
 * Update a resource
 *
 * @example
 * ```typescript
 * const { data } = await example.update('123', { name: 'Updated Name' });
 * ```
 */
export async function update(id: string, input: UpdateExampleInput) {
	// Validate input before sending
	const validatedInput = updateExampleInputSchema.parse(input);

	// Check if offline - queue the request if so
	if (!getIsOnline()) {
		const baseUrl = getApiBaseUrl();
		enqueue('PATCH', `${baseUrl}${ENDPOINT}/${id}`, validatedInput);
		throw new Error('Request queued for offline sync');
	}

	const result = await api.patchWithValidation(`${ENDPOINT}/${id}`, singleResourceSchema, validatedInput);

	// Invalidate both list and individual cache
	invalidateCacheByPattern(ENDPOINT);

	return result;
}

/**
 * Delete a resource
 *
 * @example
 * ```typescript
 * await example.remove('123');
 * ```
 */
export async function remove(id: string) {
	// Check if offline - queue the request if so
	if (!getIsOnline()) {
		const baseUrl = getApiBaseUrl();
		enqueue('DELETE', `${baseUrl}${ENDPOINT}/${id}`);
		throw new Error('Request queued for offline sync');
	}

	await api.delete(`${ENDPOINT}/${id}`);

	// Invalidate cache after deletion
	invalidateCacheByPattern(ENDPOINT);
}

// ============================================================================
// Export as namespace-like object
// ============================================================================

/**
 * Example endpoint module
 *
 * Usage:
 * ```typescript
 * import { example } from '$lib/api';
 *
 * // In a load function
 * export async function load() {
 *   const resources = await example.getAll({ page: 1 });
 *   return { resources };
 * }
 *
 * // In a component
 * const handleCreate = async () => {
 *   try {
 *     await example.create({ name: 'New Item' });
 *   } catch (error) {
 *     if (error.message.includes('offline')) {
 *       // Show "will sync when online" message
 *     }
 *   }
 * };
 * ```
 */
export const example = {
	// Schemas (for external validation if needed)
	schemas: {
		resource: exampleResourceSchema,
		createInput: createExampleInputSchema,
		updateInput: updateExampleInputSchema
	},
	// API methods
	getAll,
	getAllCached,
	getById,
	getByIdCached,
	create,
	update,
	remove
};
