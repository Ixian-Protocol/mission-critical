<script lang="ts">
	import { getSyncState, syncWithServer } from '$lib/db/sync.svelte';
	import { getIsOnline } from '$lib/api/offline';
	import { getApiBaseUrl } from '$lib/api/client';
	import { Button } from '$lib/components/ui/button/index.js';
	import CloudIcon from '@lucide/svelte/icons/cloud';
	import CloudOffIcon from '@lucide/svelte/icons/cloud-off';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import CheckIcon from '@lucide/svelte/icons/check';
	import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
	import { cn } from '$lib/utils';

	let syncState = $derived(getSyncState());
	let isOnline = $derived(getIsOnline());
	let hasApiUrl = $derived(!!getApiBaseUrl());

	async function handleSync() {
		await syncWithServer();
	}
</script>

<div class="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
	{#if !hasApiUrl}
		<CloudOffIcon class="h-3.5 w-3.5" />
		<span>Local only</span>
	{:else if !isOnline}
		<CloudOffIcon class="h-3.5 w-3.5" />
		<span>Offline</span>
	{:else if syncState.isSyncing}
		<RefreshCwIcon class="h-3.5 w-3.5 animate-spin" />
		<span>Syncing...</span>
	{:else if syncState.error}
		<Button
			variant="ghost"
			size="sm"
			class="h-auto gap-1.5 px-2 py-1 text-xs text-destructive hover:text-destructive"
			onclick={handleSync}
		>
			<AlertCircleIcon class="h-3.5 w-3.5" />
			<span>Sync failed</span>
		</Button>
	{:else if syncState.pendingCount > 0}
		<Button
			variant="ghost"
			size="sm"
			class="h-auto gap-1.5 px-2 py-1 text-xs"
			onclick={handleSync}
		>
			<CloudIcon class="h-3.5 w-3.5" />
			<span>{syncState.pendingCount} pending</span>
		</Button>
	{:else}
		<CheckIcon class="h-3.5 w-3.5 text-green-500" />
		<span class="text-green-500">Synced</span>
	{/if}
</div>
