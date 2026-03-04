/**
 * Custom error classes for API interactions
 *
 * These errors provide structured error handling throughout the application,
 * making it easy to identify and handle different failure scenarios.
 */

/**
 * Base class for all API-related errors
 */
export class ApiError extends Error {
	readonly status: number;
	readonly statusText: string;
	readonly body: unknown;
	readonly url: string;

	constructor(
		status: number,
		statusText: string,
		body: unknown = null,
		url: string = ''
	) {
		const message = `API Error ${status}: ${statusText}`;
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.statusText = statusText;
		this.body = body;
		this.url = url;
	}

	/**
	 * Check if this is a client error (4xx)
	 */
	get isClientError(): boolean {
		return this.status >= 400 && this.status < 500;
	}

	/**
	 * Check if this is a server error (5xx)
	 */
	get isServerError(): boolean {
		return this.status >= 500;
	}

	/**
	 * Check if this is an authentication error (401)
	 */
	get isUnauthorized(): boolean {
		return this.status === 401;
	}

	/**
	 * Check if this is a forbidden error (403)
	 */
	get isForbidden(): boolean {
		return this.status === 403;
	}

	/**
	 * Check if this is a not found error (404)
	 */
	get isNotFound(): boolean {
		return this.status === 404;
	}

	/**
	 * Check if this is a validation error (422)
	 */
	get isValidationError(): boolean {
		return this.status === 422;
	}

	/**
	 * Check if this is a rate limit error (429)
	 */
	get isRateLimited(): boolean {
		return this.status === 429;
	}
}

/**
 * Error thrown when a network request fails due to connectivity issues
 */
export class NetworkError extends Error {
	readonly originalError: Error | null;

	constructor(message: string = 'Network request failed', originalError: Error | null = null) {
		super(message);
		this.name = 'NetworkError';
		this.originalError = originalError;
	}
}

/**
 * Error thrown when a request times out
 */
export class TimeoutError extends Error {
	readonly timeoutMs: number;
	readonly url: string;

	constructor(timeoutMs: number, url: string = '') {
		super(`Request timed out after ${timeoutMs}ms`);
		this.name = 'TimeoutError';
		this.timeoutMs = timeoutMs;
		this.url = url;
	}
}

/**
 * Error thrown when Zod validation fails on API response
 */
export class ValidationError extends Error {
	readonly errors: Array<{ path: string; message: string }>;

	constructor(errors: Array<{ path: string; message: string }>) {
		const message = `Validation failed: ${errors.map((e) => `${e.path}: ${e.message}`).join(', ')}`;
		super(message);
		this.name = 'ValidationError';
		this.errors = errors;
	}
}

/**
 * Error thrown when the app is offline and cannot make requests
 */
export class OfflineError extends Error {
	constructor(message: string = 'App is offline') {
		super(message);
		this.name = 'OfflineError';
	}
}

// Type guard functions for error checking

export function isApiError(error: unknown): error is ApiError {
	return error instanceof ApiError;
}

export function isNetworkError(error: unknown): error is NetworkError {
	return error instanceof NetworkError;
}

export function isTimeoutError(error: unknown): error is TimeoutError {
	return error instanceof TimeoutError;
}

export function isValidationError(error: unknown): error is ValidationError {
	return error instanceof ValidationError;
}

export function isOfflineError(error: unknown): error is OfflineError {
	return error instanceof OfflineError;
}

/**
 * Check if an error is retryable (network issues, timeouts, 5xx errors)
 */
export function isRetryableError(error: unknown): boolean {
	if (isNetworkError(error) || isTimeoutError(error) || isOfflineError(error)) {
		return true;
	}
	if (isApiError(error)) {
		return error.isServerError || error.isRateLimited;
	}
	return false;
}
