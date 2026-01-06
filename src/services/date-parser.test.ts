import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { parseNaturalDate, formatDate, parseRecurrence, getNextRecurrence } from './date-parser';

describe('date-parser', () => {
  beforeEach(() => {
    // Mock current date to 2024-03-15 10:00:00 (Friday)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('parseNaturalDate', () => {
    describe('relative time expressions', () => {
      it('should parse "today"', () => {
        const result = parseNaturalDate('today');
        expect(result).not.toBeNull();
        expect(result?.getFullYear()).toBe(2024);
        expect(result?.getMonth()).toBe(2); // March (0-indexed)
        expect(result?.getDate()).toBe(15);
      });

      it('should parse "tomorrow"', () => {
        const result = parseNaturalDate('tomorrow');
        expect(result).not.toBeNull();
        expect(result?.getDate()).toBe(16);
      });

      it('should parse "yesterday"', () => {
        const result = parseNaturalDate('yesterday');
        expect(result).not.toBeNull();
        expect(result?.getDate()).toBe(14);
      });

      it('should parse "in 2 hours"', () => {
        const result = parseNaturalDate('in 2 hours');
        expect(result).not.toBeNull();
        expect(result?.getHours()).toBe(12);
      });

      it('should parse "in 30 minutes"', () => {
        const result = parseNaturalDate('in 30 minutes');
        expect(result).not.toBeNull();
        expect(result?.getMinutes()).toBe(30);
      });

      it('should parse "in 3 days"', () => {
        const result = parseNaturalDate('in 3 days');
        expect(result).not.toBeNull();
        expect(result?.getDate()).toBe(18);
      });

      it('should parse "in 1 week"', () => {
        const result = parseNaturalDate('in 1 week');
        expect(result).not.toBeNull();
        expect(result?.getDate()).toBe(22);
      });
    });

    describe('day of week expressions', () => {
      it('should parse "next monday"', () => {
        // Current date is Friday March 15, "next monday" means the monday after the coming one
        // Coming Monday is March 18, so "next monday" is March 25
        const result = parseNaturalDate('next monday');
        expect(result).not.toBeNull();
        expect(result?.getDate()).toBe(25);
        expect(result?.getDay()).toBe(1); // Monday
      });

      it('should parse "next friday"', () => {
        // Current date is Friday March 15, "next friday" means the friday after the coming one
        // Coming Friday is March 22, so "next friday" is March 29
        const result = parseNaturalDate('next friday');
        expect(result).not.toBeNull();
        expect(result?.getDate()).toBe(29);
      });

      it('should parse "monday" (upcoming)', () => {
        const result = parseNaturalDate('monday');
        expect(result).not.toBeNull();
        expect(result?.getDay()).toBe(1);
      });
    });

    describe('duration shorthand', () => {
      it('should parse "2h"', () => {
        const result = parseNaturalDate('2h');
        expect(result).not.toBeNull();
        expect(result?.getHours()).toBe(12);
      });

      it('should parse "30m"', () => {
        const result = parseNaturalDate('30m');
        expect(result).not.toBeNull();
        expect(result?.getMinutes()).toBe(30);
      });

      it('should parse "1d"', () => {
        const result = parseNaturalDate('1d');
        expect(result).not.toBeNull();
        expect(result?.getDate()).toBe(16);
      });

      it('should parse "1w" (not supported in duration shorthand)', () => {
        // The current implementation doesn't support "1w" shorthand without "in" prefix
        const result = parseNaturalDate('1w');
        // This parses as an ISO date, not a week duration
        expect(result).toBeNull();
      });

      it('should parse "in 1 week" instead of "1w"', () => {
        const result = parseNaturalDate('in 1 week');
        expect(result).not.toBeNull();
        expect(result?.getDate()).toBe(22);
      });
    });

    describe('ISO date strings', () => {
      it('should parse ISO date string', () => {
        const result = parseNaturalDate('2024-04-01T00:00:00');
        expect(result).not.toBeNull();
        expect(result?.getFullYear()).toBe(2024);
        expect(result?.getMonth()).toBe(3); // April
        expect(result?.getDate()).toBe(1);
      });

      it('should parse ISO datetime string', () => {
        const result = parseNaturalDate('2024-04-01T14:30:00');
        expect(result).not.toBeNull();
        expect(result?.getHours()).toBe(14);
        expect(result?.getMinutes()).toBe(30);
      });
    });

    describe('edge cases', () => {
      it('should return null for invalid input', () => {
        expect(parseNaturalDate('invalid')).toBeNull();
        expect(parseNaturalDate('')).toBeNull();
      });

      it('should handle case insensitivity', () => {
        expect(parseNaturalDate('TODAY')).not.toBeNull();
        expect(parseNaturalDate('Tomorrow')).not.toBeNull();
        expect(parseNaturalDate('NEXT MONDAY')).not.toBeNull();
      });
    });
  });

  describe('formatDate', () => {
    it('should format date as relative for today with time', () => {
      const today = new Date('2024-03-15T14:00:00');
      const result = formatDate(today, true);
      expect(result).toContain('Today');
      expect(result).toContain('at');
    });

    it('should format date as relative for today without time', () => {
      const today = new Date('2024-03-15T14:00:00');
      const result = formatDate(today, false);
      expect(result).toBe('Today');
    });

    it('should format date as relative for tomorrow without time', () => {
      const tomorrow = new Date('2024-03-16T14:00:00');
      const result = formatDate(tomorrow, false);
      expect(result).toBe('Tomorrow');
    });

    it('should format date with day name for this week', () => {
      const monday = new Date('2024-03-18T14:00:00');
      const result = formatDate(monday, false);
      expect(result).toContain('Mon');
    });

    it('should format date with full date for distant dates', () => {
      const farFuture = new Date('2024-06-15T14:00:00');
      const result = formatDate(farFuture, false);
      expect(result).toContain('Jun');
      expect(result).toContain('15');
    });
  });

  describe('parseRecurrence', () => {
    it('should parse "daily"', () => {
      const result = parseRecurrence('daily');
      expect(result).toEqual({ type: 'daily' });
    });

    it('should parse "weekly"', () => {
      const result = parseRecurrence('weekly');
      expect(result).toEqual({ type: 'weekly' });
    });

    it('should parse "monthly"', () => {
      const result = parseRecurrence('monthly');
      expect(result).toEqual({ type: 'monthly' });
    });

    it('should parse "every 2 days"', () => {
      const result = parseRecurrence('every 2 days');
      expect(result).toEqual({ type: 'daily', interval: 2 });
    });

    it('should parse "every 3 weeks"', () => {
      const result = parseRecurrence('every 3 weeks');
      expect(result).toEqual({ type: 'weekly', interval: 3 });
    });

    it('should return null for invalid input', () => {
      expect(parseRecurrence('invalid')).toBeNull();
    });
  });

  describe('getNextRecurrence', () => {
    it('should calculate next daily occurrence', () => {
      const lastDate = new Date('2024-03-15T09:00:00');
      const result = getNextRecurrence('daily', null, lastDate);
      expect(result.getDate()).toBe(16);
    });

    it('should calculate next weekly occurrence', () => {
      const lastDate = new Date('2024-03-15T09:00:00');
      const result = getNextRecurrence('weekly', null, lastDate);
      expect(result.getDate()).toBe(22);
    });

    it('should calculate next monthly occurrence', () => {
      const lastDate = new Date('2024-03-15T09:00:00');
      const result = getNextRecurrence('monthly', null, lastDate);
      expect(result.getMonth()).toBe(3); // April
      expect(result.getDate()).toBe(15);
    });

    it('should default to daily for unknown recurrence type', () => {
      const lastDate = new Date('2024-03-15T09:00:00');
      const result = getNextRecurrence('none', null, lastDate);
      // Default behavior is to add 1 day
      expect(result.getDate()).toBe(16);
    });
  });
});
