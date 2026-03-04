/**
 * Tests for configuration validation schemas
 */

import { describe, it, expect } from 'vitest';
import { apiUrlSchema, setupFormSchema } from './config';

describe('apiUrlSchema', () => {
	describe('valid URLs', () => {
		it('accepts a valid HTTPS URL', () => {
			const result = apiUrlSchema.safeParse('https://api.example.com');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe('https://api.example.com');
			}
		});

		it('accepts a valid HTTP URL', () => {
			const result = apiUrlSchema.safeParse('http://localhost:3000');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe('http://localhost:3000');
			}
		});

		it('accepts URL with path segments', () => {
			const result = apiUrlSchema.safeParse('https://api.example.com/v1/api');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe('https://api.example.com/v1/api');
			}
		});

		it('removes trailing slashes from URL', () => {
			const result = apiUrlSchema.safeParse('https://api.example.com/');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe('https://api.example.com');
			}
		});

		it('removes multiple trailing slashes from URL', () => {
			const result = apiUrlSchema.safeParse('https://api.example.com///');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe('https://api.example.com');
			}
		});

		it('accepts URL with port number', () => {
			const result = apiUrlSchema.safeParse('https://api.example.com:8443');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe('https://api.example.com:8443');
			}
		});
	});

	describe('empty string (offline mode)', () => {
		it('accepts empty string for offline mode', () => {
			const result = apiUrlSchema.safeParse('');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe('');
			}
		});

		it('trims whitespace to empty string', () => {
			const result = apiUrlSchema.safeParse('   ');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe('');
			}
		});
	});

	describe('invalid URLs', () => {
		it('rejects non-URL string', () => {
			const result = apiUrlSchema.safeParse('not-a-url');

			expect(result.success).toBe(false);
		});

		it('rejects URL without protocol', () => {
			const result = apiUrlSchema.safeParse('api.example.com');

			expect(result.success).toBe(false);
		});

		it('rejects FTP URLs', () => {
			const result = apiUrlSchema.safeParse('ftp://files.example.com');

			expect(result.success).toBe(false);
		});

		it('rejects file protocol URLs', () => {
			const result = apiUrlSchema.safeParse('file:///path/to/file');

			expect(result.success).toBe(false);
		});

		it('rejects non-string values', () => {
			const result = apiUrlSchema.safeParse(12345);

			expect(result.success).toBe(false);
		});

		it('rejects null', () => {
			const result = apiUrlSchema.safeParse(null);

			expect(result.success).toBe(false);
		});

		it('rejects undefined', () => {
			const result = apiUrlSchema.safeParse(undefined);

			expect(result.success).toBe(false);
		});
	});
});

describe('setupFormSchema', () => {
	describe('valid form data', () => {
		it('accepts valid form data with HTTPS URL', () => {
			const result = setupFormSchema.safeParse({
				apiUrl: 'https://api.example.com'
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.apiUrl).toBe('https://api.example.com');
			}
		});

		it('accepts valid form data with HTTP URL', () => {
			const result = setupFormSchema.safeParse({
				apiUrl: 'http://localhost:3000'
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.apiUrl).toBe('http://localhost:3000');
			}
		});

		it('transforms URL by removing trailing slash', () => {
			const result = setupFormSchema.safeParse({
				apiUrl: 'https://api.example.com/'
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.apiUrl).toBe('https://api.example.com');
			}
		});
	});

	describe('offline mode (empty apiUrl)', () => {
		it('accepts missing apiUrl field (defaults to empty string)', () => {
			const result = setupFormSchema.safeParse({});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.apiUrl).toBe('');
			}
		});

		it('accepts empty apiUrl for offline mode', () => {
			const result = setupFormSchema.safeParse({
				apiUrl: ''
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.apiUrl).toBe('');
			}
		});
	});

	describe('invalid form data', () => {
		it('rejects invalid apiUrl', () => {
			const result = setupFormSchema.safeParse({
				apiUrl: 'not-a-url'
			});

			expect(result.success).toBe(false);
		});

		it('rejects non-HTTP/HTTPS URLs', () => {
			const result = setupFormSchema.safeParse({
				apiUrl: 'ftp://files.example.com'
			});

			expect(result.success).toBe(false);
		});
	});
});
