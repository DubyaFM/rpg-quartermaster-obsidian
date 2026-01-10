/**
 * CalendarInitializer - Coordinated startup for calendar system
 *
 * Simple orchestration service that ensures proper initialization order
 * for CalendarService and related components.
 *
 * Usage:
 * ```typescript
 * const initializer = new CalendarInitializer(
 *   eventBus,
 *   calendarDefinitionManager,
 *   calendarStateAdapter
 * );
 *
 * const result = await initializer.initialize();
 * if (result.success) {
 *   // Use result.calendarService
 * }
 * ```
 *
 * Note: WorldEventService initialization is handled separately by platform code
 * (Backend/Obsidian) since it requires platform-specific dependencies and
 * integration with the calendar service.
 */

import { EventBus } from './EventBus';
import { CalendarDefinitionManager } from './CalendarDefinitionManager';
import { CalendarService } from './CalendarService';
import { DateFormatter } from './DateFormatter';
import { ICalendarStateAdapter } from '../interfaces/ICalendarStateAdapter';

/**
 * Calendar initialization configuration
 */
export interface CalendarInitializerOptions {
	/** Calendar ID to load (default: "harptos") */
	defaultCalendarId?: string;
	/** Whether to log initialization progress (default: true) */
	verbose?: boolean;
}

/**
 * Result of calendar initialization
 */
export interface CalendarInitializationResult {
	/** Initialized calendar service */
	calendarService: CalendarService | null;
	/** Whether initialization succeeded */
	success: boolean;
	/** Error message if initialization failed */
	error?: string;
}

/**
 * Calendar system initialization service
 *
 * Coordinates startup of calendar system:
 * 1. Loads calendar definitions from CalendarDefinitionManager
 * 2. Verifies selected calendar exists
 * 3. Creates and initializes CalendarService
 *
 * Handles initialization failures gracefully with detailed error messages.
 * Platform code is responsible for initializing WorldEventService separately.
 */
export class CalendarInitializer {
	constructor(
		private eventBus: EventBus,
		private calendarDefinitionManager: CalendarDefinitionManager,
		private calendarStateAdapter: ICalendarStateAdapter
	) {}

	/**
	 * Initialize calendar system
	 *
	 * Orchestrates the initialization sequence with proper dependency order.
	 * If initialization fails at any step, returns a result with success=false and error message.
	 *
	 * @param options Optional initialization configuration
	 * @returns Initialization result with service or error
	 */
	async initialize(options: CalendarInitializerOptions = {}): Promise<CalendarInitializationResult> {
		const {
			defaultCalendarId = 'harptos',
			verbose = true
		} = options;

		const log = (message: string) => {
			if (verbose) {
				console.log(`[CalendarInitializer] ${message}`);
			}
		};

		try {
			// Step 1: Load calendar definitions
			log('Loading calendar definitions...');
			await this.calendarDefinitionManager.loadDefinitions();
			const calendars = this.calendarDefinitionManager.getAllDefinitions();
			log(`Loaded ${calendars.length} calendar definition(s)`);

			if (calendars.length === 0) {
				throw new Error('No calendar definitions available. Cannot initialize calendar system.');
			}

			// Step 2: Verify default calendar exists
			log(`Verifying calendar "${defaultCalendarId}"...`);
			const calendarDef = this.calendarDefinitionManager.getDefinition(defaultCalendarId);
			if (!calendarDef) {
				const availableIds = calendars.map(c => c.id).join(', ');
				throw new Error(
					`Calendar "${defaultCalendarId}" not found. Available calendars: ${availableIds}`
				);
			}

			// Step 3: Create CalendarService
			log('Creating CalendarService...');
			const dateFormatter = new DateFormatter();
			const calendarService = new CalendarService(
				this.eventBus,
				this.calendarDefinitionManager,
				dateFormatter,
				this.calendarStateAdapter
			);

			// Initialize CalendarService (loads definitions and state)
			await calendarService.initialize();
			log('CalendarService initialized successfully');

			return {
				calendarService,
				success: true
			};

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error('[CalendarInitializer] Initialization failed:', error);

			return {
				calendarService: null,
				success: false,
				error: errorMessage
			};
		}
	}
}
