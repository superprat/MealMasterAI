// WebMCP: exposes MealMaster to AI agents running in the browser through
// navigator.modelContext (https://github.com/webmachinelearning/webmcp).
//
// Tools run inside this page and call the same /api routes the UI uses, with the
// same session cookie. An agent can either use the kitchen the person is already
// signed in to, or sign in itself with a kitchen (family) password.
//
// Browsers without navigator.modelContext (most of them today) skip all of this.

import type { MealType, Recipe, WeeklyMealPlan, WeeklyMacros, WeeklyTargets } from "@shared/schema";
import { queryClient } from "./queryClient";
import { addDays, dayIndexOf, isDateKey, todayKey, weekStartOf } from "./dates";
import { DAY_NAMES } from "./meals";

// ---- Minimal WebMCP typings (the API is still a draft) ----

type JsonSchema = Record<string, unknown>;

interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: any) => Promise<ToolResult>;
}

interface ModelContext {
  registerTool?: (tool: WebMcpTool) => { unregister?: () => void } | void;
  unregisterTool?: (name: string) => void;
  provideContext?: (context: { tools: WebMcpTool[] }) => void;
}

declare global {
  interface Navigator {
    modelContext?: ModelContext;
  }
}

// ---- Helpers ----

const MEAL_TYPE_VALUES: MealType[] = ["breakfast", "lunch", "snack", "dinner"];
const DATE_PATTERN = "^\\d{4}-\\d{2}-\\d{2}$";

class ToolError extends Error {}

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}

function fail(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

// Like apiRequest, but never redirects the page on 401: the agent gets an error it can act on.
async function api<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (res.status === 401 && !url.startsWith("/api/auth/")) {
    throw new ToolError("Not signed in to a kitchen. Call sign_in_to_kitchen with the kitchen password first.");
  }
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message = (data && typeof data === "object" && data.message) || text || res.statusText;
    const details = data && typeof data === "object" && data.errors ? ` ${JSON.stringify(data.errors)}` : "";
    throw new ToolError(`${message} (HTTP ${res.status})${details}`);
  }
  return data as T;
}

function requireDate(value: unknown, field = "date"): string {
  if (!isDateKey(value)) {
    throw new ToolError(`${field} must be a real date in YYYY-MM-DD format`);
  }
  return value;
}

function requireMealType(value: unknown): MealType {
  if (!MEAL_TYPE_VALUES.includes(value as MealType)) {
    throw new ToolError(`mealType must be one of: ${MEAL_TYPE_VALUES.join(", ")}`);
  }
  return value as MealType;
}

function requireId(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new ToolError(`${field} must be a positive integer`);
  }
  return value as number;
}

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
    hasVideo: !!r.videoUrl,
    hasPhoto: !!r.imageUrl,
  };
}

// Keep the open UI in sync with whatever the agent changed
function refreshUi(...prefixes: string[]) {
  for (const prefix of prefixes) {
    queryClient.invalidateQueries({ queryKey: [prefix] });
  }
}

const recipeFieldsSchema = {
  name: { type: "string", minLength: 1, description: "Recipe name. Must be unique across the recipe library." },
  description: { type: "string", description: "Short description, ingredients or method." },
  calories: { type: "integer", minimum: 0, description: "Calories per serving (kcal)." },
  protein: { type: "integer", minimum: 0, description: "Protein per serving, in grams." },
  carbs: { type: "integer", minimum: 0, description: "Carbohydrates per serving, in grams." },
  fats: { type: "integer", minimum: 0, description: "Fat per serving, in grams." },
  mealTypes: {
    type: "array",
    items: { type: "string", enum: MEAL_TYPE_VALUES },
    minItems: 1,
    uniqueItems: true,
    description: "Which meals this recipe suits.",
  },
  maxWeeklyUses: {
    type: "integer",
    minimum: 1,
    maximum: 21,
    description: "How many times a week this recipe may be planned. Defaults to 3.",
  },
  videoUrl: {
    type: ["string", "null"],
    description:
      "YouTube link to a video showing how to cook this dish. Find a real, matching video and include it, or an imageUrl, whenever you add a recipe. null removes it.",
  },
  imageUrl: {
    type: ["string", "null"],
    description: "https link straight to a photo of the finished dish (not a web page). null removes it.",
  },
} as const;

