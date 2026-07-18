/**
 * App configuration store using Capacitor Preferences
 *
 * Uses native storage (UserDefaults on iOS, SharedPreferences on Android)
 * which is more reliable than localStorage - won't be cleared by the OS.
 * Falls back to localStorage on web.
 */

import { Preferences } from '@capacitor/preferences';

// Storage keys
const API_URL_KEY = 'api_url';
const SETUP_COMPLETE_KEY = 'setup_complete';
const NTFY_URL_KEY = 'ntfy_url';
const NTFY_TOPIC_KEY = 'ntfy_topic';
const NOTIFICATIONS_ENABLED_KEY = 'notifications_enabled';

// In-memory cache for synchronous access (reactive — UI updates after initConfig / setApiUrl)
let cachedApiUrl = $state<string | null>(null);
let cachedSetupComplete = $state(false);
let cachedNtfyUrl = $state<string | null>(null);
let cachedNtfyTopic = $state<string | null>(null);
let cachedNotificationsEnabled = $state(false);
let initialized = false;

/**
 * Generate a random ntfy topic (not a well-known public name).
 */
export function generateNtfyTopic(): string {
	const bytes = new Uint8Array(12);
	crypto.getRandomValues(bytes);
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
	return `mc-${hex}`;
}

const API_V1_SUFFIX = '/api/v1';
const API_V1_BASE_PATTERN = /\/api\/v1$/i;

/**
 * Initialize the config store - must be called before accessing config
 * Loads values from Capacitor Preferences into memory cache
 */
export async function initConfig(): Promise<void> {
	if (initialized) return;

	try {
		const [
			apiUrlResult,
			setupCompleteResult,
			ntfyUrlResult,
			ntfyTopicResult,
			notificationsEnabledResult
		] = await Promise.all([
			Preferences.get({ key: API_URL_KEY }),
			Preferences.get({ key: SETUP_COMPLETE_KEY }),
			Preferences.get({ key: NTFY_URL_KEY }),
			Preferences.get({ key: NTFY_TOPIC_KEY }),
			Preferences.get({ key: NOTIFICATIONS_ENABLED_KEY })
		]);

		cachedApiUrl = normalizeApiUrl(apiUrlResult.value);
		cachedSetupComplete = setupCompleteResult.value === 'true';
		cachedNtfyUrl = ntfyUrlResult.value;
		cachedNtfyTopic = ntfyTopicResult.value;
		cachedNotificationsEnabled = notificationsEnabledResult.value === 'true';

		// Web: URL may only exist in localStorage (e.g. Preferences empty on first load)
		if (typeof localStorage !== 'undefined') {
			if (!cachedApiUrl) {
				cachedApiUrl = normalizeApiUrl(localStorage.getItem(API_URL_KEY));
			}
			if (!cachedSetupComplete && localStorage.getItem(SETUP_COMPLETE_KEY) === 'true') {
				cachedSetupComplete = true;
			}
			if (!cachedNtfyUrl && localStorage.getItem(NTFY_URL_KEY)) {
				cachedNtfyUrl = localStorage.getItem(NTFY_URL_KEY);
			}
			if (!cachedNtfyTopic && localStorage.getItem(NTFY_TOPIC_KEY)) {
				cachedNtfyTopic = localStorage.getItem(NTFY_TOPIC_KEY);
			}
			if (!cachedNotificationsEnabled && localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === 'true') {
				cachedNotificationsEnabled = true;
			}
		}

		if (!cachedNtfyTopic) {
			await ensureNtfyTopic();
		}

		initialized = true;
	} catch (error) {
		console.error('Failed to initialize config from Preferences:', error);
		// Fall back to localStorage for web
		if (typeof localStorage !== 'undefined') {
			cachedApiUrl = normalizeApiUrl(localStorage.getItem(API_URL_KEY));
			cachedSetupComplete = localStorage.getItem(SETUP_COMPLETE_KEY) === 'true';
			cachedNtfyUrl = localStorage.getItem(NTFY_URL_KEY);
			cachedNtfyTopic = localStorage.getItem(NTFY_TOPIC_KEY);
			cachedNotificationsEnabled = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === 'true';
		}
		if (!cachedNtfyTopic) {
			cachedNtfyTopic = generateNtfyTopic();
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(NTFY_TOPIC_KEY, cachedNtfyTopic);
			}
		}
		initialized = true;
	}
}

/**
 * Get the configured API URL
 * Returns null if not configured
 */
export function getApiUrl(): string | null {
	return cachedApiUrl;
}

/**
 * Get the configured API URL asynchronously (reads from storage)
 */
