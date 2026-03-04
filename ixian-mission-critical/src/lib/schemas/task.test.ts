/**
 * Tests for task validation schemas
 */

import { describe, it, expect } from 'vitest';
import { taskTagSchema, createTaskSchema, updateTaskSchema, taskSchema } from './task';

describe('taskTagSchema', () => {
	describe('valid tags', () => {
		it('accepts "General" tag', () => {
			const result = taskTagSchema.safeParse('General');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe('General');
			}
		});

		it('accepts "Work" tag', () => {
			const result = taskTagSchema.safeParse('Work');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe('Work');
			}
		});

		it('accepts "Personal" tag', () => {
			const result = taskTagSchema.safeParse('Personal');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe('Personal');
			}
		});

		it('accepts "Research" tag', () => {
			const result = taskTagSchema.safeParse('Research');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe('Research');
			}
		});

		it('accepts "Design" tag', () => {
			const result = taskTagSchema.safeParse('Design');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe('Design');
			}
		});
	});

	describe('invalid tags', () => {
		it('rejects unknown tag', () => {
			const result = taskTagSchema.safeParse('Unknown');

			expect(result.success).toBe(false);
		});

		it('rejects lowercase tag', () => {
			const result = taskTagSchema.safeParse('general');

			expect(result.success).toBe(false);
		});

		it('rejects empty string', () => {
			const result = taskTagSchema.safeParse('');

			expect(result.success).toBe(false);
		});

		it('rejects non-string value', () => {
			const result = taskTagSchema.safeParse(123);

			expect(result.success).toBe(false);
		});

		it('rejects null', () => {
			const result = taskTagSchema.safeParse(null);

			expect(result.success).toBe(false);
		});
	});
});

describe('createTaskSchema', () => {
	describe('valid task creation data', () => {
		it('accepts minimal valid data with only text', () => {
			const result = createTaskSchema.safeParse({
				text: 'Buy groceries'
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.text).toBe('Buy groceries');
				expect(result.data.description).toBe('');
				expect(result.data.important).toBe(false);
				expect(result.data.tag).toBe('General');
			}
		});

		it('accepts full valid data', () => {
			const result = createTaskSchema.safeParse({
				text: 'Complete project',
				description: 'Finish the API integration',
				important: true,
				tag: 'Work'
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.text).toBe('Complete project');
				expect(result.data.description).toBe('Finish the API integration');
				expect(result.data.important).toBe(true);
				expect(result.data.tag).toBe('Work');
			}
		});

		it('applies default values for optional fields', () => {
			const result = createTaskSchema.safeParse({
				text: 'Test task'
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.description).toBe('');
				expect(result.data.important).toBe(false);
				expect(result.data.tag).toBe('General');
			}
		});

		it('accepts text at maximum length (500 characters)', () => {
			const longText = 'a'.repeat(500);
			const result = createTaskSchema.safeParse({
				text: longText
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.text).toBe(longText);
			}
		});

		it('accepts description at maximum length (2000 characters)', () => {
			const longDescription = 'b'.repeat(2000);
			const result = createTaskSchema.safeParse({
				text: 'Task with long description',
				description: longDescription
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.description).toBe(longDescription);
			}
		});
	});

	describe('invalid task creation data', () => {
		it('rejects missing text field', () => {
			const result = createTaskSchema.safeParse({});

			expect(result.success).toBe(false);
		});

		it('rejects empty text', () => {
			const result = createTaskSchema.safeParse({
				text: ''
			});

			expect(result.success).toBe(false);
		});

		it('rejects text exceeding 500 characters', () => {
			const result = createTaskSchema.safeParse({
				text: 'a'.repeat(501)
			});

			expect(result.success).toBe(false);
		});

		it('rejects description exceeding 2000 characters', () => {
			const result = createTaskSchema.safeParse({
				text: 'Valid text',
				description: 'b'.repeat(2001)
			});

			expect(result.success).toBe(false);
		});

		it('rejects invalid tag', () => {
			const result = createTaskSchema.safeParse({
				text: 'Valid text',
				tag: 'InvalidTag'
			});

			expect(result.success).toBe(false);
		});

		it('rejects non-boolean important value', () => {
			const result = createTaskSchema.safeParse({
				text: 'Valid text',
				important: 'yes'
			});

			expect(result.success).toBe(false);
		});
	});
});

