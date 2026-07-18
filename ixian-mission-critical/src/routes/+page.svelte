<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import {
		TodoSidebar,
		TodoHeader,
		TaskList,
		TaskInput
	} from '$lib/components/todo';
	import {
		createTasksQuery,
		createTaskCountsQuery,
		type Task
	} from '$lib/db';
	import { getFilter, getTagFilter } from '$lib/stores/todo.svelte';

	// Reactive task data
	let tasks = $state<Task[]>([]);
	let counts = $state({ all: 0, today: 0, important: 0 });

	// Re-subscribe when filters change
	let filter = $derived(getFilter());
	let tagFilter = $derived(getTagFilter());

	$effect(() => {
		const query = createTasksQuery(filter, tagFilter);
		const subscription = query.subscribe({
			next: (value) => {
				tasks = value;
			},
			error: (err) => {
				console.error('Tasks query error:', err);
			}
		});
		return () => subscription.unsubscribe();
	});

	$effect(() => {
		const countsQuery = createTaskCountsQuery();
		const subscription = countsQuery.subscribe({
			next: (value) => {
				counts = value;
			},
			error: (err) => {
				console.error('Counts query error:', err);
			}
		});
		return () => subscription.unsubscribe();
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