export async function getApiUrlAsync(): Promise<string | null> {
	try {
		const result = await Preferences.get({ key: API_URL_KEY });
		cachedApiUrl = normalizeApiUrl(result.value);
		if (!cachedApiUrl && typeof localStorage !== 'undefined') {
			cachedApiUrl = normalizeApiUrl(localStorage.getItem(API_URL_KEY));
		}
		return cachedApiUrl;
	} catch {
		return cachedApiUrl;
	}
}

/**
 * Normalize a user-provided backend URL into the API v1 base URL used by sync calls.
 *
 * Accepts either the backend origin (`http://host:8000`) or an explicit v1 base
 * (`http://host:8000/api/v1`) so setup health checks and real API calls agree.
 */
export function normalizeApiUrl(url: string | null | undefined): string | null {
	const normalizedUrl = url?.trim().replace(/\/+$/, '');
	if (!normalizedUrl) return null;
	if (isLikelyApiV1Base(normalizedUrl)) return normalizedUrl;
	return `${normalizedUrl}${API_V1_SUFFIX}`;
}

/**
 * Set the API URL
 * Pass empty string for offline-only mode (no sync)
 */
export async function setApiUrl(url: string): Promise<void> {
	const normalizedUrl = normalizeApiUrl(url);
	try {
		if (normalizedUrl) {
			await Preferences.set({ key: API_URL_KEY, value: normalizedUrl });
			cachedApiUrl = normalizedUrl;
		} else {
			// Empty URL = offline mode, remove the key
			await Preferences.remove({ key: API_URL_KEY });
			cachedApiUrl = null;
		}

		// Mark setup as complete regardless of URL
		await Preferences.set({ key: SETUP_COMPLETE_KEY, value: 'true' });
		cachedSetupComplete = true;
	} catch (error) {
		console.error('Failed to save API URL to Preferences:', error);
		// Fall back to localStorage for web
		if (typeof localStorage !== 'undefined') {
			if (normalizedUrl) {
				localStorage.setItem(API_URL_KEY, normalizedUrl);
				cachedApiUrl = normalizedUrl;
			} else {
				localStorage.removeItem(API_URL_KEY);
				cachedApiUrl = null;
			}
			localStorage.setItem(SETUP_COMPLETE_KEY, 'true');
			cachedSetupComplete = true;
		} else {
			throw error;
		}
	}
}

/**
 * Check if initial setup is complete
 * Uses cached value for synchronous access
 * Note: API URL is optional (offline mode if not set)
 */
export function isSetupComplete(): boolean {
	return cachedSetupComplete;
}

/**
 * Check if sync is enabled (API URL is configured)
 */
export function isSyncEnabled(): boolean {
	return cachedApiUrl !== null && cachedApiUrl !== '';
}

/**
 * Check if initial setup is complete asynchronously (reads from storage)
 */
export async function isSetupCompleteAsync(): Promise<boolean> {
	try {
		const result = await Preferences.get({ key: SETUP_COMPLETE_KEY });
		cachedSetupComplete = result.value === 'true';
		return cachedSetupComplete;
	} catch {
		return cachedSetupComplete;
	}
}

/**
 * Clear all configuration (for logout/reset)
 */
export async function clearConfig(): Promise<void> {
	try {
		await Promise.all([
			Preferences.remove({ key: API_URL_KEY }),
			Preferences.remove({ key: SETUP_COMPLETE_KEY }),
			Preferences.remove({ key: NTFY_URL_KEY }),
			Preferences.remove({ key: NTFY_TOPIC_KEY }),
			Preferences.remove({ key: NOTIFICATIONS_ENABLED_KEY })
		]);
	} catch (error) {
		console.error('Failed to clear config from Preferences:', error);
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(API_URL_KEY);
			localStorage.removeItem(SETUP_COMPLETE_KEY);
			localStorage.removeItem(NTFY_URL_KEY);
			localStorage.removeItem(NTFY_TOPIC_KEY);
			localStorage.removeItem(NOTIFICATIONS_ENABLED_KEY);
		}
	}

	cachedApiUrl = null;
	cachedSetupComplete = false;
	cachedNtfyUrl = null;
	cachedNtfyTopic = null;
	cachedNotificationsEnabled = false;
}

function isLikelyApiV1Base(normalizedUrl: string): boolean {
	return API_V1_BASE_PATTERN.test(normalizedUrl);
}

/**
 * Test connection to the configured API base URL using GET {base}/health.
 * User-entered origins are normalized to `/api/v1` before probing.
 */
