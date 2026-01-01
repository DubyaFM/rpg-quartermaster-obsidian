import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../services/EventBus';
import { SYSTEM_EVENTS } from '../models/events';

describe('EventBus', () => {
	let eventBus: EventBus;

	beforeEach(() => {
		eventBus = new EventBus();
	});

	describe('subscribe and emit', () => {
		it('should subscribe and receive events', () => {
			let received: any = null;

			eventBus.subscribe('test', (payload) => {
				received = payload;
			});

			eventBus.emit('test', { data: 'hello' });

			expect(received).toEqual({ data: 'hello' });
		});

		it('should support multiple subscribers', () => {
			const results: string[] = [];

			eventBus.subscribe('test', () => results.push('listener1'));
			eventBus.subscribe('test', () => results.push('listener2'));
			eventBus.subscribe('test', () => results.push('listener3'));

			eventBus.emit('test', {});

			expect(results).toEqual(['listener1', 'listener2', 'listener3']);
		});

		it('should not emit to other events', () => {
			let receivedA = false;
			let receivedB = false;

			eventBus.subscribe('eventA', () => { receivedA = true; });
			eventBus.subscribe('eventB', () => { receivedB = true; });

			eventBus.emit('eventA', {});

			expect(receivedA).toBe(true);
			expect(receivedB).toBe(false);
		});

		it('should handle emit with no subscribers gracefully', () => {
			expect(() => {
				eventBus.emit('nonexistent', { data: 'test' });
			}).not.toThrow();
		});

		it('should support typed payloads', () => {
			interface TestPayload {
				value: number;
				message: string;
			}

			let received: TestPayload | null = null;

			eventBus.subscribe<TestPayload>('typed', (payload) => {
				received = payload;
			});

			eventBus.emit<TestPayload>('typed', { value: 42, message: 'hello' });

			expect(received).toEqual({ value: 42, message: 'hello' });
		});
	});

	describe('unsubscribe', () => {
		it('should unsubscribe using the returned function', () => {
			let callCount = 0;

			const unsubscribe = eventBus.subscribe('test', () => {
				callCount++;
			});

			eventBus.emit('test', {});
			expect(callCount).toBe(1);

			unsubscribe();

			eventBus.emit('test', {});
			expect(callCount).toBe(1); // Should not increment
		});

		it('should unsubscribe using the unsubscribe method', () => {
			let callCount = 0;

			const callback = () => {
				callCount++;
			};

			eventBus.subscribe('test', callback);

			eventBus.emit('test', {});
			expect(callCount).toBe(1);

			eventBus.unsubscribe('test', callback);

			eventBus.emit('test', {});
			expect(callCount).toBe(1); // Should not increment
		});

		it('should only unsubscribe the specific listener', () => {
			const results: string[] = [];

			const listener1 = () => results.push('listener1');
			const listener2 = () => results.push('listener2');

			eventBus.subscribe('test', listener1);
			eventBus.subscribe('test', listener2);

			eventBus.unsubscribe('test', listener1);

			eventBus.emit('test', {});

			expect(results).toEqual(['listener2']);
		});
	});

	describe('error isolation (CRITICAL)', () => {
		it('should continue executing listeners even if one throws an error', () => {
			const results: string[] = [];
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			eventBus.subscribe('test', () => results.push('listener1'));
			eventBus.subscribe('test', () => {
				throw new Error('Listener 2 crashed!');
			});
			eventBus.subscribe('test', () => results.push('listener3'));

			eventBus.emit('test', {});

			// CRITICAL: listener3 must execute even though listener2 threw an error
			expect(results).toEqual(['listener1', 'listener3']);

			// Verify error was logged
			expect(consoleErrorSpy).toHaveBeenCalled();
			expect(consoleErrorSpy.mock.calls[0][0]).toContain('[EventBus]');

			consoleErrorSpy.mockRestore();
		});

		it('should log error details including stack trace', () => {
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			eventBus.subscribe('test', () => {
				throw new Error('Test error');
			});

			eventBus.emit('test', {});

			// Should log error message and stack trace
			expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
			expect(consoleErrorSpy.mock.calls[0][0]).toContain('[EventBus]');
			expect(consoleErrorSpy.mock.calls[0][0]).toContain('test');
			expect(consoleErrorSpy.mock.calls[1][0]).toContain('Stack trace');

			consoleErrorSpy.mockRestore();
		});

		it('should handle multiple errors from different listeners', () => {
			const results: string[] = [];
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			eventBus.subscribe('test', () => results.push('listener1'));
			eventBus.subscribe('test', () => {
				throw new Error('Error 1');
			});
			eventBus.subscribe('test', () => results.push('listener2'));
			eventBus.subscribe('test', () => {
				throw new Error('Error 2');
			});
			eventBus.subscribe('test', () => results.push('listener3'));

			eventBus.emit('test', {});

			// All successful listeners should execute
			expect(results).toEqual(['listener1', 'listener2', 'listener3']);

			// Both errors should be logged
			expect(consoleErrorSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

			consoleErrorSpy.mockRestore();
		});

		it('should handle non-Error objects being thrown', () => {
			const results: string[] = [];
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			eventBus.subscribe('test', () => results.push('listener1'));
			eventBus.subscribe('test', () => {
				throw 'String error';
			});
			eventBus.subscribe('test', () => results.push('listener2'));

			eventBus.emit('test', {});

			expect(results).toEqual(['listener1', 'listener2']);
			expect(consoleErrorSpy).toHaveBeenCalled();

			consoleErrorSpy.mockRestore();
		});
	});

	describe('clear', () => {
		it('should remove all listeners', () => {
			let callCount = 0;

			eventBus.subscribe('test1', () => callCount++);
			eventBus.subscribe('test2', () => callCount++);

			eventBus.clear();

			eventBus.emit('test1', {});
			eventBus.emit('test2', {});

			expect(callCount).toBe(0);
		});
	});

	describe('getListenerCount', () => {
		it('should return the number of listeners for an event', () => {
			expect(eventBus.getListenerCount('test')).toBe(0);

			eventBus.subscribe('test', () => {});
			expect(eventBus.getListenerCount('test')).toBe(1);

			eventBus.subscribe('test', () => {});
			expect(eventBus.getListenerCount('test')).toBe(2);

			eventBus.subscribe('other', () => {});
			expect(eventBus.getListenerCount('test')).toBe(2);
			expect(eventBus.getListenerCount('other')).toBe(1);
		});
	});

	describe('system events integration', () => {
		it('should work with SYSTEM_EVENTS constants', () => {
			let received: any = null;

			eventBus.subscribe(SYSTEM_EVENTS.TIME_ADVANCED, (payload) => {
				received = payload;
			});

			const testPayload = {
				previousDay: 140,
				newDay: 147,
				daysPassed: 7
			};

			eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, testPayload);

			expect(received).toEqual(testPayload);
		});

		it('should support multiple system events', () => {
			const results: string[] = [];

			eventBus.subscribe(SYSTEM_EVENTS.TIME_ADVANCED, () => results.push('time'));
			eventBus.subscribe(SYSTEM_EVENTS.CALENDAR_CHANGED, () => results.push('calendar'));
			eventBus.subscribe(SYSTEM_EVENTS.TRANSACTION_CREATED, () => results.push('transaction'));

			eventBus.emit(SYSTEM_EVENTS.TIME_ADVANCED, {});
			eventBus.emit(SYSTEM_EVENTS.CALENDAR_CHANGED, {});

			expect(results).toEqual(['time', 'calendar']);
		});
	});
});
