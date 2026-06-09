export const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Canonical UTC day bucket: any time on a given date maps to the same value, and
// day differences come out as whole numbers. Returns epoch ms at 00:00:00.000
// UTC of that day.
export function utcDayKey(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

// Canonical week bucket: epoch ms at UTC midnight of that week's Monday.
export function utcWeekKey(date: Date): number {
  const dayMidnight = utcDayKey(date);
  const dayOfWeek = new Date(dayMidnight).getUTCDay(); // 0=Sun .. 6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return dayMidnight - daysSinceMonday * MS_PER_DAY;
}