export async function testApiConnection(
	url: string
): Promise<{ success: boolean; error?: string }> {
	try {
		const normalizedUrl = normalizeApiUrl(url);

		if (!normalizedUrl) {
			return { success: false, error: 'API URL is required' };
		}

		const response = await fetch(`${normalizedUrl}/health`, {
			method: 'GET',
			signal: AbortSignal.timeout(5000) // 5 second timeout
		});

		if (response.ok) {
			return { success: true };
		}

		return {
			success: false,
			error: `Health check failed (${response.status}). Verify the API base URL and that the backend is running`
		};
	} catch (error) {
		if (error instanceof Error) {
			if (error.name === 'TimeoutError' || error.name === 'AbortError') {
				return { success: false, error: 'Connection timed out' };
			}
			return { success: false, error: error.message };
		}
		return { success: false, error: 'Unknown error' };
	}
}

// ============================================================================
// ntfy Configuration
// ============================================================================

/**
 * Get the configured ntfy URL
 * Returns null if not configured
 */
export function getNtfyUrl(): string | null {
	return cachedNtfyUrl;
}

/**
 * Get the ntfy topic name (random per install; must match backend NTFY_TOPIC)
 */
export function getNtfyTopic(): string {
	return cachedNtfyTopic ?? '';
}

/**
 * Ensure a topic exists and persist it. Returns the topic.
 */
export async function ensureNtfyTopic(): Promise<string> {
	if (cachedNtfyTopic) return cachedNtfyTopic;

	const topic = generateNtfyTopic();
	try {
		await Preferences.set({ key: NTFY_TOPIC_KEY, value: topic });
		cachedNtfyTopic = topic;
	} catch {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(NTFY_TOPIC_KEY, topic);
			cachedNtfyTopic = topic;
		} else {
			cachedNtfyTopic = topic;
		}
	}
	return topic;
}

/**
 * Check if notifications are enabled
 */
export function isNotificationsEnabled(): boolean {
	return cachedNotificationsEnabled;
}

/**
 * Set the ntfy URL
 */
export async function setNtfyUrl(url: string | null): Promise<void> {
	try {
		if (url) {
			await Preferences.set({ key: NTFY_URL_KEY, value: url });
		} else {
			await Preferences.remove({ key: NTFY_URL_KEY });
		}
		cachedNtfyUrl = url;
	} catch (error) {
		console.error('Failed to save ntfy URL to Preferences:', error);
		if (typeof localStorage !== 'undefined') {
			if (url) {
				localStorage.setItem(NTFY_URL_KEY, url);
			} else {
				localStorage.removeItem(NTFY_URL_KEY);
			}
			cachedNtfyUrl = url;
		} else {
			throw error;
		}
	}
}

/**
 * Set notifications enabled state
 */
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
	try {
		await Preferences.set({ key: NOTIFICATIONS_ENABLED_KEY, value: String(enabled) });
		cachedNotificationsEnabled = enabled;
	} catch (error) {
		console.error('Failed to save notifications enabled to Preferences:', error);
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(enabled));
			cachedNotificationsEnabled = enabled;
		} else {
			throw error;
		}
	}
}

/**
 * Save ntfy configuration
 * Convenience function to save both URL and enabled state
 */
export async function saveNtfyConfig(url: string | null, enabled: boolean): Promise<void> {
	await Promise.all([setNtfyUrl(url), setNotificationsEnabled(enabled)]);
}

/**
 * Clear ntfy configuration
 */
export async function clearNtfyConfig(): Promise<void> {
	await Promise.all([setNtfyUrl(null), setNotificationsEnabled(false)]);
}

/**
 * Test connection to the ntfy server
 * Returns true if the server is reachable
 */
export async function testNtfyConnection(
	url: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// Normalize URL (remove trailing slash)
		const normalizedUrl = url.replace(/\/+$/, '');

		// Try the ntfy v1 health endpoint first
		try {
			const healthResponse = await fetch(`${normalizedUrl}/v1/health`, {
				method: 'GET',
				signal: AbortSignal.timeout(5000)
			});

			if (healthResponse.ok) {
				return { success: true };
			}
		} catch {
			// Health endpoint failed, try topic endpoint
		}

		// Fallback: try to access a test topic (just check server responds)
		// ntfy returns 200 for GET on topic with no messages
		const topic = cachedNtfyTopic || (await ensureNtfyTopic());
		const testResponse = await fetch(`${normalizedUrl}/${topic}/json?poll=1`, {
			method: 'GET',
			headers: { Accept: 'application/json' },
			signal: AbortSignal.timeout(5000)
		});

		// 200 means topic accessible, 404 means server up but might need auth
		if (testResponse.ok || testResponse.status === 404) {
			return { success: true };
		}

		return { success: false, error: `Server returned status ${testResponse.status}` };
	} catch (error) {
		if (error instanceof Error) {
			if (error.name === 'TimeoutError' || error.name === 'AbortError') {
				return { success: false, error: 'Connection timed out' };
			}
			return { success: false, error: error.message };
		}
		return { success: false, error: 'Unknown error' };
	}
}
