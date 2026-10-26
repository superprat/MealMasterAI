import { Card, CardContent } from "@/components/ui/card";
import { WeeklyMacros, WeeklyTargets } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/utils";

interface WeeklyOverviewProps {
  weeklyMacros: WeeklyMacros;
  targets: WeeklyTargets;
  isLoading: boolean;
}

export function WeeklyOverview({ weeklyMacros, targets, isLoading }: WeeklyOverviewProps) {
  if (isLoading) {
    return (
      <Card className="rounded-xl p-4 sm:p-6 shadow-sm border mb-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="text-center">
              <Skeleton className="w-12 h-12 sm:w-16 sm:h-16 rounded-full mx-auto mb-2" />
              <Skeleton className="h-3 sm:h-4 w-12 sm:w-16 mx-auto mb-1" />
              <Skeleton className="h-2 sm:h-3 w-16 sm:w-20 mx-auto" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  // Calculate weekly totals
  const weeklyTotals = Object.values(weeklyMacros).reduce(
    (acc, day) => ({
      calories: acc.calories + day.calories,
      protein: acc.protein + day.protein,
      carbs: acc.carbs + day.carbs,
      fats: acc.fats + day.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  const weeklyTargets = {
    calories: targets.dailyCalories * 7,
    protein: targets.dailyProtein * 7,
    carbs: targets.dailyCarbs * 7,
    fats: targets.dailyFats * 7,
  };

  const calculatePercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const CircularProgress = ({ label, percentage, color, value, target, unit }: {
    label: string;
    percentage: number;
    color: string;
    value: number;
    target: number;
    unit: string;
  }) => {
    const strokeDasharray = 251.2; // 2 * π * 40
    const strokeDashoffset = strokeDasharray - (strokeDasharray * percentage) / 100;

    return (
      <div className="text-center">
        <div className="relative w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2">
          <svg className="w-12 h-12 sm:w-16 sm:h-16 transform -rotate-90" viewBox="0 0 100 100">
            <circle 
              cx="50" 
              cy="50" 
              r="40" 
              stroke="hsl(var(--border))" 
              strokeWidth="8" 
              fill="transparent"
            />
            <circle 
              cx="50" 
              cy="50" 
              r="40" 
              stroke={color} 
              strokeWidth="8" 
              fill="transparent"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs sm:text-sm font-semibold text-foreground">
              {Math.round(percentage)}%
            </span>
          </div>
        </div>
        <div className="text-xs sm:text-sm font-medium text-foreground">
          {label}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatNumber(value)}{unit} / {formatNumber(target)}{unit}
        </div>
      </div>
    );
  };

  return (
    <Card className="rounded-xl p-4 sm:p-6 shadow-sm border mb-6">
      <h3 className="text-base sm:text-lg font-display font-semibold text-foreground mb-4">Weekly Macro Overview</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
        <CircularProgress
          label="Calories"
          percentage={calculatePercentage(weeklyTotals.calories, weeklyTargets.calories)}
          color="hsl(210, 35%, 52%)" // primary blue
          value={weeklyTotals.calories}
          target={weeklyTargets.calories}
          unit=" cal"
        />
        <CircularProgress
          label="Protein"
          percentage={calculatePercentage(weeklyTotals.protein, weeklyTargets.protein)}
          color="hsl(142, 45%, 50%)" // muted green
          value={weeklyTotals.protein}
          target={weeklyTargets.protein}
          unit="g"
        />
        <CircularProgress
          label="Carbs"
          percentage={calculatePercentage(weeklyTotals.carbs, weeklyTargets.carbs)}
          color="hsl(38, 70%, 55%)" // muted orange
          value={weeklyTotals.carbs}
          target={weeklyTargets.carbs}
          unit="g"
        />
        <CircularProgress
          label="Fats"
          percentage={calculatePercentage(weeklyTotals.fats, weeklyTargets.fats)}
          color="hsl(0, 65%, 55%)" // muted red
          value={weeklyTotals.fats}
          target={weeklyTargets.fats}
          unit="g"
        />
      </div>
    </Card>
  );
}
