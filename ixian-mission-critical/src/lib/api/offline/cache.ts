/**
 * Response caching for API requests
 *
 * Provides localStorage-based caching with TTL (time-to-live),
 * stale-while-revalidate support, and cache invalidation.
 */

import type { CacheEntry, CacheOptions } from '../types';

// Storage key prefix for cache entries
const CACHE_PREFIX = 'api_cache_';

// Default TTL: 5 minutes
const DEFAULT_TTL_MS = 5 * 60 * 1000;

// Maximum cache entries to prevent localStorage overflow
const MAX_CACHE_ENTRIES = 100;

/**
 * Generate a cache key from URL and optional custom key
 */
export function generateCacheKey(url: string, customKey?: string): string {
	if (customKey) {
		return `${CACHE_PREFIX}${customKey}`;
	}
	// Create a simple hash from the URL
	const hash = url
		.split('')
		.reduce((acc, char) => {
			return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
		}, 0)
		.toString(36);
	return `${CACHE_PREFIX}${hash}_${encodeURIComponent(url).slice(0, 50)}`;
}

/**
 * Get a cached response
 *
 * @param key - Cache key (usually the URL)
 * @param options - Cache options
 * @returns Cached data or null if not found/expired
 */
export function getFromCache<T>(key: string, options: CacheOptions = {}): CacheEntry<T> | null {
	if (typeof localStorage === 'undefined') return null;

	const cacheKey = generateCacheKey(key, options.key);

	try {
		const stored = localStorage.getItem(cacheKey);
		if (!stored) return null;

		const entry = JSON.parse(stored) as CacheEntry<T>;

		// Check if expired
		if (Date.now() > entry.expiresAt) {
			// If stale-while-revalidate is disabled, remove and return null
			if (options.staleWhileRevalidate === false) {
				localStorage.removeItem(cacheKey);
				return null;
			}
			// Otherwise, return stale data (caller should revalidate)
		}

		return entry;
	} catch (error) {
		console.error('Failed to read from cache:', error);
		return null;
	}
}

/**
 * Store a response in cache
 *
 * @param key - Cache key (usually the URL)
 * @param data - Data to cache
 * @param options - Cache options
 */
export function setInCache<T>(key: string, data: T, options: CacheOptions = {}): void {
	if (typeof localStorage === 'undefined') return;

	const cacheKey = generateCacheKey(key, options.key);
	const ttl = options.ttl ?? DEFAULT_TTL_MS;

	const entry: CacheEntry<T> = {
		data,
		cachedAt: Date.now(),
		expiresAt: Date.now() + ttl
	};

	try {
		// Enforce cache size limit
		enforceCacheLimit();

		localStorage.setItem(cacheKey, JSON.stringify(entry));
	} catch (error) {
		// localStorage might be full
		console.error('Failed to write to cache:', error);
		// Try to make room by clearing old entries
		clearExpiredCache();
		try {
			localStorage.setItem(cacheKey, JSON.stringify(entry));
		} catch {
			// Still failed, give up
			console.error('Cache is full, unable to store entry');
		}
	}
}

/**
 * Remove a specific entry from cache
 *
 * @param key - Cache key (usually the URL)
 * @param customKey - Optional custom key used when storing
 */
export function removeFromCache(key: string, customKey?: string): void {
	if (typeof localStorage === 'undefined') return;

	const cacheKey = generateCacheKey(key, customKey);
	localStorage.removeItem(cacheKey);
}

/**
 * Clear all cached responses
 */
export function clearCache(): void {
	if (typeof localStorage === 'undefined') return;

	const keysToRemove: string[] = [];

	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key?.startsWith(CACHE_PREFIX)) {
			keysToRemove.push(key);
		}
	}

	keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(): void {
	if (typeof localStorage === 'undefined') return;

	const now = Date.now();
	const keysToRemove: string[] = [];

	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key?.startsWith(CACHE_PREFIX)) {
			try {
				const stored = localStorage.getItem(key);
				if (stored) {
					const entry = JSON.parse(stored) as CacheEntry;
					if (now > entry.expiresAt) {
						keysToRemove.push(key);
					}
				}
			} catch {
				// Invalid entry, remove it
				keysToRemove.push(key);
			}
		}
	}

	keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Enforce maximum cache entries limit
 * Removes oldest entries when limit is exceeded
 */
