/**
 * Network connectivity detection and monitoring
 *
 * Provides reactive state that tracks online/offline status,
 * using Svelte 5 runes for reactivity.
 */

import type { ConnectivityStatus } from '../types';

// Reactive state for connectivity
let connectivityState = $state<ConnectivityStatus>({
	isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
	connectionType: 'unknown'
});

// Track initialization
let initialized = false;
let cleanupFn: (() => void) | null = null;

/**
 * Initialize connectivity monitoring
 * Call this once when your app starts (e.g., in +layout.svelte)
 */
export function initConnectivityMonitoring(): void {
	if (initialized || typeof window === 'undefined') return;
	initialized = true;

	const handleOnline = () => {
		connectivityState.isOnline = true;
	};

	const handleOffline = () => {
		connectivityState.isOnline = false;
	};

	// Listen to browser online/offline events
	window.addEventListener('online', handleOnline);
	window.addEventListener('offline', handleOffline);

	// Try to get more detailed connection info if available
	updateConnectionInfo();

	// Listen for connection changes (if supported)
	const connection = getNetworkConnection();
	if (connection) {
		connection.addEventListener('change', updateConnectionInfo);
	}

	// Store cleanup function
	cleanupFn = () => {
		window.removeEventListener('online', handleOnline);
		window.removeEventListener('offline', handleOffline);
		if (connection) {
			connection.removeEventListener('change', updateConnectionInfo);
		}
		initialized = false;
	};
}

/**
 * Stop connectivity monitoring and cleanup listeners
 */
export function stopConnectivityMonitoring(): void {
	if (cleanupFn) {
		cleanupFn();
		cleanupFn = null;
	}
}

/**
 * Get the Network Information API connection object (if available)
 */
function getNetworkConnection(): NetworkInformation | null {
	if (typeof navigator === 'undefined') return null;

	// Network Information API (Chrome, Edge, Opera, Android WebView)
	const nav = navigator as Navigator & {
		connection?: NetworkInformation;
		mozConnection?: NetworkInformation;
		webkitConnection?: NetworkInformation;
	};

	return nav.connection || nav.mozConnection || nav.webkitConnection || null;
}

/**
 * Update connection info from Network Information API
 */
function updateConnectionInfo(): void {
	const connection = getNetworkConnection();
	if (!connection) return;

	connectivityState.connectionType = mapConnectionType(connection.type);
	connectivityState.effectiveType = connection.effectiveType as ConnectivityStatus['effectiveType'];
}

/**
 * Map Network Information API connection type to our type
 */
function mapConnectionType(type?: string): ConnectivityStatus['connectionType'] {
	switch (type) {
		case 'wifi':
			return 'wifi';
		case 'cellular':
			return 'cellular';
		case 'ethernet':
			return 'ethernet';
		default:
			return 'unknown';
	}
}

// Network Information API types (not in standard TypeScript lib)
interface NetworkInformation extends EventTarget {
	type?: string;
	effectiveType?: string;
	downlink?: number;
	rtt?: number;
	saveData?: boolean;
}

/**
 * Get reactive connectivity status
 * Use this in components to reactively track network status
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { getConnectivity } from '$lib/api/offline/connectivity.svelte';
 *
 *   const connectivity = getConnectivity();
 * </script>
 *
 * {#if connectivity.isOnline}
 *   <p>You're online!</p>
 * {:else}
 *   <p>You're offline. Changes will be synced when you reconnect.</p>
 * {/if}
 * ```
 */
export function getConnectivity(): ConnectivityStatus {
	return connectivityState;
}

/**
 * Get just the online status (reactive)
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { getIsOnline } from '$lib/api/offline/connectivity.svelte';
 *
 *   const isOnline = getIsOnline();
 * </script>
 *
 * <button disabled={!isOnline()}>Submit</button>
 * ```
 */
export function getIsOnline(): boolean {
	return connectivityState.isOnline;
}

/**
 * Wait for the device to come back online
 * Useful for retry logic
 *
 * @param timeout - Maximum time to wait in ms (default: 30000)
 * @returns Promise that resolves when online, or rejects on timeout
 *
 * @example
 * ```typescript
 * try {
 *   await waitForOnline(10000);
 *   // Device is back online, retry request
 * } catch (error) {
 *   // Timed out waiting for connection
 * }
 * ```
 */
export function waitForOnline(timeout: number = 30000): Promise<void> {
	return new Promise((resolve, reject) => {
		// Check if already online
		if (typeof navigator !== 'undefined' && navigator.onLine) {
			resolve();
			return;
		}

		const timeoutId = setTimeout(() => {
			cleanup();
			reject(new Error('Timed out waiting for network connection'));
		}, timeout);

		const handleOnline = () => {
			cleanup();
			resolve();
		};

		const cleanup = () => {
			clearTimeout(timeoutId);
			if (typeof window !== 'undefined') {
				window.removeEventListener('online', handleOnline);
			}
		};

		if (typeof window !== 'undefined') {
			window.addEventListener('online', handleOnline);
		}
	});
}

/**
 * Execute a callback when the device comes back online
 *
 * @param callback - Function to execute when online
 * @returns Cleanup function to remove the listener
 *
 * @example
 * ```typescript
 * const cleanup = onOnline(() => {
 *   console.log('Back online! Syncing...');
 *   syncPendingRequests();
 * });
 *
 * // Later, to stop listening:
 * cleanup();
 * ```
 */
export function onOnline(callback: () => void): () => void {
	if (typeof window === 'undefined') {
		return () => {};
	}

	window.addEventListener('online', callback);
	return () => window.removeEventListener('online', callback);
}

/**
 * Execute a callback when the device goes offline
 *
 * @param callback - Function to execute when offline
 * @returns Cleanup function to remove the listener
 */
export function onOffline(callback: () => void): () => void {
	if (typeof window === 'undefined') {
		return () => {};
	}

	window.addEventListener('offline', callback);
	return () => window.removeEventListener('offline', callback);
}
