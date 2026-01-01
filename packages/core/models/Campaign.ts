/**
 * Campaign type system for activity log context
 *
 * Phase 1 (MVP): Minimal campaign metadata with default campaign
 * Phase 2 (Future): Full campaign management with settings migration
 */

/**
 * Campaign metadata for activity log context
 *
 * Phase 1 (MVP): Only id and name fields used, default campaign always active
 * Phase 2 (Future): Full campaign management with settings migration
 */
export interface Campaign {
  id: string;                    // Default: "campaign_default"
  name: string;                  // Human-readable name
  createdAt: number;             // Unix timestamp (milliseconds)
  updatedAt: number;             // Unix timestamp (milliseconds)
  isActive: boolean;             // Only one active campaign at a time

  // Phase 2 fields (optional for now)
  description?: string;
  partyMembers?: string[];       // Player names
  startDate?: string;            // In-game start date
  currentDate?: string;          // In-game current date
  settings?: CampaignSettings;   // Campaign-specific plugin settings
}

/**
 * Campaign-specific settings (Phase 2)
 * Will eventually hold all plugin settings per campaign
 */
export interface CampaignSettings {
  // Placeholder for Phase 2
  // Will include: shopDirectory, partyInventoryPath, etc.
  [key: string]: unknown;
}

/**
 * Default campaign for Phase 1
 *
 * MVP uses a single default campaign with minimal metadata.
 * All activity logs reference this campaign until Phase 2 campaign management is implemented.
 */
export const DEFAULT_CAMPAIGN: Campaign = {
  id: 'campaign_default',
  name: 'Default Campaign',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isActive: true,
};

/**
 * Campaign query parameters for Phase 2
 *
 * Used for querying campaigns from persistent storage
 */
export interface CampaignQuery {
  id?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Campaign result container for Phase 2
 *
 * Used for returning query results with pagination metadata
 */
export interface CampaignResult {
  campaigns: Campaign[];
  total: number;
}
