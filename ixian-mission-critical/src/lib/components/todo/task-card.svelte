<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
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
	let isJustCreated = $state(false);
	let justCreatedTimeout: ReturnType<typeof setTimeout> | null = null;
	let nowMs = $state(Date.now());
	let overdueInterval: ReturnType<typeof setInterval> | null = null;

	// Check if task is overdue (tick so overdue state can update without remount)
	let isOverdue = $derived(!!task.dueAt && !task.completed && task.dueAt < nowMs);

	onMount(() => {
		const age = Date.now() - task.createdAt;
		if (age < 1000) {
			isJustCreated = true;
			justCreatedTimeout = setTimeout(() => {
				isJustCreated = false;
				justCreatedTimeout = null;
			}, 1000 - age);
		}

		overdueInterval = setInterval(() => {
			nowMs = Date.now();
		}, 60_000);
	});

	onDestroy(() => {
		if (justCreatedTimeout) {
			clearTimeout(justCreatedTimeout);
			justCreatedTimeout = null;
		}
		if (overdueInterval) {
			clearInterval(overdueInterval);
			overdueInterval = null;
		}
	});

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

	async function handleToggleImportant() {
		await toggleTaskImportant(task.id);
	}

	async function handleDelete() {
		await deleteTask(task.id);
	}

	function toggleExpanded() {
		expanded = !expanded;
	}

	function handleExpandKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggleExpanded();
		}
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
		<div class="mr-4 mt-0.5 shrink-0">
			<Checkbox
				checked={task.completed}
				onCheckedChange={handleToggleComplete}
				aria-label={task.completed ? `Mark "${task.text}" incomplete` : `Mark "${task.text}" complete`}
				class="border-muted-foreground/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
			/>
		</div>

		<div class="min-w-0 flex-1">
			<div class="flex items-center justify-between gap-2">
				<button
					type="button"
					class={cn(
						'min-w-0 flex-1 cursor-pointer rounded-sm text-left text-sm font-medium text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
						!expanded && 'truncate',
						task.completed && 'text-muted-foreground line-through'
					)}
					aria-expanded={expanded}
					aria-controls="task-details-{task.id}"
					onclick={toggleExpanded}
					onkeydown={handleExpandKeydown}
				>
					{task.text}
				</button>

				<div class="flex shrink-0 items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
					<Button
						variant="ghost"
						size="icon"
						class={cn(
							'h-7 w-7',
							task.important ? 'text-yellow-500 opacity-100' : 'text-muted-foreground'
						)}
						aria-label={task.important ? `Unmark "${task.text}" as important` : `Mark "${task.text}" as important`}
						aria-pressed={task.important}
						onclick={handleToggleImportant}
					>
						<StarIcon class={cn('h-4 w-4', task.important && 'fill-current')} />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						class="h-7 w-7 text-muted-foreground hover:text-destructive"
						aria-label={`Delete "${task.text}"`}
						onclick={handleDelete}
					>
						<Trash2Icon class="h-4 w-4" />
					</Button>
				</div>

				{#if task.important}
					<div class="ml-2 hidden text-yellow-500 md:block md:group-hover:hidden" aria-hidden="true">
						<StarIcon class="h-3 w-3 fill-current" />
					</div>
				{/if}
			</div>

			<div id="task-details-{task.id}">
				{#if task.description}
					<p class={cn('mt-1.5 text-xs text-muted-foreground', !expanded && 'line-clamp-2')}>
						{task.description}
					</p>
				{/if}

				{#if task.dueAt || task.recurrence !== 'none'}
					<div class="mt-1.5 flex flex-wrap items-center gap-2">
						{#if task.dueAt}
							<div
								class={cn(
									'flex items-center gap-1 text-[11px]',
									isOverdue ? 'text-destructive' : 'text-muted-foreground'
								)}
							>
								<CalendarIcon class="h-3 w-3" aria-hidden="true" />
								<span>{formatDueDate(task.dueAt)}</span>
							</div>
						{/if}
						{#if task.recurrence !== 'none'}
							<div class="flex items-center gap-1 text-[11px] text-muted-foreground">
								<RepeatIcon class="h-3 w-3" aria-hidden="true" />
								<span>{formatRecurrence(task.recurrence, task.recurrenceAlt)}</span>
							</div>
						{/if}
					</div>
				{/if}

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
									aria-hidden="true"
								></div>
							{/if}
							{task.tag}
						</Badge>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
