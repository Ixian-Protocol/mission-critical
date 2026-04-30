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
const NOTIFICATIONS_ENABLED_KEY = 'notifications_enabled';

// Fixed ntfy topic name (single-user app)
export const NTFY_TOPIC = 'ixian-mission-critical';

// In-memory cache for synchronous access
let cachedApiUrl: string | null = null;
let cachedSetupComplete: boolean = false;
let cachedNtfyUrl: string | null = null;
let cachedNotificationsEnabled: boolean = false;
let initialized = false;

/**
 * Initialize the config store - must be called before accessing config
 * Loads values from Capacitor Preferences into memory cache
 */
export async function initConfig(): Promise<void> {
	if (initialized) return;

	try {
		const [apiUrlResult, setupCompleteResult, ntfyUrlResult, notificationsEnabledResult] =
			await Promise.all([
				Preferences.get({ key: API_URL_KEY }),
				Preferences.get({ key: SETUP_COMPLETE_KEY }),
				Preferences.get({ key: NTFY_URL_KEY }),
				Preferences.get({ key: NOTIFICATIONS_ENABLED_KEY })
			]);

		cachedApiUrl = apiUrlResult.value;
		cachedSetupComplete = setupCompleteResult.value === 'true';
		cachedNtfyUrl = ntfyUrlResult.value;
		cachedNotificationsEnabled = notificationsEnabledResult.value === 'true';
		initialized = true;
	} catch (error) {
		console.error('Failed to initialize config from Preferences:', error);
		// Fall back to localStorage for web
		if (typeof localStorage !== 'undefined') {
			cachedApiUrl = localStorage.getItem(API_URL_KEY);
			cachedSetupComplete = localStorage.getItem(SETUP_COMPLETE_KEY) === 'true';
			cachedNtfyUrl = localStorage.getItem(NTFY_URL_KEY);
			cachedNotificationsEnabled = localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === 'true';
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
		cachedApiUrl = result.value;
		return cachedApiUrl;
	} catch {
		return cachedApiUrl;
	}
}

/**
 * Set the API URL
 * Pass empty string for offline-only mode (no sync)
 */
export async function setApiUrl(url: string): Promise<void> {
	try {
		if (url) {
			await Preferences.set({ key: API_URL_KEY, value: url });
			cachedApiUrl = url;
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
			if (url) {
				localStorage.setItem(API_URL_KEY, url);
				cachedApiUrl = url;
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
			Preferences.remove({ key: NOTIFICATIONS_ENABLED_KEY })
		]);
	} catch (error) {
		console.error('Failed to clear config from Preferences:', error);
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(API_URL_KEY);
			localStorage.removeItem(SETUP_COMPLETE_KEY);
			localStorage.removeItem(NTFY_URL_KEY);
			localStorage.removeItem(NOTIFICATIONS_ENABLED_KEY);
		}
	}

	cachedApiUrl = null;
	cachedSetupComplete = false;
	cachedNtfyUrl = null;
	cachedNotificationsEnabled = false;
}

function isLikelyApiV1Base(normalizedUrl: string): boolean {
	return /\/api\/v1$/i.test(normalizedUrl);
}

/**
 * Test connection to the configured API base URL using GET {base}/health (root `/health`
 * when base is the origin only, or `/api/v1/health` when base ends with `/api/v1`).
 */
export async function testApiConnection(
	url: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// Normalize URL (remove trailing slash)
		const normalizedUrl = url.replace(/\/+$/, '');

		// Probe GET {base}/health: matches GET /health at origin or GET /api/v1/health when base ends with /api/v1
		const response = await fetch(`${normalizedUrl}/health`, {
			method: 'GET',
			signal: AbortSignal.timeout(5000) // 5 second timeout
		});

		if (response.ok) {
			return { success: true };
		}

		if (isLikelyApiV1Base(normalizedUrl)) {
			return {
				success: false,
				error: `Health check failed (${response.status}). Verify the API base URL and that the backend is running`
			};
		}

		// Legacy: hostname-only URLs may omit /api/v1; try reachability via HEAD base when root /health misses
		const baseResponse = await fetch(normalizedUrl, {
			method: 'HEAD',
			signal: AbortSignal.timeout(5000)
		});

		if (baseResponse.ok || baseResponse.status === 404) {
			return { success: true };
		}

		return { success: false, error: `Server returned status ${baseResponse.status}` };
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
 * Get the ntfy topic name (fixed for this app)
 */
export function getNtfyTopic(): string {
	return NTFY_TOPIC;
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
		const testResponse = await fetch(`${normalizedUrl}/${NTFY_TOPIC}/json?poll=1`, {
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
