/**
 * Base API client for external API interactions
 *
 * This module provides a type-safe interface to your external API.
 * All requests go through this client which handles:
 * - Authentication (JWT Bearer tokens)
 * - Error handling with custom error classes
 * - Request/response validation with Zod
 * - Timeout handling
 * - Offline detection and queueing
 * - Response caching
 */

import { z } from 'zod';
import { ApiError, NetworkError, TimeoutError, OfflineError } from './errors';
import { validate } from './schemas';
import type { HttpMethod, RequestOptions, CacheOptions, AuthTokens } from './types';
import { getApiUrl } from '$lib/stores/config.svelte';

// Storage keys
const AUTH_TOKEN_KEY = 'api_auth_tokens';

/**
 * Get the API base URL from config store
 * Returns empty string if not configured (offline mode)
 */
export function getApiBaseUrl(): string {
	return getApiUrl() ?? '';
}

// Token management

/**
 * Get stored authentication tokens
 */
export function getAuthTokens(): AuthTokens | null {
	if (typeof localStorage === 'undefined') return null;

	const stored = localStorage.getItem(AUTH_TOKEN_KEY);
	if (!stored) return null;

	try {
		return JSON.parse(stored) as AuthTokens;
	} catch {
		return null;
	}
}

/**
 * Store authentication tokens
 */
export function setAuthTokens(tokens: AuthTokens): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(tokens));
}

/**
 * Clear stored authentication tokens
 */
export function clearAuthTokens(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(AUTH_TOKEN_KEY);
}

/**
 * Check if the stored access token is expired
 */
export function isTokenExpired(): boolean {
	const tokens = getAuthTokens();
	if (!tokens) return true;

	// Add a 60 second buffer to account for clock skew
	return Date.now() >= tokens.expiresAt - 60000;
}

/**
 * Get the current access token if valid
 */
export function getAccessToken(): string | null {
	if (isTokenExpired()) return null;
	return getAuthTokens()?.accessToken ?? null;
}

// Connectivity check

/**
 * Check if the browser is online
 */
export function isOnline(): boolean {
	if (typeof navigator === 'undefined') return true;
	return navigator.onLine;
}

// Core request function

/**
 * Make an API request with full error handling, timeout, and optional validation
 *
 * @param method - HTTP method
 * @param endpoint - API endpoint (will be appended to base URL)
 * @param options - Request options
 * @returns Promise resolving to the response data
 */
export async function apiRequest<T>(
	method: HttpMethod,
	endpoint: string,
	options: RequestOptions = {}
): Promise<T> {
	const { body, headers = {}, timeout = 30000, skipAuth = false, signal } = options;

	// Check connectivity
	if (!isOnline()) {
		throw new OfflineError('Cannot make request while offline');
	}

	const baseUrl = getApiBaseUrl();
	const url = `${baseUrl}${endpoint}`;

	// Build headers
	const requestHeaders: Record<string, string> = {
		'Content-Type': 'application/json',
		...headers
	};

	// Add auth token if available and not skipped
	if (!skipAuth) {
		const token = getAccessToken();
		if (token) {
			requestHeaders['Authorization'] = `Bearer ${token}`;
		}
	}

	// Build request options
	const requestInit: RequestInit = {
		method,
		headers: requestHeaders
	};

	if (body !== undefined && method !== 'GET') {
		requestInit.body = JSON.stringify(body);
	}

	// Create timeout controller if no external signal provided
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	let abortController: AbortController | undefined;

	if (signal) {
		requestInit.signal = signal;
	} else {
		abortController = new AbortController();
		requestInit.signal = abortController.signal;
		timeoutId = setTimeout(() => abortController!.abort(), timeout);
	}

	try {
		const response = await fetch(url, requestInit);

		// Clear timeout on successful response
		if (timeoutId) clearTimeout(timeoutId);

		// Handle non-OK responses
		if (!response.ok) {
			let errorBody: unknown = null;
			try {
				errorBody = await response.json();
			} catch {
				// Response body is not JSON
				try {
					errorBody = await response.text();
				} catch {
					// Unable to read response body
				}
			}

			throw new ApiError(response.status, response.statusText, errorBody, url);
		}

		// Handle empty responses (204 No Content, etc.)
		if (response.status === 204 || response.headers.get('content-length') === '0') {
			return undefined as T;
		}

		// Parse JSON response
		const data = await response.json();
		return data as T;
	} catch (error) {
		// Clear timeout on error
		if (timeoutId) clearTimeout(timeoutId);

		// Handle abort/timeout
		if (error instanceof DOMException && error.name === 'AbortError') {
			if (signal?.aborted) {
				throw error; // Re-throw if externally aborted
			}
			throw new TimeoutError(timeout, url);
		}

		// Handle network errors
		if (error instanceof TypeError && error.message.includes('fetch')) {
			throw new NetworkError('Network request failed', error);
		}

		// Re-throw known errors
		if (
			error instanceof ApiError ||
			error instanceof NetworkError ||
			error instanceof TimeoutError ||
			error instanceof OfflineError
		) {
			throw error;
		}

		// Wrap unknown errors
		throw new NetworkError(
			error instanceof Error ? error.message : 'Unknown error occurred',
			error instanceof Error ? error : null
		);
	}
}

