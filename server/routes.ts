import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRecipeSchema, insertMealPlanSchema, insertWeeklyTargetsSchema } from "../shared/schema";
import { generateMealPlanSuggestions, generateNewRecipe, generateAlternativeSuggestion } from "./services/anthropic";
import { handleLogin, handleLogout, loginRateLimit } from "./auth-middleware";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { z } from "zod";

// AI calls cost money; cap them per family (falls back to IP before login)
const aiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => `family:${(req as any).familyId ?? ipKeyGenerator(req.ip ?? "")}`,
  message: { message: "Too many AI requests. Try again later." },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for deployment monitoring
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV 
    });
  });

  // Auth routes
  app.post('/api/auth/login', loginRateLimit, handleLogin);
  app.use('/api/ai', aiRateLimit);
  app.post('/api/auth/logout', handleLogout);
  
  // Current session info
  app.get('/api/auth/session', (req, res) => {
    const session = req.session as any;
    if (session?.authenticated && session?.familyId) {
      res.json({
        authenticated: true,
        family: {
          id: session.familyId,
          name: session.familyName
        }
      });
    } else {
      res.status(401).json({ authenticated: false });
    }
  });
  
  // Serve login page - let frontend handle routing
  // The login route is handled by the React router

  // Recipe routes
  app.get("/api/recipes", async (req, res) => {
    try {
      const recipes = await storage.getRecipes();
      res.json(recipes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recipes" });
    }
  });

  // Bulk export all recipes
  app.get("/api/recipes/export", async (req, res) => {
    try {
      const recipes = await storage.getRecipes();
      const exportData = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        recipes: recipes.map(recipe => ({
          name: recipe.name,
          description: recipe.description,
          calories: recipe.calories,
          protein: recipe.protein,
          carbs: recipe.carbs,
          fats: recipe.fats,
          mealTypes: recipe.mealTypes,
          maxWeeklyUses: recipe.maxWeeklyUses
        }))
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="recipes-export.json"');
      res.json(exportData);
    } catch (error) {
      res.status(500).json({ message: "Failed to export recipes" });
    }
  });

  app.get("/api/recipes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const recipe = await storage.getRecipe(id);
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      res.json(recipe);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recipe" });
    }
  });

  app.post("/api/recipes", async (req, res) => {
    try {
      const validatedData = insertRecipeSchema.parse(req.body);
      const existing = await storage.getRecipeByName(validatedData.name);
      if (existing) {
        return res.status(409).json({ message: "A recipe with this name already exists", recipe: existing });
      }
      const recipe = await storage.createRecipe(validatedData);
      res.status(201).json(recipe);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid recipe data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to create recipe" });
    }
  });

  app.put("/api/recipes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertRecipeSchema.partial().parse(req.body);
      const recipe = await storage.updateRecipe(id, validatedData);
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      res.json(recipe);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid recipe data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to update recipe" });
    }
  });

  app.delete("/api/recipes/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteRecipe(id);
      if (!deleted) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting recipe:", error);
      res.status(500).json({ message: "Failed to delete recipe" });
    }
  });

  // Bulk import recipes
  app.post("/api/recipes/import", async (req, res) => {
    try {
      const { recipes } = req.body;
      
      if (!Array.isArray(recipes)) {
        return res.status(400).json({ message: "Invalid import data: recipes must be an array" });
      }

      const importedRecipes = [];
      const errors = [];

      for (let i = 0; i < recipes.length; i++) {
        try {
          const validatedData = insertRecipeSchema.parse(recipes[i]);
          const recipe = await storage.createRecipe(validatedData);
          importedRecipes.push(recipe);
        } catch (error) {
          errors.push({
            index: i,
            recipe: recipes[i],
            error: error instanceof z.ZodError ? error.issues : "Invalid recipe data"
          });
        }
      }

      res.status(201).json({
        imported: importedRecipes.length,
        errors: errors.length,
        details: errors
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to import recipes" });
    }
  });

  app.get("/api/recipes/meal-type/:mealType", async (req, res) => {
    try {
      const { mealType } = req.params;
      if (!['breakfast', 'lunch', 'snack', 'dinner'].includes(mealType)) {
        return res.status(400).json({ message: "Invalid meal type" });
      }
      const recipes = await storage.getRecipesByMealType(mealType as any);
      res.json(recipes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recipes by meal type" });
    }
  });

  // Meal plan routes
  app.get("/api/meal-plans/:weekStartDate", async (req, res) => {
    try {
      const { weekStartDate } = req.params;
      const familyId = (req as any).familyId;
      const mealPlan = await storage.getMealPlansForWeek(familyId, weekStartDate);
      res.json(mealPlan);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch meal plan" });
    }
  });

  app.post("/api/meal-plans", async (req, res) => {
    try {
      const familyId = (req as any).familyId;
      const validatedData = insertMealPlanSchema.omit({ familyId: true }).parse(req.body);
      const mealPlan = await storage.setMealPlan(familyId, validatedData);
      res.status(201).json(mealPlan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid meal plan data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to create meal plan" });
    }
  });

  app.delete("/api/meal-plans/:weekStartDate/:dayOfWeek/:mealType", async (req, res) => {
    try {
      const { weekStartDate, dayOfWeek, mealType } = req.params;
      const familyId = (req as any).familyId;
      const dayNum = parseInt(dayOfWeek);
      
      if (isNaN(dayNum) || dayNum < 0 || dayNum > 6) {
        return res.status(400).json({ message: "Invalid day of week" });
      }
      
      if (!['breakfast', 'lunch', 'snack', 'dinner'].includes(mealType)) {
        return res.status(400).json({ message: "Invalid meal type" });
      }
      
      const deleted = await storage.removeMealPlan(familyId, weekStartDate, dayNum, mealType as any);
      if (!deleted) {
        return res.status(404).json({ message: "Meal plan not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete meal plan" });
    }
  });

  app.delete("/api/meal-plans/:weekStartDate/:dayOfWeek/:mealType/:recipeId", async (req, res) => {
    try {
      const { weekStartDate, dayOfWeek, mealType, recipeId } = req.params;
      const familyId = (req as any).familyId;
      const dayNum = parseInt(dayOfWeek);
      const recipeIdNum = parseInt(recipeId);
      
      if (isNaN(dayNum) || dayNum < 0 || dayNum > 6) {
        return res.status(400).json({ message: "Invalid day of week" });
      }
      
      if (!['breakfast', 'lunch', 'snack', 'dinner'].includes(mealType)) {
        return res.status(400).json({ message: "Invalid meal type" });
      }
      
      if (isNaN(recipeIdNum)) {
        return res.status(400).json({ message: "Invalid recipe ID" });
      }
      
      const deleted = await storage.removeSpecificMealPlan(familyId, weekStartDate, dayNum, mealType as any, recipeIdNum);
      if (!deleted) {
        return res.status(404).json({ message: "Meal plan not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete specific meal plan" });
    }
  });

  // Weekly macros
  app.get("/api/macros/:weekStartDate", async (req, res) => {
    try {
      const { weekStartDate } = req.params;
      const familyId = (req as any).familyId;
      const macros = await storage.calculateWeeklyMacros(familyId, weekStartDate);
      res.json(macros);
    } catch (error) {
      res.status(500).json({ message: "Failed to calculate macros" });
    }
  });

  // Weekly targets
  app.get("/api/targets", async (req, res) => {
    try {
      const familyId = (req as any).familyId;
      const targets = await storage.getWeeklyTargets(familyId);
      res.json(targets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch targets" });
    }
  });

  app.put("/api/targets", async (req, res) => {
    try {
      const familyId = (req as any).familyId;
      const validatedData = insertWeeklyTargetsSchema.omit({ familyId: true }).partial().parse(req.body);
      const targets = await storage.updateWeeklyTargets(familyId, validatedData);
      res.json(targets);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid targets data", errors: error.issues });
      }
      res.status(500).json({ message: "Failed to update targets" });
    }
  });

  // AI-powered meal planning
  app.post("/api/ai/generate-meal-plan", async (req, res) => {
    try {
      const { weekStartDate, preferences, restrictions } = req.body;
      
      // Get current meal plan and targets
      const familyId = (req as any).familyId;
      const currentMealPlan = await storage.getMealPlansForWeek(familyId, weekStartDate);
      const availableRecipes = await storage.getRecipes();
      const targets = await storage.getWeeklyTargets(familyId);
      
      const suggestions = await generateMealPlanSuggestions({
        currentWeekPlan: currentMealPlan,
        availableRecipes: availableRecipes.filter(r => r.isApproved),
        dailyTargets: {
          calories: targets.dailyCalories,
          protein: targets.dailyProtein,
          carbs: targets.dailyCarbs,
          fats: targets.dailyFats,
        },
        preferences,
        restrictions,
      });
      
      res.json(suggestions);
    } catch (error) {
      console.error('AI meal plan generation error:', error);
      res.status(500).json({ message: "Failed to generate meal plan suggestions" });
    }
  });

  // Get alternative suggestion for a specific meal slot
  app.post("/api/ai/alternative-suggestion", async (req, res) => {
    try {
      const { weekStartDate, dayOfWeek, mealType, excludeRecipes, preferences, restrictions } = req.body;
      
      // Get current meal plan and targets
      const familyId = (req as any).familyId;
      const currentMealPlan = await storage.getMealPlansForWeek(familyId, weekStartDate);
      const availableRecipes = await storage.getRecipes();
      const targets = await storage.getWeeklyTargets(familyId);
      
      // Filter out excluded recipes (previously suggested ones)
      const excluded: number[] = Array.isArray(excludeRecipes) ? excludeRecipes : [];
      const filteredRecipes = availableRecipes.filter(r => 
        r.isApproved && !excluded.includes(r.id)
      );
      
      const suggestion = await generateAlternativeSuggestion({
        dayOfWeek,
        mealType,
        currentWeekPlan: currentMealPlan,
        availableRecipes: filteredRecipes,
        dailyTargets: {
          calories: targets.dailyCalories,
          protein: targets.dailyProtein,
          carbs: targets.dailyCarbs,
          fats: targets.dailyFats,
        },
        preferences,
        restrictions,
      });
      
      res.json(suggestion);
    } catch (error) {
      console.error('AI alternative suggestion error:', error);
      res.status(500).json({ message: "Failed to generate alternative suggestion" });
    }
  });

  app.post("/api/ai/generate-recipe", async (req, res) => {
    try {
      const { mealType, targetMacros, restrictions, recipeName } = req.body;
      
      if (!['breakfast', 'lunch', 'snack', 'dinner'].includes(mealType)) {
        return res.status(400).json({ message: "Invalid meal type" });
      }
      
      const newRecipe = await generateNewRecipe(mealType, targetMacros, restrictions, recipeName);
      res.json(newRecipe);
    } catch (error) {
      console.error('AI recipe generation error:', error);
      res.status(500).json({ message: "Failed to generate new recipe" });
    }
  });

  // Recipe usage tracking
  app.get("/api/recipes/:id/usage/:weekStartDate", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { weekStartDate } = req.params;
      const familyId = (req as any).familyId;
      const usage = await storage.getRecipeUsageForWeek(familyId, weekStartDate, id);
      res.json({ usage });
    } catch (error) {
      res.status(500).json({ message: "Failed to get recipe usage" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
