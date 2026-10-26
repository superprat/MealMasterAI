import { TEST_PASSWORD, TEST_FAMILY_NAME } from "./helpers/config";
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth';

test.describe('Responsive Design', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test using helper
    await loginAsTestUser(page);
  });

  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check that navigation is mobile-friendly
    await expect(page.getByText(new RegExp(TEST_FAMILY_NAME, 'i'))).toBeVisible();
    
    // Meal calendar should be stacked vertically on mobile
    await expect(page.getByText(/meal calendar/i)).toBeVisible();
    
    // Navigation should be responsive
    const mealPlannerLink = page.getByRole('link', { name: /meal planner/i });
    const recipeLibraryLink = page.getByRole('link', { name: /recipe library/i });
    
    await expect(mealPlannerLink).toBeVisible();
    await expect(recipeLibraryLink).toBeVisible();
  });

  test('should handle mobile add recipe interaction', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Find and click add recipe button on mobile
    const addButtons = page.locator('button:has-text("+")');
    if (await addButtons.count() > 0) {
      await addButtons.first().click();
      
      // On mobile, this might show a bottom sheet instead of dropdown
      const selector = page.locator('[role="dialog"], [role="combobox"], .sheet');
      await expect(selector).toBeVisible({ timeout: 5000 });
    }
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Check layout adapts to tablet size
    await expect(page.getByText(/meal calendar/i)).toBeVisible();
    await expect(page.getByText(/weekly overview/i)).toBeVisible();
    
    // Navigation should be visible
    await expect(page.getByRole('link', { name: /meal planner/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /recipe library/i })).toBeVisible();
  });

  test('should work on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // All components should be visible on desktop
    await expect(page.getByText(/meal calendar/i)).toBeVisible();
    await expect(page.getByText(/weekly overview/i)).toBeVisible();
    await expect(page.getByText(/daily macro summary/i)).toBeVisible();
    
    // Desktop should show full navigation
    await expect(page.getByRole('link', { name: /meal planner/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /recipe library/i })).toBeVisible();
  });

  test('should handle orientation changes', async ({ page }) => {
    // Start in portrait
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByText(/meal calendar/i)).toBeVisible();
    
    // Rotate to landscape
    await page.setViewportSize({ width: 667, height: 375 });
    
    // Content should still be accessible
    await expect(page.getByText(/meal calendar/i)).toBeVisible();
    await expect(page.getByText(new RegExp(TEST_FAMILY_NAME, 'i'))).toBeVisible();
  });
});