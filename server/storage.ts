import { recipes, mealPlans, weeklyTargets, type Recipe, type InsertRecipe, type MealPlan, type InsertMealPlan, type WeeklyTargets, type InsertWeeklyTargets, type WeeklyMealPlan, type MealType, type DailyMacros, type WeeklyMacros } from "../shared/schema";

export interface IStorage {
  // Recipe operations (shared across all families)
  getRecipes(): Promise<Recipe[]>;
  getRecipe(id: number): Promise<Recipe | undefined>;
  createRecipe(recipe: InsertRecipe): Promise<Recipe>;
  updateRecipe(id: number, recipe: Partial<InsertRecipe>): Promise<Recipe | undefined>;
  deleteRecipe(id: number): Promise<boolean>;
  getRecipesByMealType(mealType: MealType): Promise<Recipe[]>;
  
  // Meal plan operations (family-specific)
  getMealPlansForWeek(familyId: number, weekStartDate: string): Promise<WeeklyMealPlan>;
  setMealPlan(familyId: number, mealPlan: Omit<InsertMealPlan, 'familyId'>): Promise<MealPlan>;
  removeMealPlan(familyId: number, weekStartDate: string, dayOfWeek: number, mealType: MealType): Promise<boolean>;
  removeSpecificMealPlan(familyId: number, weekStartDate: string, dayOfWeek: number, mealType: MealType, recipeId: number): Promise<boolean>;
  getRecipeUsageForWeek(familyId: number, weekStartDate: string, recipeId: number): Promise<number>;
  
  // Weekly targets (family-specific)
  getWeeklyTargets(familyId: number): Promise<WeeklyTargets>;
  updateWeeklyTargets(familyId: number, targets: Partial<Omit<InsertWeeklyTargets, 'familyId'>>): Promise<WeeklyTargets>;
  
  // Macro calculations (family-specific)
  calculateWeeklyMacros(familyId: number, weekStartDate: string): Promise<WeeklyMacros>;
}

import { DatabaseStorage } from "./database-storage";
export const storage = new DatabaseStorage();
