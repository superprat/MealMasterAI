import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { families, type MealType, type Recipe } from "../../shared/schema";
import { addDays, dayIndexOf, DAY_NAMES, isDateKey, weekStartOf } from "../../shared/dates";

const MEAL_TYPES = ["breakfast", "lunch", "snack", "dinner"] as const;

class ToolError extends Error {}

const ok = (data: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});
const fail = (message: string): CallToolResult => ({ content: [{ type: "text", text: message }], isError: true });

// Errors the model can act on come back as tool errors; anything unexpected is logged, not leaked
function handled<A>(name: string, fn: (args: A) => Promise<CallToolResult>) {
  return async (args: A): Promise<CallToolResult> => {
    try {
      return await fn(args);
    } catch (error) {
      if (error instanceof ToolError) return fail(error.message);
      console.error(`MCP tool ${name} failed:`, error);
      return fail(`${name} failed because of a server error. Try again later.`);
    }
  };
}

// The server runs in UTC; "today" is only a default, and get_kitchen says which date it used
const todayUtc = () => new Date().toISOString().slice(0, 10);

const dateField = z
  .string()
  .refine(isDateKey, "Must be a real date in YYYY-MM-DD format")
  .describe("Date in YYYY-MM-DD format");
const mealTypeField = z.enum(MEAL_TYPES);
const recipeIdField = z.number().int().positive();

const recipeFields = {
  name: z.string().trim().min(1).max(200).describe("Recipe name. Must be unique across the recipe library."),
  description: z.string().max(5000).optional().describe("Short description, ingredients or method."),
  calories: z.number().int().min(0).max(10000).describe("Calories per serving (kcal)."),
  protein: z.number().int().min(0).max(1000).describe("Protein per serving, in grams."),
  carbs: z.number().int().min(0).max(1000).describe("Carbohydrates per serving, in grams."),
  fats: z.number().int().min(0).max(1000).describe("Fat per serving, in grams."),
  mealTypes: z.array(mealTypeField).min(1).describe("Which meals this recipe suits."),
  maxWeeklyUses: z
    .number()
    .int()
    .min(1)
    .max(21)
    .optional()
    .describe("How many times a week this recipe may be planned. Defaults to 3."),
};

function summarizeRecipe(r: Recipe) {
  return {
    id: r.id,
    name: r.name,
    mealTypes: r.mealTypes,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fats: r.fats,
    maxWeeklyUses: r.maxWeeklyUses,
  };
}

async function requireRecipe(id: number): Promise<Recipe> {
  const recipe = await storage.getRecipe(id);
  if (!recipe) throw new ToolError(`No recipe with id ${id}. Use list_recipes to find recipe ids.`);
  return recipe;
}

