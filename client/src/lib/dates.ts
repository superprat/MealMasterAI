// Date helpers for "YYYY-MM-DD" keys, always in the user's local time zone.
// Avoid new Date("YYYY-MM-DD") (parsed as UTC) and toISOString() (formats as UTC).

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

// Monday = 0 ... Sunday = 6, matching meal_plans.day_of_week
export function dayIndexOf(key: string): number {
  return (parseDateKey(key).getDay() + 6) % 7;
}

// Monday of the week containing this date
export function weekStartOf(key: string): string {
  return addDays(key, -dayIndexOf(key));
}

export function formatShortDate(key: string): string {
  return parseDateKey(key).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export interface DisplayDay {
  date: string;
  dayIndex: number;
  weekStart: string;
  isToday: boolean;
}

export function getDisplayDays(startKey: string, count = 4): DisplayDay[] {
  const today = todayKey();
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(startKey, i);
    return { date, dayIndex: dayIndexOf(date), weekStart: weekStartOf(date), isToday: date === today };
  });
}
