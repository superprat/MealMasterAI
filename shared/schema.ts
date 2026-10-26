import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const families = pgTable("families", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  password: text("password").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  calories: integer("calories").notNull(),
  protein: integer("protein").notNull(), // in grams
  carbs: integer("carbs").notNull(), // in grams
  fats: integer("fats").notNull(), // in grams
  mealTypes: text("meal_types").array().notNull(), // ["breakfast", "lunch", "snack", "dinner"]
  maxWeeklyUses: integer("max_weekly_uses").notNull().default(3),
  isAiSuggested: boolean("is_ai_suggested").notNull().default(false),
  isApproved: boolean("is_approved").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const mealPlans = pgTable("meal_plans", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").references(() => families.id).notNull(),
  weekStartDate: text("week_start_date").notNull(), // YYYY-MM-DD format
  dayOfWeek: integer("day_of_week").notNull(), // 0-6 (Monday to Sunday)
  mealType: text("meal_type").notNull(), // breakfast, lunch, snack, dinner
  recipeId: integer("recipe_id").references(() => recipes.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const weeklyTargets = pgTable("weekly_targets", {
  id: serial("id").primaryKey(),
  familyId: integer("family_id").references(() => families.id).notNull(),
  dailyCalories: integer("daily_calories").notNull().default(2000),
  dailyProtein: integer("daily_protein").notNull().default(150),
  dailyCarbs: integer("daily_carbs").notNull().default(250),
  dailyFats: integer("daily_fats").notNull().default(67),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFamilySchema = createInsertSchema(families).omit({
  id: true,
  createdAt: true,
});

export const insertRecipeSchema = createInsertSchema(recipes).omit({
  id: true,
  createdAt: true,
});

export const insertMealPlanSchema = createInsertSchema(mealPlans).omit({
  id: true,
  createdAt: true,
});

export const insertWeeklyTargetsSchema = createInsertSchema(weeklyTargets).omit({
  id: true,
  createdAt: true,
});

export type Family = typeof families.$inferSelect;
export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type MealPlan = typeof mealPlans.$inferSelect;
export type InsertMealPlan = z.infer<typeof insertMealPlanSchema>;
export type WeeklyTargets = typeof weeklyTargets.$inferSelect;
export type InsertWeeklyTargets = z.infer<typeof insertWeeklyTargetsSchema>;

// Helper types for frontend
export type MealType = "breakfast" | "lunch" | "snack" | "dinner";
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface WeeklyMealPlan {
  weekStartDate: string;
  meals: {
    [key: number]: { // day of week (0-6)
      breakfast?: Recipe[];
      lunch?: Recipe[];
      snack?: Recipe[];
      dinner?: Recipe[];
    };
  };
}

export interface DailyMacros {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export interface WeeklyMacros {
  [key: number]: DailyMacros; // day of week (0-6)
}