/**
 * Make an API request with Zod validation
 *
 * @param method - HTTP method
 * @param endpoint - API endpoint
 * @param schema - Zod schema for response validation
 * @param options - Request options
 * @returns Promise resolving to validated response data
 */
export async function apiRequestWithValidation<T>(
	method: HttpMethod,
	endpoint: string,
	schema: z.ZodType<T>,
	options: RequestOptions = {}
): Promise<T> {
	const data = await apiRequest<unknown>(method, endpoint, options);
	return validate(schema, data);
}

// Convenience methods

/**
 * Make a GET request
 */
export function get<T>(endpoint: string, options?: Omit<RequestOptions, 'body'>): Promise<T> {
	return apiRequest<T>('GET', endpoint, options);
}

/**
 * Make a GET request with validation
 */
export function getWithValidation<T>(
	endpoint: string,
	schema: z.ZodType<T>,
	options?: Omit<RequestOptions, 'body'>
): Promise<T> {
	return apiRequestWithValidation<T>('GET', endpoint, schema, options);
}

/**
 * Make a POST request
 */
export function post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
	return apiRequest<T>('POST', endpoint, { ...options, body });
}

/**
 * Make a POST request with validation
 */
export function postWithValidation<T>(
	endpoint: string,
	schema: z.ZodType<T>,
	body?: unknown,
	options?: RequestOptions
): Promise<T> {
	return apiRequestWithValidation<T>('POST', endpoint, schema, { ...options, body });
}

/**
 * Make a PUT request
 */
export function put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
	return apiRequest<T>('PUT', endpoint, { ...options, body });
}

/**
 * Make a PUT request with validation
 */
export function putWithValidation<T>(
	endpoint: string,
	schema: z.ZodType<T>,
	body?: unknown,
	options?: RequestOptions
): Promise<T> {
	return apiRequestWithValidation<T>('PUT', endpoint, schema, { ...options, body });
}

/**
 * Make a PATCH request
 */
export function patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
	return apiRequest<T>('PATCH', endpoint, { ...options, body });
}

/**
 * Make a PATCH request with validation
 */
export function patchWithValidation<T>(
	endpoint: string,
	schema: z.ZodType<T>,
	body?: unknown,
	options?: RequestOptions
): Promise<T> {
	return apiRequestWithValidation<T>('PATCH', endpoint, schema, { ...options, body });
}

/**
 * Make a DELETE request
 */
export function del<T = void>(endpoint: string, options?: RequestOptions): Promise<T> {
	return apiRequest<T>('DELETE', endpoint, options);
}

/**
 * Make a DELETE request with validation
 */
export function delWithValidation<T>(
	endpoint: string,
	schema: z.ZodType<T>,
	options?: RequestOptions
): Promise<T> {
	return apiRequestWithValidation<T>('DELETE', endpoint, schema, options);
}

/**
 * API client object with all request methods
 */
export const api = {
	request: apiRequest,
	requestWithValidation: apiRequestWithValidation,
	get,
	getWithValidation,
	post,
	postWithValidation,
	put,
	putWithValidation,
	patch,
	patchWithValidation,
	delete: del,
	deleteWithValidation: delWithValidation,
	// Token management
	getAuthTokens,
	setAuthTokens,
	clearAuthTokens,
	isTokenExpired,
	getAccessToken,
	// Utilities
	getApiBaseUrl,
	isOnline
};