const RECIPE_FIELDS = Object.keys(recipeFieldsSchema) as (keyof typeof recipeFieldsSchema)[];

function pickRecipeFields(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of RECIPE_FIELDS) {
    if (input[key] !== undefined) out[key] = input[key];
  }
  return out;
}

// ---- Tools ----

export const tools: WebMcpTool[] = [
  {
    name: "get_kitchen_session",
    description:
      "Check whether this browser is signed in to a MealMaster kitchen and which one. Call this first; if not signed in, use sign_in_to_kitchen.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    async execute() {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (res.status === 401) return ok({ signedIn: false });
      const data = await res.json();
      return ok({ signedIn: true, kitchen: data.family, today: todayKey() });
    },
  },
  {
    name: "sign_in_to_kitchen",
    description:
      "Sign in to a MealMaster kitchen using its password. Each kitchen (family) has one shared password; the password alone decides which kitchen opens. Replaces any kitchen this browser is currently signed in to.",
    inputSchema: {
      type: "object",
      properties: { password: { type: "string", minLength: 1, description: "The kitchen password." } },
      required: ["password"],
    },
    async execute({ password }) {
      if (typeof password !== "string" || !password) throw new ToolError("password is required");
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return fail(data.message || `Sign-in failed (HTTP ${res.status})`);
      }
      queryClient.clear();
      // The login page has nothing to show once signed in; move to the planner after replying
      if (window.location.pathname === "/login") {
        setTimeout(() => window.location.replace("/"), 300);
      }
      return ok({ signedIn: true, kitchen: data.family });
    },
  },
  {
    name: "sign_out_of_kitchen",
    description: "Sign this browser out of the current kitchen.",
    inputSchema: { type: "object", properties: {} },
    async execute() {
      await api("POST", "/api/auth/logout");
      queryClient.clear();
      setTimeout(() => window.location.replace("/login"), 300);
      return ok({ signedIn: false });
    },
  },
  {
    name: "list_recipes",
    description:
      "List recipes in the recipe library with their macros. The library is shared by every kitchen. Optionally filter by meal type or by a name search.",
    inputSchema: {
      type: "object",
      properties: {
        mealType: { type: "string", enum: MEAL_TYPE_VALUES, description: "Only recipes suited to this meal." },
        search: { type: "string", description: "Case-insensitive text to match in the recipe name or description." },
      },
    },
    annotations: { readOnlyHint: true },
    async execute({ mealType, search }) {
      let recipes = await api<Recipe[]>("GET", "/api/recipes");
      if (mealType !== undefined) {
        const type = requireMealType(mealType);
        recipes = recipes.filter((r) => r.mealTypes.includes(type));
      }
      if (typeof search === "string" && search.trim()) {
        const q = search.trim().toLowerCase();
        recipes = recipes.filter(
          (r) => r.name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q),
        );
      }
      return ok({ count: recipes.length, recipes: recipes.map(summarizeRecipe) });
    },
  },
  {
    name: "get_recipe",
    description: "Get one recipe by id, including its description.",
    inputSchema: {
      type: "object",
      properties: { recipeId: { type: "integer", minimum: 1 } },
      required: ["recipeId"],
    },
    annotations: { readOnlyHint: true },
    async execute({ recipeId }) {
      return ok(await api<Recipe>("GET", `/api/recipes/${requireId(recipeId, "recipeId")}`));
    },
  },
  {
    name: "add_recipe",
    description:
      "Add a recipe to the shared recipe library. Macros are per serving. Put the ingredients and method in description, and include a YouTube videoUrl (preferred) or an imageUrl so the family can see the dish. Fails if a recipe with the same name already exists; the error includes that recipe's id so you can plan it instead.",
    inputSchema: {
      type: "object",
      properties: recipeFieldsSchema,
      required: ["name", "calories", "protein", "carbs", "fats", "mealTypes"],
    },
    async execute(input) {
      const body = pickRecipeFields(input ?? {});
      try {
        const recipe = await api<Recipe>("POST", "/api/recipes", body);
        refreshUi("/api/recipes");
        return ok({ added: summarizeRecipe(recipe) });
      } catch (error) {
        // Surface the existing recipe on a duplicate name
        if (error instanceof ToolError && error.message.includes("HTTP 409")) {
          const existing = (await api<Recipe[]>("GET", "/api/recipes")).find(
            (r) => r.name.toLowerCase() === String(body.name).trim().toLowerCase(),
          );
          return fail(
            `A recipe named "${body.name}" already exists` + (existing ? ` (recipeId ${existing.id}).` : "."),
          );
        }
        throw error;
      }
    },
  },
  {
    name: "update_recipe",
    description:
      "Change fields of an existing recipe. Only the fields you pass are changed. The library is shared, so this affects every kitchen that plans the recipe.",
    inputSchema: {
      type: "object",
      properties: { recipeId: { type: "integer", minimum: 1 }, ...recipeFieldsSchema },
      required: ["recipeId"],
    },
    async execute(input) {
      const id = requireId(input?.recipeId, "recipeId");
      const body = pickRecipeFields(input);
      if (Object.keys(body).length === 0) throw new ToolError("Pass at least one field to change");
      const recipe = await api<Recipe>("PUT", `/api/recipes/${id}`, body);
      refreshUi("/api/recipes", "/api/meal-plans", "/api/macros");
      return ok({ updated: summarizeRecipe(recipe) });
    },
  },
  {
    name: "get_meal_plan",
    description:
      "Get the signed-in kitchen's meal plan for the week (Monday to Sunday) containing a date, with each day's planned recipes, macro totals and the kitchen's daily targets.",
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          pattern: DATE_PATTERN,
          description: "Any date in the week, YYYY-MM-DD. Defaults to today.",
        },
      },
    },
    annotations: { readOnlyHint: true },
    async execute({ date }) {
      const weekStart = weekStartOf(date === undefined ? todayKey() : requireDate(date));
      const [plan, macros, targets] = await Promise.all([
        api<WeeklyMealPlan>("GET", `/api/meal-plans/${weekStart}`),
        api<WeeklyMacros>("GET", `/api/macros/${weekStart}`),
        api<WeeklyTargets>("GET", `/api/targets`),
      ]);
      const days = DAY_NAMES.map((dayName, i) => {
        const slots = plan.meals[i] ?? {};
        const meals = Object.fromEntries(
          MEAL_TYPE_VALUES.map((type) => [type, (slots[type] ?? []).map((r) => ({ id: r.id, name: r.name, calories: r.calories, protein: r.protein, carbs: r.carbs, fats: r.fats }))]),
        );
        return { date: addDays(weekStart, i), day: dayName, meals, totals: macros[i] };
      });
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
    },
  },
  {
    name: "add_meal_to_plan",
    description:
      "Plan a recipe for a meal on a date in the signed-in kitchen. A meal slot can hold several recipes; adding the same recipe twice to one slot does nothing. Warns when the recipe goes over its weekly use limit.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", pattern: DATE_PATTERN, description: "YYYY-MM-DD" },
        mealType: { type: "string", enum: MEAL_TYPE_VALUES },
        recipeId: { type: "integer", minimum: 1 },
      },
      required: ["date", "mealType", "recipeId"],
    },
    async execute({ date, mealType, recipeId }) {
      const day = requireDate(date);
      const type = requireMealType(mealType);
      const id = requireId(recipeId, "recipeId");
      const weekStart = weekStartOf(day);
      const recipe = await api<Recipe>("GET", `/api/recipes/${id}`);
      if (!recipe.mealTypes.includes(type)) {
        throw new ToolError(`"${recipe.name}" is not marked for ${type} (it suits: ${recipe.mealTypes.join(", ")})`);
      }
      await api("POST", "/api/meal-plans", { weekStartDate: weekStart, dayOfWeek: dayIndexOf(day), mealType: type, recipeId: id });
      refreshUi("/api/meal-plans", "/api/macros");
      const { usage } = await api<{ usage: number }>("GET", `/api/recipes/${id}/usage/${weekStart}`);
      return ok({
        planned: { date: day, day: DAY_NAMES[dayIndexOf(day)], mealType: type, recipe: recipe.name },
        weeklyUses: usage,
        maxWeeklyUses: recipe.maxWeeklyUses,
        ...(usage > recipe.maxWeeklyUses && {
          warning: `"${recipe.name}" is now planned ${usage} times this week, over its limit of ${recipe.maxWeeklyUses}.`,
        }),
      });
    },
  },
  {
    name: "remove_meal_from_plan",
    description:
      "Remove planned food from a meal on a date in the signed-in kitchen. Pass recipeId to remove just that recipe; leave it out to clear the whole meal slot.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", pattern: DATE_PATTERN, description: "YYYY-MM-DD" },
        mealType: { type: "string", enum: MEAL_TYPE_VALUES },
        recipeId: { type: "integer", minimum: 1 },
      },
      required: ["date", "mealType"],
    },
    async execute({ date, mealType, recipeId }) {
      const day = requireDate(date);
      const type = requireMealType(mealType);
      const base = `/api/meal-plans/${weekStartOf(day)}/${dayIndexOf(day)}/${type}`;
      const url = recipeId === undefined ? base : `${base}/${requireId(recipeId, "recipeId")}`;
      await api("DELETE", url);
      refreshUi("/api/meal-plans", "/api/macros");
      return ok({ removed: { date: day, mealType: type, ...(recipeId !== undefined && { recipeId }) } });
    },
  },
  {
    name: "update_daily_targets",
    description: "Change the signed-in kitchen's daily macro targets. Only the values you pass are changed.",
    inputSchema: {
      type: "object",
      properties: {
        dailyCalories: { type: "integer", minimum: 0 },
        dailyProtein: { type: "integer", minimum: 0, description: "grams" },
        dailyCarbs: { type: "integer", minimum: 0, description: "grams" },
        dailyFats: { type: "integer", minimum: 0, description: "grams" },
      },
    },
    async execute(input) {
      const keys = ["dailyCalories", "dailyProtein", "dailyCarbs", "dailyFats"] as const;
      const body = Object.fromEntries(keys.filter((k) => input?.[k] !== undefined).map((k) => [k, input[k]]));
      if (Object.keys(body).length === 0) throw new ToolError("Pass at least one target to change");
      const targets = await api<WeeklyTargets>("PUT", "/api/targets", body);
      refreshUi("/api/targets");
      return ok({
        dailyCalories: targets.dailyCalories,
        dailyProtein: targets.dailyProtein,
        dailyCarbs: targets.dailyCarbs,
        dailyFats: targets.dailyFats,
      });
    },
  },
];

// Turn thrown errors into tool errors the agent can read instead of failed calls
function withErrorHandling(tool: WebMcpTool): WebMcpTool {
  return {
    ...tool,
    async execute(input) {
      try {
        return await tool.execute(input ?? {});
      } catch (error) {
        if (error instanceof ToolError) return fail(error.message);
        console.error(`WebMCP tool ${tool.name} failed:`, error);
        return fail(`${tool.name} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  };
}

let registered = false;

export function registerWebMcpTools(modelContext: ModelContext | undefined = globalThis.navigator?.modelContext): boolean {
  if (!modelContext || registered) return false;
  const wrapped = tools.map(withErrorHandling);

  if (typeof modelContext.registerTool === "function") {
    for (const tool of wrapped) modelContext.registerTool(tool);
  } else if (typeof modelContext.provideContext === "function") {
    modelContext.provideContext({ tools: wrapped });
  } else {
    return false;
  }
  registered = true;
  return true;
}
