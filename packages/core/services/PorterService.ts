/**
 * Porter Service - Campaign Export/Import (Phase 4: Campaign Switching)
 *
 * Provides Canonical Exchange Format (CEF) for cross-platform campaign portability.
 *
 * The Porter Service enables:
 * - Exporting campaigns to JSON (CEF format)
 * - Importing campaigns from CEF
 * - Cross-platform campaign transfer (Obsidian ↔ Web ↔ Mobile)
 * - Campaign backups and version control
 *
 * CEF Design Principles:
 * - Platform-agnostic: No file paths, DB-specific structures, or platform IDs
 * - Versioned: Schema version for forward/backward compatibility
 * - Complete: All campaign data included (shops, party, transactions, etc.)
 * - Library-aware: References libraries but doesn't duplicate their items
 */

import { IDataAdapter } from '../interfaces/IDataAdapter';
import { Shop, Transaction } from '../models/types';
import { PartyInventoryV2 } from '../interfaces/IDataAdapter';

/**
 * Canonical Exchange Format (CEF) for campaign export
 *
 * This is the official interchange format for Quartermaster campaigns.
 */
export interface CampaignExportManifest {
  /** CEF schema version (semver) */
  version: string;

  /** Export timestamp (Unix milliseconds) */
  exportedAt: number;

  /** Campaign metadata */
  campaign: {
    /** Original campaign ID (informational only, new ID generated on import) */
    id: string;

    /** Campaign name */
    name: string;

    /** World/setting ID */
    worldId: string;

    /** Campaign description */
    description?: string;

    /** Campaign-specific settings */
    settings?: Record<string, any>;
  };

  /** Campaign data */
  data: {
    /** All shops in the campaign */
    shops: Shop[];

    /** Party inventory and funds */
    party: PartyInventoryV2;

    /** Transaction history */
    transactions: Transaction[];

    /** NPCs (future) */
    npcs?: any[];

    /** Locations (future) */
    locations?: any[];

    /** Factions (future) */
    factions?: any[];

    /** Calendar state (future) */
    calendarState?: any;

    /** Projects (future) */
    projects?: any[];

    /** Strongholds (future) */
    strongholds?: any[];
  };

  /** Library references */
  libraries: {
    /** Library IDs referenced by items in this campaign */
    referenced: string[];
  };

  /** Export metadata */
  metadata: {
    /** Platform that created this export */
    sourcePlatform: 'obsidian' | 'web' | 'mobile';

    /** User/plugin version that created export */
    exportedBy: string;

    /** Total entity counts (for validation) */
    counts: {
      shops: number;
      transactions: number;
      items: number;
    };
  };
}

/**
 * Import validation result
 */
export interface ImportValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Porter Service
 *
 * Handles campaign export and import using the CEF format.
 */
export class PorterService {
  /** Current CEF version */
  private static readonly CEF_VERSION = '1.0.0';

  constructor(
    private dataAdapter: IDataAdapter,
    private platform: 'obsidian' | 'web' | 'mobile',
    private version: string
  ) {}

  /**
   * Export campaign to CEF format
   *
   * Hydrates all campaign data from the adapter and packages it
   * into a portable JSON format.
   *
   * @param campaignId - Campaign to export
   * @param campaignName - Campaign name
   * @param worldId - World ID
   * @param settings - Campaign settings
   * @returns CEF manifest
   */
  async exportCampaign(
    campaignId: string,
    campaignName: string,
    worldId: string,
    description?: string,
    settings?: Record<string, any>
  ): Promise<CampaignExportManifest> {
    console.log(`[PorterService] Exporting campaign: ${campaignId}`);

    // Hydrate all data from adapter
    const shops = await this.dataAdapter.getAllShops();
    const partyV2 = await this.dataAdapter.getPartyInventoryV2();
    const transactions = await this.dataAdapter.getAllTransactions();

    // Extract unique library references from items
    const referencedLibraries = new Set<string>();

    // Scan shops for library items
    for (const shop of shops) {
      for (const item of shop.inventory) {
        // TODO: Track library source in items
        // For now, we'll just note that items exist
      }
    }

    // Count total items
    let totalItems = 0;
    for (const shop of shops) {
      totalItems += shop.inventory.length;
    }
    totalItems += partyV2.items.length;

    // Build CEF manifest
    const manifest: CampaignExportManifest = {
      version: PorterService.CEF_VERSION,
      exportedAt: Date.now(),

      campaign: {
        id: campaignId,
        name: campaignName,
        worldId,
        description,
        settings
      },

      data: {
        shops,
        party: partyV2,
        transactions
      },

      libraries: {
        referenced: Array.from(referencedLibraries)
      },

      metadata: {
        sourcePlatform: this.platform,
        exportedBy: `${this.platform}-${this.version}`,
        counts: {
          shops: shops.length,
          transactions: transactions.length,
          items: totalItems
        }
      }
    };

    console.log(`[PorterService] Export complete: ${shops.length} shops, ${transactions.length} transactions`);
    return manifest;
  }

