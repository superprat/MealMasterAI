import { TEST_PASSWORD, TEST_FAMILY_NAME } from "./helpers/config";
import { test, expect } from '@playwright/test';

test.describe('API Integration', () => {
  let authCookies: string;

  test.beforeAll(async ({ request }) => {
    // Login to get authentication cookies
    const loginResponse = await request.post('/api/auth/login', {
      data: { password: TEST_PASSWORD }
    });
    
    expect(loginResponse.ok()).toBeTruthy();
    const responseData = await loginResponse.json();
    expect(responseData.success).toBeTruthy();
    
    // Extract cookies for authenticated requests
    const cookies = loginResponse.headers()['set-cookie'];
    authCookies = cookies || '';
  });

  test('should authenticate successfully', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { password: TEST_PASSWORD }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBeTruthy();
    expect(data.family).toBeDefined();
    expect(data.family.name).toBe(TEST_FAMILY_NAME);
  });

  test('should reject invalid login', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { password: 'invalid_password' }
    });
    
    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBeFalsy();
  });

  test('should get session info', async ({ request }) => {
    // First login
    const loginResponse = await request.post('/api/auth/login', {
      data: { password: TEST_PASSWORD }
    });
    expect(loginResponse.ok()).toBeTruthy();
    
    // Then check session
    const sessionResponse = await request.get('/api/auth/session');
    expect(sessionResponse.ok()).toBeTruthy();
    
    const data = await sessionResponse.json();
    expect(data.authenticated).toBeTruthy();
    expect(data.family).toBeDefined();
  });

  test('should get recipes', async ({ request }) => {
    // Login first
    await request.post('/api/auth/login', {
      data: { password: TEST_PASSWORD }
    });
    
    const response = await request.get('/api/recipes');
    expect(response.ok()).toBeTruthy();
    
    const recipes = await response.json();
    expect(Array.isArray(recipes)).toBeTruthy();
    expect(recipes.length).toBeGreaterThan(0);
    
    // Check recipe structure
    const firstRecipe = recipes[0];
    expect(firstRecipe).toHaveProperty('id');
    expect(firstRecipe).toHaveProperty('name');
    expect(firstRecipe).toHaveProperty('calories');
    expect(firstRecipe).toHaveProperty('protein');
    expect(firstRecipe).toHaveProperty('mealTypes');
  });

  test('should create recipe', async ({ request }) => {
    // Login first
    await request.post('/api/auth/login', {
      data: { password: TEST_PASSWORD }
    });
    
    const newRecipe = {
      name: 'API Test Recipe',
      description: 'Created by API test',
      calories: 250,
      protein: 15,
      carbs: 20,
      fats: 8,
      mealTypes: ['breakfast'],
      maxWeeklyUses: 3,
      isApproved: true
    };
    
    const response = await request.post('/api/recipes', {
      data: newRecipe
    });
    
    expect(response.ok()).toBeTruthy();
    const createdRecipe = await response.json();
    expect(createdRecipe.name).toBe(newRecipe.name);
    expect(createdRecipe.id).toBeDefined();
  });

  test('should get meal plans', async ({ request }) => {
    // Login first
    await request.post('/api/auth/login', {
      data: { password: TEST_PASSWORD }
    });
    
    const weekStartDate = '2025-08-04';
    const response = await request.get(`/api/meal-plans/${weekStartDate}`);
    expect(response.ok()).toBeTruthy();
    
    const mealPlan = await response.json();
    expect(mealPlan).toHaveProperty('weekStartDate');
    expect(mealPlan).toHaveProperty('meals');
    expect(mealPlan.weekStartDate).toBe(weekStartDate);
  });

  test('should get macro calculations', async ({ request }) => {
    // Login first
    await request.post('/api/auth/login', {
      data: { password: TEST_PASSWORD }
    });
    
    const weekStartDate = '2025-08-04';
    const response = await request.get(`/api/macros/${weekStartDate}`);
    expect(response.ok()).toBeTruthy();
    
    const macros = await response.json();
    expect(typeof macros).toBe('object');
    
    // Should have daily macro data
    Object.values(macros).forEach((dayMacros: any) => {
      expect(dayMacros).toHaveProperty('calories');
      expect(dayMacros).toHaveProperty('protein');
      expect(dayMacros).toHaveProperty('carbs');
      expect(dayMacros).toHaveProperty('fats');
    });
  });

  test('should get weekly targets', async ({ request }) => {
    // Login first
    await request.post('/api/auth/login', {
      data: { password: TEST_PASSWORD }
    });
    
    const response = await request.get('/api/targets');
    expect(response.ok()).toBeTruthy();
    
    const targets = await response.json();
    expect(targets).toHaveProperty('dailyCalories');
    expect(targets).toHaveProperty('dailyProtein');
    expect(targets).toHaveProperty('dailyCarbs');
    expect(targets).toHaveProperty('dailyFats');
    expect(typeof targets.familyId).toBe('number');
  });

  test('should generate AI meal plan', async ({ request }) => {
    // Login first
    await request.post('/api/auth/login', {
      data: { password: TEST_PASSWORD }
    });
    
    const requestData = {
      weekStartDate: '2025-08-04',
      preferences: [],
      restrictions: []
    };
    
    const response = await request.post('/api/ai/generate-meal-plan', {
      data: requestData
    });
    
    expect(response.ok()).toBeTruthy();
    const suggestions = await response.json();
    expect(Array.isArray(suggestions)).toBeTruthy();
    
    if (suggestions.length > 0) {
      const firstSuggestion = suggestions[0];
      expect(firstSuggestion).toHaveProperty('dayOfWeek');
      expect(firstSuggestion).toHaveProperty('mealType');
      expect(firstSuggestion).toHaveProperty('reasoning');
      expect(['suggestedRecipeId', 'newRecipe']).toContain(
        firstSuggestion.suggestedRecipeId ? 'suggestedRecipeId' : 'newRecipe'
      );
    }
  });

  test('should require authentication for protected endpoints', async ({ request }) => {
    // Try accessing protected endpoint without authentication
    const endpoints = [
      '/api/recipes',
      '/api/meal-plans/2025-08-04',
      '/api/macros/2025-08-04',
      '/api/targets',
      '/api/ai/generate-meal-plan'
    ];
    
    for (const endpoint of endpoints) {
      const response = await request.get(endpoint);
      expect(response.status()).toBe(401);
      
      const data = await response.json();
      expect(data.message).toBe('Authentication required');
    }
  });
});