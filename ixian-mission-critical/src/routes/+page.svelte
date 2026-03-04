<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import {
		TodoSidebar,
		TodoHeader,
		TaskList,
		TaskInput
	} from '$lib/components/todo';
	import {
		initDatabase,
		createTasksQuery,
		createTaskCountsQuery,
		type Task
	} from '$lib/db';
	import { getFilter, getTagFilter } from '$lib/stores/todo.svelte';
	import type { Subscription } from 'dexie';

	// Reactive task data
	let tasks = $state<Task[]>([]);
	let counts = $state({ all: 0, today: 0, important: 0 });

	// Subscriptions
	let tasksSubscription: Subscription | null = null;
	let countsSubscription: Subscription | null = null;

	// Re-subscribe when filters change
	let filter = $derived(getFilter());
	let tagFilter = $derived(getTagFilter());

	$effect(() => {
		// Clean up previous subscription
		if (tasksSubscription) {
			tasksSubscription.unsubscribe();
		}

		// Create new subscription with current filters
		const query = createTasksQuery(filter, tagFilter);
		tasksSubscription = query.subscribe({
			next: (value) => {
				tasks = value;
			},
			error: (err) => {
				console.error('Tasks query error:', err);
			}
		});
	});

	onMount(async () => {
		// Initialize database
		await initDatabase();

		// Subscribe to counts
		const countsQuery = createTaskCountsQuery();
		countsSubscription = countsQuery.subscribe({
			next: (value) => {
				counts = value;
			},
			error: (err) => {
				console.error('Counts query error:', err);
			}
		});
	});

	onDestroy(() => {
		if (tasksSubscription) {
			tasksSubscription.unsubscribe();
		}
		if (countsSubscription) {
			countsSubscription.unsubscribe();
		}
	});
</script>

<Sidebar.Provider>
	<TodoSidebar {counts} />
	<Sidebar.Inset class="relative flex h-screen flex-col overflow-hidden">
		<TodoHeader />
		<TaskList {tasks} />
		<TaskInput />
	</Sidebar.Inset>
</Sidebar.Provider>
