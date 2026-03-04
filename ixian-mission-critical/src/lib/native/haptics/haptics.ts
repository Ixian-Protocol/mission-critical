/**
 * Haptic feedback utilities
 *
 * Simple wrapper around @capacitor/haptics with graceful fallbacks.
 * All functions silently fail on unsupported platforms.
 */

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { getCapabilities } from '../platform.svelte';

/**
 * Trigger light impact feedback
 * Good for UI interactions like button taps
 */
export async function impactLight(): Promise<void> {
	if (!getCapabilities().haptics) return;
	try {
		await Haptics.impact({ style: ImpactStyle.Light });
	} catch {
		// Silently fail - haptics are non-critical
	}
}

/**
 * Trigger medium impact feedback
 * Good for confirming actions
 */
export async function impactMedium(): Promise<void> {
	if (!getCapabilities().haptics) return;
	try {
		await Haptics.impact({ style: ImpactStyle.Medium });
	} catch {
		// Silently fail
	}
}

/**
 * Trigger heavy impact feedback
 * Good for significant events
 */
export async function impactHeavy(): Promise<void> {
	if (!getCapabilities().haptics) return;
	try {
		await Haptics.impact({ style: ImpactStyle.Heavy });
	} catch {
		// Silently fail
	}
}

/**
 * Trigger success notification feedback
 */
export async function notificationSuccess(): Promise<void> {
	if (!getCapabilities().haptics) return;
	try {
		await Haptics.notification({ type: NotificationType.Success });
	} catch {
		// Silently fail
	}
}

/**
 * Trigger warning notification feedback
 */
export async function notificationWarning(): Promise<void> {
	if (!getCapabilities().haptics) return;
	try {
		await Haptics.notification({ type: NotificationType.Warning });
	} catch {
		// Silently fail
	}
}

/**
 * Trigger error notification feedback
 */
export async function notificationError(): Promise<void> {
	if (!getCapabilities().haptics) return;
	try {
		await Haptics.notification({ type: NotificationType.Error });
	} catch {
		// Silently fail
	}
}

/**
 * Trigger selection changed feedback
 * Good for picker/selection changes
 */
export async function selectionChanged(): Promise<void> {
	if (!getCapabilities().haptics) return;
	try {
		await Haptics.selectionChanged();
	} catch {
		// Silently fail
	}
}

/**
 * Custom vibration with duration
 */
export async function vibrate(duration: number = 300): Promise<void> {
	if (!getCapabilities().haptics) return;
	try {
		await Haptics.vibrate({ duration });
	} catch {
		// Silently fail
	}
}
