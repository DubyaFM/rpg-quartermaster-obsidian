/**
 * Job filename slug generation utilities
 *
 * Converts job titles to filesystem-safe slugs and handles collision detection
 *
 * @module jobSlugGenerator
 * @packageDocumentation
 */

/**
 * Convert job title to filename-safe slug
 *
 * Rules:
 * - Converts to lowercase
 * - Removes special characters (keeps alphanumeric, spaces, hyphens)
 * - Replaces spaces with hyphens
 * - Collapses multiple hyphens to single
 * - Removes leading/trailing hyphens
 *
 * @param title Job title
 * @returns Filename-safe slug
 *
 * @example
 * ```ts
 * generateJobSlug("Save the Blacksmith's Daughter")
 * // Returns: "save-the-blacksmiths-daughter"
 *
 * generateJobSlug("Rat Catcher!!!")
 * // Returns: "rat-catcher"
 *
 * generateJobSlug("  Multiple   Spaces  ")
 * // Returns: "multiple-spaces"
 * ```
 */
export function generateJobSlug(title: string): string {
	return title
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')  // Remove special characters (keep alphanumeric, spaces, hyphens)
		.replace(/\s+/g, '-')      // Replace spaces with hyphens
		.replace(/-+/g, '-')       // Replace multiple hyphens with single
		.replace(/^-|-$/g, '');    // Remove leading/trailing hyphens
}

/**
 * Generate unique filename with auto-increment if collision detected
 *
 * If the base slug already exists in the list of filenames, appends
 * a number (-2, -3, etc.) until a unique name is found.
 *
 * @param title Job title to convert to filename
 * @param existingFilenames List of existing job filenames
 * @returns Unique filename with .md extension
 *
 * @example
 * ```ts
 * const existing = ["rat-catcher.md", "rat-catcher-2.md"];
 *
 * generateUniqueJobFilename("Rat Catcher", existing)
 * // Returns: "rat-catcher-3.md"
 *
 * generateUniqueJobFilename("New Quest", existing)
 * // Returns: "new-quest.md"
 * ```
 */
export function generateUniqueJobFilename(
	title: string,
	existingFilenames: string[]
): string {
	const slug = generateJobSlug(title);
	let filename = `${slug}.md`;
	let counter = 2;

	while (existingFilenames.includes(filename)) {
		filename = `${slug}-${counter}.md`;
		counter++;
	}

	return filename;
}

/**
 * Check if a filename would cause a collision
 *
 * @param title Job title
 * @param existingFilenames List of existing job filenames
 * @returns true if collision would occur, false otherwise
 *
 * @example
 * ```ts
 * const existing = ["rat-catcher.md"];
 *
 * wouldCauseCollision("Rat Catcher", existing)
 * // Returns: true
 *
 * wouldCauseCollision("New Quest", existing)
 * // Returns: false
 * ```
 */
export function wouldCauseCollision(
	title: string,
	existingFilenames: string[]
): boolean {
	const slug = generateJobSlug(title);
	const filename = `${slug}.md`;
	return existingFilenames.includes(filename);
}

/**
 * Extract job title from filename
 *
 * Reverses the slug process to create a human-readable title suggestion
 * (for display purposes only - actual title comes from frontmatter)
 *
 * @param filename Job filename (with or without .md extension)
 * @returns Suggested title (capitalized words, hyphens → spaces)
 *
 * @example
 * ```ts
 * extractTitleFromFilename("rat-catcher.md")
 * // Returns: "Rat Catcher"
 *
 * extractTitleFromFilename("save-the-blacksmiths-daughter-2.md")
 * // Returns: "Save The Blacksmiths Daughter 2"
 * ```
 */
export function extractTitleFromFilename(filename: string): string {
	// Remove .md extension if present
	const slug = filename.replace(/\.md$/, '');

	// Split on hyphens, capitalize each word
	return slug
		.split('-')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}
