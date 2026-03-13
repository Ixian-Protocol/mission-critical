<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
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
	import {
		getApiUrl,
		getNtfyUrl,
		isNotificationsEnabled,
		setApiUrl,
		saveNtfyConfig,
		testApiConnection,
		testNtfyConnection
	} from '$lib/stores/config.svelte';
	import { requestPermissions } from '$lib/native';
	import { initSync, stopSync } from '$lib/db';
	import { initNtfy, stopNtfy } from '$lib/native/ntfy';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import CheckCircle2Icon from '@lucide/svelte/icons/circle-check';
	import XCircleIcon from '@lucide/svelte/icons/circle-x';
	import BellIcon from '@lucide/svelte/icons/bell';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	let open = $state(false);

	// Form state - initialized from current config
	let apiUrl = $state('');
	let enableNotifications = $state(false);
	let ntfyUrl = $state('');

	// Connection status
	let apiConnectionStatus = $state<'idle' | 'testing' | 'success' | 'error'>('idle');
	let apiConnectionError = $state<string | null>(null);
	let ntfyConnectionStatus = $state<'idle' | 'testing' | 'success' | 'error'>('idle');
	let ntfyConnectionError = $state<string | null>(null);
	let saving = $state(false);
	let notificationsOpen = $state(false);

	// Load current values when dialog opens
	function loadCurrentValues() {
		apiUrl = getApiUrl() ?? '';
		ntfyUrl = getNtfyUrl() ?? '';
		enableNotifications = isNotificationsEnabled();
		// Expand notifications section if already enabled
		notificationsOpen = enableNotifications;
		// Reset status
		apiConnectionStatus = 'idle';
		apiConnectionError = null;
		ntfyConnectionStatus = 'idle';
		ntfyConnectionError = null;
	}

	async function handleTestApiConnection() {
		if (!apiUrl) return;

		apiConnectionStatus = 'testing';
		apiConnectionError = null;

		const result = await testApiConnection(apiUrl);

		if (result.success) {
			apiConnectionStatus = 'success';
		} else {
			apiConnectionStatus = 'error';
			apiConnectionError = result.error || 'Failed to connect';
		}
	}

	async function handleTestNtfyConnection() {
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

	async function handleSave() {
		saving = true;

		try {
			const currentApiUrl = getApiUrl() ?? '';
			const currentNtfyUrl = getNtfyUrl() ?? '';
			const currentNotificationsEnabled = isNotificationsEnabled();

			// Test API connection if URL provided and changed
			if (apiUrl && apiUrl !== currentApiUrl) {
				apiConnectionStatus = 'testing';
				const result = await testApiConnection(apiUrl);
				if (!result.success) {
					apiConnectionStatus = 'error';
					apiConnectionError = result.error || 'Failed to connect to server';
					saving = false;
					return;
				}
				apiConnectionStatus = 'success';
			}

			// Test ntfy connection if enabled and URL provided
			if (enableNotifications && ntfyUrl && ntfyUrl !== currentNtfyUrl) {
				ntfyConnectionStatus = 'testing';
				const result = await testNtfyConnection(ntfyUrl);
				if (!result.success) {
					ntfyConnectionStatus = 'error';
					ntfyConnectionError = result.error || 'Failed to connect to ntfy server';
					saving = false;
					return;
				}
				ntfyConnectionStatus = 'success';
			}

			// Request notification permissions if enabling
			console.log('[Settings] Checking if permission request needed:', { enableNotifications, currentNotificationsEnabled });
			if (enableNotifications && !currentNotificationsEnabled) {
				console.log('[Settings] Requesting notification permissions...');
				const granted = await requestPermissions();
				console.log('[Settings] Permission granted:', granted);
				if (!granted) {
					console.warn('Notification permission not granted');
				}
			}

			// Save configuration
			await setApiUrl(apiUrl);
			await saveNtfyConfig(enableNotifications ? ntfyUrl : null, enableNotifications);

			// Restart sync engine if API URL changed
			if (apiUrl !== currentApiUrl) {
				stopSync();
				if (apiUrl) {
					initSync();
				}
			}

			// Restart ntfy subscription if config changed
			if (enableNotifications !== currentNotificationsEnabled || ntfyUrl !== currentNtfyUrl) {
				stopNtfy();
				if (enableNotifications && ntfyUrl) {
					await initNtfy();
				}
			}

			open = false;
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => isOpen && loadCurrentValues()}>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="icon" class="size-7">
				<SettingsIcon class="h-4 w-4" />
				<span class="sr-only">Settings</span>
			</Button>
		{/snippet}
	</Dialog.Trigger>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>Settings</Dialog.Title>
			<Dialog.Description>
				Configure your server connection and notification preferences.
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			<!-- Server URL -->
			<Field>
				<div class="flex items-center justify-between">
					<Label for="settings-apiUrl">Server URL</Label>
					<span class="text-xs text-muted-foreground">Optional</span>
				</div>
				<Content>
					<Input
						id="settings-apiUrl"
						type="url"
						placeholder="https://tasks.example.com"
						bind:value={apiUrl}
					/>
				</Content>
				<Description>Leave empty for offline-only mode (no sync)</Description>
			</Field>

			{#if apiUrl}
				{#if apiConnectionStatus === 'success'}
					<div
						class="flex items-center gap-2 rounded-lg bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400"
					>
						<CheckCircle2Icon class="h-4 w-4" />
						<span>Server connection successful!</span>
					</div>
				{:else if apiConnectionStatus === 'error'}
					<div
						class="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400"
					>
						<XCircleIcon class="h-4 w-4" />
						<span>{apiConnectionError}</span>
					</div>
				{/if}

				<Button
					type="button"
					variant="outline"
					size="sm"
					onclick={handleTestApiConnection}
					disabled={!apiUrl || apiConnectionStatus === 'testing' || saving}
				>
					{#if apiConnectionStatus === 'testing'}
						<LoaderCircleIcon class="mr-2 h-4 w-4 animate-spin" />
						Testing...
					{:else}
						Test Connection
					{/if}
				</Button>
			{/if}

			<!-- Push Notifications -->
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
						Receive task reminders via ntfy 15 minutes before due time.
					</p>

					<Field>
						<div class="flex items-center gap-3">
							<Checkbox id="settings-enableNotifications" bind:checked={enableNotifications} />
							<Label for="settings-enableNotifications" class="cursor-pointer">
								Enable task reminders
							</Label>
						</div>
					</Field>

					{#if enableNotifications}
						<Field>
							<Label for="settings-ntfyUrl">ntfy Server URL</Label>
							<Content>
								<Input
									id="settings-ntfyUrl"
									type="url"
									placeholder="https://ntfy.example.com"
									bind:value={ntfyUrl}
								/>
							</Content>
							<Description>Your ntfy server (e.g., https://ntfy.sh)</Description>
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
							disabled={!ntfyUrl || ntfyConnectionStatus === 'testing' || saving}
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
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)} disabled={saving}>Cancel</Button>
			<Button onclick={handleSave} disabled={saving}>
				{#if saving}
					<LoaderCircleIcon class="mr-2 h-4 w-4 animate-spin" />
					Saving...
				{:else}
					Save Changes
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
