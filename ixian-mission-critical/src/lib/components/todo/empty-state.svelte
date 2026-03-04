<script lang="ts">
	import CheckCircle2Icon from '@lucide/svelte/icons/check-circle-2';

	interface Props {
		title?: string;
		description?: string;
	}

	let { title = 'All caught up!', description = 'Add a new task below' }: Props = $props();
</script>

<div class="flex h-full flex-col items-center justify-center text-muted-foreground">
	<div
		class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted/50"
	>
		<CheckCircle2Icon class="h-8 w-8 text-muted-foreground/60" />
	</div>
	<p class="text-sm">{title}</p>
	<p class="mt-1 text-xs text-muted-foreground/60">{description}</p>
</div>
