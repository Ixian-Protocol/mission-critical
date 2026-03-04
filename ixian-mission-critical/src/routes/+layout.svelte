<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	// API offline support
	import { initOfflineSupport, stopOfflineSupport } from '$lib/api/offline';

	// Native capabilities
	import {
		initNativeCapabilities,
		stopNativeCapabilities,
		initNtfyIfConfigured
	} from '$lib/native';

	// App configuration
	import { initConfig, isSetupComplete, isSyncEnabled } from '$lib/stores/config.svelte';

	// Database and sync
	import { initDatabase, initDefaultTags, initSync, stopSync } from '$lib/db';

	let { children } = $props();

	// Track initialization state
	let initialized = $state(false);

	// Route guard - redirect to /setup if not configured
	$effect(() => {
		if (!initialized) return;

		const currentPath = $page.url.pathname;

		// Allow /setup route without config
		if (currentPath === '/setup') return;

		// Redirect to setup if not configured
		if (!isSetupComplete()) {
			goto('/setup');
		}
	});

	onMount(async () => {
		// Initialize app configuration first
		await initConfig();

		// Initialize offline support (network detection, request queue)
		initOfflineSupport();

		// Initialize native capabilities (platform, notifications)
		await initNativeCapabilities();

		// Initialize database
		await initDatabase();

		// Initialize default tags (seeds on first run, refreshes cache)
		await initDefaultTags();

		// Initialize sync engine only if API URL is configured
		if (isSetupComplete() && isSyncEnabled()) {
			initSync();
		}

		// Initialize ntfy subscription if configured
		if (isSetupComplete()) {
			await initNtfyIfConfigured();
		}

		// Mark as initialized to enable route guard
		initialized = true;
	});

	onDestroy(() => {
		stopSync();
		stopOfflineSupport();
		stopNativeCapabilities();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
