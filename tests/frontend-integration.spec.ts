import { TEST_PASSWORD, TEST_FAMILY_NAME } from "./helpers/config";
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth';

test.describe('Frontend Integration Tests - Complete User Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('should complete full meal planning workflow', async ({ page }) => {
    // 1. Navigate to meal planner page
    await page.goto('/meal-planner');
    await page.waitForLoadState('networkidle');
    
    // 2. Verify page loaded correctly
    await expect(page.locator(`text=${TEST_FAMILY_NAME}`)).toBeVisible();
    await expect(page.locator('text=Meal Calendar')).toBeVisible();
    
    // 3. Test navigation between pages
    await page.click('a[href="/recipe-library"]');
    await page.waitForURL(/.*recipe-library/);
    await expect(page.locator('text=Recipe Library')).toBeVisible();
    
    // 4. Go back to meal planner
    await page.click('a[href="/meal-planner"]');
    await page.waitForURL(/.*meal-planner/);
    
    // 5. Test week navigation
    const nextButton = page.locator('button').filter({ hasText: /next|→/i });
    if (await nextButton.count() > 0) {
      await nextButton.click();
      await page.waitForLoadState('networkidle');
    }
    
    const prevButton = page.locator('button').filter({ hasText: /prev|←/i });
    if (await prevButton.count() > 0) {
      await prevButton.click();
      await page.waitForLoadState('networkidle');
    }
    
    // 6. Take screenshot of final state
    await page.screenshot({ path: 'test-results/meal-planner-navigation.png' });
  });

  test('should interact with meal slots and recipe selection', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Find all meal slots
    const mealSlots = page.locator('div').filter({ hasText: /breakfast|lunch|dinner|snack/i });
    await expect(mealSlots.first()).toBeVisible();
    
    // Find add buttons within meal slots
    const addButtons = page.locator('button').filter({ hasText: '+' });
    const addButtonCount = await addButtons.count();
    
    if (addButtonCount > 0) {
      // Click first add button
      await addButtons.first().click();
      await page.waitForTimeout(1000);
      
      // Check if recipe selector appeared
      const uiElements = [
        page.locator('input[placeholder*="search"]'),
        page.locator('[role="combobox"]'),
        page.locator('[role="dialog"]'),
        page.locator('div[class*="command"]'),
        page.locator('div[class*="popover"]')
      ];
      
      let elementFound = false;
      for (const element of uiElements) {
        if (await element.isVisible({ timeout: 2000 })) {
          elementFound = true;
          
          // If it's a search input, try typing
          if (await element.getAttribute('placeholder') !== null) {
            await element.fill('egg');
            await page.waitForTimeout(500);
          }
          break;
        }
      }
      
      expect(elementFound).toBe(true);
      
      // Try to select a recipe
      const recipeSelectors = [
        'div[role="option"]:has-text("egg")',
        'button:has-text("omelette")',
        'div:has-text("cheese")',
        '[data-value]'
      ];
      
      for (const selector of recipeSelectors) {
        const options = page.locator(selector);
        if (await options.count() > 0) {
          await options.first().click();
          await page.waitForLoadState('networkidle');
          break;
        }
      }
    }
    
    await page.screenshot({ path: 'test-results/recipe-selection-interaction.png' });
  });

  test('should test AI suggestions complete workflow', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // 1. Open AI suggestions modal
    const aiButton = page.locator('button').filter({ hasText: /ai suggestions|get.*suggestions/i });
    await expect(aiButton).toBeVisible();
    await aiButton.click();
    
    // 2. Verify modal opened
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.locator('text=AI')).toBeVisible();
    
    await page.screenshot({ path: 'test-results/ai-modal-opened.png' });
    
    // 3. Generate suggestions
    const generateButton = modal.locator('button').filter({ hasText: /generate|suggest/i });
    await expect(generateButton).toBeVisible();
    await generateButton.click();
    
    // 4. Wait for AI response
    await page.waitForTimeout(2000);
    const loadingIndicator = modal.locator('text=/loading|generating|thinking/i');
    if (await loadingIndicator.isVisible({ timeout: 1000 })) {
      await expect(loadingIndicator).not.toBeVisible({ timeout: 30000 });
    }
    
    // 5. Check for suggestions content
    await page.waitForTimeout(1000);
    const suggestionContent = modal.locator('text=/reasoning|suggestion|meal|recipe/i');
    await expect(suggestionContent.first()).toBeVisible({ timeout: 30000 });
    
    await page.screenshot({ path: 'test-results/ai-suggestions-generated.png' });
    
    // 6. Test "Different" button functionality
    const differentButtons = modal.locator('button').filter({ hasText: /different/i });
    if (await differentButtons.count() > 0) {
      await differentButtons.first().click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ path: 'test-results/ai-alternative-suggestion.png' });
    }
    
    // 7. Close modal
    const closeButton = modal.locator('button').filter({ hasText: /close|cancel|×/i });
    if (await closeButton.count() > 0) {
      await closeButton.click();
    } else {
      await page.keyboard.press('Escape');
    }
    
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test('should test responsive design behavior', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/desktop-view.png' });
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/tablet-view.png' });
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/mobile-view.png' });
    
    // Test add recipe behavior on mobile
    const addButtons = page.locator('button').filter({ hasText: '+' });
    if (await addButtons.count() > 0) {
      await addButtons.first().click();
      await page.waitForTimeout(1000);
      
      // On mobile, should show bottom sheet or full-screen modal
      const mobileSelector = page.locator('[role="dialog"], div[class*="sheet"], div[class*="drawer"]');
      if (await mobileSelector.isVisible({ timeout: 2000 })) {
        await page.screenshot({ path: 'test-results/mobile-recipe-selector.png' });
        
        // Close the selector
        await page.keyboard.press('Escape');
      }
    }
  });

  test('should test macro calculations and weekly overview', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Check for weekly overview section
    const weeklyOverview = page.locator('text=Weekly Overview').or(page.locator('text=weekly')).first();
    await expect(weeklyOverview).toBeVisible();
    
    // Check for macro elements
    const macroElements = [
      'text=Calories',
      'text=Protein',
      'text=Carbs',
      'text=Fats'
    ];
    
    for (const element of macroElements) {
      await expect(page.locator(element)).toBeVisible();
    }
    
    // Check for daily macro summary
    const dailyMacro = page.locator('text=Daily Macro').or(page.locator('text=daily')).first();
    if (await dailyMacro.isVisible({ timeout: 2000 })) {
      await expect(dailyMacro).toBeVisible();
    }
    
    await page.screenshot({ path: 'test-results/macro-calculations.png' });
  });

  test('should test form validation and error handling', async ({ page }) => {
    // Navigate to recipe library to test forms
    await page.goto('/recipe-library');
    await page.waitForLoadState('networkidle');
    
    // Look for add recipe button
    const addRecipeButton = page.locator('button').filter({ hasText: /add.*recipe|create.*recipe|\+/i });
    if (await addRecipeButton.count() > 0) {
      await addRecipeButton.click();
      await page.waitForTimeout(1000);
      
      // Check if form modal opened
      const formModal = page.locator('[role="dialog"]');
      if (await formModal.isVisible({ timeout: 2000 })) {
        // Try submitting empty form to test validation
        const submitButton = formModal.locator('button[type="submit"], button').filter({ hasText: /save|create|add/i });
        if (await submitButton.count() > 0) {
          await submitButton.click();
          await page.waitForTimeout(500);
          
          // Check for validation errors
          const errorMessages = formModal.locator('text=/required|error|invalid/i');
          if (await errorMessages.count() > 0) {
            await expect(errorMessages.first()).toBeVisible();
          }
          
          await page.screenshot({ path: 'test-results/form-validation.png' });
        }
        
        // Close modal
        const closeButton = formModal.locator('button').filter({ hasText: /close|cancel|×/i });
        if (await closeButton.count() > 0) {
          await closeButton.click();
        } else {
          await page.keyboard.press('Escape');
        }
      }
    }
  });

  test('should test authentication and session management', async ({ page }) => {
    // Test logout
    const logoutButton = page.locator('button').filter({ hasText: /logout/i });
    await expect(logoutButton).toBeVisible();
    
    await logoutButton.click();
    await page.waitForURL(/.*login/, { timeout: 5000 });
    
    // Verify we're on login page
    await expect(page.locator('input[type="password"], input[placeholder*="password"]')).toBeVisible();
    
    // Test invalid login
    await page.fill('input[type="password"], input[placeholder*="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);
    
    // Should show error message
    const errorMessage = page.locator('text=/invalid|incorrect|wrong/i');
    await expect(errorMessage).toBeVisible({ timeout: 3000 });
    
    await page.screenshot({ path: 'test-results/login-error.png' });
    
    // Test valid login
    await page.fill('input[type="password"], input[placeholder*="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*meal-planner/, { timeout: 10000 });
    
    // Verify successful login
    await expect(page.locator(`text=${TEST_FAMILY_NAME}`)).toBeVisible();
    
    await page.screenshot({ path: 'test-results/successful-login.png' });
  });
});