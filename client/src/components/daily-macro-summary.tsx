import type { WeeklyTargets } from "@shared/schema";
import { cn, formatNumber } from "@/lib/utils";

interface DayMacros {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface DayTotalsProps {
  macros: DayMacros;
  targets?: WeeklyTargets;
  compact?: boolean;
}

// Under 90% is still being planned (neutral), 90–110% is on track, above 110% is over.
function calorieStatus(current: number, target: number) {
  if (current === 0) return { label: "", bar: "bg-transparent", text: "text-muted-foreground" };
  const ratio = current / target;
  if (ratio > 1.1) return { label: `${formatNumber(current - target)} over`, bar: "bg-over", text: "text-over" };
  if (ratio >= 0.9) return { label: "On track", bar: "bg-on-track", text: "text-on-track" };
  return { label: `${formatNumber(target - current)} to go`, bar: "bg-foreground/35", text: "text-muted-foreground" };
}

export function DayTotals({ macros, targets, compact = false }: DayTotalsProps) {
  if (!targets) return null;
  const status = calorieStatus(macros.calories, targets.dailyCalories);
  const width = Math.min((macros.calories / targets.dailyCalories) * 100, 100);

  const macroItems = [
    { label: "Protein", short: "P", value: macros.protein, target: targets.dailyProtein },
    { label: "Carbs", short: "C", value: macros.carbs, target: targets.dailyCarbs },
    { label: "Fat", short: "F", value: macros.fats, target: targets.dailyFats },
  ];

  return (
    <div className={cn("tabular", compact ? "space-y-1.5" : "space-y-2")} data-testid="day-totals">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm">
          <span className="font-semibold text-foreground">{formatNumber(macros.calories)}</span>
          <span className="text-muted-foreground"> / {formatNumber(targets.dailyCalories)} cal</span>
        </span>
        <span className={cn("text-xs font-medium", status.text)}>{status.label}</span>
      </div>
      <div
        className="h-1.5 rounded-full bg-muted overflow-hidden"
        role="meter"
        aria-label="Calories against daily target"
        aria-valuemin={0}
        aria-valuemax={targets.dailyCalories}
        aria-valuenow={macros.calories}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-500 ease-out", status.bar)} style={{ width: `${width}%` }} />
      </div>
      <dl className="flex gap-3 text-xs text-muted-foreground">
        {macroItems.map((m) => (
          <div key={m.label} className="flex gap-1" title={`${m.label}: ${m.value}g of ${m.target}g`}>
            <dt>
              <abbr title={m.label} className="no-underline">{m.short}</abbr>
            </dt>
            <dd className={cn(m.value > m.target * 1.1 ? "text-over font-medium" : "text-foreground/80")}>
              {Math.round(m.value)}
              <span className="text-muted-foreground">/{m.target}g</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
