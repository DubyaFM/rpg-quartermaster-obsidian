/**
 * Reputation Target Suggest
 *
 * Auto-suggest component for reputation target entity input
 * Suggests previously used faction/location/NPC names for consistency
 */

import { AbstractInputSuggest, App } from 'obsidian';
import type { Job, ReputationTargetType } from '@quartermaster/core/models/Job';
import { ReputationTargetExtractor } from '@quartermaster/core/services/ReputationTargetExtractor';

export class ReputationTargetSuggest extends AbstractInputSuggest<string> {
	private extractor: ReputationTargetExtractor;
	private targetType: ReputationTargetType | null = null;
	private jobs: Job[] = [];
	private textInputEl: HTMLInputElement;

	constructor(
		app: App,
		inputEl: HTMLInputElement,
		jobs: Job[]
	) {
		super(app, inputEl);
		this.textInputEl = inputEl;
		this.extractor = new ReputationTargetExtractor();
		this.jobs = jobs;
	}

	/**
	 * Set the target type to filter suggestions
	 *
	 * @param type - The reputation target type (Location, Faction, NPC)
	 */
	setTargetType(type: ReputationTargetType): void {
		this.targetType = type;
	}

	/**
	 * Get suggestions based on current input
	 *
	 * @param query - Current input text
	 * @returns Array of matching suggestions
	 */
	getSuggestions(query: string): string[] {
		// Get suggestions filtered by type if selected
		let suggestions: string[];
		if (this.targetType) {
			suggestions = this.extractor.getTargetsByType(this.jobs, this.targetType);
		} else {
			suggestions = this.extractor.getAllEntityNames(this.jobs);
		}

		// Filter by query (case-insensitive)
		const lowerQuery = query.toLowerCase();
		const filtered = suggestions.filter(entity =>
			entity.toLowerCase().includes(lowerQuery)
		);

		// If no matches, return empty array (user can type new name)
		return filtered;
	}

	/**
	 * Render suggestion item in dropdown
	 *
	 * @param value - Suggestion value
	 * @param el - Element to render into
	 */
	renderSuggestion(value: string, el: HTMLElement): void {
		el.createEl('div', { text: value });
	}

	/**
	 * Handle suggestion selection
	 *
	 * @param value - Selected suggestion
	 */
	selectSuggestion(value: string): void {
		// Format as wikilink if type is known
		if (this.targetType) {
			const formatted = this.extractor.formatAsWikilink(value, this.targetType);
			this.textInputEl.value = formatted;
		} else {
			this.textInputEl.value = value;
		}

		// Trigger input event so modal can update
		this.textInputEl.dispatchEvent(new Event('input', { bubbles: true }));
		this.textInputEl.blur();
	}
}
