import Anthropic from '@anthropic-ai/sdk';
import { Recipe, MealType, WeeklyMealPlan, DailyMacros } from '../../shared/schema';

// Override with ANTHROPIC_MODEL to pin a different Claude model
const DEFAULT_MODEL_STR = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

// Created on first use so the server still starts when no API key is configured
let client: Anthropic | undefined;
function getClient(): Anthropic {
  client ??= new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY ?? process.env.CLAUDE_API_KEY,
  });
  return client;
}

// Sends one prompt and returns the answer text. Haiku 5.5 thinks by default, so the
// response can start with thinking blocks and thinking counts toward max_tokens.
async function askClaude(prompt: string): Promise<string> {
  const response = await getClient().messages.create({
    model: DEFAULT_MODEL_STR,
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error(`Claude declined the request (${response.stop_details?.category ?? 'no category'})`);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('Claude response was cut off at max_tokens');
  }

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

export interface MealPlanRequest {
  currentWeekPlan: WeeklyMealPlan;
  availableRecipes: Recipe[];
  dailyTargets: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
  preferences?: string[] | {
    dietaryRestrictions?: string[];
    cuisinePreferences?: string[];
    cookingTime?: string;
    difficulty?: string;
  };
  restrictions?: string[];
}

export interface MealPlanSuggestion {
  dayOfWeek: number;
  mealType: MealType;
  suggestedRecipeId?: number;
  newRecipe?: {
    name: string;
    description: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    mealType: MealType;
  };
  reasoning: string;
}

const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

// Guards against the model returning an ID that isn't in the library, or one that belongs to a
// different recipe than the one it describes. Match on the recipe name it gave, fall back to
// the ID only when no name came back, and return null when the suggestion points at nothing real.
function resolveSuggestion(
  suggestion: MealPlanSuggestion & { recipeName?: string | null },
  recipes: Recipe[],
): MealPlanSuggestion | null {
  const { recipeName, ...rest } = suggestion;
  const byName = recipeName ? recipes.find((r) => normalizeName(r.name) === normalizeName(recipeName)) : undefined;
  const byId = recipeName ? undefined : recipes.find((r) => r.id === suggestion.suggestedRecipeId);
  // A "new" recipe that already exists in the library is reused rather than duplicated
  const byNewName = suggestion.newRecipe?.name
    ? recipes.find((r) => normalizeName(r.name) === normalizeName(suggestion.newRecipe!.name))
    : undefined;

  const existing = byName ?? byId ?? byNewName;
  if (existing) {
    return { ...rest, suggestedRecipeId: existing.id, newRecipe: undefined };
  }
  if (suggestion.newRecipe?.name) {
    return { ...rest, suggestedRecipeId: undefined };
  }
  console.warn(`Dropped AI suggestion with unknown recipe (id ${suggestion.suggestedRecipeId}, name ${recipeName ?? "none"})`);
  return null;
}

export async function generateAlternativeSuggestion(request: {
  dayOfWeek: number;
  mealType: string;
  currentWeekPlan: WeeklyMealPlan;
  availableRecipes: Recipe[];
  dailyTargets: { calories: number; protein: number; carbs: number; fats: number };
  preferences?: string[];
  restrictions?: string[];
}): Promise<MealPlanSuggestion> {
  try {
    const { dayOfWeek, mealType, currentWeekPlan, availableRecipes, dailyTargets, preferences = [], restrictions = [] } = request;
    
    // Calculate current daily macros for context
    const dayMeals = currentWeekPlan.meals[dayOfWeek] || {};
    let currentDayMacros = { calories: 0, protein: 0, carbs: 0, fats: 0 };
    
    for (const meal of Object.values(dayMeals)) {
      if (Array.isArray(meal)) {
        for (const recipe of meal) {
          currentDayMacros.calories += recipe.calories;
          currentDayMacros.protein += recipe.protein;
          currentDayMacros.carbs += recipe.carbs;
          currentDayMacros.fats += recipe.fats;
        }
      }
    }
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const prompt = `You are a professional nutritionist and meal planning expert. I need an alternative meal suggestion for a specific meal slot.

CURRENT CONTEXT:
- Day: ${dayNames[dayOfWeek]}
- Meal Type: ${mealType}
- Current day macros: ${currentDayMacros.calories} cal, ${currentDayMacros.protein}g protein, ${currentDayMacros.carbs}g carbs, ${currentDayMacros.fats}g fats
- Daily targets: ${dailyTargets.calories} cal, ${dailyTargets.protein}g protein, ${dailyTargets.carbs}g carbs, ${dailyTargets.fats}g fats

AVAILABLE RECIPES:
${availableRecipes.map(recipe => 
  `ID: ${recipe.id} | ${recipe.name} | ${recipe.description} | ${recipe.calories}cal, ${recipe.protein}g protein, ${recipe.carbs}g carbs, ${recipe.fats}g fats | Meal: ${recipe.mealTypes.join(', ')}`
).join('\n')}

PREFERENCES: ${preferences.length > 0 ? preferences.join(', ') : 'None specified'}
RESTRICTIONS: ${restrictions.length > 0 ? restrictions.join(', ') : 'None specified'}

Please suggest ONE alternative recipe that would work well for this ${mealType} slot on ${dayNames[dayOfWeek]}. Consider:
1. Nutritional balance for the day
2. How much nutrition is still needed to reach daily targets
3. Appropriateness for the meal type and day
4. User preferences and restrictions

If no existing recipe fits well, you may suggest creating a new one.

Respond with EXACTLY this JSON format:
{
  "dayOfWeek": ${dayOfWeek},
  "mealType": "${mealType}",
  "suggestedRecipeId": [ID if using existing recipe, or null if creating new],
  "recipeName": "[exact name of the existing recipe, or null if creating new]",
  "newRecipe": {
    "name": "[recipe name if creating new]",
    "description": "[description if creating new]", 
    "calories": [calories if creating new],
    "protein": [protein if creating new],
    "carbs": [carbs if creating new],
    "fats": [fats if creating new],
    "mealType": "${mealType}"
  },
  "reasoning": "[brief explanation of why this alternative works well]"
}

If using an existing recipe, set newRecipe to null.`;

    const textResponse = await askClaude(prompt);
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }

    const suggestion = resolveSuggestion(JSON.parse(jsonMatch[0]), availableRecipes);
    if (!suggestion) {
      throw new Error('AI suggested a recipe that is not in the library');
    }
    return suggestion;
  } catch (error) {
    console.error('Error generating alternative suggestion:', error);
    throw new Error('Failed to generate alternative suggestion');
  }
}

export async function generateMealPlanSuggestions(request: MealPlanRequest): Promise<MealPlanSuggestion[]> {
  try {
    // Plan from today for the current week, or from Monday for any other week (0 = Monday)
    const today = new Date();
    const todayIndex = (today.getDay() + 6) % 7;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - todayIndex);
    const isCurrentWeek = thisMonday.toISOString().split('T')[0] === request.currentWeekPlan.weekStartDate;
    const firstDay = isCurrentWeek ? todayIndex : 0;
    
    // Find all empty meal slots starting from current day
    const mealTypes = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
    const emptySlots = [];
    
    // Check current and future days for empty slots
    for (let dayOfWeek = firstDay; dayOfWeek < 7; dayOfWeek++) {
      
      for (const mealType of mealTypes) {
        // Check if this slot already has recipes
        const dayMeals = request.currentWeekPlan.meals[dayOfWeek];
        const hasRecipes = dayMeals && dayMeals[mealType] && dayMeals[mealType]!.length > 0;
        
        if (!hasRecipes) {
          emptySlots.push({ dayOfWeek, mealType });
        }
      }
      
      // Stop when we have found 10 empty slots
      if (emptySlots.length >= 10) break;
    }
    
    // Take only the first 10 empty slots
    const slotsToFill = emptySlots.slice(0, 10);

    const prompt = `You are an AI nutritionist creating meal suggestions.

Current situation:
- Planning starts at day ${firstDay} of the week (0=Monday, 6=Sunday)
- Daily targets: ${request.dailyTargets.calories} calories, ${request.dailyTargets.protein}g protein, ${request.dailyTargets.carbs}g carbs, ${request.dailyTargets.fats}g fats
- Available recipes: ${JSON.stringify(request.availableRecipes.map(r => ({
  id: r.id,
  name: r.name,
  mealTypes: r.mealTypes,
  calories: r.calories,
  protein: r.protein,
  carbs: r.carbs,
  fats: r.fats,
  maxWeeklyUses: r.maxWeeklyUses
})))}
- Current meal plan: ${JSON.stringify(request.currentWeekPlan)}
- Empty slots to fill: ${JSON.stringify(slotsToFill)}
${request.preferences ? `- Preferences: ${Array.isArray(request.preferences) ? request.preferences.join(', ') : JSON.stringify(request.preferences)}` : ''}
${request.restrictions ? `- Restrictions: ${request.restrictions.join(', ')}` : ''}

TASK: Generate meal suggestions for the ${slotsToFill.length} empty meal slots provided above.

Requirements:
1. Create one suggestion for each empty slot in the slotsToFill list
2. Use existing recipes when possible, create new recipes only when needed
3. Respect recipe usage limits (maxWeeklyUses)
4. Balance nutrition across the day and week
5. Match meal types appropriately (breakfast recipes for breakfast slots, etc.)
6. For an existing recipe, use only an id from the available recipes list and copy its exact name into "recipeName". Never invent an id; a dish that isn't in the list goes in "newRecipe" with "suggestedRecipeId": null

IMPORTANT: Respond with ONLY a valid JSON array. No explanatory text.

Return format - exactly ${slotsToFill.length} entries:
[
  {
    "dayOfWeek": 0,
    "mealType": "breakfast", 
    "suggestedRecipeId": 1,
    "recipeName": "Exact Name Of Recipe 1",
    "newRecipe": null,
    "reasoning": "Meets protein target"
  },
  {
    "dayOfWeek": 0,
    "mealType": "lunch",
    "suggestedRecipeId": null,
    "recipeName": null,
    "newRecipe": {
      "name": "Recipe Name",
      "description": "Brief description", 
      "calories": 400,
      "protein": 25,
      "carbs": 30,
      "fats": 15,
      "mealType": "lunch"
    },
    "reasoning": "Custom recipe to meet calorie needs"
  }
]

Generate exactly 10 meal suggestions for the next empty meal slots, ordered by priority (earliest meals first).`;

    const responseText = await askClaude(prompt);
    
    // Extract JSON from response - handle cases where Claude adds explanatory text
    let jsonText = responseText;
    
    // Try to find JSON array or object in the response
    const jsonArrayMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    const jsonObjectMatch = responseText.match(/\{\s*"[\s\S]*\}/);
    
    if (jsonArrayMatch) {
      jsonText = jsonArrayMatch[0];
    } else if (jsonObjectMatch) {
      jsonText = `[${jsonObjectMatch[0]}]`; // Wrap single object in array
    } else {
      // Fallback: clean up markdown and try parsing
      jsonText = responseText
        .replace(/```json\s*/, '')
        .replace(/```\s*$/, '')
        .replace(/^[^[\{]*/, '') // Remove text before JSON
        .replace(/[^}\]]*$/, '') // Remove text after JSON
        .trim();
    }
    
    const suggestions = JSON.parse(jsonText) as MealPlanSuggestion[];
    
    return suggestions
      .map((s) => resolveSuggestion(s, request.availableRecipes))
      .filter((s): s is MealPlanSuggestion => s !== null);
  } catch (error) {
    console.error('Error generating meal plan suggestions:', error);
    throw new Error('Failed to generate meal plan suggestions');
  }
}

export async function generateNewRecipe(mealType: MealType, targetMacros: Partial<DailyMacros>, restrictions?: string[], recipeName?: string): Promise<{
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  mealTypes: MealType[];
}> {
  try {
    const prompt = recipeName 
      ? `Analyze the nutritional content of this ${mealType} recipe: "${recipeName}"

Provide realistic nutritional estimates for a standard serving size. Consider typical ingredients and preparation methods for this dish.
${targetMacros.calories ? `- Target calories: around ${targetMacros.calories}` : ''}
${targetMacros.protein ? `- Target protein: around ${targetMacros.protein}g` : ''}
${targetMacros.carbs ? `- Target carbs: around ${targetMacros.carbs}g` : ''}
${targetMacros.fats ? `- Target fats: around ${targetMacros.fats}g` : ''}
${restrictions ? `- Dietary restrictions: ${restrictions.join(', ')}` : ''}

Respond with a JSON object in this exact format:
{
  "name": "${recipeName}",
  "description": "Brief, appealing description of the dish and its main ingredients",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fats": number,
  "mealTypes": ["${mealType}"]
}

Base your nutritional estimates on realistic serving sizes and common ingredients.`
      : `Create a healthy ${mealType} recipe that meets these nutritional targets:
${targetMacros.calories ? `- Calories: around ${targetMacros.calories}` : ''}
${targetMacros.protein ? `- Protein: around ${targetMacros.protein}g` : ''}
${targetMacros.carbs ? `- Carbs: around ${targetMacros.carbs}g` : ''}
${targetMacros.fats ? `- Fats: around ${targetMacros.fats}g` : ''}
${restrictions ? `- Dietary restrictions: ${restrictions.join(', ')}` : ''}

Respond with a JSON object in this exact format:
{
  "name": "Recipe Name",
  "description": "Brief, appealing description of the dish and its main ingredients",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fats": number,
  "mealTypes": ["${mealType}"]
}

Make sure the recipe is realistic, delicious, and nutritionally balanced.`;

    const responseText = await askClaude(prompt);
    
    // Clean up response text - remove markdown code blocks if present
    const cleanedText = responseText
      .replace(/```json\s*/, '')
      .replace(/```\s*$/, '')
      .trim();
    
    const recipe = JSON.parse(cleanedText);
    
    return recipe;
  } catch (error) {
    console.error('Error generating new recipe:', error);
    throw new Error('Failed to generate new recipe');
  }
}
