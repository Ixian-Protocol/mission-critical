<script lang="ts">
	import { onMount } from 'svelte';
	import {
		createTask,
		createTagsQuery,
		RECURRENCE_OPTIONS,
		type Tag,
		type TaskTag,
		type RecurrenceType
	} from '$lib/db';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import Calendar from '$lib/components/ui/calendar/calendar.svelte';
	import { getIsInputExpanded, expandInput, collapseInput } from '$lib/stores/todo.svelte';
	import TagIcon from '@lucide/svelte/icons/tag';
	import RepeatIcon from '@lucide/svelte/icons/repeat';
	import StarIcon from '@lucide/svelte/icons/star';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import XIcon from '@lucide/svelte/icons/x';
	import { cn } from '$lib/utils';
	import {
		CalendarDate,
		getLocalTimeZone,
		today,
		parseDate,
		type DateValue
	} from '@internationalized/date';
	import type { Subscription } from 'dexie';

	// Form state
	let taskText = $state('');
	let taskDescription = $state('');
	let isImportant = $state(false);
	let currentTag = $state<string>('General');
	let dueAt = $state<number | null>(null);
	let currentRecurrenceIndex = $state(0);
	let recurrenceAlt = $state(false);
	let datePickerOpen = $state(false);

	// Tags from database
	let tags = $state<Tag[]>([]);
	let tagsSubscription: Subscription | null = null;

	onMount(() => {
		const observable = createTagsQuery();
		tagsSubscription = observable.subscribe({
			next: (value) => {
				tags = value;
			},
			error: (err) => {
				console.error('Tags query error:', err);
			}
		});

		return () => {
			tagsSubscription?.unsubscribe();
		};
	});

	// Derived
	let currentRecurrence = $derived(RECURRENCE_OPTIONS[currentRecurrenceIndex]);
	let isExpanded = $derived(getIsInputExpanded());
	let currentTagData = $derived(tags.find((t) => t.name === currentTag));

	// Convert dueAt timestamp to CalendarDate for the picker
	let calendarValue = $derived.by(() => {
		if (!dueAt) return undefined;
		const date = new Date(dueAt);
		return new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
	});

	// Time input value
	let timeValue = $derived.by(() => {
		if (!dueAt) return '12:00';
		const date = new Date(dueAt);
		return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
	});

	// Recurrence colors
	const recurrenceColors: Record<string, string> = {
		none: 'border-zinc-500/50 text-zinc-400',
		daily: 'border-orange-500/50 text-orange-400',
		weekly: 'border-cyan-500/50 text-cyan-400',
		monthly: 'border-violet-500/50 text-violet-400'
	};

	// Recurrence labels
	const recurrenceLabels: Record<string, string> = {
		none: 'None',
		daily: 'Daily',
		weekly: 'Weekly',
		monthly: 'Monthly'
	};

	function handleFocus() {
		expandInput();
	}

	function handleCollapse() {
		collapseInput();
	}

	function cycleTag() {
		if (tags.length === 0) return;
		const currentIndex = tags.findIndex((t) => t.name === currentTag);
		const nextIndex = (currentIndex + 1) % tags.length;
		currentTag = tags[nextIndex].name;
	}

	function cycleRecurrence() {
		currentRecurrenceIndex = (currentRecurrenceIndex + 1) % RECURRENCE_OPTIONS.length;
		// Reset alt when going back to none
		if (currentRecurrenceIndex === 0) {
			recurrenceAlt = false;
		}
	}

	function toggleRecurrenceAlt() {
		recurrenceAlt = !recurrenceAlt;
	}

	function toggleImportant() {
		isImportant = !isImportant;
	}

	function handleDateSelect(value: DateValue | undefined) {
		if (value) {
			// Preserve existing time or use noon as default
			const existingDate = dueAt ? new Date(dueAt) : null;
			const hours = existingDate?.getHours() ?? 12;
			const minutes = existingDate?.getMinutes() ?? 0;

			const newDate = new Date(value.year, value.month - 1, value.day, hours, minutes);
			dueAt = newDate.getTime();
		}
		datePickerOpen = false;
	}

	function handleTimeChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const [hours, minutes] = input.value.split(':').map(Number);

		if (dueAt) {
			const date = new Date(dueAt);
			date.setHours(hours, minutes);
			dueAt = date.getTime();
		} else {
			// If no date set, use today
			const now = new Date();
			now.setHours(hours, minutes, 0, 0);
			dueAt = now.getTime();
		}
	}

	function clearDueDate() {
		dueAt = null;
	}

	function formatDueDate(timestamp: number): string {
		const date = new Date(timestamp);
		const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
		const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
		return `${dateStr}, ${timeStr}`;
	}

	async function handleSubmit() {
		const text = taskText.trim();
		if (!text) return;

		await createTask({
			text,
			description: taskDescription.trim(),
			important: isImportant,
			tag: currentTag as TaskTag,
			dueAt,
			recurrence: currentRecurrence as RecurrenceType,
			recurrenceAlt
		});

		// Reset form
		taskText = '';
		taskDescription = '';
		isImportant = false;
		dueAt = null;
		currentRecurrenceIndex = 0;
		recurrenceAlt = false;

		collapseInput();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSubmit();
		}
		if (event.key === 'Escape') {
			handleCollapse();
		}
	}
