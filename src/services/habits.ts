/**
 * Habit Tracking Service (TickTick-style)
 *
 * Features:
 * - Create and manage habits with daily/weekly frequency
 * - Track habit completions
 * - Calculate streaks
 * - Get completion statistics
 */

import { eq, and, desc, asc, gte, lte } from 'drizzle-orm';
import { db, habits, habitCompletions, type Habit, type HabitCompletion } from '../db/index.js';

// ============================================
// Habit CRUD Operations
// ============================================

/**
 * Create a new habit
 */
export function createHabit(data: {
  name: string;
  description?: string;
  frequency?: 'daily' | 'weekly' | 'custom';
  frequencyDays?: string[]; // For weekly: ["mon", "wed", "fri"]
  targetCount?: number;
  color?: string;
  reminderTime?: string; // "09:00"
}): Habit {
  return db
    .insert(habits)
    .values({
      name: data.name,
      description: data.description,
      frequency: data.frequency ?? 'daily',
      frequencyDays: data.frequencyDays ? JSON.stringify(data.frequencyDays) : null,
      targetCount: data.targetCount ?? 1,
      color: data.color ?? '#6366f1',
      reminderTime: data.reminderTime,
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
    .get();
}

/**
 * Get a habit by ID
 */
export function getHabit(id: number): Habit | undefined {
  return db.select().from(habits).where(eq(habits.id, id)).get();
}

/**
 * List all active habits
 */
export function listHabits(includeArchived = false): Habit[] {
  if (includeArchived) {
    return db.select().from(habits).orderBy(asc(habits.name)).all();
  }
  return db
    .select()
    .from(habits)
    .where(eq(habits.isArchived, false))
    .orderBy(asc(habits.name))
    .all();
}

/**
 * Update a habit
 */
export function updateHabit(
  id: number,
  data: {
    name?: string;
    description?: string;
    frequency?: string;
    frequencyDays?: string[];
    targetCount?: number;
    color?: string;
    reminderTime?: string;
  }
): Habit {
  const existing = getHabit(id);
  if (!existing) throw new Error(`Habit ${id} not found`);

  const updates: Partial<Habit> = { updatedAt: new Date() };

  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.frequency !== undefined) updates.frequency = data.frequency;
  if (data.frequencyDays !== undefined) updates.frequencyDays = JSON.stringify(data.frequencyDays);
  if (data.targetCount !== undefined) updates.targetCount = data.targetCount;
  if (data.color !== undefined) updates.color = data.color;
  if (data.reminderTime !== undefined) updates.reminderTime = data.reminderTime;

  return db.update(habits).set(updates).where(eq(habits.id, id)).returning().get();
}

/**
 * Archive a habit (soft delete)
 */
export function archiveHabit(id: number): Habit {
  const existing = getHabit(id);
  if (!existing) throw new Error(`Habit ${id} not found`);

  return db
    .update(habits)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(eq(habits.id, id))
    .returning()
    .get();
}

/**
 * Unarchive a habit
 */
export function unarchiveHabit(id: number): Habit {
  const existing = getHabit(id);
  if (!existing) throw new Error(`Habit ${id} not found`);

  return db
    .update(habits)
    .set({ isArchived: false, updatedAt: new Date() })
    .where(eq(habits.id, id))
    .returning()
    .get();
}

/**
 * Delete a habit permanently
 */
export function deleteHabit(id: number): boolean {
  const existing = getHabit(id);
  if (!existing) throw new Error(`Habit ${id} not found`);

  // Delete completions first
  db.delete(habitCompletions).where(eq(habitCompletions.habitId, id)).run();
  // Delete habit
  db.delete(habits).where(eq(habits.id, id)).run();

  return true;
}

// ============================================
// Habit Completion Operations
// ============================================

/**
 * Log a habit completion
 */
export function completeHabit(habitId: number, note?: string): HabitCompletion {
  const habit = getHabit(habitId);
  if (!habit) throw new Error(`Habit ${habitId} not found`);

  return db
    .insert(habitCompletions)
    .values({
      habitId,
      completedAt: new Date(),
      note,
    })
    .returning()
    .get();
}

/**
 * Get completions for a habit within a date range
 */
export function getCompletions(habitId: number, startDate: Date, endDate: Date): HabitCompletion[] {
  return db
    .select()
    .from(habitCompletions)
    .where(
      and(
        eq(habitCompletions.habitId, habitId),
        gte(habitCompletions.completedAt, startDate),
        lte(habitCompletions.completedAt, endDate)
      )
    )
    .orderBy(desc(habitCompletions.completedAt))
    .all();
}

/**
 * Get today's completions for a habit
 */
export function getTodayCompletions(habitId: number): HabitCompletion[] {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  return getCompletions(habitId, startOfDay, endOfDay);
}

/**
 * Check if a habit is completed for today
 */
export function isHabitCompletedToday(habitId: number): boolean {
  const habit = getHabit(habitId);
  if (!habit) return false;

  const todayCompletions = getTodayCompletions(habitId);
  return todayCompletions.length >= (habit.targetCount ?? 1);
}

/**
 * Delete a habit completion
 */
export function deleteCompletion(id: number): boolean {
  const completion = db.select().from(habitCompletions).where(eq(habitCompletions.id, id)).get();
  if (!completion) throw new Error(`Completion ${id} not found`);

  db.delete(habitCompletions).where(eq(habitCompletions.id, id)).run();
  return true;
}

// ============================================
// Streak Calculations
// ============================================

/**
 * Calculate the current streak for a habit
 */
export function getStreak(habitId: number): number {
  const habit = getHabit(habitId);
  if (!habit) return 0;

  // Get all completions sorted by date descending
  const allCompletions = db
    .select()
    .from(habitCompletions)
    .where(eq(habitCompletions.habitId, habitId))
    .orderBy(desc(habitCompletions.completedAt))
    .all();

  if (allCompletions.length === 0) return 0;

  // Group completions by date
  const completionsByDate = new Map<string, number>();
  for (const completion of allCompletions) {
    const dateStr = completion.completedAt.toISOString().split('T')[0];
    completionsByDate.set(dateStr, (completionsByDate.get(dateStr) ?? 0) + 1);
  }

  // Calculate streak
  let streak = 0;
  const today = new Date();
  const currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Check if today is completed
  const todayStr = currentDate.toISOString().split('T')[0];
  const todayCount = completionsByDate.get(todayStr) ?? 0;

  // If today is not started, check from yesterday
  if (todayCount === 0) {
    currentDate.setDate(currentDate.getDate() - 1);
  }

  // Count consecutive days
  let keepCounting = true;
  while (keepCounting) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const count = completionsByDate.get(dateStr) ?? 0;

    if (count >= (habit.targetCount ?? 1)) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      keepCounting = false;
    }
  }

  return streak;
}

