// dateUtils.ts - Create this file for timezone-safe date handling

/**
 * Get today's date in the user's local timezone
 * Returns YYYY-MM-DD format string
 */
export const getTodayLocal = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  const today = `${year}-${month}-${day}`;
  console.log('📅 Today (local):', today);
  return today;
};

/**
 * Get current date in user's timezone using Intl API
 * More reliable than Date methods
 */
export const getTodayInTimezone = (timezone?: string): string => {
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', { // en-CA gives YYYY-MM-DD format
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const today = formatter.format(now);
  console.log(`📅 Today in ${tz}:`, today);
  return today;
};

/**
 * Check if a date string is today
 */
export const isToday = (dateString: string): boolean => {
  const today = getTodayLocal();
  return dateString === today;
};

/**
 * Format a date for display
 */
export const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString + 'T00:00:00'); // Add time to prevent timezone issues
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
};

/**
 * Get date string from Date object in YYYY-MM-DD format
 * WITHOUT timezone conversion issues
 */
export const dateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parse YYYY-MM-DD string to Date object
 * WITHOUT timezone conversion issues
 */
export const parseYYYYMMDD = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Get the start of today as a Date object
 */
export const getStartOfToday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

/**
 * Compare two date strings (YYYY-MM-DD format)
 */
export const compareDates = (date1: string, date2: string): number => {
  const d1 = parseYYYYMMDD(date1);
  const d2 = parseYYYYMMDD(date2);
  return d1.getTime() - d2.getTime();
};

/**
 * Check if date1 is before date2
 */
export const isBefore = (date1: string, date2: string): boolean => {
  return compareDates(date1, date2) < 0;
};

/**
 * Check if date1 is after date2
 */
export const isAfter = (date1: string, date2: string): boolean => {
  return compareDates(date1, date2) > 0;
};

/**
 * Add days to a date string
 */
export const addDays = (dateString: string, days: number): string => {
  const date = parseYYYYMMDD(dateString);
  date.setDate(date.getDate() + days);
  return dateToYYYYMMDD(date);
};

/**
 * Get days between two dates
 */
export const daysBetween = (date1: string, date2: string): number => {
  const d1 = parseYYYYMMDD(date1);
  const d2 = parseYYYYMMDD(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Example usage in your components:
/*
import { getTodayLocal, getTodayInTimezone, isToday } from '@/utils/dateUtils';

// Get today's date
const today = getTodayLocal(); // "2025-10-08"

// Check if assignment is due today
const isDueToday = isToday(assignment.date);

// Get today in specific timezone
const todayPST = getTodayInTimezone('America/Los_Angeles');
*/