/**
 * Offline support module exports
 *
 * This module provides everything needed for offline-capable API interactions:
 * - Connectivity monitoring (Svelte 5 runes)
 * - Request queueing for mutations
 * - Response caching with TTL
 */

// Connectivity monitoring (Svelte 5 runes)
export {
	getConnectivity,
	getIsOnline,
	initConnectivityMonitoring,
	stopConnectivityMonitoring,
	waitForOnline,
	onOnline,
	onOffline
} from './connectivity.svelte';

// Request queue (Svelte 5 runes)
export {
	getQueue,
	getQueueLength,
	hasPendingRequests,
	initOfflineQueue,
	stopOfflineQueue,
	enqueue,
	dequeue,
	clearQueue,
	processQueue,
	onRequestEnqueued,
	onRequestDequeued,
	onRequestProcessed
} from './queue.svelte';

// Response cache
export {
	getFromCache,
	setInCache,
	removeFromCache,
	clearCache,
	clearExpiredCache,
	invalidateCacheByPattern,
	isCacheStale,
	getCacheStats,
	withCache,
	generateCacheKey
} from './cache';

import { initConnectivityMonitoring, stopConnectivityMonitoring } from './connectivity.svelte';
import { initOfflineQueue, stopOfflineQueue } from './queue.svelte';

/**
 * Initialize all offline support features
 * Call this once when your app starts (e.g., in +layout.svelte)
 *
 * @example
 * ```svelte
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
 */
export function initOfflineSupport(): void {
	initConnectivityMonitoring();
	initOfflineQueue();
}

/**
 * Stop all offline support features and cleanup listeners
 */
export function stopOfflineSupport(): void {
	stopConnectivityMonitoring();
	stopOfflineQueue();
}