// One server per request: the kitchen comes from the access token, never from tool input
export function createKitchenMcpServer(familyId: number): McpServer {
  const server = new McpServer(
    { name: "mealmaster", title: "MealMaster", version: "1.0.0" },
    {
      instructions:
        "MealMaster is a family meal planner. You are connected to one kitchen (family): its meal plan and daily macro targets are private to it, while the recipe library is shared by all kitchens. Plan meals by date (YYYY-MM-DD) and meal (breakfast, lunch, snack, dinner) using recipe ids from list_recipes. Weeks run Monday to Sunday.",
    },
  );

  server.registerTool(
    "get_kitchen",
    {
      title: "Get kitchen",
      description: "Which kitchen you are connected to, its daily macro targets, and the server's current date (UTC).",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    handled("get_kitchen", async () => {
      const [family] = await db.select({ id: families.id, name: families.name }).from(families).where(eq(families.id, familyId));
      const targets = await storage.getWeeklyTargets(familyId);
      return ok({
        kitchen: family,
        today: todayUtc(),
        dailyTargets: {
          calories: targets.dailyCalories,
          protein: targets.dailyProtein,
          carbs: targets.dailyCarbs,
          fats: targets.dailyFats,
        },
      });
    }),
  );

  server.registerTool(
    "list_recipes",
    {
      title: "List recipes",
      description:
        "List recipes in the shared recipe library with their macros per serving. Optionally filter by meal type or a name search.",
      inputSchema: {
        mealType: mealTypeField.optional().describe("Only recipes suited to this meal."),
        search: z.string().optional().describe("Case-insensitive text to match in the recipe name or description."),
      },
      annotations: { readOnlyHint: true },
    },
    handled("list_recipes", async ({ mealType, search }) => {
      let recipes = mealType ? await storage.getRecipesByMealType(mealType) : await storage.getRecipes();
      const q = search?.trim().toLowerCase();
      if (q) {
        recipes = recipes.filter((r) => r.name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q));
      }
      return ok({ count: recipes.length, recipes: recipes.map(summarizeRecipe) });
    }),
  );

  server.registerTool(
    "get_recipe",
    {
      title: "Get recipe",
      description: "Get one recipe by id, including its description.",
      inputSchema: { recipeId: recipeIdField },
      annotations: { readOnlyHint: true },
    },
    handled("get_recipe", async ({ recipeId }) => {
      const { createdAt, isAiSuggested, isApproved, ...recipe } = await requireRecipe(recipeId);
      return ok(recipe);
    }),
  );

  server.registerTool(
    "add_recipe",
    {
      title: "Add recipe",
      description:
        "Add a recipe to the shared recipe library. Macros are per serving. Refused if a recipe with the same name exists; the error gives that recipe's id so you can plan it instead.",
      inputSchema: recipeFields,
    },
    handled("add_recipe", async (input) => {
      const existing = await storage.getRecipeByName(input.name);
      if (existing) throw new ToolError(`A recipe named "${existing.name}" already exists (recipeId ${existing.id}).`);
      const recipe = await storage.createRecipe({ ...input, maxWeeklyUses: input.maxWeeklyUses ?? 3 });
      return ok({ added: summarizeRecipe(recipe) });
    }),
  );

  server.registerTool(
    "update_recipe",
    {
      title: "Update recipe",
      description:
        "Change fields of an existing recipe; only the fields you pass change. The library is shared, so this affects every kitchen that plans the recipe.",
      inputSchema: {
        recipeId: recipeIdField,
        ...Object.fromEntries(Object.entries(recipeFields).map(([key, field]) => [key, field.optional()])),
      } as { recipeId: typeof recipeIdField } & { [K in keyof typeof recipeFields]: z.ZodOptional<(typeof recipeFields)[K]> },
    },
    handled("update_recipe", async ({ recipeId, ...changes }) => {
      const fields = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
      if (Object.keys(fields).length === 0) throw new ToolError("Pass at least one field to change.");
      const current = await requireRecipe(recipeId);
      if (typeof fields.name === "string") {
        const clash = await storage.getRecipeByName(fields.name);
        if (clash && clash.id !== current.id) throw new ToolError(`Another recipe is already named "${clash.name}" (recipeId ${clash.id}).`);
      }
      const recipe = await storage.updateRecipe(recipeId, fields);
      return ok({ updated: summarizeRecipe(recipe!) });
    }),
  );

  server.registerTool(
    "get_meal_plan",
    {
      title: "Get meal plan",
      description:
        "Get this kitchen's meal plan for the week (Monday to Sunday) containing a date: each day's planned recipes, macro totals and the daily targets.",
      inputSchema: { date: dateField.optional().describe("Any date in the week, YYYY-MM-DD. Defaults to today (UTC).") },
      annotations: { readOnlyHint: true },
    },
    handled("get_meal_plan", async ({ date }) => {
      const weekStart = weekStartOf(date ?? todayUtc());
      const [plan, macros, targets] = await Promise.all([
        storage.getMealPlansForWeek(familyId, weekStart),
        storage.calculateWeeklyMacros(familyId, weekStart),
        storage.getWeeklyTargets(familyId),
      ]);
      const days = DAY_NAMES.map((day, i) => ({
        date: addDays(weekStart, i),
        day,
        meals: Object.fromEntries(
          MEAL_TYPES.map((type) => [
            type,
            (plan.meals[i]?.[type] ?? []).map((r) => ({ id: r.id, name: r.name, calories: r.calories, protein: r.protein, carbs: r.carbs, fats: r.fats })),
          ]),
        ),
        totals: macros[i],
      }));
      return ok({
        weekStartDate: weekStart,
        dailyTargets: {
          calories: targets.dailyCalories,
          protein: targets.dailyProtein,
          carbs: targets.dailyCarbs,
          fats: targets.dailyFats,
        },
        days,
      });
    }),
  );

  server.registerTool(
    "add_meal_to_plan",
    {
      title: "Add meal to plan",
      description:
        "Plan a recipe for a meal on a date. A meal can hold several recipes; adding the same recipe twice to one meal does nothing. Warns when the recipe goes over its weekly use limit.",
      inputSchema: { date: dateField, mealType: mealTypeField, recipeId: recipeIdField },
    },
    handled("add_meal_to_plan", async ({ date, mealType, recipeId }) => {
      const recipe = await requireRecipe(recipeId);
      if (!recipe.mealTypes.includes(mealType)) {
        throw new ToolError(`"${recipe.name}" is not marked for ${mealType} (it suits: ${recipe.mealTypes.join(", ")}).`);
      }
      const weekStart = weekStartOf(date);
      await storage.setMealPlan(familyId, { weekStartDate: weekStart, dayOfWeek: dayIndexOf(date), mealType, recipeId });
      const usage = await storage.getRecipeUsageForWeek(familyId, weekStart, recipeId);
      return ok({
        planned: { date, day: DAY_NAMES[dayIndexOf(date)], mealType, recipe: recipe.name },
        weeklyUses: usage,
        maxWeeklyUses: recipe.maxWeeklyUses,
        ...(usage > recipe.maxWeeklyUses && {
          warning: `"${recipe.name}" is now planned ${usage} times this week, over its limit of ${recipe.maxWeeklyUses}.`,
        }),
      });
    }),
  );

  server.registerTool(
    "remove_meal_from_plan",
    {
      title: "Remove meal from plan",
      description: "Remove planned food from a meal on a date. Pass recipeId to remove one recipe; leave it out to clear the whole meal.",
      inputSchema: { date: dateField, mealType: mealTypeField, recipeId: recipeIdField.optional() },
      annotations: { destructiveHint: true },
    },
    handled("remove_meal_from_plan", async ({ date, mealType, recipeId }) => {
      const weekStart = weekStartOf(date);
      const day = dayIndexOf(date);
      const removed =
        recipeId === undefined
          ? await storage.removeMealPlan(familyId, weekStart, day, mealType as MealType)
          : await storage.removeSpecificMealPlan(familyId, weekStart, day, mealType as MealType, recipeId);
      if (!removed) throw new ToolError(`Nothing matching was planned for ${mealType} on ${date}.`);
      return ok({ removed: { date, mealType, ...(recipeId !== undefined && { recipeId }) } });
    }),
  );

  server.registerTool(
    "update_daily_targets",
    {
      title: "Update daily targets",
      description: "Change this kitchen's daily calorie and macro targets. Only the values you pass change.",
      inputSchema: {
        dailyCalories: z.number().int().min(0).max(20000).optional(),
        dailyProtein: z.number().int().min(0).max(2000).optional().describe("grams"),
        dailyCarbs: z.number().int().min(0).max(2000).optional().describe("grams"),
        dailyFats: z.number().int().min(0).max(2000).optional().describe("grams"),
      },
    },
    handled("update_daily_targets", async (input) => {
      const changes = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
      if (Object.keys(changes).length === 0) throw new ToolError("Pass at least one target to change.");
      const t = await storage.updateWeeklyTargets(familyId, changes);
      return ok({ dailyCalories: t.dailyCalories, dailyProtein: t.dailyProtein, dailyCarbs: t.dailyCarbs, dailyFats: t.dailyFats });
    }),
  );

  return server;
}