describe('updateTaskSchema', () => {
	describe('valid update data', () => {
		it('accepts empty object (no updates)', () => {
			const result = updateTaskSchema.safeParse({});

			expect(result.success).toBe(true);
		});

		it('accepts text update only', () => {
			const result = updateTaskSchema.safeParse({
				text: 'Updated title'
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.text).toBe('Updated title');
				expect(result.data.description).toBeUndefined();
			}
		});

		it('accepts description update only', () => {
			const result = updateTaskSchema.safeParse({
				description: 'Updated description'
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.description).toBe('Updated description');
			}
		});

		it('accepts completed update only', () => {
			const result = updateTaskSchema.safeParse({
				completed: true
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.completed).toBe(true);
			}
		});

		it('accepts important update only', () => {
			const result = updateTaskSchema.safeParse({
				important: true
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.important).toBe(true);
			}
		});

		it('accepts tag update only', () => {
			const result = updateTaskSchema.safeParse({
				tag: 'Work'
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.tag).toBe('Work');
			}
		});

		it('accepts multiple field updates', () => {
			const result = updateTaskSchema.safeParse({
				text: 'New title',
				important: true,
				tag: 'Personal'
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.text).toBe('New title');
				expect(result.data.important).toBe(true);
				expect(result.data.tag).toBe('Personal');
			}
		});
	});

	describe('invalid update data', () => {
		it('rejects empty text', () => {
			const result = updateTaskSchema.safeParse({
				text: ''
			});

			expect(result.success).toBe(false);
		});

		it('rejects text exceeding 500 characters', () => {
			const result = updateTaskSchema.safeParse({
				text: 'a'.repeat(501)
			});

			expect(result.success).toBe(false);
		});

		it('rejects description exceeding 2000 characters', () => {
			const result = updateTaskSchema.safeParse({
				description: 'b'.repeat(2001)
			});

			expect(result.success).toBe(false);
		});

		it('rejects invalid tag', () => {
			const result = updateTaskSchema.safeParse({
				tag: 'InvalidTag'
			});

			expect(result.success).toBe(false);
		});

		it('rejects non-boolean completed value', () => {
			const result = updateTaskSchema.safeParse({
				completed: 'yes'
			});

			expect(result.success).toBe(false);
		});
	});
});

describe('taskSchema', () => {
	describe('valid task data', () => {
		it('accepts complete valid task data', () => {
			const taskData = {
				id: '550e8400-e29b-41d4-a716-446655440000',
				text: 'Test task',
				description: 'Task description',
				completed: false,
				important: true,
				tag: 'Work',
				dueAt: null,
				recurrence: 'none',
				recurrenceAlt: false,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				deletedAt: null
			};

			const result = taskSchema.safeParse(taskData);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.id).toBe(taskData.id);
				expect(result.data.text).toBe('Test task');
				expect(result.data.completed).toBe(false);
				expect(result.data.important).toBe(true);
				expect(result.data.tag).toBe('Work');
				expect(result.data.deletedAt).toBeNull();
			}
		});

		it('accepts task with deletedAt timestamp', () => {
			const deletedAt = Date.now();
			const taskData = {
				id: '550e8400-e29b-41d4-a716-446655440000',
				text: 'Deleted task',
				description: '',
				completed: true,
				important: false,
				tag: 'General',
				dueAt: null,
				recurrence: 'none',
				recurrenceAlt: false,
				createdAt: Date.now() - 1000,
				updatedAt: Date.now(),
				deletedAt
			};

			const result = taskSchema.safeParse(taskData);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.deletedAt).toBe(deletedAt);
			}
		});

		it('accepts all valid tag types', () => {
			const tags = ['General', 'Work', 'Personal', 'Research', 'Design'];

			tags.forEach((tag) => {
				const result = taskSchema.safeParse({
					id: '550e8400-e29b-41d4-a716-446655440000',
					text: 'Task',
					description: '',
					completed: false,
					important: false,
					tag,
					dueAt: null,
					recurrence: 'none',
					recurrenceAlt: false,
					createdAt: Date.now(),
					updatedAt: Date.now(),
					deletedAt: null
				});

				expect(result.success).toBe(true);
			});
		});
	});

	describe('invalid task data', () => {
		it('rejects invalid UUID format', () => {
			const result = taskSchema.safeParse({
				id: 'not-a-uuid',
				text: 'Task',
				description: '',
				completed: false,
				important: false,
				tag: 'General',
				dueAt: null,
				recurrence: 'none',
				recurrenceAlt: false,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				deletedAt: null
			});

			expect(result.success).toBe(false);
		});

		it('rejects missing required fields', () => {
			const result = taskSchema.safeParse({
				id: '550e8400-e29b-41d4-a716-446655440000'
			});

			expect(result.success).toBe(false);
		});

		it('rejects invalid tag', () => {
			const result = taskSchema.safeParse({
				id: '550e8400-e29b-41d4-a716-446655440000',
				text: 'Task',
				description: '',
				completed: false,
				important: false,
				tag: 'InvalidTag',
				dueAt: null,
				recurrence: 'none',
				recurrenceAlt: false,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				deletedAt: null
			});

			expect(result.success).toBe(false);
		});

		it('rejects non-number timestamps', () => {
			const result = taskSchema.safeParse({
				id: '550e8400-e29b-41d4-a716-446655440000',
				text: 'Task',
				description: '',
				completed: false,
				important: false,
				tag: 'General',
				dueAt: null,
				recurrence: 'none',
				recurrenceAlt: false,
				createdAt: '2024-01-01',
				updatedAt: Date.now(),
				deletedAt: null
			});

			expect(result.success).toBe(false);
		});

		it('rejects non-boolean completed value', () => {
			const result = taskSchema.safeParse({
				id: '550e8400-e29b-41d4-a716-446655440000',
				text: 'Task',
				description: '',
				completed: 1,
				important: false,
				tag: 'General',
				dueAt: null,
				recurrence: 'none',
				recurrenceAlt: false,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				deletedAt: null
			});

			expect(result.success).toBe(false);
		});

		it('rejects undefined deletedAt (should be null or number)', () => {
			const result = taskSchema.safeParse({
				id: '550e8400-e29b-41d4-a716-446655440000',
				text: 'Task',
				description: '',
				completed: false,
				important: false,
				tag: 'General',
				dueAt: null,
				recurrence: 'none',
				recurrenceAlt: false,
				createdAt: Date.now(),
				updatedAt: Date.now(),
				deletedAt: undefined
			});

			expect(result.success).toBe(false);
		});
	});
});
