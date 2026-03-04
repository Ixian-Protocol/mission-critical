<script lang="ts">
	import type { Task } from '$lib/db';
	import TaskCard from './task-card.svelte';
	import EmptyState from './empty-state.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		tasks: Task[];
		class?: string;
	}

	let { tasks, class: className }: Props = $props();
</script>

<div class={cn('flex-1 overflow-y-auto p-4 pb-40 md:p-6', className)} id="task-container">
	{#if tasks.length === 0}
		<div class="flex h-full items-center justify-center">
			<EmptyState />
		</div>
	{:else}
		<div class="mx-auto max-w-3xl space-y-2" id="tasks-list">
			{#each tasks as task (task.id)}
				<TaskCard {task} />
			{/each}
		</div>
	{/if}
</div>
