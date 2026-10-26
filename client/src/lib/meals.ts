import type { MealType } from "@shared/schema";

// One place for meal-type labels and colours (tokens live in index.css)
export const MEAL_TYPES: { type: MealType; label: string; dot: string; soft: string; text: string }[] = [
  { type: "breakfast", label: "Breakfast", dot: "bg-meal-breakfast", soft: "bg-meal-breakfast-soft", text: "text-meal-breakfast" },
  { type: "lunch", label: "Lunch", dot: "bg-meal-lunch", soft: "bg-meal-lunch-soft", text: "text-meal-lunch" },
  { type: "snack", label: "Snack", dot: "bg-meal-snack", soft: "bg-meal-snack-soft", text: "text-meal-snack" },
  { type: "dinner", label: "Dinner", dot: "bg-meal-dinner", soft: "bg-meal-dinner-soft", text: "text-meal-dinner" },
];

export const MEAL_TYPE_STYLE = Object.fromEntries(MEAL_TYPES.map((m) => [m.type, m])) as Record<
  MealType,
  (typeof MEAL_TYPES)[number]
>;

export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
