import { describe, it, expect } from 'vitest';
import {
	generateJobSlug,
	generateUniqueJobFilename,
	wouldCauseCollision,
	extractTitleFromFilename
} from '../utils/jobSlugGenerator';

describe('jobSlugGenerator', () => {
	describe('generateJobSlug', () => {
		it('should convert title to lowercase slug', () => {
			expect(generateJobSlug('Save The Blacksmith')).toBe('save-the-blacksmith');
			expect(generateJobSlug('RAT CATCHER')).toBe('rat-catcher');
		});

		it('should replace spaces with hyphens', () => {
			expect(generateJobSlug('Multiple Word Title')).toBe('multiple-word-title');
			expect(generateJobSlug('A B C D')).toBe('a-b-c-d');
		});

		it('should remove special characters', () => {
			expect(generateJobSlug("Save the Blacksmith's Daughter")).toBe('save-the-blacksmiths-daughter');
			expect(generateJobSlug('Rat Catcher!!!')).toBe('rat-catcher');
			expect(generateJobSlug('Quest #1 - @Location')).toBe('quest-1-location');
		});

		it('should collapse multiple hyphens to single', () => {
			expect(generateJobSlug('Multiple   Spaces')).toBe('multiple-spaces');
			expect(generateJobSlug('Many---Hyphens')).toBe('many-hyphens');
		});

		it('should remove leading and trailing hyphens', () => {
			expect(generateJobSlug('  Leading and Trailing  ')).toBe('leading-and-trailing');
			expect(generateJobSlug('---Start')).toBe('start');
			expect(generateJobSlug('End---')).toBe('end');
		});

		it('should handle empty or whitespace-only strings', () => {
			expect(generateJobSlug('')).toBe('');
			expect(generateJobSlug('   ')).toBe('');
			expect(generateJobSlug('---')).toBe('');
		});

		it('should handle strings with only special characters', () => {
			expect(generateJobSlug('!!!')).toBe('');
			expect(generateJobSlug('@#$%')).toBe('');
		});

		it('should preserve numbers and alphanumeric characters', () => {
			expect(generateJobSlug('Quest 123')).toBe('quest-123');
			expect(generateJobSlug('Level-5-Adventure')).toBe('level-5-adventure');
		});
	});

	describe('generateUniqueJobFilename', () => {
		it('should return basic filename when no collision', () => {
			const result = generateUniqueJobFilename('Rat Catcher', []);

			expect(result).toBe('rat-catcher.md');
		});

		it('should add -2 suffix on first collision', () => {
			const existing = ['rat-catcher.md'];
			const result = generateUniqueJobFilename('Rat Catcher', existing);

			expect(result).toBe('rat-catcher-2.md');
		});

		it('should increment suffix for multiple collisions', () => {
			const existing = ['rat-catcher.md', 'rat-catcher-2.md'];
			const result = generateUniqueJobFilename('Rat Catcher', existing);

			expect(result).toBe('rat-catcher-3.md');
		});

		it('should handle non-sequential existing files', () => {
			const existing = ['rat-catcher.md', 'rat-catcher-2.md', 'rat-catcher-5.md'];
			const result = generateUniqueJobFilename('Rat Catcher', existing);

			expect(result).toBe('rat-catcher-3.md');
		});

		it('should work with multiple different jobs', () => {
			const existing = [
				'rat-catcher.md',
				'rat-catcher-2.md',
				'save-blacksmith.md',
				'escort-caravan.md'
			];

			expect(generateUniqueJobFilename('Rat Catcher', existing)).toBe('rat-catcher-3.md');
			expect(generateUniqueJobFilename('Save Blacksmith', existing)).toBe('save-blacksmith-2.md');
			expect(generateUniqueJobFilename('Escort Caravan', existing)).toBe('escort-caravan-2.md');
			expect(generateUniqueJobFilename('New Quest', existing)).toBe('new-quest.md');
		});

		it('should handle special characters in title', () => {
			const existing = ['save-the-blacksmiths-daughter.md'];
			const result = generateUniqueJobFilename("Save the Blacksmith's Daughter", existing);

			expect(result).toBe('save-the-blacksmiths-daughter-2.md');
		});
	});

	describe('wouldCauseCollision', () => {
		it('should return true when filename already exists', () => {
			const existing = ['rat-catcher.md', 'escort-caravan.md'];

			expect(wouldCauseCollision('Rat Catcher', existing)).toBe(true);
			expect(wouldCauseCollision('Escort Caravan', existing)).toBe(true);
		});

		it('should return false when filename is unique', () => {
			const existing = ['rat-catcher.md'];

			expect(wouldCauseCollision('New Quest', existing)).toBe(false);
			expect(wouldCauseCollision('Save Blacksmith', existing)).toBe(false);
		});

		it('should be case-insensitive', () => {
			const existing = ['rat-catcher.md'];

			expect(wouldCauseCollision('RAT CATCHER', existing)).toBe(true);
			expect(wouldCauseCollision('Rat Catcher', existing)).toBe(true);
			expect(wouldCauseCollision('rat catcher', existing)).toBe(true);
		});

		it('should handle special characters correctly', () => {
			const existing = ['save-the-blacksmiths-daughter.md'];

			expect(wouldCauseCollision("Save the Blacksmith's Daughter", existing)).toBe(true);
			expect(wouldCauseCollision("Save the Blacksmiths Daughter", existing)).toBe(true);
		});

		it('should not match numbered variants', () => {
			const existing = ['rat-catcher-2.md'];

			expect(wouldCauseCollision('Rat Catcher', existing)).toBe(false);
		});
	});

	describe('extractTitleFromFilename', () => {
		it('should convert slug to title with capitalized words', () => {
			expect(extractTitleFromFilename('rat-catcher.md')).toBe('Rat Catcher');
			expect(extractTitleFromFilename('save-the-blacksmith.md')).toBe('Save The Blacksmith');
		});

		it('should work without .md extension', () => {
			expect(extractTitleFromFilename('rat-catcher')).toBe('Rat Catcher');
			expect(extractTitleFromFilename('escort-caravan')).toBe('Escort Caravan');
		});

		it('should preserve numbers in title', () => {
			expect(extractTitleFromFilename('quest-123.md')).toBe('Quest 123');
			expect(extractTitleFromFilename('level-5-adventure.md')).toBe('Level 5 Adventure');
		});

		it('should handle numbered variants', () => {
			expect(extractTitleFromFilename('rat-catcher-2.md')).toBe('Rat Catcher 2');
			expect(extractTitleFromFilename('rat-catcher-10.md')).toBe('Rat Catcher 10');
		});

		it('should handle single word filenames', () => {
			expect(extractTitleFromFilename('quest.md')).toBe('Quest');
			expect(extractTitleFromFilename('adventure')).toBe('Adventure');
		});

		it('should handle empty filename', () => {
			expect(extractTitleFromFilename('')).toBe('');
			expect(extractTitleFromFilename('.md')).toBe('');
		});

		it('should capitalize each word separately', () => {
			expect(extractTitleFromFilename('the-quick-brown-fox.md')).toBe('The Quick Brown Fox');
		});
	});
});
