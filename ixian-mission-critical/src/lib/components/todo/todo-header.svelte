<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { getFilter, getTagFilter, getFormattedDate, getFilterTitle } from '$lib/stores/todo.svelte';
	import SettingsDialog from '$lib/components/settings-dialog.svelte';
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';

	let filter = $derived(getFilter());
	let tagFilter = $derived(getTagFilter());
	let title = $derived(getFilterTitle(filter, tagFilter));
	let dateDisplay = $derived(getFormattedDate());
</script>

<header
	class="flex min-h-16 shrink-0 items-center justify-between border-b border-border bg-background/50 px-6 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur"
>
	<div class="flex items-center gap-2">
		<Sidebar.Trigger class="-ml-1" />
		<Separator orientation="vertical" class="mr-2 data-[orientation=vertical]:h-4" />
		<div>
			<h1 class="text-xl font-medium tracking-tight text-foreground">{title}</h1>
			<p class="mt-0.5 text-xs text-muted-foreground">{dateDisplay}</p>
		</div>
	</div>
	<div class="flex items-center gap-2">
		<SettingsDialog />
	</div>
</header>