/**
 * Get the best (longest) streak for a habit
 */
export function getBestStreak(habitId: number): number {
  const habit = getHabit(habitId);
  if (!habit) return 0;

  // Get all completions sorted by date
  const allCompletions = db
    .select()
    .from(habitCompletions)
    .where(eq(habitCompletions.habitId, habitId))
    .orderBy(asc(habitCompletions.completedAt))
    .all();

  if (allCompletions.length === 0) return 0;

  // Group completions by date
  const completionsByDate = new Map<string, number>();
  for (const completion of allCompletions) {
    const dateStr = completion.completedAt.toISOString().split('T')[0];
    completionsByDate.set(dateStr, (completionsByDate.get(dateStr) ?? 0) + 1);
  }

  // Find best streak
  let bestStreak = 0;
  let currentStreak = 0;
  let prevDate: Date | null = null;

  const sortedDates = Array.from(completionsByDate.keys()).sort();

  for (const dateStr of sortedDates) {
    const count = completionsByDate.get(dateStr) ?? 0;
    const currentDate = new Date(dateStr);

    if (count >= (habit.targetCount ?? 1)) {
      if (prevDate) {
        const dayDiff = Math.floor(
          (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (dayDiff === 1) {
          currentStreak++;
        } else {
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }
      prevDate = currentDate;
    } else {
      currentStreak = 0;
      prevDate = null;
    }

    if (currentStreak > bestStreak) {
      bestStreak = currentStreak;
    }
  }

  return bestStreak;
}

// ============================================
// Statistics
// ============================================

export interface HabitStats {
  habit: Habit;
  currentStreak: number;
  bestStreak: number;
  completedToday: boolean;
  todayCount: number;
  last7Days: number;
  last30Days: number;
  totalCompletions: number;
}

/**
 * Get comprehensive statistics for a habit
 */
export function getHabitStats(habitId: number): HabitStats | null {
  const habit = getHabit(habitId);
  if (!habit) return null;

  const now = new Date();
  const startOf7Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const startOf30Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const todayCompletions = getTodayCompletions(habitId);
  const last7DaysCompletions = getCompletions(habitId, startOf7Days, endOfToday);
  const last30DaysCompletions = getCompletions(habitId, startOf30Days, endOfToday);
  const allCompletions = db
    .select()
    .from(habitCompletions)
    .where(eq(habitCompletions.habitId, habitId))
    .all();

  return {
    habit,
    currentStreak: getStreak(habitId),
    bestStreak: getBestStreak(habitId),
    completedToday: todayCompletions.length >= (habit.targetCount ?? 1),
    todayCount: todayCompletions.length,
    last7Days: last7DaysCompletions.length,
    last30Days: last30DaysCompletions.length,
    totalCompletions: allCompletions.length,
  };
}

/**
 * Get today's habits status (for daily review)
 */
export function getTodayHabitsStatus(): Array<{ habit: Habit; completed: boolean; count: number }> {
  const activeHabits = listHabits(false);

  return activeHabits.map((habit) => {
    const todayCompletions = getTodayCompletions(habit.id);
    return {
      habit,
      completed: todayCompletions.length >= (habit.targetCount ?? 1),
      count: todayCompletions.length,
    };
  });
}
