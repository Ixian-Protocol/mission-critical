/**
 * Tiny leveled logger. Debug output is suppressed outside Vite dev mode.
 */

type LogMethod = (...args: unknown[]) => void;

const isDev = import.meta.env.DEV;

function noop(): void {
	/* production no-op */
}

export const logger = {
	debug: (isDev ? console.debug.bind(console) : noop) as LogMethod,
	info: console.info.bind(console) as LogMethod,
	warn: console.warn.bind(console) as LogMethod,
	error: console.error.bind(console) as LogMethod
};
