# Mission Critical (Frontend)

SvelteKit + Capacitor client for the Mission Critical offline-first todo app.

See the [root README](../README.md) for architecture, Docker Compose, API surface, and end-to-end setup.

## Scripts

```bash
pnpm install
pnpm dev          # Vite dev server
pnpm build        # Static production build
pnpm test         # Vitest
pnpm check        # svelte-check
pnpm lint         # Prettier + ESLint
pnpm sync         # Capacitor sync
```

## Notes

- First-run configuration lives on `/setup` (Server URL optional for offline-only).
- Local data is stored in IndexedDB via Dexie; sync runs when a Server URL is set.
- ntfy topic is generated per install — copy it into the backend `NTFY_TOPIC`.
