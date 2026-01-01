/**
 * Service for building time advance summaries from listener outputs
 * Aggregates updates from projects, strongholds, jobs, and other systems
 */

export interface TimeAdvanceSummarySection {
  title: string;
  content: string[];
  isEmpty: boolean;
}

export interface TimeAdvanceSummary {
  daysAdvanced: number;
  fromDate: string;
  toDate: string;
  sections: TimeAdvanceSummarySection[];
  hasContent: boolean;
}

/**
 * Builder for creating formatted time advance summaries
 */
export class TimeAdvanceSummaryBuilder {
  private sections: Map<string, string[]> = new Map();
  private daysAdvanced = 0;
  private fromDate = '';
  private toDate = '';

  /**
   * Set the time advancement metadata
   */
  setTimeAdvancement(params: {
    daysAdvanced: number;
    fromDate: string;
    toDate: string;
  }): this {
    this.daysAdvanced = params.daysAdvanced;
    this.fromDate = params.fromDate;
    this.toDate = params.toDate;
    return this;
  }

  /**
   * Add a section to the summary
   */
  addSection(title: string, items: string[]): this {
    if (items.length > 0) {
      this.sections.set(title, items);
    }
    return this;
  }

  /**
   * Add a single item to a section
   */
  addItem(sectionTitle: string, item: string): this {
    const existing = this.sections.get(sectionTitle) || [];
    existing.push(item);
    this.sections.set(sectionTitle, existing);
    return this;
  }

  /**
   * Add items from a listener's output
   * Listeners should return { sectionTitle: string, items: string[] }
   */
  addListenerOutput(output: {
    sectionTitle: string;
    items: string[];
  }): this {
    return this.addSection(output.sectionTitle, output.items);
  }

  /**
   * Add multiple listener outputs at once
   */
  addListenerOutputs(
    outputs: Array<{ sectionTitle: string; items: string[] }>
  ): this {
    outputs.forEach((output) => this.addListenerOutput(output));
    return this;
  }

  /**
   * Check if summary has any content
   */
  hasContent(): boolean {
    return this.sections.size > 0;
  }

  /**
   * Build the final summary object
   */
  build(): TimeAdvanceSummary {
    const sections: TimeAdvanceSummarySection[] = [];

    // Convert map to sections array
    this.sections.forEach((content, title) => {
      sections.push({
        title,
        content,
        isEmpty: content.length === 0,
      });
    });

    return {
      daysAdvanced: this.daysAdvanced,
      fromDate: this.fromDate,
      toDate: this.toDate,
      sections,
      hasContent: sections.length > 0,
    };
  }

  /**
   * Build and format as plain text
   */
  buildAsText(): string {
    const summary = this.build();

    if (!summary.hasContent) {
      return '';
    }

    let text = `# Time Advanced: ${summary.daysAdvanced} day${summary.daysAdvanced !== 1 ? 's' : ''}\n`;
    text += `${summary.fromDate} → ${summary.toDate}\n\n`;

    summary.sections.forEach((section) => {
      text += `## ${section.title}\n`;
      section.content.forEach((item) => {
        text += `- ${item}\n`;
      });
      text += '\n';
    });

    return text;
  }

  /**
   * Build and format as markdown
   */
  buildAsMarkdown(): string {
    return this.buildAsText(); // Same format for now
  }

  /**
   * Reset the builder for reuse
   */
  reset(): this {
    this.sections.clear();
    this.daysAdvanced = 0;
    this.fromDate = '';
    this.toDate = '';
    return this;
  }

  /**
   * Create a new builder instance
   */
  static create(): TimeAdvanceSummaryBuilder {
    return new TimeAdvanceSummaryBuilder();
  }
}

/**
 * Example listener output format:
 *
 * const projectListener = {
 *   onTimeAdvance: (days: number) => {
 *     return {
 *       sectionTitle: 'Projects',
 *       items: [
 *         'Project "Scribe Scroll" completed (Alice)',
 *         'Project "Craft Sword" failed after 3 days (Bob)',
 *         'Project "Research Spell" progressed: 5/7 days (Carol)'
 *       ]
 *     };
 *   }
 * };
 *
 * Usage in CalendarService.advanceTime():
 *
 * const builder = TimeAdvanceSummaryBuilder.create()
 *   .setTimeAdvancement({ daysAdvanced: 3, fromDate: '2024-01-01', toDate: '2024-01-04' })
 *   .addListenerOutput(projectListener.onTimeAdvance(3))
 *   .addListenerOutput(strongholdListener.onTimeAdvance(3))
 *   .addListenerOutput(jobsListener.onTimeAdvance(3));
 *
 * const summary = builder.build();
 * if (summary.hasContent) {
 *   // Show modal
 * }
 */
