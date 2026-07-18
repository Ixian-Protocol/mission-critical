/**
 * Offline support — connectivity monitoring for sync and UI.
 *
 * Product mutations use Dexie + the sync engine, not an HTTP request queue.
 */

export {
	getConnectivity,
	getIsOnline,
	initConnectivityMonitoring,
	stopConnectivityMonitoring,
	waitForOnline,
	onOnline,
	onOffline
} from './connectivity.svelte';

import {
	initConnectivityMonitoring,
	stopConnectivityMonitoring
} from './connectivity.svelte';

/**
 * Initialize connectivity monitoring.
 * Call once on app startup (e.g. in +layout.svelte).
 */
export function initOfflineSupport(): void {
	initConnectivityMonitoring();
}

/**
 * Stop connectivity monitoring and cleanup listeners.
 */
export function stopOfflineSupport(): void {
	stopConnectivityMonitoring();
}
