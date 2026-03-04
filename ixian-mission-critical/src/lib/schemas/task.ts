/**
 * Task validation schemas
 */

import { z } from 'zod';
import { RECURRENCE_OPTIONS } from '$lib/db';

/**
 * Task tag schema (now accepts any string for custom tags)
 */
export const taskTagSchema = z.string().min(1, 'Tag is required').max(50, 'Tag name is too long');

/**
 * Recurrence type enum schema
 */
export const recurrenceSchema = z.enum(RECURRENCE_OPTIONS);

/**
 * Schema for creating a new task
 */
export const createTaskSchema = z.object({
	text: z.string().min(1, 'Task title is required').max(500, 'Task title is too long'),
	description: z.string().max(2000, 'Description is too long').default(''),
	important: z.boolean().default(false),
	tag: taskTagSchema.default('General'),
	dueAt: z.number().nullable().default(null),
	recurrence: recurrenceSchema.default('none'),
	recurrenceAlt: z.boolean().default(false)
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/**
 * Schema for updating a task
 */
export const updateTaskSchema = z.object({
	text: z.string().min(1, 'Task title is required').max(500, 'Task title is too long').optional(),
	description: z.string().max(2000, 'Description is too long').optional(),
	completed: z.boolean().optional(),
	important: z.boolean().optional(),
	tag: taskTagSchema.optional(),
	dueAt: z.number().nullable().optional(),
	recurrence: recurrenceSchema.optional(),
	recurrenceAlt: z.boolean().optional()
});

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/**
 * Full task schema (for validation from server)
 */
export const taskSchema = z.object({
	id: z.string().uuid(),
	text: z.string(),
	description: z.string(),
	completed: z.boolean(),
	important: z.boolean(),
	tag: taskTagSchema,
	dueAt: z.number().nullable(),
	recurrence: recurrenceSchema,
	recurrenceAlt: z.boolean(),
	createdAt: z.number(),
	updatedAt: z.number(),
	deletedAt: z.number().nullable()
});

export type TaskData = z.infer<typeof taskSchema>;
