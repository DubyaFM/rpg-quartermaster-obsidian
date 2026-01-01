import { ObsidianSettingsAdapter } from '../src/adapters/ObsidianSettingsAdapter';
import { RPGShopkeepSettings, DEFAULT_SETTINGS } from '@quartermaster/core/models/types';

// Mock Plugin
const mockPlugin = {
	saveData: vi.fn().mockResolvedValue(undefined),
	loadData: vi.fn().mockResolvedValue(null),
	manifest: { id: 'rpg-shopkeep', name: 'RPG Shopkeep', version: '1.0.0' }
} as any;

describe('ObsidianSettingsAdapter', () => {
	let adapter: ObsidianSettingsAdapter;
	let testSettings: RPGShopkeepSettings;

	beforeEach(() => {
		jest.clearAllMocks();
		testSettings = { ...DEFAULT_SETTINGS };
		adapter = new ObsidianSettingsAdapter(mockPlugin, testSettings);
	});

	describe('getSettings', () => {
		it('should return current settings', () => {
			const settings = adapter.getSettings();
			expect(settings).toEqual(testSettings);
		});

		it('should return same object reference', () => {
			const settings1 = adapter.getSettings();
			const settings2 = adapter.getSettings();
			expect(settings1).toBe(settings2);
		});
	});

	describe('saveSettings', () => {
		it('should save settings via plugin.saveData', async () => {
			const newSettings: RPGShopkeepSettings = {
				...testSettings,
				partyLevel: 10
			};

			await adapter.saveSettings(newSettings);

			expect(mockPlugin.saveData).toHaveBeenCalledWith(newSettings);
			expect(adapter.getSettings()).toEqual(newSettings);
		});

		it('should update internal settings reference', async () => {
			const newSettings: RPGShopkeepSettings = {
				...testSettings,
				shopsFolder: 'Custom-Shops'
			};

			await adapter.saveSettings(newSettings);

			const currentSettings = adapter.getSettings();
			expect(currentSettings.shopsFolder).toBe('Custom-Shops');
		});

		it('should trigger settings change callbacks', async () => {
			const callback = jest.fn();
			adapter.onSettingsChange(callback);

			const newSettings: RPGShopkeepSettings = {
				...testSettings,
				partyLevel: 15
			};

			await adapter.saveSettings(newSettings);

			expect(callback).toHaveBeenCalledWith(newSettings);
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should handle multiple callbacks', async () => {
			const callback1 = jest.fn();
			const callback2 = jest.fn();
			const callback3 = jest.fn();

			adapter.onSettingsChange(callback1);
			adapter.onSettingsChange(callback2);
			adapter.onSettingsChange(callback3);

			const newSettings: RPGShopkeepSettings = {
				...testSettings,
				partyLevel: 20
			};

			await adapter.saveSettings(newSettings);

			expect(callback1).toHaveBeenCalledWith(newSettings);
			expect(callback2).toHaveBeenCalledWith(newSettings);
			expect(callback3).toHaveBeenCalledWith(newSettings);
		});

		it('should catch errors in callbacks without failing', async () => {
			const errorCallback = jest.fn(() => {
				throw new Error('Callback error');
			});
			const successCallback = jest.fn();

			adapter.onSettingsChange(errorCallback);
			adapter.onSettingsChange(successCallback);

			const newSettings: RPGShopkeepSettings = {
				...testSettings,
				partyLevel: 8
			};

			// Should not throw
			await expect(adapter.saveSettings(newSettings)).resolves.toBeUndefined();

			// Success callback should still be called
			expect(successCallback).toHaveBeenCalled();
		});
	});

	describe('onSettingsChange', () => {
		it('should register callback', () => {
			const callback = jest.fn();
			adapter.onSettingsChange(callback);

			// Callback should not be called on registration
			expect(callback).not.toHaveBeenCalled();
		});

		it('should allow multiple callback registrations', () => {
			const callback1 = jest.fn();
			const callback2 = jest.fn();

			adapter.onSettingsChange(callback1);
			adapter.onSettingsChange(callback2);

			// No errors should occur
			expect(callback1).not.toHaveBeenCalled();
			expect(callback2).not.toHaveBeenCalled();
		});
	});

	describe('updateSettings', () => {
		it('should update settings and trigger callbacks', () => {
			const callback = jest.fn();
			adapter.onSettingsChange(callback);

			const newSettings: RPGShopkeepSettings = {
				...testSettings,
				itemsFolders: [{ path: 'Custom-Items', excludeSubfolders: false }]
			};

			adapter.updateSettings(newSettings);

			expect(adapter.getSettings()).toEqual(newSettings);
			expect(callback).toHaveBeenCalledWith(newSettings);
		});

		it('should not call plugin.saveData', () => {
			const newSettings: RPGShopkeepSettings = {
				...testSettings,
				partyLevel: 12
			};

			adapter.updateSettings(newSettings);

			expect(mockPlugin.saveData).not.toHaveBeenCalled();
		});
	});

	describe('custom config settings', () => {
		it('should support new custom config fields', async () => {
			const settingsWithCustomConfig: RPGShopkeepSettings = {
				...testSettings,
				customConfigFolderPath: 'Custom-Configs',
				useCustomShopConfig: true,
				useCustomServicesConfig: true,
				useCustomShopkeepConfig: false
			};

			await adapter.saveSettings(settingsWithCustomConfig);

			const saved = adapter.getSettings();
			expect(saved.customConfigFolderPath).toBe('Custom-Configs');
			expect(saved.useCustomShopConfig).toBe(true);
			expect(saved.useCustomServicesConfig).toBe(true);
			expect(saved.useCustomShopkeepConfig).toBe(false);
		});
	});
});
