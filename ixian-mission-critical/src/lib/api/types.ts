/**
 * TypeScript types for API interactions
 *
 * These types provide structure for API requests, responses, and common patterns
 * used throughout the application.
 */

/**
 * HTTP methods supported by the API client
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Options for API requests
 */
export interface RequestOptions {
	/** Request body (will be JSON stringified) */
	body?: unknown;
	/** Additional headers to include */
	headers?: Record<string, string>;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
	/** Whether to skip authentication header (default: false) */
	skipAuth?: boolean;
	/** AbortSignal for request cancellation */
	signal?: AbortSignal;
	/** Cache options for this request */
	cache?: CacheOptions;
}

/**
 * Options for caching API responses
 */
export interface CacheOptions {
	/** Whether to enable caching for this request (default: false for mutations) */
	enabled?: boolean;
	/** Time-to-live in milliseconds (default: 5 minutes) */
	ttl?: number;
	/** Custom cache key (default: generated from URL and params) */
	key?: string;
	/** Use stale data while revalidating (default: true) */
	staleWhileRevalidate?: boolean;
}

/**
 * Standard paginated response wrapper
 */
export interface PaginatedResponse<T> {
	data: T[];
	pagination: {
		page: number;
		pageSize: number;
		totalPages: number;
		totalItems: number;
		hasNextPage: boolean;
		hasPreviousPage: boolean;
	};
}

/**
 * Standard pagination request parameters
 */
export interface PaginationParams {
	page?: number;
	pageSize?: number;
	sortBy?: string;
	sortOrder?: 'asc' | 'desc';
}

/**
 * Standard API response wrapper (for non-paginated responses)
 */
export interface ApiResponse<T> {
	data: T;
	message?: string;
}

/**
 * Standard error response from API
 */
export interface ApiErrorResponse {
	error: {
		code: string;
		message: string;
		details?: Record<string, unknown>;
	};
}

/**
 * JWT token payload structure (Firebase Auth)
 */
export interface JwtPayload {
	sub: string;
	email?: string;
	email_verified?: boolean;
	name?: string;
	picture?: string;
	iat: number;
	exp: number;
	aud: string;
	iss: string;
}

/**
 * Authentication tokens stored client-side
 */
export interface AuthTokens {
	accessToken: string;
	refreshToken?: string;
	expiresAt: number;
}

/**
 * Queued request for offline support
 */
export interface QueuedRequest {
	id: string;
	method: HttpMethod;
	url: string;
	body?: unknown;
	headers?: Record<string, string>;
	createdAt: number;
	retryCount: number;
	maxRetries: number;
}

/**
 * Cached response entry
 */
export interface CacheEntry<T = unknown> {
	data: T;
	cachedAt: number;
	expiresAt: number;
	etag?: string;
}

/**
 * Network connectivity status
 */
export interface ConnectivityStatus {
	isOnline: boolean;
	connectionType?: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
	effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
}

/**
 * Request interceptor function type
 */
export type RequestInterceptor = (
	url: string,
	options: RequestInit
) => Promise<{ url: string; options: RequestInit }> | { url: string; options: RequestInit };

/**
 * Response interceptor function type
 */
export type ResponseInterceptor = (response: Response) => Promise<Response> | Response;

/**
 * API client configuration
 */
export interface ApiClientConfig {
	/** Base URL for all requests */
	baseUrl: string;
	/** Default timeout in milliseconds */
	timeout?: number;
	/** Default headers for all requests */
	defaultHeaders?: Record<string, string>;
	/** Request interceptors */
	requestInterceptors?: RequestInterceptor[];
	/** Response interceptors */
	responseInterceptors?: ResponseInterceptor[];
	/** Enable offline queue for mutations */
	enableOfflineQueue?: boolean;
	/** Enable response caching */
	enableCache?: boolean;
}
