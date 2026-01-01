/**
 * Vitest setup file
 * Loads Obsidian mock and initializes HTMLElement extensions
 */

// Import the obsidian mock to ensure HTMLElement extensions are loaded
// The resolve alias in vitest.config.ts ensures all imports of 'obsidian'
// will use this mock file
import './__mocks__/obsidian';

// The mock file will automatically extend HTMLElement prototype
// when it's loaded in a jsdom environment
