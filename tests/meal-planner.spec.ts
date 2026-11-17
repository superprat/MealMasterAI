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

});