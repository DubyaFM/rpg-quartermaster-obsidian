import { describe, it, expect, beforeEach } from 'vitest';
import { TimeAdvanceSummaryBuilder } from '../../services/TimeAdvanceSummaryBuilder';

describe('TimeAdvanceSummaryBuilder', () => {
  let builder: TimeAdvanceSummaryBuilder;

  beforeEach(() => {
    builder = TimeAdvanceSummaryBuilder.create();
  });

  describe('Fluent API', () => {
    it('should allow method chaining', () => {
      const result = builder
        .setTimeAdvancement({ daysAdvanced: 3, fromDate: '2024-01-01', toDate: '2024-01-04' })
        .addSection('Projects', ['Project 1 completed'])
        .addItem('Projects', 'Project 2 in progress')
        .build();

      expect(result.daysAdvanced).toBe(3);
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].content).toHaveLength(2);
    });
  });

  describe('setTimeAdvancement', () => {
    it('should set time advancement metadata', () => {
      builder.setTimeAdvancement({
        daysAdvanced: 5,
        fromDate: '2024-01-01',
        toDate: '2024-01-06',
      });

      const summary = builder.build();
      expect(summary.daysAdvanced).toBe(5);
      expect(summary.fromDate).toBe('2024-01-01');
      expect(summary.toDate).toBe('2024-01-06');
    });
  });

  describe('addSection', () => {
    it('should add section with items', () => {
      builder.addSection('Projects', ['Project A completed', 'Project B failed']);

      const summary = builder.build();
      expect(summary.sections).toHaveLength(1);
      expect(summary.sections[0].title).toBe('Projects');
      expect(summary.sections[0].content).toHaveLength(2);
    });

    it('should not add empty sections', () => {
      builder.addSection('Empty Section', []);

      const summary = builder.build();
      expect(summary.sections).toHaveLength(0);
    });
  });

  describe('addItem', () => {
    it('should add item to existing section', () => {
      builder
        .addSection('Projects', ['Item 1'])
        .addItem('Projects', 'Item 2');

      const summary = builder.build();
      expect(summary.sections[0].content).toHaveLength(2);
    });

    it('should create new section if it does not exist', () => {
      builder.addItem('New Section', 'First item');

      const summary = builder.build();
      expect(summary.sections).toHaveLength(1);
      expect(summary.sections[0].title).toBe('New Section');
    });
  });

  describe('addListenerOutput', () => {
    it('should add listener output as section', () => {
      builder.addListenerOutput({
        sectionTitle: 'Projects',
        items: ['Project completed', 'Project failed'],
      });

      const summary = builder.build();
      expect(summary.sections).toHaveLength(1);
      expect(summary.sections[0].content).toHaveLength(2);
    });
  });

  describe('addListenerOutputs', () => {
    it('should add multiple listener outputs', () => {
      builder.addListenerOutputs([
        { sectionTitle: 'Projects', items: ['Project 1'] },
        { sectionTitle: 'Strongholds', items: ['Stronghold event'] },
        { sectionTitle: 'Jobs', items: ['Job completed'] },
      ]);

      const summary = builder.build();
      expect(summary.sections).toHaveLength(3);
    });
  });

  describe('hasContent', () => {
    it('should return false when no sections added', () => {
      expect(builder.hasContent()).toBe(false);
    });

    it('should return true when sections added', () => {
      builder.addSection('Projects', ['Item 1']);
      expect(builder.hasContent()).toBe(true);
    });
  });

  describe('build', () => {
    it('should build complete summary', () => {
      builder
        .setTimeAdvancement({ daysAdvanced: 2, fromDate: '2024-01-01', toDate: '2024-01-03' })
        .addSection('Projects', ['Project completed'])
        .addSection('Strongholds', ['Resource collected']);

      const summary = builder.build();
      expect(summary.hasContent).toBe(true);
      expect(summary.sections).toHaveLength(2);
    });

    it('should mark summary as empty when no content', () => {
      builder.setTimeAdvancement({ daysAdvanced: 1, fromDate: '2024-01-01', toDate: '2024-01-02' });

      const summary = builder.build();
      expect(summary.hasContent).toBe(false);
    });
  });

  describe('buildAsText', () => {
    it('should format summary as markdown text', () => {
      builder
        .setTimeAdvancement({ daysAdvanced: 3, fromDate: '2024-01-01', toDate: '2024-01-04' })
        .addSection('Projects', ['Project A completed', 'Project B in progress']);

      const text = builder.buildAsText();
      expect(text).toContain('# Time Advanced: 3 days');
      expect(text).toContain('2024-01-01 → 2024-01-04');
      expect(text).toContain('## Projects');
      expect(text).toContain('- Project A completed');
      expect(text).toContain('- Project B in progress');
    });

    it('should return empty string when no content', () => {
      const text = builder.buildAsText();
      expect(text).toBe('');
    });
  });

  describe('reset', () => {
    it('should clear all data for reuse', () => {
      builder
        .setTimeAdvancement({ daysAdvanced: 5, fromDate: '2024-01-01', toDate: '2024-01-06' })
        .addSection('Projects', ['Item 1'])
        .reset();

      const summary = builder.build();
      expect(summary.daysAdvanced).toBe(0);
      expect(summary.sections).toHaveLength(0);
      expect(summary.hasContent).toBe(false);
    });
  });
});
