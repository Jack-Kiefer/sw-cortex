/**
 * Natural Language Date Parser (TickTick-style)
 *
 * Parses human-friendly date expressions like:
 * - "today", "tomorrow", "yesterday"
 * - "next monday", "this friday"
 * - "in 2 hours", "in 3 days"
 * - "at 3pm", "at 14:30"
 * - "monday at 9am"
 * - ISO dates
 */

// Day name to index mapping (Sunday = 0)
const DAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

// Month name to index mapping
const MONTHS: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

/**
 * Parse a time string like "3pm", "14:30", "9:30am"
 */
function parseTime(input: string): { hours: number; minutes: number } | null {
  // Match "3pm", "3:30pm", "15:30", "9am"
  const timeMatch = input.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!timeMatch) return null;

  let hours = parseInt(timeMatch[1], 10);
  const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  const meridiem = timeMatch[3]?.toLowerCase();

  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return { hours, minutes };
}

/**
 * Get the next occurrence of a day of the week
 */
function getNextDayOfWeek(dayIndex: number, fromDate: Date = new Date()): Date {
  const result = new Date(fromDate);
  result.setHours(9, 0, 0, 0); // Default to 9am

  const currentDay = result.getDay();
  let daysToAdd = dayIndex - currentDay;

  // If the day has passed this week, go to next week
  if (daysToAdd <= 0) {
    daysToAdd += 7;
  }

  result.setDate(result.getDate() + daysToAdd);
  return result;
}

/**
 * Parse relative time expressions
 */
function parseRelativeTime(input: string, now: Date): Date | null {
  const lower = input.toLowerCase().trim();

  // "today", "tonight"
  if (lower === 'today' || lower === 'tonight') {
    const result = new Date(now);
    if (lower === 'tonight') {
      result.setHours(20, 0, 0, 0);
    }
    return result;
  }

  // "tomorrow"
  if (lower === 'tomorrow') {
    const result = new Date(now);
    result.setDate(result.getDate() + 1);
    result.setHours(9, 0, 0, 0);
    return result;
  }

  // "yesterday"
  if (lower === 'yesterday') {
    const result = new Date(now);
    result.setDate(result.getDate() - 1);
    return result;
  }

  // "next week"
  if (lower === 'next week') {
    const result = new Date(now);
    result.setDate(result.getDate() + 7);
    result.setHours(9, 0, 0, 0);
    return result;
  }

  // "next month"
  if (lower === 'next month') {
    const result = new Date(now);
    result.setMonth(result.getMonth() + 1);
    result.setHours(9, 0, 0, 0);
    return result;
  }

  // "in X hours/minutes/days/weeks"
  const inMatch = lower.match(
    /^in\s+(\d+)\s*(m|min|mins|minutes?|h|hr|hrs|hours?|d|days?|w|wk|wks|weeks?)$/i
  );
  if (inMatch) {
    const value = parseInt(inMatch[1], 10);
    const unit = inMatch[2].toLowerCase();

    const result = new Date(now);

    if (unit.startsWith('m')) {
      result.setMinutes(result.getMinutes() + value);
    } else if (unit.startsWith('h')) {
      result.setHours(result.getHours() + value);
    } else if (unit.startsWith('d')) {
      result.setDate(result.getDate() + value);
    } else if (unit.startsWith('w')) {
      result.setDate(result.getDate() + value * 7);
    }

    return result;
  }

  // Duration without "in" prefix (for backward compatibility)
  const durationMatch = lower.match(/^(\d+)\s*(m|min|mins|minutes?|h|hr|hrs|hours?|d|days?)$/i);
  if (durationMatch) {
    const value = parseInt(durationMatch[1], 10);
    const unit = durationMatch[2].toLowerCase();

    const result = new Date(now);

    if (unit.startsWith('m')) {
      result.setMinutes(result.getMinutes() + value);
    } else if (unit.startsWith('h')) {
      result.setHours(result.getHours() + value);
    } else if (unit.startsWith('d')) {
      result.setDate(result.getDate() + value);
    }

    return result;
  }

  return null;
}

/**
 * Parse day-based expressions
 */
