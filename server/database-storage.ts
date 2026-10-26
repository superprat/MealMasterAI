import { recipes, mealPlans, weeklyTargets, type Recipe, type InsertRecipe, type MealPlan, type InsertMealPlan, type WeeklyTargets, type InsertWeeklyTargets, type WeeklyMealPlan, type MealType, type DailyMacros, type WeeklyMacros } from "../shared/schema";
import { db } from "./db";
import { eq, and, sql, isNotNull } from "drizzle-orm";
import { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  async getRecipes(): Promise<Recipe[]> {
    const result = await db.select().from(recipes).orderBy(recipes.name);
    return result;
  }

  async getRecipe(id: number): Promise<Recipe | undefined> {
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id));
    return recipe || undefined;
  }

  // Case- and whitespace-insensitive, so "Mutton biryani" matches "mutton Biryani "
  async getRecipeByName(name: string): Promise<Recipe | undefined> {
    const [recipe] = await db
      .select()
      .from(recipes)
      .where(sql`lower(trim(${recipes.name})) = lower(trim(${name}))`);
    return recipe || undefined;
  }

  async createRecipe(recipe: InsertRecipe): Promise<Recipe> {
    const [newRecipe] = await db
      .insert(recipes)
      .values(recipe)
      .returning();
    return newRecipe;
  }

  async updateRecipe(id: number, recipe: Partial<InsertRecipe>): Promise<Recipe | undefined> {
    const [updated] = await db
      .update(recipes)
      .set(recipe)
      .where(eq(recipes.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteRecipe(id: number): Promise<boolean> {
    // First, delete all meal plans that reference this recipe
    await db.delete(mealPlans).where(eq(mealPlans.recipeId, id));
    
    // Then delete the recipe
    const result = await db.delete(recipes).where(eq(recipes.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getRecipesByMealType(mealType: MealType): Promise<Recipe[]> {
    // Use SQL function to check if mealType is in the mealTypes array
    const result = await db
      .select()
      .from(recipes)
      .where(eq(sql`${mealType} = ANY(${recipes.mealTypes})`, true))
      .orderBy(recipes.name);
    return result;
  }

  async getMealPlansForWeek(familyId: number, weekStartDate: string): Promise<WeeklyMealPlan> {
    const plans = await db
      .select({
        mealPlan: mealPlans,
        recipe: recipes,
      })
      .from(mealPlans)
      .leftJoin(recipes, eq(mealPlans.recipeId, recipes.id))
      .where(and(
        eq(mealPlans.familyId, familyId),
        eq(mealPlans.weekStartDate, weekStartDate)
      ));

    const meals: WeeklyMealPlan['meals'] = {};
    
    for (let day = 0; day < 7; day++) {
      meals[day] = {
        breakfast: [],
        lunch: [],
        snack: [],
        dinner: []
      };
    }

    for (const plan of plans) {
      if (plan.recipe && plan.mealPlan.recipeId) {
        const day = plan.mealPlan.dayOfWeek;
        const mealType = plan.mealPlan.mealType as MealType;
        if (!meals[day][mealType]) {
          meals[day][mealType] = [];
        }
        meals[day][mealType]!.push(plan.recipe);
      }
    }

    return {
      weekStartDate,
      meals,
    };
  }

  async setMealPlan(familyId: number, mealPlan: Omit<InsertMealPlan, 'familyId'>): Promise<MealPlan> {
    // Check if this exact combination already exists (same recipe in same slot)
    const existing = await db
      .select()
      .from(mealPlans)
      .where(
        and(
          eq(mealPlans.familyId, familyId),
          eq(mealPlans.weekStartDate, mealPlan.weekStartDate),
          eq(mealPlans.dayOfWeek, mealPlan.dayOfWeek),
          eq(mealPlans.mealType, mealPlan.mealType),
          mealPlan.recipeId ? eq(mealPlans.recipeId, mealPlan.recipeId) : sql`true`
        )
      );

    if (existing.length > 0) {
      // Recipe already exists in this slot, return existing
      return existing[0];
    } else {
      // Create new meal plan entry (allows multiple recipes per slot)
      const [newMealPlan] = await db
        .insert(mealPlans)
        .values({ ...mealPlan, familyId })
        .returning();
      return newMealPlan;
    }
  }

  async removeMealPlan(familyId: number, weekStartDate: string, dayOfWeek: number, mealType: MealType): Promise<boolean> {
    const result = await db
      .delete(mealPlans)
      .where(
        and(
          eq(mealPlans.familyId, familyId),
          eq(mealPlans.weekStartDate, weekStartDate),
          eq(mealPlans.dayOfWeek, dayOfWeek),
          eq(mealPlans.mealType, mealType)
        )
      );
    return (result.rowCount || 0) > 0;
  }

  async removeSpecificMealPlan(familyId: number, weekStartDate: string, dayOfWeek: number, mealType: MealType, recipeId: number): Promise<boolean> {
    const result = await db
      .delete(mealPlans)
      .where(
        and(
          eq(mealPlans.familyId, familyId),
          eq(mealPlans.weekStartDate, weekStartDate),
          eq(mealPlans.dayOfWeek, dayOfWeek),
          eq(mealPlans.mealType, mealType),
          eq(mealPlans.recipeId, recipeId)
        )
      );
    return (result.rowCount || 0) > 0;
  }

  async getRecipeUsageForWeek(familyId: number, weekStartDate: string, recipeId: number): Promise<number> {
    const plans = await db
      .select()
      .from(mealPlans)
      .where(
        and(
          eq(mealPlans.familyId, familyId),
          eq(mealPlans.weekStartDate, weekStartDate),
          eq(mealPlans.recipeId, recipeId)
        )
      );
    return plans.length;
  }

  async getWeeklyTargets(familyId: number): Promise<WeeklyTargets> {
    const [targets] = await db
      .select()
      .from(weeklyTargets)
      .where(eq(weeklyTargets.familyId, familyId))
      .limit(1);
    
    if (!targets) {
      // Create default targets if none exist for this family
      const [newTargets] = await db
        .insert(weeklyTargets)
        .values({
          familyId,
          dailyCalories: 2000,
          dailyProtein: 150,
          dailyCarbs: 250,
          dailyFats: 67,
        })
        .returning();
      return newTargets;
    }
    
    return targets;
  }

  async updateWeeklyTargets(familyId: number, targets: Partial<Omit<InsertWeeklyTargets, 'familyId'>>): Promise<WeeklyTargets> {
    const existing = await this.getWeeklyTargets(familyId);
    
    const [updated] = await db
      .update(weeklyTargets)
      .set(targets)
      .where(eq(weeklyTargets.id, existing.id))
      .returning();
    
    return updated;
  }

  async calculateWeeklyMacros(familyId: number, weekStartDate: string): Promise<WeeklyMacros> {
    const plans = await db
      .select({
        mealPlan: mealPlans,
        recipe: recipes,
      })
      .from(mealPlans)
      .leftJoin(recipes, eq(mealPlans.recipeId, recipes.id))
      .where(and(
        eq(mealPlans.familyId, familyId),
        eq(mealPlans.weekStartDate, weekStartDate)
      ));

    const weeklyMacros: WeeklyMacros = {};
    
    for (let day = 0; day < 7; day++) {
      weeklyMacros[day] = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fats: 0,
      };
    }

    for (const plan of plans) {
      if (plan.recipe && plan.mealPlan.recipeId) {
        const day = plan.mealPlan.dayOfWeek;
        weeklyMacros[day].calories += plan.recipe.calories;
        weeklyMacros[day].protein += plan.recipe.protein;
        weeklyMacros[day].carbs += plan.recipe.carbs;
        weeklyMacros[day].fats += plan.recipe.fats;
      }
    }

    return weeklyMacros;
  }
}