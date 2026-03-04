/**
 * Centralized API client for external API interactions
 *
 * This module provides a type-safe, validated interface to your external API.
 * All requests go through the base client which handles:
 * - Authentication (JWT Bearer tokens)
 * - Error handling with custom error classes
 * - Request/response validation with Zod
 * - Timeout handling
 * - Offline support (connectivity monitoring, request queueing, response caching)
 *
 * ## Quick Start
 *
 * 1. Set the `VITE_API_URL` environment variable to your API base URL
 * 2. Initialize offline support in your root layout
 * 3. Import and use the apiClient
 *
 * ## Usage in load functions
 *
 * ```typescript
 * // src/routes/examples/+page.ts
 * import { apiClient } from '$lib/api';
 *
 * export async function load() {
 *   const resources = await apiClient.example.getAll({ page: 1 });
 *   return { resources };
 * }
 * ```
 *
 * ## Usage in components
 *
 * ```svelte
 * <script lang="ts">
 *   import { apiClient } from '$lib/api';
 *   import { isOnline } from '$lib/api/offline';
 *
 *   let loading = $state(false);
 *
 *   async function handleCreate() {
 *     loading = true;
 *     try {
 *       await apiClient.example.create({ name: 'New Item' });
 *     } catch (error) {
 *       // Handle error
 *     } finally {
 *       loading = false;
 *     }
 *   }
 * </script>
 *
 * <button onclick={handleCreate} disabled={loading || !$isOnline}>
 *   Create
 * </button>
 * ```
 *
 * ## Setting up offline support
 *
 * ```svelte
 * <!-- src/routes/+layout.svelte -->
 * <script lang="ts">
 *   import { onMount, onDestroy } from 'svelte';
 *   import { initOfflineSupport, stopOfflineSupport } from '$lib/api/offline';
 *
 *   onMount(() => {
 *     initOfflineSupport();
 *   });
 *
 *   onDestroy(() => {
 *     stopOfflineSupport();
 *   });
 * </script>
 * ```
 *
 * ## Authentication
 *
 * ```typescript
 * import { api } from '$lib/api';
 *
 * // After Firebase auth, store the JWT token
 * api.setAuthTokens({
 *   accessToken: firebaseIdToken,
 *   expiresAt: Date.now() + 3600 * 1000 // 1 hour
 * });
 *
 * // Token is automatically included in all requests
 * // To logout:
 * api.clearAuthTokens();
 * ```
 */

// Core client exports
export {
	api,
	apiRequest,
	apiRequestWithValidation,
	getApiBaseUrl,
	// Token management
	getAuthTokens,
	setAuthTokens,
	clearAuthTokens,
	isTokenExpired,
	getAccessToken,
	// Convenience methods
	get,
	getWithValidation,
	post,
	postWithValidation,
	put,
	putWithValidation,
	patch,
	patchWithValidation,
	del,
	delWithValidation
} from './client';

// Error exports
export {
	ApiError,
	NetworkError,
	TimeoutError,
	ValidationError,
	OfflineError,
	isApiError,
	isNetworkError,
	isTimeoutError,
	isValidationError,
	isOfflineError,
	isRetryableError
} from './errors';

// Type exports
export type {
	HttpMethod,
	RequestOptions,
	CacheOptions,
	PaginatedResponse,
	PaginationParams,
	ApiResponse,
	ApiErrorResponse,
	JwtPayload,
	AuthTokens,
	QueuedRequest,
	CacheEntry,
	ConnectivityStatus,
	RequestInterceptor,
	ResponseInterceptor,
	ApiClientConfig
} from './types';

// Schema exports
export {
	validate,
	validateSafe,
	// Common schemas
	dateStringSchema,
	uuidSchema,
	emailSchema,
	nonEmptyStringSchema,
	positiveIntSchema,
	nonNegativeIntSchema,
	paginationSchema,
	// Schema factories
	createPaginatedSchema,
	createApiResponseSchema,
	apiErrorResponseSchema,
	jwtPayloadSchema,
	// Example schemas (remove or replace with your own)
	userSchema,
	createUserInputSchema,
	updateUserInputSchema
} from './schemas';

export type { User, CreateUserInput, UpdateUserInput } from './schemas';

// Endpoint imports
import { example } from './endpoints/example';
import { tasks } from './endpoints/tasks';
import { tags } from './endpoints/tags';

/**
 * Main API client object
 *
 * Organized by resource type. Add your endpoint modules here.
 *
 * @example
 * ```typescript
 * // Get all examples
 * const { data } = await apiClient.example.getAll();
 *
 * // Create a new example
 * const { data: newItem } = await apiClient.example.create({ name: 'Test' });
 *
 * // Sync tasks
 * const tasks = await apiClient.tasks.getAll(since);
 *
 * // Sync tags
 * const tags = await apiClient.tags.getAll(since);
 * ```
 */
export const apiClient = {
	example,
	tasks,
	tags
};

/**
 * Default export for convenience
 */
export default apiClient;
