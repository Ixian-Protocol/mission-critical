/**
 * Zod schemas for API response validation
 *
 * These schemas provide runtime type safety for API responses,
 * ensuring data integrity and catching backend contract changes early.
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

// Common reusable schemas

/**
 * ISO 8601 date string schema
 */
export const dateStringSchema = z.iso.datetime();

/**
 * UUID schema
 */
export const uuidSchema = z.uuid();

/**
 * Email schema
 */
export const emailSchema = z.email();

/**
 * Non-empty string schema
 */
export const nonEmptyStringSchema = z.string().min(1);

/**
 * Positive integer schema
 */
export const positiveIntSchema = z.number().int().positive();

/**
 * Non-negative integer schema
 */
export const nonNegativeIntSchema = z.number().int().nonnegative();

/**
 * Pagination info schema
 */
export const paginationSchema = z.object({
	page: positiveIntSchema,
	pageSize: positiveIntSchema,
	totalPages: nonNegativeIntSchema,
	totalItems: nonNegativeIntSchema,
	hasNextPage: z.boolean(),
	hasPreviousPage: z.boolean()
});

/**
 * Create a paginated response schema for a given item schema
 */
export function createPaginatedSchema<T extends z.ZodTypeAny>(itemSchema: T) {
	return z.object({
		data: z.array(itemSchema),
		pagination: paginationSchema
	});
}

/**
 * Create a standard API response schema for a given data schema
 */
export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
	return z.object({
		data: dataSchema,
		message: z.string().optional()
	});
}

/**
 * API error response schema
 */
export const apiErrorResponseSchema = z.object({
	error: z.object({
		code: z.string(),
		message: z.string(),
		details: z.record(z.string(), z.unknown()).optional()
	})
});

/**
 * JWT payload schema (Firebase Auth)
 */
export const jwtPayloadSchema = z.object({
	sub: z.string(),
	email: z.email().optional(),
	email_verified: z.boolean().optional(),
	name: z.string().optional(),
	picture: z.url().optional(),
	iat: z.number(),
	exp: z.number(),
	aud: z.string(),
	iss: z.string()
});

// Example entity schemas - replace/extend these for your actual API

/**
 * Example: User schema
 */
export const userSchema = z.object({
	id: uuidSchema,
	email: emailSchema,
	name: z.string(),
	avatarUrl: z.url().nullable(),
	createdAt: dateStringSchema,
	updatedAt: dateStringSchema
});

export type User = z.infer<typeof userSchema>;

/**
 * Example: Create user input schema
 */
export const createUserInputSchema = z.object({
	email: emailSchema,
	name: nonEmptyStringSchema,
	password: z.string().min(8)
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

/**
 * Example: Update user input schema
 */
export const updateUserInputSchema = z.object({
	name: nonEmptyStringSchema.optional(),
	avatarUrl: z.url().nullable().optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
