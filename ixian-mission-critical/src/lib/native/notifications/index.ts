/**
 * Notifications module exports
 */

export type { LocalNotification, NotificationState } from './types';

export {
	initNotifications,
	stopNotifications,
	checkPermissions,
	requestPermissions,
	showNotification,
	cancelNotification,
	cancelAllNotifications,
	onNotificationReceived,
	getNotificationState,
	getNotificationPermissionStatus
} from './notifications.svelte';
