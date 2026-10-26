import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { WeeklyMealPlan, DayOfWeek, MealType } from "@shared/schema";
import { MealCard } from "./meal-card";
import { DisplayDay, formatShortDate } from "@/lib/dates";

interface MealCalendarProps {
  displayDays: DisplayDay[];
  mealPlansByWeek: Record<string, WeeklyMealPlan | undefined>;
  isLoading: boolean;
}

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MEAL_TYPES = [
  { name: 'Breakfast', color: 'bg-orange-50', dot: 'bg-orange-400' },
  { name: 'Lunch', color: 'bg-green-50', dot: 'bg-green-400' },
  { name: 'Snack', color: 'bg-purple-50', dot: 'bg-purple-400' },
  { name: 'Dinner', color: 'bg-blue-50', dot: 'bg-blue-400' },
];

export function MealCalendar({ displayDays, mealPlansByWeek, isLoading }: MealCalendarProps) {
  const recipesFor = (day: DisplayDay, mealType: MealType) =>
    mealPlansByWeek[day.weekStart]?.meals[day.dayIndex]?.[mealType] || [];

  if (isLoading) {
    return (
      <Card className="rounded-xl shadow-sm border overflow-hidden mb-6">
        <div className="p-4">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="grid grid-cols-5 gap-3">
                <Skeleton className="h-4 w-16" />
                {[...Array(4)].map((_, j) => (
                  <Skeleton key={j} className="h-32 rounded-lg" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl shadow-sm border overflow-hidden mb-6">
      {/* Calendar Header - Desktop */}
      <div className="hidden sm:grid grid-cols-5 bg-muted/50 border-b border-border">
        <div className="p-3 sm:p-4 border-r border-border">
          <div className="text-sm font-medium text-muted-foreground">Meal</div>
        </div>
        {displayDays.map((day) => (
          <div key={day.date} className="p-3 sm:p-4 border-r border-border last:border-r-0 text-center">
            <div className={`text-sm font-medium ${day.isToday ? 'text-primary' : 'text-foreground'}`}>
              {ALL_DAYS[day.dayIndex]}
              {day.isToday && <span className="ml-1 text-xs">(Today)</span>}
            </div>
            <div className="text-xs text-muted-foreground">{formatShortDate(day.date)}</div>
          </div>
        ))}
      </div>

      {/* Desktop Meal Rows */}
      <div className="hidden sm:block">
        {MEAL_TYPES.map((mealType, mealIndex) => (
          <div key={mealType.name} className={`grid grid-cols-5 ${mealIndex < MEAL_TYPES.length - 1 ? 'border-b border-border' : ''}`}>
            {/* Meal Type Label */}
            <div className={`p-3 sm:p-4 border-r border-border ${mealType.color} flex items-center`}>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 ${mealType.dot} rounded-full`}></div>
                <span className="text-sm font-medium text-foreground">{mealType.name}</span>
              </div>
            </div>

            {/* Meal Slots for Each Day */}
            {displayDays.map((day) => (
              <div key={day.date} className="p-2 sm:p-3 border-r border-border last:border-r-0 meal-slot flex items-stretch">
                <div className="w-full">
                  <MealCard
                    weekStartDate={day.weekStart}
                    dayOfWeek={day.dayIndex as DayOfWeek}
                    mealType={mealType.name.toLowerCase() as MealType}
                    recipes={recipesFor(day, mealType.name.toLowerCase() as MealType)}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Mobile Layout - Stacked by Day */}
      <div className="sm:hidden">
        {displayDays.map((day) => (
          <div key={day.date} className="border-b border-border last:border-b-0">
            {/* Day Header */}
            <div className="bg-muted/50 p-4 border-b border-border">
              <div className={`text-lg font-semibold ${day.isToday ? 'text-primary' : 'text-foreground'}`}>
                {ALL_DAYS[day.dayIndex]}
                {day.isToday && <span className="ml-2 text-sm">(Today)</span>}
              </div>
              <div className="text-sm text-muted-foreground">{formatShortDate(day.date)}</div>
            </div>

            {/* Meals for this day */}
            <div className="space-y-0">
              {MEAL_TYPES.map((mealType, mealIndex) => (
                <div key={mealType.name} className={`${mealIndex < MEAL_TYPES.length - 1 ? 'border-b border-border/50' : ''}`}>
                  <div className="flex">
                    {/* Meal Type Label */}
                    <div className={`w-24 ${mealType.color} flex items-center p-3 border-r border-border`}>
                      <div className="flex flex-col items-center space-y-1">
                        <div className={`w-3 h-3 ${mealType.dot} rounded-full`}></div>
                        <span className="text-xs font-medium text-foreground text-center">{mealType.name}</span>
                      </div>
                    </div>

                    {/* Meal Slot */}
                    <div className="flex-1 p-3">
                      <MealCard
                        weekStartDate={day.weekStart}
                        dayOfWeek={day.dayIndex as DayOfWeek}
                        mealType={mealType.name.toLowerCase() as MealType}
                        recipes={recipesFor(day, mealType.name.toLowerCase() as MealType)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
