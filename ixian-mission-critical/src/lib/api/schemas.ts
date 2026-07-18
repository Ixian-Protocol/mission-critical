/**
 * Zod schemas for API response validation
 */

import { z } from 'zod';
import { ValidationError } from './errors';

/**
 * Validate data against a Zod schema
 * Throws ValidationError if validation fails
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
	const result = schema.safeParse(data);

	if (!result.success) {
		const errors = result.error.issues.map((issue) => ({
			path: issue.path.join('.'),
			message: issue.message
		}));
		throw new ValidationError(errors);
	}

	return result.data;
}

/**
 * Validate data against a Zod schema, returning null on failure instead of throwing
 */
export function validateSafe<T>(schema: z.ZodType<T>, data: unknown): T | null {
	const result = schema.safeParse(data);
	return result.success ? result.data : null;
}

export const dateStringSchema = z.iso.datetime();
export const uuidSchema = z.uuid();
export const emailSchema = z.email();
export const nonEmptyStringSchema = z.string().min(1);
export const positiveIntSchema = z.number().int().positive();
export const nonNegativeIntSchema = z.number().int().nonnegative();

export const paginationSchema = z.object({
	page: positiveIntSchema,
	pageSize: positiveIntSchema,
	totalPages: nonNegativeIntSchema,
	totalItems: nonNegativeIntSchema,
	hasNextPage: z.boolean(),
	hasPreviousPage: z.boolean()
});

export function createPaginatedSchema<T extends z.ZodTypeAny>(itemSchema: T) {
	return z.object({
		data: z.array(itemSchema),
		pagination: paginationSchema
	});
}

export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
	return z.object({
		data: dataSchema,
		message: z.string().optional()
	});
}

export const apiErrorResponseSchema = z.object({
	error: z.object({
		code: z.string(),
		message: z.string(),
		details: z.record(z.string(), z.unknown()).optional()
	})
});
