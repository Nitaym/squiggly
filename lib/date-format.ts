const STABLE_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
});

/**
 * Hydration-safe date formatting.
 * Uses a fixed locale + timezone so server and client render identical text.
 */
export function formatDateStable(dateLike: string | number | Date): string {
  return STABLE_DATE_FORMATTER.format(new Date(dateLike));
}

// Backward-compatible alias used in some components.
export const formatStableDate = formatDateStable;
