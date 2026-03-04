/**
 * Notification types
 */

/**
 * Local notification configuration
 */
export interface LocalNotification {
	id: number;
	title: string;
	body: string;
	largeBody?: string;
	summaryText?: string;
	extra?: Record<string, unknown>;
}

/**
 * Notification state
 */
export interface NotificationState {
	permissionStatus: 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied' | 'unknown';
	lastNotificationId: number;
}
