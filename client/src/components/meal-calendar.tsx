import { Skeleton } from "@/components/ui/skeleton";
import type { WeeklyMacros, WeeklyMealPlan, WeeklyTargets, DayOfWeek } from "@shared/schema";
import { MealCard } from "./meal-card";
import { DayTotals } from "./daily-macro-summary";
import { DisplayDay, formatShortDate } from "@/lib/dates";
import { DAY_NAMES, MEAL_TYPES } from "@/lib/meals";
import { cn } from "@/lib/utils";

interface MealCalendarProps {
  displayDays: DisplayDay[];
  mealPlansByWeek: Record<string, WeeklyMealPlan | undefined>;
  macrosByWeek: Record<string, WeeklyMacros | undefined>;
  targets?: WeeklyTargets;
  isLoading: boolean;
}

const EMPTY_MACROS = { calories: 0, protein: 0, carbs: 0, fats: 0 };

function TodayTag() {
  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground align-middle">
      Today
    </span>
  );
}

export function MealCalendar({ displayDays, mealPlansByWeek, macrosByWeek, targets, isLoading }: MealCalendarProps) {
  const mealPlanFor = (day: DisplayDay) => mealPlansByWeek[day.weekStart]?.meals[day.dayIndex];
  const macrosFor = (day: DisplayDay) => macrosByWeek[day.weekStart]?.[day.dayIndex] ?? EMPTY_MACROS;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6" aria-busy="true">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-5 w-24" />
              {[...Array(4)].map((_, j) => (
                <Skeleton key={j} className="h-24 rounded-lg" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section aria-label="Meal calendar">
      {/* Desktop: meals as rows, days as columns, day totals as the footer row */}
      <div className="hidden sm:grid grid-cols-[7.5rem_repeat(4,minmax(0,1fr))] rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border" />
        {displayDays.map((day) => (
          <div
            key={day.date}
            className={cn("px-3 py-3 border-b border-l border-border", day.isToday && "bg-primary/[0.06]")}
          >
            <div className={cn("font-display text-lg leading-tight", day.isToday ? "text-primary" : "text-foreground")}>
              {DAY_NAMES[day.dayIndex]}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {formatShortDate(day.date)}
              {day.isToday && <TodayTag />}
            </div>
          </div>
        ))}

        {MEAL_TYPES.map((meal) => (
          <div key={meal.type} className="contents">
            <div className="px-3 py-3 border-b border-border flex items-start gap-2">
              <span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", meal.dot)} aria-hidden />
              <span className="text-sm font-medium text-foreground">{meal.label}</span>
            </div>
            {displayDays.map((day) => (
              <div
                key={day.date}
                className={cn("p-2 border-b border-l border-border", day.isToday && "bg-primary/[0.06]")}
              >
                <MealCard
                  weekStartDate={day.weekStart}
                  dayOfWeek={day.dayIndex as DayOfWeek}
                  mealType={meal.type}
                  recipes={mealPlanFor(day)?.[meal.type] || []}
                />
              </div>
            ))}
          </div>
        ))}

        <div className="px-3 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Day total</div>
        {displayDays.map((day) => (
          <div key={day.date} className={cn("px-3 py-3 border-l border-border", day.isToday && "bg-primary/[0.06]")}>
            <DayTotals macros={macrosFor(day)} targets={targets} />
          </div>
        ))}
      </div>

      {/* Mobile: one block per day */}
      <div className="sm:hidden space-y-4">
        {displayDays.map((day) => (
          <article
            key={day.date}
            className={cn("rounded-xl border bg-card", day.isToday ? "border-primary/40" : "border-border")}
            aria-label={`${DAY_NAMES[day.dayIndex]}, ${formatShortDate(day.date)}`}
          >
            <header className="px-4 pt-4 pb-3 border-b border-border space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className={cn("font-display text-xl", day.isToday ? "text-primary" : "text-foreground")}>
                  {DAY_NAMES[day.dayIndex]}
                </h2>
                <span className="text-sm text-muted-foreground">
                  {formatShortDate(day.date)}
                  {day.isToday && <TodayTag />}
                </span>
              </div>
              <DayTotals macros={macrosFor(day)} targets={targets} compact />
            </header>
            <div className="divide-y divide-border">
              {MEAL_TYPES.map((meal) => (
                <div key={meal.type} className="flex gap-3 px-4 py-3">
                  <div className="w-20 shrink-0 flex items-start gap-2 pt-2">
                    <span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", meal.dot)} aria-hidden />
                    <span className="text-sm font-medium text-foreground">{meal.label}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <MealCard
                      weekStartDate={day.weekStart}
                      dayOfWeek={day.dayIndex as DayOfWeek}
                      mealType={meal.type}
                      recipes={mealPlanFor(day)?.[meal.type] || []}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