function parseDayExpression(input: string, now: Date): Date | null {
  const lower = input.toLowerCase().trim();

  // "monday", "tuesday", etc.
  for (const [dayName, dayIndex] of Object.entries(DAYS)) {
    if (lower === dayName) {
      return getNextDayOfWeek(dayIndex, now);
    }
  }

  // "next monday", "this friday"
  const nextDayMatch = lower.match(/^(next|this)\s+(\w+)$/);
  if (nextDayMatch) {
    const modifier = nextDayMatch[1];
    const dayName = nextDayMatch[2];
    const dayIndex = DAYS[dayName];

    if (dayIndex !== undefined) {
      const result = getNextDayOfWeek(dayIndex, now);
      if (modifier === 'next') {
        // "next monday" means the monday after the coming one
        result.setDate(result.getDate() + 7);
      }
      return result;
    }
  }

  return null;
}

/**
 * Parse a date with optional time
 */
function parseDateWithTime(input: string, now: Date): Date | null {
  const lower = input.toLowerCase().trim();

  // "monday at 3pm", "tomorrow at 9:30am"
  const atMatch = lower.match(/^(.+?)\s+at\s+(.+)$/);
  if (atMatch) {
    const datePart = atMatch[1];
    const timePart = atMatch[2];

    // Parse the date part
    const result = parseRelativeTime(datePart, now) || parseDayExpression(datePart, now);
    if (!result) return null;

    // Parse the time part
    const time = parseTime(timePart);
    if (!time) return null;

    result.setHours(time.hours, time.minutes, 0, 0);
    return result;
  }

  // Just time "at 3pm", "3pm"
  const justTime = parseTime(lower.replace(/^at\s+/, ''));
  if (justTime) {
    const result = new Date(now);
    result.setHours(justTime.hours, justTime.minutes, 0, 0);

    // If the time is in the past today, assume tomorrow
    if (result <= now) {
      result.setDate(result.getDate() + 1);
    }

    return result;
  }

  return null;
}

/**
 * Parse a specific date like "Jan 15", "December 25, 2025"
 */
function parseSpecificDate(input: string, now: Date): Date | null {
  const lower = input.toLowerCase().trim();

  // "Jan 15", "December 25", "Mar 3rd"
  const monthDayMatch = lower.match(/^(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?$/);
  if (monthDayMatch) {
    const monthName = monthDayMatch[1];
    const day = parseInt(monthDayMatch[2], 10);
    const year = monthDayMatch[3] ? parseInt(monthDayMatch[3], 10) : now.getFullYear();

    const monthIndex = MONTHS[monthName];
    if (monthIndex !== undefined && day >= 1 && day <= 31) {
      const result = new Date(year, monthIndex, day, 9, 0, 0, 0);

      // If the date is in the past and no year was specified, use next year
      if (!monthDayMatch[3] && result < now) {
        result.setFullYear(result.getFullYear() + 1);
      }

      return result;
    }
  }

  // "15 Jan", "25 December 2025"
  const dayMonthMatch = lower.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)(?:\s+(\d{4}))?$/);
  if (dayMonthMatch) {
    const day = parseInt(dayMonthMatch[1], 10);
    const monthName = dayMonthMatch[2];
    const year = dayMonthMatch[3] ? parseInt(dayMonthMatch[3], 10) : now.getFullYear();

    const monthIndex = MONTHS[monthName];
    if (monthIndex !== undefined && day >= 1 && day <= 31) {
      const result = new Date(year, monthIndex, day, 9, 0, 0, 0);

      if (!dayMonthMatch[3] && result < now) {
        result.setFullYear(result.getFullYear() + 1);
      }

      return result;
    }
  }

  return null;
}

/**
 * Main date parsing function
 * Parses natural language dates and returns a Date object
 */
export function parseNaturalDate(input: string, now: Date = new Date()): Date | null {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try ISO date first
  const isoDate = new Date(trimmed);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try relative time (today, tomorrow, in 2 hours)
  const relativeResult = parseRelativeTime(trimmed, now);
  if (relativeResult) return relativeResult;

  // Try day expressions (monday, next friday)
  const dayResult = parseDayExpression(trimmed, now);
  if (dayResult) return dayResult;

  // Try date with time (tomorrow at 3pm)
  const dateTimeResult = parseDateWithTime(trimmed, now);
  if (dateTimeResult) return dateTimeResult;

  // Try specific date (Jan 15, December 25 2025)
  const specificResult = parseSpecificDate(trimmed, now);
  if (specificResult) return specificResult;

  return null;
}

