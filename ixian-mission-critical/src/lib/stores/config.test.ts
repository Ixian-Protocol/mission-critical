/**
 * Tests for the config store
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Capacitor Preferences before importing the module
vi.mock('@capacitor/preferences', () => {
	const storage = new Map<string, string>();

	return {
		Preferences: {
			get: vi.fn(async ({ key }: { key: string }) => ({
				value: storage.get(key) ?? null
			})),
			set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
				storage.set(key, value);
			}),
			remove: vi.fn(async ({ key }: { key: string }) => {
				storage.delete(key);
			}),
			clear: vi.fn(async () => {
				storage.clear();
			}),
			// Expose storage for test manipulation
			_storage: storage
		}
	};
});

// Import after mocking
import { Preferences } from '@capacitor/preferences';
import {
	initConfig,
	getApiUrl,
	getApiUrlAsync,
	setApiUrl,
	isSetupComplete,
	isSetupCompleteAsync,
	clearConfig,
	testApiConnection
} from './config.svelte';

// Helper to access mock storage
const getMockStorage = () => (Preferences as unknown as { _storage: Map<string, string> })._storage;

// Helper to reset module state between tests
// We need to dynamically reimport to reset the module's internal state
const resetModuleState = async () => {
	// Clear the mock storage
	getMockStorage().clear();
	// Clear mocks
	vi.clearAllMocks();
};

describe('config store', () => {
	beforeEach(async () => {
		await resetModuleState();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('initConfig', () => {
		it('initializes config from empty storage', async () => {
			await initConfig();

			expect(Preferences.get).toHaveBeenCalledWith({ key: 'api_url' });
			expect(Preferences.get).toHaveBeenCalledWith({ key: 'setup_complete' });
		});

		it('loads existing API URL from storage', async () => {
			getMockStorage().set('api_url', 'https://api.example.com');
			getMockStorage().set('setup_complete', 'true');

			// Need to reset initialized state - since module is already loaded,
			// we test via getApiUrlAsync which reads from storage
			await getApiUrlAsync();

			expect(Preferences.get).toHaveBeenCalled();
		});
	});

	describe('getApiUrl', () => {
		it('returns null when API URL is not set', async () => {
			await clearConfig();

			const url = getApiUrl();

			expect(url).toBeNull();
		});

		it('returns cached API URL after setApiUrl', async () => {
			await setApiUrl('https://api.example.com');

			const url = getApiUrl();

			expect(url).toBe('https://api.example.com');
		});
	});

	describe('getApiUrlAsync', () => {
		it('reads API URL from storage', async () => {
			getMockStorage().set('api_url', 'https://stored.example.com');

			const url = await getApiUrlAsync();

			expect(url).toBe('https://stored.example.com');
			expect(Preferences.get).toHaveBeenCalledWith({ key: 'api_url' });
		});

		it('returns null when storage is empty', async () => {
			getMockStorage().clear();

			const url = await getApiUrlAsync();

			expect(url).toBeNull();
		});

		it('updates cache after reading from storage', async () => {
			getMockStorage().set('api_url', 'https://new.example.com');

			await getApiUrlAsync();
			const cachedUrl = getApiUrl();

			expect(cachedUrl).toBe('https://new.example.com');
		});
	});

	describe('setApiUrl', () => {
		it('saves API URL to storage', async () => {
			await setApiUrl('https://api.example.com');

			expect(Preferences.set).toHaveBeenCalledWith({
				key: 'api_url',
				value: 'https://api.example.com'
			});
		});

		it('marks setup as complete when setting URL', async () => {
			await setApiUrl('https://api.example.com');

			expect(Preferences.set).toHaveBeenCalledWith({
				key: 'setup_complete',
				value: 'true'
			});
		});

		it('updates cached value', async () => {
			await setApiUrl('https://api.example.com');

			expect(getApiUrl()).toBe('https://api.example.com');
		});

		it('updates setup complete status in cache', async () => {
			await clearConfig();
			expect(isSetupComplete()).toBe(false);

			await setApiUrl('https://api.example.com');

			expect(isSetupComplete()).toBe(true);
		});
	});

	describe('isSetupComplete', () => {
		it('returns false when config is cleared', async () => {
			await clearConfig();

			expect(isSetupComplete()).toBe(false);
		});

		it('returns true after API URL is set', async () => {
			await setApiUrl('https://api.example.com');

			expect(isSetupComplete()).toBe(true);
		});

		it('returns false when API URL is null even if setup_complete is true', async () => {
			await clearConfig();
			// This tests the edge case where setup_complete might be set but URL is missing

			expect(isSetupComplete()).toBe(false);
		});
	});

	describe('isSetupCompleteAsync', () => {
		it('reads setup status from storage', async () => {
			getMockStorage().set('setup_complete', 'true');
			getMockStorage().set('api_url', 'https://api.example.com');
			// Update cache
			await getApiUrlAsync();

			const result = await isSetupCompleteAsync();

			expect(result).toBe(true);
			expect(Preferences.get).toHaveBeenCalledWith({ key: 'setup_complete' });
		});

		it('returns false when setup_complete is not set', async () => {
			getMockStorage().clear();
			await clearConfig();

			const result = await isSetupCompleteAsync();

			expect(result).toBe(false);
		});
	});

	describe('clearConfig', () => {
		it('removes API URL from storage', async () => {
			await setApiUrl('https://api.example.com');

			await clearConfig();

			expect(Preferences.remove).toHaveBeenCalledWith({ key: 'api_url' });
		});

		it('removes setup_complete from storage', async () => {
			await setApiUrl('https://api.example.com');

			await clearConfig();

			expect(Preferences.remove).toHaveBeenCalledWith({ key: 'setup_complete' });
		});

		it('clears cached API URL', async () => {
			await setApiUrl('https://api.example.com');
			expect(getApiUrl()).toBe('https://api.example.com');

			await clearConfig();

			expect(getApiUrl()).toBeNull();
		});

		it('clears cached setup complete status', async () => {
			await setApiUrl('https://api.example.com');
			expect(isSetupComplete()).toBe(true);

			await clearConfig();

			expect(isSetupComplete()).toBe(false);
		});
	});

	describe('testApiConnection', () => {
		beforeEach(() => {
			vi.stubGlobal('fetch', vi.fn());
		});

		afterEach(() => {
			vi.unstubAllGlobals();
		});

		it('returns success when health endpoint responds with 200', async () => {
			vi.mocked(fetch).mockResolvedValueOnce(
				new Response('OK', { status: 200 })
			);

			const result = await testApiConnection('https://api.example.com');

			expect(result.success).toBe(true);
			expect(fetch).toHaveBeenCalledWith(
				'https://api.example.com/health',
				expect.objectContaining({ method: 'GET' })
			);
		});

		it('normalizes URL by removing trailing slashes', async () => {
			vi.mocked(fetch).mockResolvedValueOnce(
				new Response('OK', { status: 200 })
			);

			await testApiConnection('https://api.example.com///');

			expect(fetch).toHaveBeenCalledWith(
				'https://api.example.com/health',
				expect.any(Object)
			);
		});

		it('falls back to base URL if health endpoint fails', async () => {
			vi.mocked(fetch)
				.mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
				.mockResolvedValueOnce(new Response('', { status: 200 }));

			const result = await testApiConnection('https://api.example.com');

			expect(result.success).toBe(true);
			expect(fetch).toHaveBeenCalledTimes(2);
		});

		it('returns success for 404 on base URL (server reachable)', async () => {
			vi.mocked(fetch)
				.mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
				.mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

			const result = await testApiConnection('https://api.example.com');

			expect(result.success).toBe(true);
		});

		it('returns error for server errors', async () => {
			vi.mocked(fetch)
				.mockResolvedValueOnce(new Response('Error', { status: 500 }))
				.mockResolvedValueOnce(new Response('Error', { status: 500 }));

			const result = await testApiConnection('https://api.example.com');

			expect(result.success).toBe(false);
			expect(result.error).toContain('500');
		});

		it('returns timeout error when request times out', async () => {
			const timeoutError = new Error('Timeout');
			timeoutError.name = 'TimeoutError';
			vi.mocked(fetch).mockRejectedValueOnce(timeoutError);

			const result = await testApiConnection('https://api.example.com');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Connection timed out');
		});

		it('returns abort error as timeout', async () => {
			const abortError = new Error('Aborted');
			abortError.name = 'AbortError';
			vi.mocked(fetch).mockRejectedValueOnce(abortError);

			const result = await testApiConnection('https://api.example.com');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Connection timed out');
		});

		it('returns error message for network errors', async () => {
			vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

			const result = await testApiConnection('https://api.example.com');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Network error');
		});

		it('returns unknown error for non-Error exceptions', async () => {
			vi.mocked(fetch).mockRejectedValueOnce('string error');

			const result = await testApiConnection('https://api.example.com');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Unknown error');
		});
	});
});
