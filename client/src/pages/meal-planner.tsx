import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChefHat } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { MealCalendar } from "@/components/meal-calendar";
import { AIRecommendationModal } from "@/components/ai-recommendation-modal";
import { formatNumber } from "@/lib/utils";
import { addDays, formatShortDate, getDisplayDays, parseDateKey, todayKey } from "@/lib/dates";
import { MEAL_TYPES } from "@/lib/meals";
import type { WeeklyMacros, WeeklyMealPlan, WeeklyTargets } from "@shared/schema";

const DAYS_SHOWN = 4;

// "Oct 26 – 29" within a month, "Oct 30 – Nov 2" across months
function formatPeriod(startDate: string): string {
  const endDate = addDays(startDate, DAYS_SHOWN - 1);
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  if (start.getMonth() === end.getMonth()) {
    return `${formatShortDate(startDate)} – ${end.getDate()}`;
  }
  return `${formatShortDate(startDate)} – ${formatShortDate(endDate)}`;
}

export default function MealPlanner() {
  const [viewStartDate, setViewStartDate] = useState(todayKey());
  const [showAIModal, setShowAIModal] = useState(false);

  // The visible days can span two Monday-based weeks; fetch both
  const displayDays = getDisplayDays(viewStartDate, DAYS_SHOWN);
  const weekStartForAPI = displayDays[0].weekStart;
  const nextWeekStart = displayDays[displayDays.length - 1].weekStart;

  const { data: mealPlan, isLoading: mealPlanLoading } = useQuery<WeeklyMealPlan>({
    queryKey: ['/api/meal-plans', weekStartForAPI],
  });
  const { data: nextMealPlan, isLoading: nextMealPlanLoading } = useQuery<WeeklyMealPlan>({
    queryKey: ['/api/meal-plans', nextWeekStart],
  });
  const { data: weeklyMacros } = useQuery<WeeklyMacros>({
    queryKey: ['/api/macros', weekStartForAPI],
  });
  const { data: nextWeeklyMacros } = useQuery<WeeklyMacros>({
    queryKey: ['/api/macros', nextWeekStart],
  });
  const { data: targets } = useQuery<WeeklyTargets>({
    queryKey: ['/api/targets'],
  });

  const mealPlansByWeek: Record<string, WeeklyMealPlan | undefined> = {
    [weekStartForAPI]: mealPlan,
    [nextWeekStart]: nextMealPlan,
  };
  const macrosByWeek: Record<string, WeeklyMacros | undefined> = {
    [weekStartForAPI]: weeklyMacros,
    [nextWeekStart]: nextWeeklyMacros,
  };

  const totalSlots = displayDays.length * MEAL_TYPES.length;
  const plannedSlots = displayDays.reduce((count, day) => {
    const meals = mealPlansByWeek[day.weekStart]?.meals[day.dayIndex];
    return count + MEAL_TYPES.filter(({ type }) => (meals?.[type]?.length ?? 0) > 0).length;
  }, 0);

  const isViewingToday = viewStartDate === todayKey();
  const year = parseDateKey(viewStartDate).getFullYear();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between mb-6 sm:mb-8">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl text-foreground leading-tight" data-testid="text-period">
              {formatPeriod(viewStartDate)}
              <span className="ml-2 text-muted-foreground/70 text-xl sm:text-2xl">{year}</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
              {mealPlanLoading || nextMealPlanLoading
                ? "Loading meals…"
                : plannedSlots === 0
                  ? "Nothing planned yet. Pick a slot to add a recipe."
                  : `${plannedSlots} of ${totalSlots} meals planned`}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Change days">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setViewStartDate(addDays(viewStartDate, -DAYS_SHOWN))}
                aria-label={`Previous ${DAYS_SHOWN} days`}
                data-testid="button-prev-days"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3"
                onClick={() => setViewStartDate(todayKey())}
                disabled={isViewingToday}
                data-testid="button-today"
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setViewStartDate(addDays(viewStartDate, DAYS_SHOWN))}
                aria-label={`Next ${DAYS_SHOWN} days`}
                data-testid="button-next-days"
              >
                <ChevronRight />
              </Button>
            </div>

            <Button onClick={() => setShowAIModal(true)} className="ml-auto sm:ml-0" data-testid="button-suggest-meals">
              <ChefHat />
              Suggest meals
            </Button>
          </div>
        </div>

        <MealCalendar
          displayDays={displayDays}
          mealPlansByWeek={mealPlansByWeek}
          macrosByWeek={macrosByWeek}
          targets={targets}
          isLoading={mealPlanLoading || nextMealPlanLoading}
        />

        {targets && (
          <p className="mt-4 text-xs text-muted-foreground tabular">
            Daily target: {formatNumber(targets.dailyCalories)} cal · {targets.dailyProtein}g protein · {targets.dailyCarbs}g carbs · {targets.dailyFats}g fat
          </p>
        )}
      </main>

      <AIRecommendationModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        weekStartDate={weekStartForAPI}
      />
    </div>
  );
}