/**
 * Format a date for display
 */
export function formatDate(date: Date, includeTime = true): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const isTomorrow =
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear();

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (isToday) {
    return includeTime ? `Today at ${timeStr}` : 'Today';
  }

  if (isTomorrow) {
    return includeTime ? `Tomorrow at ${timeStr}` : 'Tomorrow';
  }

  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });

  return includeTime ? `${dateStr} at ${timeStr}` : dateStr;
}

/**
 * Parse a recurrence rule string (simple format)
 * Returns an object describing the recurrence pattern
 */
export function parseRecurrence(input: string): {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  interval?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
} | null {
  const lower = input.toLowerCase().trim();

  if (lower === 'daily' || lower === 'every day') {
    return { type: 'daily' };
  }

  if (lower === 'weekly' || lower === 'every week') {
    return { type: 'weekly' };
  }

  if (lower === 'monthly' || lower === 'every month') {
    return { type: 'monthly' };
  }

  if (lower === 'yearly' || lower === 'every year' || lower === 'annually') {
    return { type: 'yearly' };
  }

  // "every 2 days", "every 3 weeks"
  const intervalMatch = lower.match(/^every\s+(\d+)\s+(days?|weeks?|months?|years?)$/);
  if (intervalMatch) {
    const interval = parseInt(intervalMatch[1], 10);
    const unit = intervalMatch[2];

    if (unit.startsWith('day')) return { type: 'daily', interval };
    if (unit.startsWith('week')) return { type: 'weekly', interval };
    if (unit.startsWith('month')) return { type: 'monthly', interval };
    if (unit.startsWith('year')) return { type: 'yearly', interval };
  }

  // "every monday", "every mon, wed, fri"
  const everyDaysMatch = lower.match(/^every\s+(.+)$/);
  if (everyDaysMatch) {
    const daysPart = everyDaysMatch[1];
    const dayNames = daysPart.split(/[,\s]+/).filter(Boolean);
    const daysOfWeek: number[] = [];

    for (const dayName of dayNames) {
      const dayIndex = DAYS[dayName];
      if (dayIndex !== undefined) {
        daysOfWeek.push(dayIndex);
      }
    }

    if (daysOfWeek.length > 0) {
      return { type: 'custom', daysOfWeek };
    }
  }

  return null;
}

/**
 * Calculate the next occurrence of a recurring task
 */
export function getNextRecurrence(
  recurrenceType: string,
  recurrenceRule: string | null,
  lastOccurrence: Date
): Date {
  const result = new Date(lastOccurrence);

  switch (recurrenceType) {
    case 'daily':
      result.setDate(result.getDate() + 1);
      break;
    case 'weekly':
      result.setDate(result.getDate() + 7);
      break;
    case 'monthly':
      result.setMonth(result.getMonth() + 1);
      break;
    case 'yearly':
      result.setFullYear(result.getFullYear() + 1);
      break;
    case 'custom':
      // Parse the custom rule if provided
      if (recurrenceRule) {
        try {
          const rule = JSON.parse(recurrenceRule);
          if (rule.interval) {
            if (rule.type === 'daily') {
              result.setDate(result.getDate() + rule.interval);
            } else if (rule.type === 'weekly') {
              result.setDate(result.getDate() + rule.interval * 7);
            }
          } else if (rule.daysOfWeek) {
            // Find the next day that matches
            let found = false;
            for (let i = 1; i <= 7 && !found; i++) {
              const nextDate = new Date(result);
              nextDate.setDate(nextDate.getDate() + i);
              if (rule.daysOfWeek.includes(nextDate.getDay())) {
                result.setDate(nextDate.getDate());
                found = true;
              }
            }
          }
        } catch {
          // Default to daily if rule is invalid
          result.setDate(result.getDate() + 1);
        }
      } else {
        result.setDate(result.getDate() + 1);
      }
      break;
    default:
      result.setDate(result.getDate() + 1);
  }

  return result;
}
