// Inventory Filter Helper
// Handles shop inventory sorting and filtering for UI
// Kept under 150 lines for maintainability

import { ShopItem } from '@quartermaster/core/models/types';
import {
	SortOptions,
	SortCriteria,
	SortDirection,
	applyMultiSort,
	filterInventoryBySearch,
	getRarityBreakdown,
	getTypeBreakdown,
	calculateInventoryValue
} from '@quartermaster/core/utils/sortFilter';
import { convertFromCopper, formatCurrency } from '@quartermaster/core/calculators/currency';
import { DEFAULT_CURRENCY_CONFIG } from '@quartermaster/core/data/defaultCurrencyConfig';

export class InventoryFilter {
	private currentSort: SortOptions = {
		criteria: 'category',
		direction: 'asc'
	};
	private currentSearch: string = '';

	/**
	 * Apply current filters and sort to inventory
	 */
	apply(items: ShopItem[]): ShopItem[] {
		return applyMultiSort(items, this.currentSort, this.currentSearch);
	}

	/**
	 * Set sort criteria
	 */
	setSort(criteria: SortCriteria, direction: SortDirection = 'asc'): void {
		this.currentSort = { criteria, direction };
	}

	/**
	 * Toggle sort direction
	 */
	toggleDirection(): void {
		this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
	}

	/**
	 * Set search query
	 */
	setSearch(query: string): void {
		this.currentSearch = query;
	}

	/**
	 * Clear search query
	 */
	clearSearch(): void {
		this.currentSearch = '';
	}

	/**
	 * Get current sort options
	 */
	getSortOptions(): SortOptions {
		return { ...this.currentSort };
	}

	/**
	 * Get current search query
	 */
	getSearchQuery(): string {
		return this.currentSearch;
	}

	/**
	 * Get rarity breakdown for display
	 */
	getRarityStats(items: ShopItem[]): Map<string, number> {
		return getRarityBreakdown(items);
	}

	/**
	 * Get type breakdown for display
	 */
	getTypeStats(items: ShopItem[]): Map<string, number> {
		return getTypeBreakdown(items);
	}

	/**
	 * Calculate total inventory value
	 */
	getTotalValue(items: ShopItem[]): string {
		const copperValue = calculateInventoryValue(items);
		const currency = convertFromCopper(copperValue);
		return formatCurrency(currency, DEFAULT_CURRENCY_CONFIG);
	}

	/**
	 * Get sort direction indicator for UI
	 */
	getSortIndicator(): string {
		return this.currentSort.direction === 'asc' ? '↑' : '↓';
	}

	/**
	 * Get formatted sort label for UI
	 */
	getSortLabel(): string {
		const labels: Record<SortCriteria, string> = {
			price: 'Price',
			rarity: 'Rarity',
			type: 'Type',
			category: 'Category',
			name: 'Name'
		};
		return `${labels[this.currentSort.criteria]} ${this.getSortIndicator()}`;
	}

	/**
	 * Reset all filters to default
	 */
	reset(): void {
		this.currentSort = {
			criteria: 'category',
			direction: 'asc'
		};
		this.currentSearch = '';
	}

	/**
	 * Check if any filters are active
	 */
	hasActiveFilters(): boolean {
		return this.currentSearch.length > 0 ||
			this.currentSort.criteria !== 'category' ||
			this.currentSort.direction !== 'asc';
	}
}
