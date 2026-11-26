/**
 * Selection Window Utilities for MessMate (Asia/Kolkata timezone)
 *
 * Rule:
 * Selection window is open from the 25th of the current month
 * through the last calendar day of the current month, inclusive.
 *
 * During this window, students select mess and add-ons for the UPCOMING month.
 * e.g., On Nov 26, 2026: window is open for Dec 2026 (2026-12).
 */

export interface SelectionWindowStatus {
  isOpen: boolean;
  currentDate: string; // YYYY-MM-DD
  dayOfMonth: number;
  lastDayOfMonth: number;
  currentMonthYear: string; // YYYY-MM
  targetMonthYear: string; // YYYY-MM (upcoming month)
  windowStartDate: string; // YYYY-MM-25
  windowEndDate: string; // YYYY-MM-lastDay
  message: string;
}

/**
 * Returns current date and time components in Asia/Kolkata timezone
 */
export function getKolkataDate(baseDate?: Date | string): {
  year: number;
  month: number; // 1-12
  day: number;
  dateStr: string; // YYYY-MM-DD
  monthYear: string; // YYYY-MM
} {
  const d = baseDate ? new Date(baseDate) : new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.format(d).split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const monthYear = `${year}-${String(month).padStart(2, "0")}`;
  return { year, month, day, dateStr, monthYear };
}

/**
 * Calculates last calendar day of any given year and month (handles leap years)
 */
export function getLastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Calculates the upcoming month string (YYYY-MM) given a year and month
 */
export function getNextMonthYear(year: number, month: number): string {
  if (month === 12) {
    return `${year + 1}-01`;
  }
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/**
 * Checks whether the monthly mess and add-on selection window is open.
 * Can accept an optional simulated date for testing.
 */
export function checkSelectionWindow(overrideDate?: Date | string): SelectionWindowStatus {
  const { year, month, day, dateStr, monthYear } = getKolkataDate(overrideDate);
  const lastDay = getLastDayOfMonth(year, month);
  const targetMonthYear = getNextMonthYear(year, month);

  const windowStartDate = `${year}-${String(month).padStart(2, "0")}-25`;
  const windowEndDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const isOpen = day >= 25 && day <= lastDay;

  let message = "";
  if (isOpen) {
    message = `Monthly selection window for ${targetMonthYear} is open until ${windowEndDate}.`;
  } else if (day < 25) {
    message = `Monthly selection window for ${targetMonthYear} opens on ${windowStartDate}.`;
  } else {
    message = `Monthly selection window for ${targetMonthYear} has closed on ${windowEndDate}.`;
  }

  return {
    isOpen,
    currentDate: dateStr,
    dayOfMonth: day,
    lastDayOfMonth: lastDay,
    currentMonthYear: monthYear,
    targetMonthYear,
    windowStartDate,
    windowEndDate,
    message,
  };
}
