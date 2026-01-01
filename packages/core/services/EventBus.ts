/**
 * EventBus - Central event dispatcher using observer pattern
 *
 * Provides pub/sub mechanism for event-driven architecture.
 * CRITICAL: Each listener is isolated with error handling to prevent
 * one faulty listener from breaking the entire event chain.
 *
 * @example
 * const bus = new EventBus();
 *
 * // Subscribe to event
 * const unsubscribe = bus.subscribe('TimeAdvanced', (payload) => {
 *   console.log('Time advanced to day', payload.newDay);
 * });
 *
 * // Emit event
 * bus.emit('TimeAdvanced', { newDay: 147, daysPassed: 7 });
 *
 * // Cleanup
 * unsubscribe();
 */
export class EventBus {
	private listeners: Map<string, Set<(payload: any) => void>> = new Map();

	/**
	 * Subscribe to an event
	 *
	 * @param event Event name (e.g., "TimeAdvanced")
	 * @param callback Function to call when event fires
	 * @returns Unsubscribe function
	 */
	subscribe<T = any>(event: string, callback: (payload: T) => void): () => void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(callback);

		// Return unsubscribe function
		return () => this.unsubscribe(event, callback);
	}

	/**
	 * Unsubscribe from an event
	 *
	 * @param event Event name
	 * @param callback The callback function to remove
	 */
	unsubscribe(event: string, callback: (payload: any) => void): void {
		const callbacks = this.listeners.get(event);
		if (callbacks) {
			callbacks.delete(callback);
		}
	}

	/**
	 * Emit an event to all subscribers
	 *
	 * CRITICAL: Each listener is wrapped in try/catch for error isolation.
	 * One listener error must NOT stop other listeners from executing.
	 *
	 * @param event Event name
	 * @param payload Event data
	 */
	emit<T = any>(event: string, payload: T): void {
		const callbacks = this.listeners.get(event);
		if (!callbacks || callbacks.size === 0) {
			return;
		}

		// CRITICAL: Isolate each listener with try/catch
		// One listener error must NOT break the entire event chain
		for (const callback of callbacks) {
			try {
				callback(payload);
			} catch (error) {
				// Log error but continue to next listener
				console.error(`[EventBus] Error in listener for event "${event}":`, error);

				// Optional: Track failed listeners for debugging
				if (error instanceof Error) {
					console.error(`  Stack trace:`, error.stack);
				}
			}
		}
	}

	/**
	 * Clear all listeners (for testing/cleanup)
	 */
	clear(): void {
		this.listeners.clear();
	}

	/**
	 * Get listener count for an event (for debugging)
	 *
	 * @param event Event name
	 * @returns Number of listeners subscribed to this event
	 */
	getListenerCount(event: string): number {
		return this.listeners.get(event)?.size || 0;
	}
}
