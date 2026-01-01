/**
 * RenownConfigService
 *
 * Service for loading and managing renown rank ladder configurations.
 * Provides default ladders from renownLadders.yaml and supports custom per-entity ladders.
 */

import { RenownRank } from '../models/types';

// Raw YAML structure for renown ladders config
export interface RawRenownLaddersConfig {
	location?: Record<string, RenownRank[]>;
	faction?: Record<string, RenownRank[]>;
	npc?: Record<string, RenownRank[]>;
	special?: Record<string, RenownRank[]>;
}

/**
 * Renown configuration service
 * Loads and caches rank ladders from configuration
 */
export class RenownConfigService {
	private config: RawRenownLaddersConfig | null = null;
	private configLoader: () => Promise<any>;

	constructor(configLoader: () => Promise<any>) {
		this.configLoader = configLoader;
	}

	/**
	 * Load renown ladders configuration
	 */
	async loadConfig(): Promise<void> {
		try {
			this.config = await this.configLoader();
			if (!this.config) {
				console.warn('RenownConfigService: No renownLadders.yaml found, using defaults');
				this.config = this.getDefaultConfig();
			}
		} catch (error) {
			console.error('RenownConfigService: Error loading config:', error);
			this.config = this.getDefaultConfig();
		}
	}

	/**
	 * Get all available location ladder types
	 */
	getLocationLadderTypes(): string[] {
		if (!this.config?.location) return ['default'];
		return Object.keys(this.config.location);
	}

	/**
	 * Get all available faction ladder types
	 */
	getFactionLadderTypes(): string[] {
		if (!this.config?.faction) return ['positive'];
		return Object.keys(this.config.faction);
	}

	/**
	 * Get all available NPC ladder types
	 */
	getNPCLadderTypes(): string[] {
		if (!this.config?.npc) return ['default'];
		return Object.keys(this.config.npc);
	}

	/**
	 * Get a specific location rank ladder by type
	 */
	getLocationLadder(type: string): RenownRank[] | null {
		if (!this.config?.location) return null;
		return this.config.location[type] || null;
	}

	/**
	 * Get a specific faction rank ladder by type
	 */
	getFactionLadder(type: string): RenownRank[] | null {
		if (!this.config?.faction) return null;
		return this.config.faction[type] || null;
	}

	/**
	 * Get a specific NPC rank ladder by type
	 */
	getNPCLadder(type: string): RenownRank[] | null {
		if (!this.config?.npc) return null;
		return this.config.npc[type] || null;
	}

	/**
	 * Get a special rank ladder by key
	 */
	getSpecialLadder(key: string): RenownRank[] | null {
		if (!this.config?.special) return null;
		return this.config.special[key] || null;
	}

	/**
	 * Get default configuration (fallback when YAML not found)
	 */
	private getDefaultConfig(): RawRenownLaddersConfig {
		return {
			location: {
				default: [
					{ threshold: 0, title: 'Stranger' },
					{ threshold: 5, title: 'Known Face' },
					{ threshold: 10, title: 'Trusted Visitor', perk: 'Minor discounts from local merchants' },
					{ threshold: 20, title: 'Respected Resident', perk: 'Access to local guilds and organizations' },
					{ threshold: 30, title: 'Pillar of the Community', perk: 'Free lodging and local support' },
					{ threshold: 50, title: 'Hero of [Location]', perk: 'Significant influence and favors' }
				],
				city: [
					{ threshold: 0, title: 'Outsider' },
					{ threshold: 3, title: 'Visitor' },
					{ threshold: 10, title: 'Resident', perk: 'Access to city services' },
					{ threshold: 25, title: 'Notable Citizen', perk: 'Recognized by city officials' },
					{ threshold: 50, title: 'Distinguished Citizen', perk: 'Audience with city leaders' },
					{ threshold: 100, title: 'Hero of the City', perk: 'City-wide recognition and support' }
				]
			},
			faction: {
				positive: [
					{ threshold: 0, title: 'Stranger' },
					{ threshold: 3, title: 'Acquaintance' },
					{ threshold: 10, title: 'Agent', perk: 'Minor faction support' },
					{ threshold: 25, title: 'Operative', perk: 'Access to faction resources' },
					{ threshold: 50, title: 'Champion', perk: 'Significant faction backing and influence' }
				],
				negative: [
					{ threshold: 0, title: 'Neutral' },
					{ threshold: -10, title: 'Suspect' },
					{ threshold: -25, title: 'Wanted', perk: 'Faction actively opposes party' },
					{ threshold: -50, title: 'Enemy', perk: 'Hunted by faction assassins' }
				],
				combined: [
					{ threshold: -50, title: 'Enemy', perk: 'Hunted by faction assassins' },
					{ threshold: -25, title: 'Wanted', perk: 'Faction actively opposes party' },
					{ threshold: -10, title: 'Suspect' },
					{ threshold: 0, title: 'Neutral' },
					{ threshold: 3, title: 'Acquaintance' },
					{ threshold: 10, title: 'Agent', perk: 'Minor faction support' },
					{ threshold: 25, title: 'Operative', perk: 'Access to faction resources' },
					{ threshold: 50, title: 'Champion', perk: 'Significant faction backing and influence' }
				]
			},
			npc: {
				default: [
					{ threshold: -50, title: 'Mortal Enemy' },
					{ threshold: -25, title: 'Enemy' },
					{ threshold: -10, title: 'Disliked' },
					{ threshold: 0, title: 'Stranger' },
					{ threshold: 5, title: 'Acquaintance' },
					{ threshold: 15, title: 'Friend', perk: 'Will offer assistance' },
					{ threshold: 30, title: 'Trusted Friend', perk: 'Will take risks to help' },
					{ threshold: 50, title: 'Close Ally', perk: 'Unwavering loyalty' }
				]
			}
		};
	}

	/**
	 * Clear cached configuration (force reload)
	 */
	clearCache(): void {
		this.config = null;
	}
}
