import Anthropic from '@anthropic-ai/sdk';
import { MealType, DailyMacros } from '../../shared/schema';

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
