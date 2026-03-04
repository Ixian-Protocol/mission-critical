/**
 * Local notifications management with Svelte 5 runes
 *
 * Supports both Capacitor LocalNotifications (native) and
 * browser Notification API (web) with automatic fallback.
 */

import { LocalNotifications } from '@capacitor/local-notifications';
import type { LocalNotification, NotificationState } from './types';
import { getCapabilities } from '../platform.svelte';

// Reactive state
let notificationState = $state<NotificationState>({
	permissionStatus: 'unknown',
	lastNotificationId: 0
});

let initialized = false;
let notificationListeners: Array<(notification: LocalNotification) => void> = [];

/**
 * Check if browser Notification API is available
 */
function hasBrowserNotifications(): boolean {
	return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Initialize notifications module
 */
export async function initNotifications(): Promise<void> {
	if (initialized || typeof window === 'undefined') return;

	initialized = true;

	// Check permissions on init
	await checkPermissions();

	// Only set up Capacitor listeners if available
	if (getCapabilities().notifications) {
		try {
			await LocalNotifications.addListener('localNotificationReceived', (notification) => {
				notificationListeners.forEach((cb) =>
					cb({
						id: notification.id,
						title: notification.title ?? '',
						body: notification.body ?? '',
						extra: notification.extra
					})
				);
			});
		} catch {
			// Ignore listener errors
		}
	}
}

/**
 * Check notification permissions
 */
export async function checkPermissions(): Promise<NotificationState['permissionStatus']> {
	// Try Capacitor LocalNotifications first (native)
	if (getCapabilities().notifications) {
		try {
			const status = await LocalNotifications.checkPermissions();
			const displayStatus = status.display as NotificationState['permissionStatus'];
			notificationState.permissionStatus = displayStatus;
			return displayStatus;
		} catch {
			return 'denied';
		}
	}

	// Fallback to browser Notification API (web)
	if (hasBrowserNotifications()) {
		const permission = Notification.permission;
		notificationState.permissionStatus = permission as NotificationState['permissionStatus'];
		return permission as NotificationState['permissionStatus'];
	}

	notificationState.permissionStatus = 'denied';
	return 'denied';
}

/**
 * Request notification permissions
 */
export async function requestPermissions(): Promise<boolean> {
	console.log('[Notifications] requestPermissions called');
	console.log('[Notifications] capabilities.notifications:', getCapabilities().notifications);
	console.log('[Notifications] hasBrowserNotifications:', hasBrowserNotifications());

	// Try Capacitor LocalNotifications first (native)
	if (getCapabilities().notifications) {
		try {
			console.log('[Notifications] Using Capacitor LocalNotifications');
			const status = await LocalNotifications.requestPermissions();
			const displayStatus = status.display as NotificationState['permissionStatus'];
			notificationState.permissionStatus = displayStatus;
			return status.display === 'granted';
		} catch (e) {
			console.error('[Notifications] Capacitor error:', e);
			return false;
		}
	}

	// Fallback to browser Notification API (web)
	if (hasBrowserNotifications()) {
		try {
			console.log('[Notifications] Using browser Notification API');
			console.log('[Notifications] Current permission:', Notification.permission);
			const result = await Notification.requestPermission();
			console.log('[Notifications] Permission result:', result);
			notificationState.permissionStatus = result as NotificationState['permissionStatus'];
			return result === 'granted';
		} catch (e) {
			console.error('[Notifications] Browser API error:', e);
			return false;
		}
	}

	console.log('[Notifications] No notification API available');
	return false;
}

/**
 * Show a local notification immediately
 *
 * @param title - Notification title
 * @param body - Notification body text
 * @param extra - Optional extra data
 * @returns Notification ID or null if failed
 */
export async function showNotification(
	title: string,
	body: string,
	extra?: Record<string, unknown>
): Promise<number | null> {
	// Request permissions if needed
	if (notificationState.permissionStatus !== 'granted') {
		const granted = await requestPermissions();
		if (!granted) return null;
	}

	const id = ++notificationState.lastNotificationId;

	// Try Capacitor LocalNotifications first (native)
	if (getCapabilities().notifications) {
		try {
			await LocalNotifications.schedule({
				notifications: [
					{
						id,
						title,
						body,
						extra
					}
				]
			});
			return id;
		} catch {
			return null;
		}
	}

	// Fallback to browser Notification API (web)
	if (hasBrowserNotifications() && notificationState.permissionStatus === 'granted') {
		try {
			const notification = new Notification(title, {
				body,
				icon: '/favicon.png',
				tag: `notification-${id}`,
				data: extra
			});

			// Notify listeners when notification is clicked
			notification.onclick = () => {
				notificationListeners.forEach((cb) =>
					cb({
						id,
						title,
						body,
						extra
					})
				);
				window.focus();
			};

			return id;
		} catch {
			return null;
		}
	}

	return null;
}

/**
 * Cancel a notification by ID
 */
export async function cancelNotification(id: number): Promise<void> {
	if (!getCapabilities().notifications) return;

	try {
		await LocalNotifications.cancel({ notifications: [{ id }] });
	} catch {
		// Ignore errors
	}
}

/**
 * Cancel all pending notifications
 */
export async function cancelAllNotifications(): Promise<void> {
	if (!getCapabilities().notifications) return;

	try {
		const pending = await LocalNotifications.getPending();
		if (pending.notifications.length > 0) {
			await LocalNotifications.cancel({ notifications: pending.notifications });
		}
	} catch {
		// Ignore errors
	}
}

/**
 * Subscribe to notification received events
 */
export function onNotificationReceived(
	callback: (notification: LocalNotification) => void
): () => void {
	notificationListeners.push(callback);
	return () => {
		const index = notificationListeners.indexOf(callback);
		if (index > -1) notificationListeners.splice(index, 1);
	};
}

// Getters

/**
 * Get notification state (reactive)
 */
export function getNotificationState(): NotificationState {
	return notificationState;
}

/**
 * Get notification permission status (reactive)
 */
export function getNotificationPermissionStatus(): NotificationState['permissionStatus'] {
	return notificationState.permissionStatus;
}

/**
 * Cleanup notifications module
 */
export async function stopNotifications(): Promise<void> {
	if (getCapabilities().notifications) {
		try {
			await LocalNotifications.removeAllListeners();
		} catch {
			// Ignore errors
		}
	}
	initialized = false;
	notificationListeners = [];
}
