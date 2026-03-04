/**
 * Shared types for native capabilities
 */

/**
 * Platform information
 */
export interface PlatformInfo {
	isNative: boolean;
	isWeb: boolean;
	isIOS: boolean;
	isAndroid: boolean;
	platform: 'ios' | 'android' | 'web';
}

/**
 * Available native capabilities
 */
export interface CapabilityAvailability {
	geolocation: boolean;
	notifications: boolean;
	haptics: boolean;
}
