import { Card, CardContent } from "@/components/ui/card";
import { WeeklyMacros, WeeklyTargets } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/utils";
import { DisplayDay } from "@/lib/dates";

interface DailyMacroSummaryProps {
  macrosByWeek: Record<string, WeeklyMacros | undefined>;
  targets: WeeklyTargets;
  displayDays: DisplayDay[];
  isLoading: boolean;
}

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function DailyMacroSummary({ macrosByWeek, targets, displayDays, isLoading }: DailyMacroSummaryProps) {

  if (isLoading) {
    return (
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="shadow-sm border">
            <CardContent className="p-4">
              <Skeleton className="h-4 w-16 mb-3" />
              <div className="space-y-2">
                {[...Array(4)].map((_, j) => (
                  <div key={j}>
                    <Skeleton className="h-3 w-full mb-1" />
                    <Skeleton className="h-1.5 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const calculatePercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage < 50) return 'bg-destructive';
    if (percentage < 80) return 'bg-yellow-500';
    if (percentage <= 100) return 'bg-primary';
    return 'bg-destructive'; // Over target
  };

  const MacroBar = ({ current, target, label, color }: {
    current: number;
    target: number;
    label: string;
    color: string;
  }) => {
    const percentage = calculatePercentage(current, target);
    const isOver = current > target;
    
    return (
      <>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className={`font-medium ${isOver ? 'text-destructive' : 'text-foreground'}`}>
            {formatNumber(current)}{label === 'Calories' ? '' : 'g'} / {formatNumber(target)}{label === 'Calories' ? '' : 'g'}
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5">
          <div 
            className={`${color} h-1.5 rounded-full transition-all duration-300`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </>
    );
  };

  return (
    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {displayDays.map((day) => {
        const dayMacros = macrosByWeek[day.weekStart]?.[day.dayIndex] || { calories: 0, protein: 0, carbs: 0, fats: 0 };
        
        const caloriesPercentage = calculatePercentage(dayMacros.calories, targets.dailyCalories);
        const proteinPercentage = calculatePercentage(dayMacros.protein, targets.dailyProtein);
        const carbsPercentage = calculatePercentage(dayMacros.carbs, targets.dailyCarbs);
        const fatsPercentage = calculatePercentage(dayMacros.fats, targets.dailyFats);

        return (
          <Card key={day.date} className="shadow-sm border">
            <CardContent className="p-3 sm:p-4">
              <div className={`text-sm font-semibold mb-3 ${day.isToday ? 'text-primary' : 'text-foreground'}`}>
                {ALL_DAYS[day.dayIndex]}
                {day.isToday && <span className="ml-1 text-xs">(Today)</span>}
              </div>
              <div className="space-y-2">
                <MacroBar
                  current={dayMacros.calories}
                  target={targets.dailyCalories}
                  label="Calories"
                  color={getProgressColor(caloriesPercentage)}
                />
                <MacroBar
                  current={dayMacros.protein}
                  target={targets.dailyProtein}
                  label="Protein"
                  color={getProgressColor(proteinPercentage)}
                />
                <MacroBar
                  current={dayMacros.carbs}
                  target={targets.dailyCarbs}
                  label="Carbs"
                  color={getProgressColor(carbsPercentage)}
                />
                <MacroBar
                  current={dayMacros.fats}
                  target={targets.dailyFats}
                  label="Fats"
                  color={getProgressColor(fatsPercentage)}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
