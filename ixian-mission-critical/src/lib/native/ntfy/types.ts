/**
 * ntfy notification types
 */

/**
 * ntfy notification message from server
 */
export interface NtfyMessage {
	id: string;
	time: number;
	expires?: number;
	event: 'message' | 'open' | 'keepalive' | 'poll_request';
	topic: string;
	title?: string;
	message?: string;
	priority?: 1 | 2 | 3 | 4 | 5; // min, low, default, high, max
	tags?: string[];
	click?: string;
	actions?: NtfyAction[];
	attachment?: NtfyAttachment;
}

/**
 * ntfy action button
 */
export interface NtfyAction {
	action: 'view' | 'http' | 'broadcast';
	label: string;
	url?: string;
	method?: string;
	headers?: Record<string, string>;
	body?: string;
	intent?: string;
	extras?: Record<string, string>;
	clear?: boolean;
}

/**
 * ntfy attachment
 */
export interface NtfyAttachment {
	name: string;
	url: string;
	type?: string;
	size?: number;
	expires?: number;
}

/**
 * ntfy subscription state
 */
export interface NtfyState {
	status: 'disconnected' | 'connecting' | 'connected' | 'error';
	lastConnected: number | null;
	lastError: string | null;
	reconnectAttempts: number;
}
