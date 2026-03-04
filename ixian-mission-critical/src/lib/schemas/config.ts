/**
 * Configuration validation schemas
 */

import { z } from 'zod';

/**
 * API URL validation schema
 * Optional - empty string or valid HTTP/HTTPS URL
 * When empty, the app runs in offline-only mode (no sync)
 */
export const apiUrlSchema = z
	.string()
	.transform((val) => val.trim())
	.pipe(
		z.union([
			z.literal(''),
			z
				.string()
				.url('Must be a valid URL')
				.refine(
					(url) => url.startsWith('http://') || url.startsWith('https://'),
					'URL must start with http:// or https://'
				)
				.transform((url) => url.replace(/\/+$/, ''))
		])
	);

/**
 * ntfy URL validation schema
 * Optional - empty string or valid HTTP/HTTPS URL
 */
export const ntfyUrlSchema = z
	.string()
	.transform((val) => val.trim())
	.pipe(
		z.union([
			z.literal(''),
			z
				.string()
				.url('Must be a valid URL')
				.refine(
					(url) => url.startsWith('http://') || url.startsWith('https://'),
					'URL must start with http:// or https://'
				)
				.transform((url) => url.replace(/\/+$/, ''))
		])
	);

/**
 * Setup form schema
 * Both server URL and ntfy URL are optional:
 * - No server URL = offline-only mode (no sync)
 * - No ntfy URL = no push notifications
 */
export const setupFormSchema = z
	.object({
		apiUrl: apiUrlSchema.default(''),
		enableNotifications: z.boolean().default(false),
		ntfyUrl: ntfyUrlSchema.default('')
	})
	.refine(
		(data) => {
			// If notifications enabled, ntfy URL is required
			if (data.enableNotifications && !data.ntfyUrl) {
				return false;
			}
			return true;
		},
		{
			message: 'ntfy Server URL is required when notifications are enabled',
			path: ['ntfyUrl']
		}
	);

export type SetupFormData = z.infer<typeof setupFormSchema>;
