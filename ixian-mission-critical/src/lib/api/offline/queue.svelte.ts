/**
 * Offline request queue for mutation operations
 *
 * When the app is offline, mutation requests (POST, PUT, PATCH, DELETE)
 * are queued and automatically retried when connectivity is restored.
 * Uses Svelte 5 runes for reactivity.
 */

import type { QueuedRequest, HttpMethod } from '../types';
import { isRetryableError } from '../errors';
import { onOnline, getIsOnline } from './connectivity.svelte';

// Storage key for persisting queue
const QUEUE_STORAGE_KEY = 'api_offline_queue';

// Maximum retries per request
const DEFAULT_MAX_RETRIES = 3;

// Delay between retries (exponential backoff base)
const RETRY_BASE_DELAY_MS = 1000;

// Reactive state for queued requests
let queueState = $state<QueuedRequest[]>([]);

// Track if we're currently processing the queue
let isProcessing = false;

// Cleanup function for online listener
let onlineCleanup: (() => void) | null = null;

/**
 * Initialize the offline queue
 * Loads persisted queue from storage and sets up online listener
 */
export function initOfflineQueue(): void {
	// Load persisted queue
	loadQueueFromStorage();

	// Set up listener to process queue when coming back online
	onlineCleanup = onOnline(() => {
		processQueue();
	});

	// Process any pending requests if we're online
	if (getIsOnline()) {
		processQueue();
	}
}

/**
 * Cleanup offline queue listeners
 */
export function stopOfflineQueue(): void {
	if (onlineCleanup) {
		onlineCleanup();
		onlineCleanup = null;
	}
}

/**
 * Load queue from localStorage
 */
function loadQueueFromStorage(): void {
	if (typeof localStorage === 'undefined') return;

	try {
		const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
		if (stored) {
			queueState = JSON.parse(stored) as QueuedRequest[];
		}
	} catch (error) {
		console.error('Failed to load offline queue from storage:', error);
	}
}

/**
 * Save queue to localStorage
 */
function saveQueueToStorage(): void {
	if (typeof localStorage === 'undefined') return;

	try {
		localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queueState));
	} catch (error) {
		console.error('Failed to save offline queue to storage:', error);
	}
}

/**
 * Generate a unique ID for a queued request
 */
function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Add a request to the offline queue
 *
 * @param method - HTTP method
 * @param url - Full request URL
 * @param body - Request body
 * @param headers - Request headers
 * @param maxRetries - Maximum retry attempts
 * @returns The queued request object
 */
export function enqueue(
	method: HttpMethod,
	url: string,
	body?: unknown,
	headers?: Record<string, string>,
	maxRetries: number = DEFAULT_MAX_RETRIES
): QueuedRequest {
	const request: QueuedRequest = {
		id: generateId(),
		method,
		url,
		body,
		headers,
		createdAt: Date.now(),
		retryCount: 0,
		maxRetries
	};

	queueState.push(request);
	saveQueueToStorage();

	return request;
}

/**
 * Remove a request from the queue by ID
 */
export function dequeue(id: string): void {
	const index = queueState.findIndex((req) => req.id === id);
	if (index !== -1) {
		queueState.splice(index, 1);
		saveQueueToStorage();
	}
}

/**
 * Clear all requests from the queue
 */
export function clearQueue(): void {
	queueState.length = 0;
	saveQueueToStorage();
}

/**
 * Get all queued requests (reactive)
 */
export function getQueue(): QueuedRequest[] {
	return queueState;
}

/**
 * Get the number of queued requests (reactive)
 */
export function getQueueLength(): number {
	return queueState.length;
}

/**
 * Check if there are pending requests (reactive)
 */
export function hasPendingRequests(): boolean {
	return queueState.length > 0;
}

/**
 * Update a request's retry count
 */
function incrementRetryCount(id: string): void {
	const request = queueState.find((req) => req.id === id);
	if (request) {
		request.retryCount++;
		saveQueueToStorage();
	}
}

/**
 * Process a single queued request
 * Returns true if successful, false if should retry, throws if should remove
 */
async function processRequest(request: QueuedRequest): Promise<boolean> {
	try {
		const response = await fetch(request.url, {
			method: request.method,
			headers: {
				'Content-Type': 'application/json',
				...request.headers
			},
			body: request.body ? JSON.stringify(request.body) : undefined
		});

		if (response.ok) {
			return true;
		}

		// Check if this is a client error (4xx) - don't retry these
		if (response.status >= 400 && response.status < 500) {
			console.error(
				`Request ${request.id} failed with client error ${response.status}, removing from queue`
			);
			throw new Error(`Client error: ${response.status}`);
		}

		// Server error - can retry
		return false;
	} catch (error) {
		// Network errors are retryable
		if (isRetryableError(error)) {
			return false;
		}

		// Other errors - remove from queue
		throw error;
	}
}

/**
 * Process all queued requests
 * Called automatically when coming back online
 */
export async function processQueue(): Promise<void> {
	if (isProcessing) return;
	if (!getIsOnline()) return;

	isProcessing = true;

	// Create a copy to iterate over since we'll be modifying the array
	const queueCopy = [...queueState];

	for (const request of queueCopy) {
		if (!getIsOnline()) {
			break; // Stop if we go offline again
		}

		try {
			const success = await processRequest(request);

			if (success) {
				dequeue(request.id);
				console.log(`Queued request ${request.id} processed successfully`);
			} else {
				// Failed but retryable
				if (request.retryCount >= request.maxRetries) {
					console.error(`Request ${request.id} exceeded max retries, removing from queue`);
					dequeue(request.id);
				} else {
					incrementRetryCount(request.id);
					// Apply exponential backoff delay
					const delay = RETRY_BASE_DELAY_MS * Math.pow(2, request.retryCount);
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			}
		} catch (error) {
			// Non-retryable error
			console.error(`Request ${request.id} failed permanently:`, error);
			dequeue(request.id);
		}
	}

	isProcessing = false;
}

/**
 * Callback type for queue events
 */
export type QueueEventCallback = (request: QueuedRequest) => void;

// Event callbacks
const onEnqueueCallbacks: QueueEventCallback[] = [];
const onDequeueCallbacks: QueueEventCallback[] = [];
const onProcessedCallbacks: QueueEventCallback[] = [];

/**
 * Register a callback for when a request is enqueued
 */
export function onRequestEnqueued(callback: QueueEventCallback): () => void {
	onEnqueueCallbacks.push(callback);
	return () => {
		const index = onEnqueueCallbacks.indexOf(callback);
		if (index > -1) onEnqueueCallbacks.splice(index, 1);
	};
}

/**
 * Register a callback for when a request is dequeued (removed)
 */
export function onRequestDequeued(callback: QueueEventCallback): () => void {
	onDequeueCallbacks.push(callback);
	return () => {
		const index = onDequeueCallbacks.indexOf(callback);
		if (index > -1) onDequeueCallbacks.splice(index, 1);
	};
}

/**
 * Register a callback for when a request is successfully processed
 */
export function onRequestProcessed(callback: QueueEventCallback): () => void {
	onProcessedCallbacks.push(callback);
	return () => {
		const index = onProcessedCallbacks.indexOf(callback);
		if (index > -1) onProcessedCallbacks.splice(index, 1);
	};
}
