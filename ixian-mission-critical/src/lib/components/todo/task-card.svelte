<script lang="ts">
	import type { Task } from '$lib/db';
	import { toggleTaskComplete, toggleTaskImportant, deleteTask, getTagColor } from '$lib/db';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import StarIcon from '@lucide/svelte/icons/star';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import RepeatIcon from '@lucide/svelte/icons/repeat';
	import { cn } from '$lib/utils';

	interface Props {
		task: Task;
		class?: string;
	}

	let { task, class: className }: Props = $props();

	// Expanded state for reading full description
	let expanded = $state(false);

	// Check if task is overdue
	let isOverdue = $derived(task.dueAt && !task.completed && task.dueAt < Date.now());

	// Check if task was just created (within last 1 second) - prevents accidental clicks
	let isJustCreated = $derived(Date.now() - task.createdAt < 1000);

	// Format due date for display
	function formatDueDate(timestamp: number): string {
		const date = new Date(timestamp);
		const now = new Date();
		const isToday = date.toDateString() === now.toDateString();
		const tomorrow = new Date(now);
		tomorrow.setDate(tomorrow.getDate() + 1);
		const isTomorrow = date.toDateString() === tomorrow.toDateString();

		if (isToday) {
			return `Today, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
		}
		if (isTomorrow) {
			return `Tomorrow, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
		}
		return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
	}

	// Format recurrence for display
	function formatRecurrence(recurrence: string, alt: boolean): string {
		const prefix = alt ? 'Every other ' : '';
		switch (recurrence) {
			case 'daily':
				return alt ? 'Every other day' : 'Daily';
			case 'weekly':
				return alt ? 'Every other week' : 'Weekly';
			case 'monthly':
				return alt ? 'Every other month' : 'Monthly';
			default:
				return '';
		}
	}

	async function handleToggleComplete() {
		await toggleTaskComplete(task.id);
	}

	async function handleToggleImportant(event: Event) {
		event.stopPropagation();
		await toggleTaskImportant(task.id);
	}

	async function handleDelete(event: Event) {
		event.stopPropagation();
		await deleteTask(task.id);
	}
</script>

<div
	class={cn(
		'group flex flex-col rounded-xl border border-border bg-card p-3 transition-all hover:border-muted-foreground/30',
		task.completed && 'opacity-60',
		isOverdue && 'border-destructive/50',
		isJustCreated && 'animate-task-glow',
		className
	)}
>
	<div class="flex items-start">
		<!-- Checkbox -->
		<div
			class="mr-4 mt-0.5 shrink-0 cursor-pointer"
			onclick={handleToggleComplete}
			onkeydown={(e) => e.key === 'Enter' && handleToggleComplete()}
			role="checkbox"
			aria-checked={task.completed}
			tabindex="0"
		>
			<Checkbox
				checked={task.completed}
				onCheckedChange={handleToggleComplete}
				onclick={(e: Event) => e.stopPropagation()}
				class="border-muted-foreground/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
			/>
		</div>

		<!-- Content (click to expand/collapse) -->
		<div
			class="min-w-0 flex-1 cursor-pointer"
			onclick={() => (expanded = !expanded)}
			onkeydown={(e) => e.key === 'Enter' && (expanded = !expanded)}
			role="button"
			tabindex="0"
		>
			<div class="flex items-center justify-between">
				<div
					class={cn(
						'pr-2 text-sm font-medium text-foreground transition-all',
						!expanded && 'truncate',
						task.completed && 'text-muted-foreground line-through'
					)}
				>
					{task.text}
				</div>

				<!-- Hover Actions (visible on mobile, hover-only on desktop) -->
				<div
					class="flex shrink-0 items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
				>
					<Button
						variant="ghost"
						size="icon"
						class={cn(
							'h-7 w-7',
							task.important ? 'text-yellow-500 opacity-100' : 'text-muted-foreground'
						)}
						onclick={handleToggleImportant}
					>
						<StarIcon class={cn('h-4 w-4', task.important && 'fill-current')} />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						class="h-7 w-7 text-muted-foreground hover:text-destructive"
						onclick={handleDelete}
					>
						<Trash2Icon class="h-4 w-4" />
					</Button>
				</div>

				<!-- Always visible important indicator (hidden on mobile since icons visible, hidden on desktop hover) -->
				{#if task.important}
					<div class="ml-2 hidden text-yellow-500 md:block md:group-hover:hidden">
						<StarIcon class="h-3 w-3 fill-current" />
					</div>
				{/if}
			</div>

			<!-- Description -->
			{#if task.description}
				<p class={cn('mt-1.5 text-xs text-muted-foreground', !expanded && 'line-clamp-2')}>
					{task.description}
				</p>
			{/if}

			<!-- Due Date & Recurrence -->
			{#if task.dueAt || task.recurrence !== 'none'}
				<div class="mt-1.5 flex flex-wrap items-center gap-2">
					{#if task.dueAt}
						<div
							class={cn(
								'flex items-center gap-1 text-[11px]',
								isOverdue ? 'text-destructive' : 'text-muted-foreground'
							)}
						>
							<CalendarIcon class="h-3 w-3" />
							<span>{formatDueDate(task.dueAt)}</span>
						</div>
					{/if}
					{#if task.recurrence !== 'none'}
						<div class="flex items-center gap-1 text-[11px] text-muted-foreground">
							<RepeatIcon class="h-3 w-3" />
							<span>{formatRecurrence(task.recurrence, task.recurrenceAlt)}</span>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Tag -->
			{#if task.tag !== 'General'}
				{@const tagColor = getTagColor(task.tag)}
				<div class="mt-1.5">
					<Badge
						variant="outline"
						class="h-5 gap-1.5 px-1.5 text-[10px]"
						style={tagColor ? `border-color: ${tagColor}40; color: ${tagColor}` : undefined}
					>
						{#if tagColor}
							<div
								class="h-1.5 w-1.5 rounded-full"
								style="background-color: {tagColor}"
							></div>
						{/if}
						{task.tag}
					</Badge>
				</div>
			{/if}
		</div>
	</div>
</div>
