<script lang="ts">
	import type { Task } from '$lib/db';
	import { syncWithServer } from '$lib/db/sync.svelte';
	import { getPlatform } from '$lib/native/platform.svelte';
	import TaskCard from './task-card.svelte';
	import EmptyState from './empty-state.svelte';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import { cn } from '$lib/utils';

	interface Props {
		tasks: Task[];
		class?: string;
	}

	let { tasks, class: className }: Props = $props();

	let scrollEl = $state<HTMLDivElement | null>(null);
	let pullDy = $state(0); // resisted pull distance for UX
	let touchStartY = 0;
	let touchPulling = false;
	let refreshing = $state(false);

	const PULL_FIRE = 64;
	const PULL_RESIST = 0.45;

	let nativePull = $derived(getPlatform().isNative);

	function resetPullState() {
		touchPulling = false;
		pullDy = 0;
	}

	function handleTouchStart(e: TouchEvent) {
		if (!nativePull || refreshing) return;
		const el = scrollEl;
		if (!el || el.scrollTop > 2) return;
		touchStartY = e.touches[0].clientY;
		touchPulling = true;
	}

	function handleTouchMove(e: TouchEvent) {
		if (!nativePull || !touchPulling || refreshing) return;
		const el = scrollEl;
		if (!el || el.scrollTop > 2) {
			resetPullState();
			return;
		}
		const dy = e.touches[0].clientY - touchStartY;
		if (dy <= 0) {
			pullDy = 0;
			return;
		}
		pullDy = Math.min(dy * PULL_RESIST, PULL_FIRE * 1.25);
	}

	async function handleTouchEnd() {
		if (!nativePull || refreshing) {
			resetPullState();
			return;
		}
		if (!touchPulling) {
			return;
		}
		touchPulling = false;
		const shouldSync = pullDy >= PULL_FIRE * 0.55;
		pullDy = 0;
		if (!shouldSync) return;

		refreshing = true;
		try {
			await syncWithServer();
		} finally {
			refreshing = false;
		}
	}

	function handleTouchCancel() {
		resetPullState();
	}
</script>

<div
	bind:this={scrollEl}
	class={cn('relative flex-1 overflow-y-auto p-4 pb-40 md:p-6', className)}
	id="task-container"
	style="touch-action: pan-y"
	ontouchstart={nativePull ? handleTouchStart : undefined}
	ontouchmove={nativePull ? handleTouchMove : undefined}
	ontouchend={nativePull ? handleTouchEnd : undefined}
	ontouchcancel={nativePull ? handleTouchCancel : undefined}
>
	{#if nativePull && (pullDy > 4 || refreshing)}
		<div
			class="pointer-events-none flex justify-center pb-2 text-muted-foreground"
			aria-hidden="true"
		>
			<RefreshCwIcon
				class={cn('h-5 w-5', refreshing ? 'animate-spin' : 'transition-opacity duration-150')}
				style={
					refreshing
						? undefined
						: `opacity: ${0.35 + Math.min(pullDy / PULL_FIRE, 1) * 0.65}; transform: translateY(${Math.min(pullDy, PULL_FIRE)}px)`
				}
			/>
		</div>
	{/if}
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
