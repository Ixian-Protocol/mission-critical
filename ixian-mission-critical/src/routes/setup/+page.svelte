<script lang="ts">
	import { goto } from '$app/navigation';
	import { superForm, defaults } from 'sveltekit-superforms';
	import { zod4, zod4Client } from 'sveltekit-superforms/adapters';
	import { setupFormSchema, type SetupFormData } from '$lib/schemas/config';
	import {
		setApiUrl,
		testApiConnection,
		saveNtfyConfig,
		testNtfyConnection
	} from '$lib/stores/config.svelte';
	import { requestPermissions } from '$lib/native';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import {
		Field,
		Label,
		Content,
		Description,
		Error as FieldError
	} from '$lib/components/ui/field/index.js';
	import ServerIcon from '@lucide/svelte/icons/server';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import CheckCircle2Icon from '@lucide/svelte/icons/check-circle-2';
	import XCircleIcon from '@lucide/svelte/icons/x-circle';
	import BellIcon from '@lucide/svelte/icons/bell';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	let connectionStatus = $state<'idle' | 'testing' | 'success' | 'error'>('idle');
	let connectionError = $state<string | null>(null);
	let ntfyConnectionStatus = $state<'idle' | 'testing' | 'success' | 'error'>('idle');
	let ntfyConnectionError = $state<string | null>(null);
	let notificationsOpen = $state(false);

	const { form, errors, enhance, submitting } = superForm(defaults(zod4(setupFormSchema)), {
		SPA: true,
		validators: zod4Client(setupFormSchema),
		async onUpdate({ form }) {
			if (!form.valid) return;

			const formData = form.data as SetupFormData;

			// Test the API connection if URL is provided
			if (formData.apiUrl) {
				connectionStatus = 'testing';
				connectionError = null;

				const result = await testApiConnection(formData.apiUrl);

				if (!result.success) {
					connectionStatus = 'error';
					connectionError = result.error || 'Failed to connect to server';
					return;
				}
			}

			// If notifications enabled, test ntfy connection
			if (formData.enableNotifications && formData.ntfyUrl) {
				ntfyConnectionStatus = 'testing';
				ntfyConnectionError = null;

				const ntfyResult = await testNtfyConnection(formData.ntfyUrl);

				if (!ntfyResult.success) {
					connectionStatus = 'idle';
					ntfyConnectionStatus = 'error';
					ntfyConnectionError = ntfyResult.error || 'Failed to connect to ntfy server';
					return;
				}

				ntfyConnectionStatus = 'success';

				// Request notification permissions
				const permissionGranted = await requestPermissions();
				if (!permissionGranted) {
					console.warn('Notification permission not granted');
				}

				// Save ntfy config
				await saveNtfyConfig(formData.ntfyUrl, true);
			} else {
				// Clear ntfy config if not enabled
				await saveNtfyConfig(null, false);
			}

			connectionStatus = 'success';

			// Save the API URL (empty string for offline mode)
			await setApiUrl(formData.apiUrl);

			// Navigate to home after brief delay to show success
			setTimeout(() => {
				goto('/');
			}, 500);
		}
	});

	async function handleTestConnection() {
		const apiUrl = ($form as SetupFormData).apiUrl;
		if (!apiUrl) return;

		connectionStatus = 'testing';
		connectionError = null;

		const result = await testApiConnection(apiUrl);

		if (result.success) {
			connectionStatus = 'success';
		} else {
			connectionStatus = 'error';
			connectionError = result.error || 'Failed to connect';
		}
	}

	async function handleTestNtfyConnection() {
		const ntfyUrl = ($form as SetupFormData).ntfyUrl;
		if (!ntfyUrl) return;

		ntfyConnectionStatus = 'testing';
		ntfyConnectionError = null;

		const result = await testNtfyConnection(ntfyUrl);

		if (result.success) {
			ntfyConnectionStatus = 'success';
		} else {
			ntfyConnectionStatus = 'error';
			ntfyConnectionError = result.error || 'Failed to connect';
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-background p-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="text-center">
			<div
				class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"
			>
				<ServerIcon class="h-6 w-6 text-primary" />
			</div>
			<Card.Title class="text-2xl">Get Started</Card.Title>
			<Card.Description>
				Configure your task server for syncing, or continue in offline mode.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<form method="POST" use:enhance class="space-y-4">
				<Field>
					<div class="flex items-center justify-between">
						<Label for="apiUrl">Server URL</Label>
						<span class="text-xs text-muted-foreground">Optional</span>
					</div>
					<Content>
						<Input
							id="apiUrl"
							name="apiUrl"
							type="url"
							placeholder="https://tasks.example.com"
							bind:value={($form as SetupFormData).apiUrl}
							aria-invalid={$errors.apiUrl ? 'true' : undefined}
						/>
					</Content>
					{#if $errors.apiUrl}
						<FieldError>{$errors.apiUrl}</FieldError>
					{/if}
					<Description>
						Leave empty for offline-only mode (no sync between devices)
					</Description>
				</Field>

				<!-- ntfy Push Notifications Section -->
				<Collapsible.Root bind:open={notificationsOpen} class="mt-2">
					<Collapsible.Trigger
						class="flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/50"
					>
						<div class="flex items-center gap-3">
							<BellIcon class="h-4 w-4 text-muted-foreground" />
							<div>
								<span class="text-sm font-medium">Push Notifications</span>
								<span class="ml-2 text-xs text-muted-foreground">Optional</span>
							</div>
						</div>
						<ChevronDownIcon
							class="h-4 w-4 text-muted-foreground transition-transform duration-200 {notificationsOpen
								? 'rotate-180'
								: ''}"
						/>
					</Collapsible.Trigger>

					<Collapsible.Content class="mt-3 space-y-4 px-1">
						<p class="text-sm text-muted-foreground">
							Receive task reminders via ntfy push notifications 15 minutes before due time.
						</p>

						<Field>
							<div class="flex items-center gap-3">
								<Checkbox
									id="enableNotifications"
									bind:checked={($form as SetupFormData).enableNotifications}
								/>
								<Label for="enableNotifications" class="cursor-pointer">
									Enable task reminders
								</Label>
							</div>
						</Field>

						{#if ($form as SetupFormData).enableNotifications}
							<Field>
								<Label for="ntfyUrl">ntfy Server URL</Label>
								<Content>
									<Input
										id="ntfyUrl"
										name="ntfyUrl"
										type="url"
										placeholder="https://ntfy.example.com"
										bind:value={($form as SetupFormData).ntfyUrl}
										aria-invalid={$errors.ntfyUrl ? 'true' : undefined}
									/>
								</Content>
								{#if $errors.ntfyUrl}
									<FieldError>{$errors.ntfyUrl}</FieldError>
								{/if}
								<Description>Your ntfy server (e.g., https://ntfy.sh or self-hosted)</Description>
							</Field>

							{#if ntfyConnectionStatus === 'success'}
								<div
									class="flex items-center gap-2 rounded-lg bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400"
								>
									<CheckCircle2Icon class="h-4 w-4" />
									<span>ntfy connection successful!</span>
								</div>
							{:else if ntfyConnectionStatus === 'error'}
								<div
									class="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400"
								>
									<XCircleIcon class="h-4 w-4" />
									<span>{ntfyConnectionError}</span>
								</div>
							{/if}

							<Button
								type="button"
								variant="outline"
								size="sm"
								onclick={handleTestNtfyConnection}
								disabled={!($form as SetupFormData).ntfyUrl ||
									ntfyConnectionStatus === 'testing' ||
									$submitting}
							>
								{#if ntfyConnectionStatus === 'testing'}
									<LoaderCircleIcon class="mr-2 h-4 w-4 animate-spin" />
									Testing ntfy...
								{:else}
									Test ntfy Connection
								{/if}
							</Button>
						{/if}
					</Collapsible.Content>
				</Collapsible.Root>

				{#if connectionStatus === 'success'}
					<div
						class="flex items-center gap-2 rounded-lg bg-green-500/10 p-3 text-sm text-green-500"
					>
						<CheckCircle2Icon class="h-4 w-4" />
						<span>Connection successful!</span>
					</div>
				{:else if connectionStatus === 'error'}
					<div class="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">
						<XCircleIcon class="h-4 w-4" />
						<span>{connectionError}</span>
					</div>
				{/if}

				<div class="flex gap-2">
					{#if ($form as SetupFormData).apiUrl}
						<Button
							type="button"
							variant="outline"
							class="flex-1"
							onclick={handleTestConnection}
							disabled={connectionStatus === 'testing' || $submitting}
						>
							{#if connectionStatus === 'testing'}
								<LoaderCircleIcon class="mr-2 h-4 w-4 animate-spin" />
								Testing...
							{:else}
								Test Connection
							{/if}
						</Button>
					{/if}
					<Button type="submit" class="flex-1" disabled={$submitting}>
						{#if $submitting}
							<LoaderCircleIcon class="mr-2 h-4 w-4 animate-spin" />
							{($form as SetupFormData).apiUrl ? 'Connecting...' : 'Starting...'}
						{:else}
							{($form as SetupFormData).apiUrl ? 'Connect' : 'Continue Offline'}
						{/if}
					</Button>
				</div>
			</form>
		</Card.Content>
		<Card.Footer class="justify-center text-xs text-muted-foreground">
			Your settings are stored locally on this device.
		</Card.Footer>
	</Card.Root>
</div>