function enforceCacheLimit(): void {
	if (typeof localStorage === 'undefined') return;

	const entries: Array<{ key: string; cachedAt: number }> = [];

	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key?.startsWith(CACHE_PREFIX)) {
			try {
				const stored = localStorage.getItem(key);
				if (stored) {
					const entry = JSON.parse(stored) as CacheEntry;
					entries.push({ key, cachedAt: entry.cachedAt });
				}
			} catch {
				// Invalid entry
			}
		}
	}

	// If over limit, remove oldest entries
	if (entries.length >= MAX_CACHE_ENTRIES) {
		// Sort by cachedAt (oldest first)
		entries.sort((a, b) => a.cachedAt - b.cachedAt);

		// Remove oldest 10% of entries
		const removeCount = Math.ceil(entries.length * 0.1);
		for (let i = 0; i < removeCount; i++) {
			localStorage.removeItem(entries[i].key);
		}
	}
}

/**
 * Invalidate cache entries matching a pattern
 * Useful for invalidating related cache entries after a mutation
 *
 * @param pattern - String or RegExp to match against cache keys
 *
 * @example
 * ```typescript
 * // After updating a user, invalidate all user-related cache
 * invalidateCacheByPattern('/api/users');
 *
 * // Or use a regex for more control
 * invalidateCacheByPattern(/\/api\/users\/\d+/);
 * ```
 */
export function invalidateCacheByPattern(pattern: string | RegExp): void {
	if (typeof localStorage === 'undefined') return;

	const keysToRemove: string[] = [];
	const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key?.startsWith(CACHE_PREFIX)) {
			// Extract the original URL part from the cache key
			const urlPart = key.slice(CACHE_PREFIX.length);
			if (regex.test(urlPart) || regex.test(decodeURIComponent(urlPart))) {
				keysToRemove.push(key);
			}
		}
	}

	keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * Check if a cache entry is stale (expired but still available)
 */
export function isCacheStale(key: string, customKey?: string): boolean {
	const entry = getFromCache(key, { key: customKey, staleWhileRevalidate: true });
	if (!entry) return true;
	return Date.now() > entry.expiresAt;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
	totalEntries: number;
	validEntries: number;
	expiredEntries: number;
	totalSizeBytes: number;
} {
	if (typeof localStorage === 'undefined') {
		return { totalEntries: 0, validEntries: 0, expiredEntries: 0, totalSizeBytes: 0 };
	}

	const now = Date.now();
	let totalEntries = 0;
	let validEntries = 0;
	let expiredEntries = 0;
	let totalSizeBytes = 0;

	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key?.startsWith(CACHE_PREFIX)) {
			totalEntries++;
			const stored = localStorage.getItem(key);
			if (stored) {
				totalSizeBytes += stored.length * 2; // UTF-16 encoding
				try {
					const entry = JSON.parse(stored) as CacheEntry;
					if (now > entry.expiresAt) {
						expiredEntries++;
					} else {
						validEntries++;
					}
				} catch {
					expiredEntries++;
				}
			}
		}
	}

	return { totalEntries, validEntries, expiredEntries, totalSizeBytes };
}

/**
 * Higher-order function to wrap an API call with caching
 *
 * @example
 * ```typescript
 * const getCachedUser = withCache(
 *   (id: string) => api.get(`/users/${id}`),
 *   (id: string) => `/users/${id}`,
 *   { ttl: 60000 }
 * );
 *
 * // First call fetches from API
 * const user1 = await getCachedUser('123');
 *
 * // Second call returns cached data
 * const user2 = await getCachedUser('123');
 * ```
 */
export function withCache<TArgs extends unknown[], TResult>(
	fn: (...args: TArgs) => Promise<TResult>,
	keyFn: (...args: TArgs) => string,
	options: CacheOptions = {}
): (...args: TArgs) => Promise<TResult> {
	return async (...args: TArgs): Promise<TResult> => {
		const key = keyFn(...args);
		const cacheOptions = { ...options, staleWhileRevalidate: options.staleWhileRevalidate ?? true };

		// Check cache first
		const cached = getFromCache<TResult>(key, cacheOptions);

		if (cached) {
			// If not stale, return cached data
			if (Date.now() <= cached.expiresAt) {
				return cached.data;
			}

			// If stale but staleWhileRevalidate is enabled
			if (cacheOptions.staleWhileRevalidate) {
				// Return stale data immediately, revalidate in background
				fn(...args)
					.then((freshData) => {
						setInCache(key, freshData, cacheOptions);
					})
					.catch((error) => {
						console.error('Background revalidation failed:', error);
					});

				return cached.data;
			}
		}

		// Fetch fresh data
		const data = await fn(...args);
		setInCache(key, data, cacheOptions);
		return data;
	};
}
