<script lang="ts">
	import { onMount } from 'svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { clearCompletedTasks, createTagsQuery, type Tag, type TaskTag, type TaskFilter } from '$lib/db';
	import {
		getFilter,
		setFilter,
		getTagFilter,
		setTagFilter
	} from '$lib/stores/todo.svelte';
	import SyncIndicator from './sync-indicator.svelte';
	import TagDialog from './tag-dialog.svelte';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import StarIcon from '@lucide/svelte/icons/star';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import { cn } from '$lib/utils';
	import type { ComponentProps } from 'svelte';
	import type { Subscription } from 'dexie';

	interface Props extends ComponentProps<typeof Sidebar.Root> {
		counts?: {
			all: number;
			today: number;
			important: number;
		};
	}

	let { counts = { all: 0, today: 0, important: 0 }, ...restProps }: Props = $props();

	let currentFilter = $derived(getFilter());
	let currentTagFilter = $derived(getTagFilter());

	// Tags from database
	let tags = $state<Tag[]>([]);
	let tagsSubscription: Subscription | null = null;

	// Dialog state
	let tagDialogOpen = $state(false);
	let editingTag = $state<Tag | null>(null);

	onMount(() => {
		// Subscribe to tags query
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

	function handleFilterClick(filter: TaskFilter) {
		setFilter(filter);
	}

	function handleTagClick(tag: TaskTag) {
		if (currentTagFilter === tag) {
			setTagFilter(null);
		} else {
			setTagFilter(tag);
		}
	}

	function handleCreateTag() {
		editingTag = null;
		tagDialogOpen = true;
	}

	function handleEditTag(tag: Tag, event: Event) {
		event.stopPropagation();
		editingTag = tag;
		tagDialogOpen = true;
	}

	async function handleClearCompleted() {
		await clearCompletedTasks();
	}
</script>

<Sidebar.Root class="border-e-0" {...restProps}>
	<Sidebar.Header class="pt-[calc(env(safe-area-inset-top)+1rem)]">
		<!-- User Profile Stub -->
		<div class="flex items-center gap-3 px-2 pb-4">
			<div
				class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-primary to-blue-500 text-xs font-bold text-primary-foreground"
			>
				U
			</div>
			<span class="text-sm font-medium text-foreground">User</span>
		</div>
	</Sidebar.Header>

	<Sidebar.Content>
		<!-- Main Navigation -->
		<Sidebar.Group>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					<!-- All Tasks -->
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							isActive={currentFilter === 'all' && !currentTagFilter}
							onclick={() => handleFilterClick('all')}
						>
							<InboxIcon class={cn('h-4 w-4', currentFilter === 'all' && !currentTagFilter && 'text-primary')} />
							<span>All Tasks</span>
							<Badge variant="secondary" class="ml-auto h-5 px-1.5 text-[10px]">
								{counts.all}
							</Badge>
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>

					<!-- Today -->
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							isActive={currentFilter === 'today' && !currentTagFilter}
							onclick={() => handleFilterClick('today')}
						>
							<CalendarIcon class={cn('h-4 w-4', currentFilter === 'today' && !currentTagFilter && 'text-primary')} />
							<span>Today</span>
							<Badge variant="secondary" class="ml-auto h-5 px-1.5 text-[10px]">
								{counts.today}
							</Badge>
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>

					<!-- Important -->
					<Sidebar.MenuItem>
						<Sidebar.MenuButton
							isActive={currentFilter === 'important' && !currentTagFilter}
							onclick={() => handleFilterClick('important')}
						>
							<StarIcon class={cn('h-4 w-4', currentFilter === 'important' && !currentTagFilter && 'text-primary')} />
							<span>Important</span>
							<Badge variant="secondary" class="ml-auto h-5 px-1.5 text-[10px]">
								{counts.important}
							</Badge>
						</Sidebar.MenuButton>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>

		<!-- Tags -->
		<Sidebar.Group>
			<div class="flex items-center justify-between px-2">
				<Sidebar.GroupLabel class="text-xs uppercase tracking-widest text-muted-foreground">
					Tags
				</Sidebar.GroupLabel>
				<Button
					variant="ghost"
					size="icon"
					class="h-6 w-6 text-muted-foreground hover:text-foreground"
					onclick={handleCreateTag}
				>
					<PlusIcon class="h-3.5 w-3.5" />
					<span class="sr-only">Add tag</span>
				</Button>
			</div>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each tags.filter((t) => t.name !== 'General') as tag (tag.id)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton
								isActive={currentTagFilter === tag.name}
								onclick={() => handleTagClick(tag.name)}
								class={cn(
									'group/tag',
									currentTagFilter === tag.name ? '[&>span]:text-primary' : ''
								)}
							>
								<div
									class="h-2 w-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.3)]"
									style="background-color: {tag.color}"
								></div>
								<span class="flex-1">{tag.name}</span>
								{#if !tag.isDefault}
									<Button
										variant="ghost"
										size="icon"
										class="h-5 w-5 opacity-0 transition-opacity group-hover/tag:opacity-100"
										onclick={(e) => handleEditTag(tag, e)}
									>
										<PencilIcon class="h-3 w-3" />
										<span class="sr-only">Edit tag</span>
									</Button>
								{/if}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer>
		<div class="space-y-2">
			<SyncIndicator />
			<Separator />
			<Button
				variant="ghost"
				class="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
				onclick={handleClearCompleted}
			>
				<Trash2Icon class="h-4 w-4" />
				<span>Clear Completed</span>
			</Button>
		</div>
	</Sidebar.Footer>

	<Sidebar.Rail />
</Sidebar.Root>

<TagDialog bind:open={tagDialogOpen} tag={editingTag} onClose={() => (editingTag = null)} />
