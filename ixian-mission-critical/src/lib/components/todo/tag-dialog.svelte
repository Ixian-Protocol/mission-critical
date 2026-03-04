<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Field, Label, Content, Error as FieldError } from '$lib/components/ui/field/index.js';
	import { createTag, updateTag, deleteTag, type Tag, TAG_COLORS } from '$lib/db';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	interface Props {
		/** Tag to edit (null for create mode) */
		tag?: Tag | null;
		/** Whether dialog is open */
		open?: boolean;
		/** Callback when dialog closes */
		onClose?: () => void;
	}

	let { tag = null, open = $bindable(false), onClose }: Props = $props();

	// Form state
	let name = $state('');
	let error = $state<string | null>(null);
	let saving = $state(false);
	let deleting = $state(false);

	// Computed
	let isEditMode = $derived(tag !== null);
	let title = $derived(isEditMode ? 'Edit Tag' : 'Create Tag');
	let previewColor = $derived(tag?.color ?? TAG_COLORS[0]);

	// Load values when dialog opens or tag changes
	$effect(() => {
		if (open) {
			name = tag?.name ?? '';
			error = null;
		}
	});

	async function handleSave() {
		const trimmedName = name.trim();

		if (!trimmedName) {
			error = 'Tag name is required';
			return;
		}

		if (trimmedName.length > 50) {
			error = 'Tag name must be 50 characters or less';
			return;
		}

		saving = true;
		error = null;

		try {
			if (isEditMode && tag) {
				await updateTag(tag.id, { name: trimmedName });
			} else {
				await createTag(trimmedName);
			}
			open = false;
			onClose?.();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save tag';
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		if (!tag) return;

		deleting = true;
		error = null;

		try {
			await deleteTag(tag.id);
			open = false;
			onClose?.();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to delete tag';
		} finally {
			deleting = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !saving) {
			e.preventDefault();
			handleSave();
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-sm">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			<Field>
				<Label for="tag-name">Tag Name</Label>
				<Content>
					<div class="flex items-center gap-2">
						<div
							class="h-4 w-4 shrink-0 rounded-full"
							style="background-color: {previewColor}"
						></div>
						<Input
							id="tag-name"
							type="text"
							placeholder="Enter tag name"
							bind:value={name}
							onkeydown={handleKeydown}
							maxlength={50}
							autofocus
						/>
					</div>
				</Content>
				{#if error}
					<FieldError>{error}</FieldError>
				{/if}
			</Field>

			{#if !isEditMode}
				<p class="text-xs text-muted-foreground">
					Color will be automatically assigned from the palette.
				</p>
			{/if}
		</div>

		<Dialog.Footer class="flex-col gap-2 sm:flex-row sm:justify-between">
			{#if isEditMode && tag && !tag.isDefault}
				<Button
					variant="destructive"
					size="sm"
					onclick={handleDelete}
					disabled={saving || deleting}
					class="w-full sm:w-auto"
				>
					{#if deleting}
						<LoaderCircleIcon class="mr-2 h-4 w-4 animate-spin" />
						Deleting...
					{:else}
						<Trash2Icon class="mr-2 h-4 w-4" />
						Delete Tag
					{/if}
				</Button>
			{:else}
				<div></div>
			{/if}

			<div class="flex gap-2">
				<Button variant="outline" onclick={() => (open = false)} disabled={saving || deleting}>
					Cancel
				</Button>
				<Button onclick={handleSave} disabled={saving || deleting || !name.trim()}>
					{#if saving}
						<LoaderCircleIcon class="mr-2 h-4 w-4 animate-spin" />
						Saving...
					{:else}
						{isEditMode ? 'Save' : 'Create'}
					{/if}
				</Button>
			</div>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
