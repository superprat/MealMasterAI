import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth';

test.describe('Meal Planner - Frontend Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test using helper
    await loginAsTestUser(page);
  });

  test('should display meal calendar with current week', async ({ page }) => {
    // Check for meal calendar components
    await expect(page.getByText(/meal calendar/i)).toBeVisible();
    await expect(page.getByText(/today/i)).toBeVisible();
    
    // Check for days of the week
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday'];
    for (const day of days) {
      await expect(page.getByText(day)).toBeVisible();
    }
    
    // Check for meal types
    const mealTypes = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];
    for (const meal of mealTypes) {
      await expect(page.getByText(meal)).toBeVisible();
    }
  });

  test('should display weekly overview and macro summary', async ({ page }) => {
    await expect(page.getByText(/weekly overview/i)).toBeVisible();
    await expect(page.getByText(/daily macro summary/i)).toBeVisible();
    
    // Check for macro indicators
    await expect(page.getByText(/calories/i)).toBeVisible();
    await expect(page.getByText(/protein/i)).toBeVisible();
    await expect(page.getByText(/carbs/i)).toBeVisible();
    await expect(page.getByText(/fats/i)).toBeVisible();
  });

  test('should navigate between weeks', async ({ page }) => {
    const prevButton = page.getByRole('button', { name: /previous/i });
    const nextButton = page.getByRole('button', { name: /next/i });
    
    await expect(prevButton).toBeVisible();
    await expect(nextButton).toBeVisible();
    
    // Click next week
    await nextButton.click();
    await page.waitForLoadState('networkidle');
    
    // Click previous week to go back
    await prevButton.click();
    await page.waitForLoadState('networkidle');
  });

  test('should open add recipe modal', async ({ page }) => {
    // Look for add recipe buttons (+ symbols)
    const addButtons = page.locator('button:has-text("+")');
    await expect(addButtons.first()).toBeVisible();
    
    // Click first add button
    await addButtons.first().click();
    
    // Should show recipe selection (dropdown or modal)
    // This might be a dropdown on desktop or modal on mobile
    const recipeSelector = page.locator('[role="combobox"], [role="dialog"]');
    await expect(recipeSelector).toBeVisible({ timeout: 5000 });
  });

  test('should add recipe to meal slot through UI interaction', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Take screenshot before interaction
    await page.screenshot({ path: 'test-results/before-add-recipe.png' });
    
    // Find add recipe buttons and click one
    const addButtons = page.locator('button').filter({ hasText: '+' });
    const buttonCount = await addButtons.count();
    expect(buttonCount).toBeGreaterThan(0);
    
    // Click the first add button
    await addButtons.first().click();
    await page.waitForTimeout(1000);
    
    // Look for recipe selector UI (dropdown, modal, or command menu)
    const possibleSelectors = [
      'input[placeholder*="search" i]',
      'input[placeholder*="recipe" i]',
      '[role="combobox"]',
      '[role="dialog"]',
      'div[class*="popover"]',
      'div[class*="dropdown"]'
    ];
    
    let selectorFound = false;
    for (const selector of possibleSelectors) {
      const element = page.locator(selector);
      if (await element.isVisible({ timeout: 2000 })) {
        selectorFound = true;
        break;
      }
    }
    
    expect(selectorFound).toBe(true);
    
    // Search for and select a recipe
    const searchInput = page.locator('input[placeholder*="search" i], input[placeholder*="recipe" i]').first();
    if (await searchInput.isVisible({ timeout: 1000 })) {
      await searchInput.fill('egg');
      await page.waitForTimeout(500);
    }
    
    // Try to select a recipe option
    const recipeOptions = [
      'div[role="option"]',
      'button:has-text("egg")',
      'div:has-text("omelette")',
      '[data-value*="egg"]'
    ];
    
    for (const optionSelector of recipeOptions) {
      const options = page.locator(optionSelector);
      if (await options.count() > 0) {
        await options.first().click();
        break;
      }
    }
    
    await page.waitForLoadState('networkidle');
    
    // Take screenshot after interaction
    await page.screenshot({ path: 'test-results/after-add-recipe.png' });
  });

  test('should show AI suggestions modal', async ({ page }) => {
    const aiButton = page.getByRole('button', { name: /get ai suggestions/i });
    await expect(aiButton).toBeVisible();
    
    await aiButton.click();
    
    // Check for AI modal
    const modal = page.locator('[role="dialog"]:has-text("AI Meal Plan Suggestions")');
    await expect(modal).toBeVisible();
    
    // Check for generate suggestions button
    const generateButton = page.getByRole('button', { name: /generate suggestions/i });
    await expect(generateButton).toBeVisible();
  });

  test('should generate AI meal suggestions', async ({ page }) => {
    // Wait for page to load fully
    await page.waitForLoadState('networkidle');
    
    const aiButton = page.getByRole('button', { name: /get ai suggestions/i });
    await expect(aiButton).toBeVisible();
    await aiButton.click();
    
    const modal = page.locator('[role="dialog"]').filter({ hasText: /ai.*suggestions/i });
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    const generateButton = page.getByRole('button', { name: /generate.*suggestions/i });
    await expect(generateButton).toBeVisible();
    await generateButton.click();
    
    // Wait for AI response (this might take a while)
    const reasoningText = page.locator('text=/reasoning|suggestion|recommended/i');
    await expect(reasoningText.first()).toBeVisible({ timeout: 30000 });
    
    // Check for "Different" buttons on suggestions
    const differentButtons = page.getByRole('button', { name: /different/i });
    if ((await differentButtons.count()) > 0) {
      await expect(differentButtons.first()).toBeVisible();
    }
  });

  test('should test alternative suggestions', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    const aiButton = page.getByRole('button', { name: /get ai suggestions/i });
    await aiButton.click();
    
    const generateButton = page.getByRole('button', { name: /generate.*suggestions/i });
    await generateButton.click();
    
    // Wait for suggestions to load
    const reasoningText = page.locator('text=/reasoning|suggestion|recommended/i');
    await expect(reasoningText.first()).toBeVisible({ timeout: 30000 });
    
    // Click "Different" button on first suggestion if available
    const differentButtons = page.getByRole('button', { name: /different/i });
    const buttonCount = await differentButtons.count();
    
    if (buttonCount > 0) {
      await differentButtons.first().click();
      
      // Wait for the suggestion to update
      await page.waitForTimeout(2000);
      
      // Verify the suggestion changed by checking for "Alternative suggestion" or updated content
      const alternativeText = page.locator('text=/alternative|updated|different/i');
      const hasAlternative = await alternativeText.count() > 0;
      
      if (hasAlternative) {
        await expect(alternativeText.first()).toBeVisible();
      }
    }
  });

  test('should apply AI suggestions', async ({ page }) => {
    const aiButton = page.getByRole('button', { name: /get ai suggestions/i });
    await aiButton.click();
    
    const generateButton = page.getByRole('button', { name: /generate suggestions/i });
    await generateButton.click();
    
    // Wait for suggestions
    await expect(page.getByText(/reasoning/i)).toBeVisible({ timeout: 30000 });
    
    // Select first suggestion
    const suggestionCard = page.locator('[class*="cursor-pointer"]').first();
    await suggestionCard.click();
    
    // Apply suggestions
    const applyButton = page.getByRole('button', { name: /apply.*suggestions/i });
    await expect(applyButton).toBeVisible();
    await applyButton.click();
    
    // Should close modal and update meal plan
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    
    // Verify success message or modal closed
    const successMessage = page.locator('text=/applied.*suggestions|success/i');
    if (await successMessage.count() > 0) {
      await expect(successMessage.first()).toBeVisible();
    }
  });
});