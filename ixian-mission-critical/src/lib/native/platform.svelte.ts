/**
 * Platform detection and native capability availability
 *
 * Provides reactive state for detecting runtime environment
 * and available native capabilities.
 */

import { Capacitor } from '@capacitor/core';
import type { PlatformInfo, CapabilityAvailability } from './types';

// Reactive state for platform info
let platformState = $state<PlatformInfo>({
	isNative: false,
	isWeb: true,
	isIOS: false,
	isAndroid: false,
	platform: 'web'
});

// Reactive state for capability availability
let capabilityState = $state<CapabilityAvailability>({
	geolocation: false,
	notifications: false,
	haptics: false
});

let initialized = false;

/**
 * Initialize platform detection
 * Call once at app startup
 */
export function initPlatformDetection(): void {
	if (initialized || typeof window === 'undefined') return;
	initialized = true;

	const platform = Capacitor.getPlatform();
	const isNative = Capacitor.isNativePlatform();

	platformState = {
		isNative,
		isWeb: !isNative,
		isIOS: platform === 'ios',
		isAndroid: platform === 'android',
		platform: platform as 'ios' | 'android' | 'web'
	};

	// Check plugin availability
	capabilityState = {
		geolocation: Capacitor.isPluginAvailable('BackgroundGeolocation'),
		notifications: Capacitor.isPluginAvailable('LocalNotifications'),
		haptics: Capacitor.isPluginAvailable('Haptics')
	};
}

/**
 * Get platform information (reactive)
 */
export function getPlatform(): PlatformInfo {
	return platformState;
}

/**
 * Get capability availability (reactive)
 */
export function getCapabilities(): CapabilityAvailability {
	return capabilityState;
}

/**
 * Check if running on native platform
 */
export function isNative(): boolean {
	return platformState.isNative;
}

/**
 * Check if running on iOS
 */
export function isIOS(): boolean {
	return platformState.isIOS;
}

/**
 * Check if running on Android
 */
export function isAndroid(): boolean {
	return platformState.isAndroid;
}

/**
 * Run code only on native platforms
 * Returns undefined on web
 */
export async function runOnNative<T>(fn: () => Promise<T>): Promise<T | undefined> {
	if (!platformState.isNative) return undefined;
	return fn();
}

/**
 * Run code only if a capability is available
 */
export async function runIfAvailable<T>(
	capability: keyof CapabilityAvailability,
	fn: () => Promise<T>
): Promise<T | undefined> {
	if (!capabilityState[capability]) return undefined;
	return fn();
}
