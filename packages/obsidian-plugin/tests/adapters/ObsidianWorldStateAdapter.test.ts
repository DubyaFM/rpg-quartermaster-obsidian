/**
 * Tests for ObsidianWorldStateAdapter
 *
 * Verifies:
 * - Loading and saving world state
 * - Backup creation and restoration
 * - Graceful handling of missing files
 * - Path configuration
 * - State validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObsidianWorldStateAdapter } from '../../src/adapters/ObsidianWorldStateAdapter';
import { WorldState } from '@quartermaster/core/models/worldStateTypes';
import { App, TFile } from 'obsidian';

describe('ObsidianWorldStateAdapter', () => {
	let adapter: ObsidianWorldStateAdapter;
	let mockApp: App;
	let mockFileStore: Map<string, string>;

	beforeEach(() => {
		// Create mock file storage
		mockFileStore = new Map();

		// Mock app with vault
		mockApp = {
			vault: {
				getAbstractFileByPath: vi.fn((path: string) => {
					if (mockFileStore.has(path)) {
						return { path } as TFile;
					}
					return null;
				}),
				read: vi.fn((file: TFile) => {
					return Promise.resolve(mockFileStore.get(file.path) || '');
				}),
				modify: vi.fn((file: TFile, content: string) => {
					mockFileStore.set(file.path, content);
					return Promise.resolve();
				}),
				create: vi.fn((path: string, content: string) => {
					mockFileStore.set(path, content);
					return Promise.resolve({ path } as TFile);
				}),
				delete: vi.fn((file: TFile) => {
					mockFileStore.delete(file.path);
					return Promise.resolve();
				}),
				createFolder: vi.fn((path: string) => {
					// Mock folder creation
					return Promise.resolve();
				})
			}
		} as any;

		// Create adapter with default path
		adapter = new ObsidianWorldStateAdapter(mockApp);
	});

	describe('Constructor and Path Configuration', () => {
		it('should use default path when none provided', () => {
			const defaultAdapter = new ObsidianWorldStateAdapter(mockApp);
			expect(defaultAdapter.getStoragePath()).toBe('.quartermaster/world-state.json');
		});

		it('should use custom path when provided', () => {
			const customAdapter = new ObsidianWorldStateAdapter(mockApp, 'custom/path/world.json');
			expect(customAdapter.getStoragePath()).toBe('custom/path/world.json');
		});

		it('should allow updating storage path', () => {
			adapter.setStoragePath('new/path/state.json');
			expect(adapter.getStoragePath()).toBe('new/path/state.json');
		});
	});

	describe('loadWorldState', () => {
		it('should return null when no state file exists', async () => {
			const state = await adapter.loadWorldState();
			expect(state).toBeNull();
		});

		it('should load valid world state from file', async () => {
			const mockState: WorldState = {
				version: 1,
				activeCalendarId: 'harptos',
				clock: { currentDay: 10, timeOfDay: 480 },
				chainStates: {},
				overrides: [],
				moduleToggles: {}
			};

			mockFileStore.set('.quartermaster/world-state.json', JSON.stringify(mockState));

			const state = await adapter.loadWorldState();
			expect(state).not.toBeNull();
			expect(state?.version).toBe(1);
			expect(state?.activeCalendarId).toBe('harptos');
			expect(state?.clock.currentDay).toBe(10);
		});

		it('should return null when state format is invalid', async () => {
			mockFileStore.set('.quartermaster/world-state.json', JSON.stringify({ invalid: 'data' }));

			const state = await adapter.loadWorldState();
			expect(state).toBeNull();
		});

		it('should throw error when JSON is malformed', async () => {
			mockFileStore.set('.quartermaster/world-state.json', 'invalid json {{{');

			await expect(adapter.loadWorldState()).rejects.toThrow();
		});
	});

	describe('saveWorldState', () => {
		it('should create new file when state does not exist', async () => {
			const mockState: WorldState = {
				version: 1,
				activeCalendarId: 'harptos',
				clock: { currentDay: 5, timeOfDay: 360 },
				chainStates: {},
				overrides: [],
				moduleToggles: {}
			};

			await adapter.saveWorldState(mockState);

			expect(mockApp.vault.create).toHaveBeenCalledWith(
				'.quartermaster/world-state.json',
				expect.stringContaining('"version": 1')
			);
		});

		it('should update existing file when state exists', async () => {
			const initialState: WorldState = {
				version: 1,
				activeCalendarId: 'harptos',
				clock: { currentDay: 5, timeOfDay: 360 },
				chainStates: {},
				overrides: [],
				moduleToggles: {}
			};

			mockFileStore.set('.quartermaster/world-state.json', JSON.stringify(initialState));

			const updatedState: WorldState = {
				...initialState,
				clock: { currentDay: 10, timeOfDay: 480 }
			};

			await adapter.saveWorldState(updatedState);

			expect(mockApp.vault.modify).toHaveBeenCalled();
		});

		it('should add lastSaved timestamp', async () => {
			const mockState: WorldState = {
				version: 1,
				activeCalendarId: 'harptos',
				clock: { currentDay: 5, timeOfDay: 360 },
				chainStates: {},
				overrides: [],
				moduleToggles: {}
			};

			await adapter.saveWorldState(mockState);

			expect(mockState.lastSaved).toBeDefined();
		});

		it('should create backup before saving', async () => {
			const initialState: WorldState = {
				version: 1,
				activeCalendarId: 'harptos',
				clock: { currentDay: 5, timeOfDay: 360 },
				chainStates: {},
				overrides: [],
				moduleToggles: {}
			};

			mockFileStore.set('.quartermaster/world-state.json', JSON.stringify(initialState));

			const updatedState: WorldState = {
				...initialState,
				clock: { currentDay: 10, timeOfDay: 480 }
			};

			await adapter.saveWorldState(updatedState);

			// Backup should be created
			expect(mockFileStore.has('.quartermaster/world-state.backup.json')).toBe(true);
		});
	});

	describe('restoreWorldStateFromBackup', () => {
		it('should return null when no backup exists', async () => {
			const state = await adapter.restoreWorldStateFromBackup();
			expect(state).toBeNull();
		});

		it('should restore state from backup file', async () => {
			const backupState: WorldState = {
				version: 1,
				activeCalendarId: 'harptos',
				clock: { currentDay: 5, timeOfDay: 360 },
				chainStates: {},
				overrides: [],
				moduleToggles: {}
			};

			mockFileStore.set('.quartermaster/world-state.backup.json', JSON.stringify(backupState));

			const state = await adapter.restoreWorldStateFromBackup();
			expect(state).not.toBeNull();
			expect(state?.clock.currentDay).toBe(5);
		});

		it('should return null when backup format is invalid', async () => {
			mockFileStore.set('.quartermaster/world-state.backup.json', JSON.stringify({ invalid: 'data' }));

			const state = await adapter.restoreWorldStateFromBackup();
			expect(state).toBeNull();
		});
	});

	describe('hasWorldState', () => {
		it('should return false when state does not exist', async () => {
			const exists = await adapter.hasWorldState();
			expect(exists).toBe(false);
		});

		it('should return true when state exists', async () => {
			mockFileStore.set('.quartermaster/world-state.json', '{}');

			const exists = await adapter.hasWorldState();
			expect(exists).toBe(true);
		});
	});

	describe('deleteWorldState', () => {
		it('should delete both primary and backup files', async () => {
			mockFileStore.set('.quartermaster/world-state.json', '{}');
			mockFileStore.set('.quartermaster/world-state.backup.json', '{}');

			await adapter.deleteWorldState();

			expect(mockFileStore.has('.quartermaster/world-state.json')).toBe(false);
			expect(mockFileStore.has('.quartermaster/world-state.backup.json')).toBe(false);
		});

		it('should not throw when files do not exist', async () => {
			await expect(adapter.deleteWorldState()).resolves.not.toThrow();
		});
	});

	describe('Campaign-Specific Paths', () => {
		it('should support campaign-specific world state paths', () => {
			const campaignAdapter = new ObsidianWorldStateAdapter(
				mockApp,
				'Quartermaster/Campaigns/CurseOfStrahd/world-state.json'
			);

			expect(campaignAdapter.getStoragePath()).toBe(
				'Quartermaster/Campaigns/CurseOfStrahd/world-state.json'
			);
		});

		it('should support shared world state across campaigns', () => {
			const sharedAdapter = new ObsidianWorldStateAdapter(
				mockApp,
				'Quartermaster/Worlds/Forgotten-Realms/world-state.json'
			);

			expect(sharedAdapter.getStoragePath()).toBe(
				'Quartermaster/Worlds/Forgotten-Realms/world-state.json'
			);
		});
	});

	describe('State Validation', () => {
		it('should validate required fields', async () => {
			const invalidStates = [
				{ version: 1 }, // Missing other fields
				{ clock: { currentDay: 0, timeOfDay: 0 } }, // Missing version
				{ version: 1, clock: { currentDay: 0 } }, // Missing timeOfDay
				{ version: 1, clock: { currentDay: 0, timeOfDay: 0 } }, // Missing activeCalendarId
			];

			for (const invalidState of invalidStates) {
				mockFileStore.set('.quartermaster/world-state.json', JSON.stringify(invalidState));
				const state = await adapter.loadWorldState();
				expect(state).toBeNull();
			}
		});

		it('should accept valid state with all required fields', async () => {
			const validState: WorldState = {
				version: 1,
				activeCalendarId: 'harptos',
				clock: { currentDay: 10, timeOfDay: 480 },
				chainStates: {
					'weather-chain': {
						currentStateName: 'Clear',
						stateEnteredDay: 5,
						stateDurationDays: 3,
						rngState: 12345,
						stateEndDay: 8
					}
				},
				overrides: [
					{
						id: 'override-1',
						eventId: 'weather-chain',
						scope: 'one_off',
						forcedStateName: 'Storm',
						forcedDuration: 2,
						appliedDay: 10,
						expiresDay: 12,
						notes: 'Manual storm for dramatic effect',
						createdAt: '2025-01-10T12:00:00Z'
					}
				],
				moduleToggles: {
					weather: true,
					economy: false
				}
			};

			mockFileStore.set('.quartermaster/world-state.json', JSON.stringify(validState));

			const state = await adapter.loadWorldState();
			expect(state).not.toBeNull();
			expect(state?.chainStates['weather-chain']?.currentStateName).toBe('Clear');
			expect(state?.overrides).toHaveLength(1);
			expect(state?.moduleToggles.weather).toBe(true);
		});
	});
});
