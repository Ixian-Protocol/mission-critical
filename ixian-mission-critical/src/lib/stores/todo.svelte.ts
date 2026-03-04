/**
 * Todo UI state management using Svelte 5 runes
 */

import type { TaskFilter, TaskTag } from '$lib/db';

// Current filter state
let currentFilter = $state<TaskFilter>('all');
let currentTagFilter = $state<TaskTag | null>(null);

// Input UI state
let isInputExpanded = $state(false);

/**
 * Get the current filter
 */
export function getFilter(): TaskFilter {
	return currentFilter;
}

/**
 * Set the current filter
 */
export function setFilter(filter: TaskFilter): void {
	currentFilter = filter;
	// Clear tag filter when changing main filter
	currentTagFilter = null;
}

/**
 * Get the current tag filter
 */
export function getTagFilter(): TaskTag | null {
	return currentTagFilter;
}

/**
 * Set the tag filter
 */
export function setTagFilter(tag: TaskTag | null): void {
	currentTagFilter = tag;
}

/**
 * Check if input is expanded
 */
export function getIsInputExpanded(): boolean {
	return isInputExpanded;
}

/**
 * Expand the input
 */
export function expandInput(): void {
	isInputExpanded = true;
}

/**
 * Collapse the input
 */
export function collapseInput(): void {
	isInputExpanded = false;
}

/**
 * Toggle input expanded state
 */
export function toggleInput(): void {
	isInputExpanded = !isInputExpanded;
}

/**
 * Get filter display title
 */
export function getFilterTitle(filter: TaskFilter, tagFilter: TaskTag | null = null): string {
	if (tagFilter) {
		return tagFilter;
	}
	switch (filter) {
		case 'all':
			return 'All Tasks';
		case 'today':
			return "Today's Tasks";
		case 'important':
			return 'Important';
		default:
			return 'Tasks';
	}
}

/**
 * Format today's date for display
 */
export function getFormattedDate(): string {
	return new Date().toLocaleDateString('en-US', {
		weekday: 'long',
		day: 'numeric',
		month: 'short'
	});
}
