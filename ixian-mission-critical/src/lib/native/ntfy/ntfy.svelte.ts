/**
 * ntfy subscription client with Svelte 5 runes
 *
 * Uses Server-Sent Events (SSE) for real-time notifications.
 * Automatically reconnects with exponential backoff.
 */

import type { NtfyMessage, NtfyState } from './types';
import { getNtfyUrl, getNtfyTopic, isNotificationsEnabled } from '$lib/stores/config.svelte';
import { showNotification, requestPermissions } from '../notifications';
import { notificationWarning } from '../haptics';
import { getIsOnline, onOnline } from '$lib/api/offline/connectivity.svelte';

// Reactive state
let ntfyState = $state<NtfyState>({
	status: 'disconnected',
	lastConnected: null,
	lastError: null,
	reconnectAttempts: 0
});

// Internal state
let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;
let messageListeners: Array<(message: NtfyMessage) => void> = [];
let cleanupOnOnline: (() => void) | null = null;

// Reconnect settings
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 60000; // 1 minute

/**
 * Initialize ntfy subscription
 * Call after config is loaded and notifications are enabled
 */
export async function initNtfy(): Promise<void> {
	if (initialized || typeof window === 'undefined') return;

	const ntfyUrl = getNtfyUrl();
	const enabled = isNotificationsEnabled();

	// Don't initialize if ntfy is not configured or disabled
	if (!ntfyUrl || !enabled) {
		return;
	}

	initialized = true;

	// Request notification permissions if not granted
	await requestPermissions();

	// Subscribe to the topic
	await subscribe();

	// Setup reconnect on network recovery
	cleanupOnOnline = onOnline(() => {
		if (ntfyState.status === 'disconnected' || ntfyState.status === 'error') {
			subscribe();
		}
	});
}

/**
 * Subscribe to ntfy topic using SSE
 */
async function subscribe(): Promise<void> {
	const ntfyUrl = getNtfyUrl();
	const topic = getNtfyTopic();

	if (!ntfyUrl) return;

	// Close existing connection
	if (eventSource) {
		eventSource.close();
		eventSource = null;
	}

	ntfyState.status = 'connecting';
	ntfyState.lastError = null;

	try {
		// Use SSE endpoint
		const url = `${ntfyUrl}/${topic}/sse`;
		eventSource = new EventSource(url);

		eventSource.onopen = () => {
			ntfyState.status = 'connected';
			ntfyState.lastConnected = Date.now();
			ntfyState.reconnectAttempts = 0;
		};

		eventSource.onmessage = (event) => {
			try {
				const message = JSON.parse(event.data) as NtfyMessage;
				handleMessage(message);
			} catch (error) {
				console.error('Failed to parse ntfy message:', error);
			}
		};

		eventSource.onerror = () => {
			ntfyState.status = 'error';
			eventSource?.close();
			eventSource = null;
			scheduleReconnect();
		};
	} catch (error) {
		ntfyState.status = 'error';
		ntfyState.lastError = error instanceof Error ? error.message : 'Unknown error';
		scheduleReconnect();
	}
}

/**
 * Handle incoming ntfy message
 */
async function handleMessage(message: NtfyMessage): Promise<void> {
	// Skip non-message events
	if (message.event !== 'message') return;

	// Trigger haptic feedback for task reminder
	await notificationWarning();

	// Show local notification
	showNotification(message.title || 'Task Reminder', message.message || '', {
		ntfyMessageId: message.id,
		topic: message.topic,
		priority: message.priority,
		click: message.click
	});

	// Notify listeners
	messageListeners.forEach((cb) => cb(message));
}

/**
 * Schedule reconnection with exponential backoff
 */
function scheduleReconnect(): void {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
	}

	if (ntfyState.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
		ntfyState.lastError = 'Max reconnection attempts reached';
		return;
	}

	// Don't reconnect if offline
	if (!getIsOnline()) {
		return;
	}

	const delay = Math.min(
		BASE_RECONNECT_DELAY * Math.pow(2, ntfyState.reconnectAttempts),
		MAX_RECONNECT_DELAY
	);

	ntfyState.reconnectAttempts++;

	reconnectTimer = setTimeout(() => {
		subscribe();
	}, delay);
}

/**
 * Manually reconnect to ntfy
 */
export async function reconnect(): Promise<void> {
	ntfyState.reconnectAttempts = 0;
	await subscribe();
}

/**
 * Subscribe to ntfy message events
 */
export function onNtfyMessage(callback: (message: NtfyMessage) => void): () => void {
	messageListeners.push(callback);
	return () => {
		const index = messageListeners.indexOf(callback);
		if (index > -1) messageListeners.splice(index, 1);
	};
}

/**
 * Get ntfy state (reactive)
 */
export function getNtfyState(): NtfyState {
	return ntfyState;
}

/**
 * Check if ntfy is connected
 */
export function isNtfyConnected(): boolean {
	return ntfyState.status === 'connected';
}

/**
 * Stop ntfy subscription
 */
export function stopNtfy(): void {
	if (eventSource) {
		eventSource.close();
		eventSource = null;
	}

	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}

	if (cleanupOnOnline) {
		cleanupOnOnline();
		cleanupOnOnline = null;
	}

	ntfyState = {
		status: 'disconnected',
		lastConnected: null,
		lastError: null,
		reconnectAttempts: 0
	};

	messageListeners = [];
	initialized = false;
}
