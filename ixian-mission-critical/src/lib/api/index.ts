/**
 * Centralized API client for Mission Critical backend interactions.
 *
 * Requests go through the base client which handles:
 * - Optional Bearer tokens (if set)
 * - Error handling with custom error classes
 * - Request/response validation with Zod
 * - Timeout handling
 * - Connectivity checks
 */

export {
	api,
	apiRequest,
	apiRequestWithValidation,
	getApiBaseUrl,
	getAuthTokens,
	setAuthTokens,
	clearAuthTokens,
	isTokenExpired,
	getAccessToken,
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

export type {
	HttpMethod,
	RequestOptions,
	PaginatedResponse,
	PaginationParams,
	ApiResponse,
	ApiErrorResponse,
	AuthTokens,
	ConnectivityStatus
} from './types';

export {
	validate,
	validateSafe,
	dateStringSchema,
	uuidSchema,
	emailSchema,
	nonEmptyStringSchema,
	positiveIntSchema,
	nonNegativeIntSchema,
	paginationSchema,
	createPaginatedSchema,
	createApiResponseSchema,
	apiErrorResponseSchema
} from './schemas';

import { tasks } from './endpoints/tasks';
import { tags } from './endpoints/tags';

/**
 * Main API client organized by resource type.
 */
export const apiClient = {
	tasks,
	tags
};

export default apiClient;