</script>

<!-- Click-away overlay -->
{#if isExpanded}
	<button
		class="fixed inset-0 z-20 bg-black/40 backdrop-blur-[1px] transition-opacity"
		onclick={handleCollapse}
		aria-label="Close input"
	></button>
{/if}

<div class="absolute bottom-0 left-0 z-30 w-full">
	<!-- Gradient Fade -->
	<div class="pointer-events-none h-12 bg-gradient-to-t from-background to-transparent"></div>

	<div class="bg-background px-4 pb-6 pt-2">
		<div class="relative mx-auto max-w-3xl">
			<!-- Main Input Card -->
			<div
				class={cn(
					'relative overflow-hidden rounded-xl border shadow-lg shadow-black/20 transition-all duration-300 ease-out',
					isExpanded ? 'border-primary/40 bg-zinc-800/80 ring-1 ring-primary/30' : 'border-border bg-card'
				)}
			>
				<!-- Title input -->
				<div class="px-4 py-4">
					<Input
						type="text"
						placeholder="Add a new task..."
						bind:value={taskText}
						onfocus={handleFocus}
						onkeydown={handleKeydown}
						class="w-full border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
						autocomplete="off"
					/>
				</div>

				<!-- Expanded Options Area -->
				<div
					class={cn(
						'overflow-hidden transition-all duration-300 ease-in-out',
						isExpanded ? 'max-h-[300px]' : 'max-h-0'
					)}
				>
					<div class="px-4 pb-4">
						<!-- Description -->
						<Textarea
							bind:value={taskDescription}
							placeholder="Add notes or description..."
							class="mb-4 min-h-[60px] resize-none rounded-lg border-transparent bg-muted/30 px-3 py-2 shadow-none focus-visible:ring-0"
							rows={2}
						/>

						<!-- Bottom Controls -->
						<div class="flex flex-wrap items-center justify-between gap-2">
							<div class="flex flex-wrap gap-2">
								<!-- Due Date Picker -->
								<Popover.Root bind:open={datePickerOpen}>
									<Popover.Trigger>
										{#snippet child({ props })}
											<Button
												{...props}
												variant="outline"
												size="sm"
												class={cn(
													'h-8 gap-2 text-xs',
													dueAt ? 'border-rose-500/50 text-rose-400' : 'border-zinc-500/50 text-zinc-400'
												)}
											>
												<CalendarIcon class="h-3.5 w-3.5" />
												<span>{dueAt ? formatDueDate(dueAt) : 'Due date'}</span>
												{#if dueAt}
													<button
														type="button"
														class="ml-1 rounded-full p-0.5 hover:bg-muted"
														onclick={(e) => {
															e.stopPropagation();
															clearDueDate();
														}}
													>
														<XIcon class="h-3 w-3" />
													</button>
												{/if}
											</Button>
										{/snippet}
									</Popover.Trigger>
									<Popover.Content class="w-auto p-0" align="start">
										<div class="flex flex-col gap-3 p-3">
											<Calendar
												type="single"
												value={calendarValue}
												onValueChange={handleDateSelect}
												captionLayout="dropdown"
											/>
											<div class="flex items-center gap-2 border-t pt-3">
												<span class="text-sm text-muted-foreground">Time:</span>
												<input
													type="time"
													value={timeValue}
													onchange={handleTimeChange}
													class="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
												/>
											</div>
										</div>
									</Popover.Content>
								</Popover.Root>

								<!-- Tag Picker (tap to cycle) -->
								<Button
									variant="outline"
									size="sm"
									onclick={cycleTag}
									class="h-8 gap-2 text-xs"
								>
									{#if currentTagData}
										<div
											class="h-2.5 w-2.5 rounded-full"
											style="background-color: {currentTagData.color}"
										></div>
									{:else}
										<TagIcon class="h-3.5 w-3.5" />
									{/if}
									<span>{currentTag}</span>
								</Button>

								<!-- Recurrence Toggle -->
								<Button
									variant="outline"
									size="sm"
									onclick={cycleRecurrence}
									class={cn('h-8 gap-2 text-xs', recurrenceColors[currentRecurrence])}
								>
									<RepeatIcon class="h-3.5 w-3.5" />
									<span>{recurrenceLabels[currentRecurrence]}</span>
								</Button>

								<!-- Every Other Toggle (only visible when recurrence is set) -->
								{#if currentRecurrence !== 'none'}
									<Button
										variant="outline"
										size="sm"
										onclick={toggleRecurrenceAlt}
										class={cn(
											'h-8 px-2 text-xs',
											recurrenceAlt
												? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
												: 'border-zinc-500/50 text-zinc-400'
										)}
										title="Every other (alternating)"
									>
										2x
									</Button>
								{/if}
							</div>

							<div class="flex items-center gap-3">
								<div class="h-6 w-px bg-border"></div>
								<Button
									variant="ghost"
									size="icon"
									onclick={toggleImportant}
									class={cn(
										'h-9 w-9',
										isImportant ? 'text-yellow-400' : 'text-muted-foreground hover:text-yellow-400'
									)}
									title="Mark as Important"
								>
									<StarIcon class={cn('h-5 w-5', isImportant && 'fill-current')} />
								</Button>
								<Button onclick={handleSubmit} disabled={!taskText.trim()} class="px-4">
									Add Task
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