  /**
   * Validate CEF manifest before import
   *
   * Checks for:
   * - Valid schema version
   * - Required fields present
   * - Data integrity
   *
   * @param manifest - CEF manifest to validate
   * @returns Validation result
   */
  validateManifest(manifest: any): ImportValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if manifest exists
    if (!manifest) {
      errors.push('Manifest is null or undefined');
      return { valid: false, errors, warnings };
    }

    // Check CEF version
    if (!manifest.version) {
      errors.push('Missing CEF version');
    } else if (manifest.version !== PorterService.CEF_VERSION) {
      warnings.push(`CEF version mismatch: expected ${PorterService.CEF_VERSION}, got ${manifest.version}`);
    }

    // Check required campaign fields
    if (!manifest.campaign) {
      errors.push('Missing campaign metadata');
    } else {
      if (!manifest.campaign.name) errors.push('Missing campaign name');
      if (!manifest.campaign.worldId) errors.push('Missing campaign worldId');
    }

    // Check required data fields
    if (!manifest.data) {
      errors.push('Missing campaign data');
    } else {
      if (!manifest.data.shops) warnings.push('No shops in export');
      if (!manifest.data.party) errors.push('Missing party inventory');
      if (!manifest.data.transactions) warnings.push('No transactions in export');
    }

    // Check metadata
    if (!manifest.metadata) {
      warnings.push('Missing export metadata');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Import campaign from CEF format
   *
   * Validates manifest and imports all entities into the current campaign.
   * WARNING: This will overwrite existing campaign data!
   *
   * @param manifest - CEF manifest to import
   * @param options - Import options
   * @returns Import statistics
   */
  async importCampaign(
    manifest: CampaignExportManifest,
    options: {
      /** If true, clear all existing data before import */
      clearExisting?: boolean;
      /** If true, skip validation (dangerous!) */
      skipValidation?: boolean;
    } = {}
  ): Promise<{
    shopsImported: number;
    transactionsImported: number;
    errors: string[];
  }> {
    console.log(`[PorterService] Importing campaign: ${manifest.campaign.name}`);

    // Validate manifest
    if (!options.skipValidation) {
      const validation = this.validateManifest(manifest);

      if (!validation.valid) {
        throw new Error(`Invalid CEF manifest: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        console.warn(`[PorterService] Import warnings:`, validation.warnings);
      }
    }

    const errors: string[] = [];
    let shopsImported = 0;
    let transactionsImported = 0;

    try {
      // TODO: Clear existing data if requested
      // This is dangerous and should prompt user confirmation

      // Import shops
      console.log(`[PorterService] Importing ${manifest.data.shops.length} shops...`);
      for (const shop of manifest.data.shops) {
        try {
          // Use shop.id as path for backend, or generate filename for file-based adapters
          const shopPath = shop.id || shop.name.replace(/[^a-zA-Z0-9-_]/g, '-');
          await this.dataAdapter.saveShop(shop, shopPath);
          shopsImported++;
        } catch (error) {
          errors.push(`Failed to import shop ${shop.id}: ${error}`);
          console.error(`[PorterService] Error importing shop ${shop.id}:`, error);
        }
      }

      // Import party inventory
      console.log(`[PorterService] Importing party inventory...`);
      try {
        // TODO: Update party inventory via adapter
        // await this.dataAdapter.updatePartyInventory(...);
        console.warn('[PorterService] Party inventory import not yet implemented');
      } catch (error) {
        errors.push(`Failed to import party inventory: ${error}`);
        console.error('[PorterService] Error importing party inventory:', error);
      }

      // Import transactions
      console.log(`[PorterService] Importing ${manifest.data.transactions.length} transactions...`);
      for (const transaction of manifest.data.transactions) {
        try {
          // Transactions are typically imported via logTransaction method
          // This might need special handling to preserve IDs and timestamps
          console.warn('[PorterService] Transaction import not yet implemented');
          // transactionsImported++;
        } catch (error) {
          errors.push(`Failed to import transaction ${transaction.id}: ${error}`);
          console.error(`[PorterService] Error importing transaction ${transaction.id}:`, error);
        }
      }

      console.log(`[PorterService] Import complete: ${shopsImported} shops imported`);
      return {
        shopsImported,
        transactionsImported,
        errors
      };

    } catch (error) {
      console.error('[PorterService] Import failed:', error);
      throw error;
    }
  }

  /**
   * Export campaign to JSON file (helper method)
   *
   * @param manifest - CEF manifest
   * @returns JSON string
   */
  serializeManifest(manifest: CampaignExportManifest): string {
    return JSON.stringify(manifest, null, 2);
  }

  /**
   * Import campaign from JSON file (helper method)
   *
   * @param json - JSON string
   * @returns Parsed CEF manifest
   */
  deserializeManifest(json: string): CampaignExportManifest {
    try {
      return JSON.parse(json);
    } catch (error) {
      throw new Error(`Failed to parse CEF manifest: ${error}`);
    }
  }
}
