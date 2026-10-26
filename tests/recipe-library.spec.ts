import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './helpers/auth';

test.describe('Recipe Library', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test using helper
    await loginAsTestUser(page);
    
    // Navigate to recipe library
    await page.click('a[href="/recipe-library"]');
    await page.waitForURL(/.*\/recipe-library/, { timeout: 5000 });
    await page.waitForLoadState('networkidle');
  });

  test('should display recipe library page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /recipe library/i })).toBeVisible();
    
    // Check for add recipe button
    await expect(page.getByRole('button', { name: /add recipe/i })).toBeVisible();
    
    // Check for filter controls
    await expect(page.getByText(/all meal types/i)).toBeVisible();
  });

  test('should display recipe cards', async ({ page }) => {
    // Wait for recipes to load
    await page.waitForLoadState('networkidle');
    
    // Check for recipe cards
    const recipeCards = page.locator('[class*="recipe"], [class*="card"]');
    await expect(recipeCards.first()).toBeVisible({ timeout: 10000 });
    
    // Check for recipe information
    await expect(page.getByText(/calories/i)).toBeVisible();
    await expect(page.getByText(/protein/i)).toBeVisible();
  });

  test('should filter recipes by meal type', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Click on meal type filter
    await page.click('button:has-text("All Meal Types")');
    
    // Select breakfast filter
    await page.click('text=Breakfast');
    
    // Wait for filtering to complete
    await page.waitForTimeout(1000);
    
    // All visible recipes should be breakfast items
    const recipeCards = page.locator('[class*="recipe"], [class*="card"]');
    const count = await recipeCards.count();
    
    if (count > 0) {
      // Check that displayed recipes are breakfast items
      await expect(page.getByText(/breakfast/i).first()).toBeVisible();
    }
  });

  test('should search recipes', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Find search input
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();
    
    // Search for a specific recipe
    await searchInput.fill('omelette');
    await page.waitForTimeout(1000);
    
    // Should show filtered results
    const recipeCards = page.locator('[class*="recipe"], [class*="card"]');
    const count = await recipeCards.count();
    
    if (count > 0) {
      await expect(page.getByText(/omelette/i)).toBeVisible();
    }
  });

  test('should open add recipe modal', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /add recipe/i });
    await addButton.click();
    
    // Check for modal
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // Check for form fields
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/description/i)).toBeVisible();
    await expect(page.getByLabel(/calories/i)).toBeVisible();
    await expect(page.getByLabel(/protein/i)).toBeVisible();
  });

  test('should create new recipe', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /add recipe/i });
    await addButton.click();
    
    // Fill out form
    await page.fill('[name="name"], input[placeholder*="name" i]', 'Test Recipe');
    await page.fill('[name="description"], textarea[placeholder*="description" i]', 'A test recipe for automation');
    await page.fill('[name="calories"], input[placeholder*="calories" i]', '300');
    await page.fill('[name="protein"], input[placeholder*="protein" i]', '20');
    await page.fill('[name="carbs"], input[placeholder*="carbs" i]', '30');
    await page.fill('[name="fats"], input[placeholder*="fats" i]', '10');
    
    // Select meal type
    await page.click('button:has-text("Select meal types")');
    await page.click('text=Breakfast');
    
    // Submit form
    const createButton = page.getByRole('button', { name: /create recipe/i });
    await createButton.click();
    
    // Should close modal and show success
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
    await expect(page.getByText(/recipe created/i)).toBeVisible();
    
    // Recipe should appear in list
    await expect(page.getByText('Test Recipe')).toBeVisible();
  });

  test('should edit existing recipe', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Find first edit button
    const editButton = page.getByRole('button', { name: /edit/i }).first();
    if (await editButton.isVisible()) {
      await editButton.click();
      
      // Check for edit modal
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();
      
      // Update recipe name
      const nameInput = page.getByLabel(/name/i);
      await nameInput.fill('Updated Recipe Name');
      
      // Save changes
      const saveButton = page.getByRole('button', { name: /update recipe/i });
      await saveButton.click();
      
      // Should close modal and show updated recipe
      await expect(modal).not.toBeVisible();
      await expect(page.getByText('Updated Recipe Name')).toBeVisible();
    }
  });

  test('should delete recipe', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Find first delete button
    const deleteButton = page.getByRole('button', { name: /delete/i }).first();
    if (await deleteButton.isVisible()) {
      // Get recipe name before deletion
      const recipeCard = deleteButton.locator('..').locator('..');
      const recipeName = await recipeCard.textContent();
      
      await deleteButton.click();
      
      // Confirm deletion if confirmation dialog appears
      const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
      
      // Recipe should be removed
      if (recipeName) {
        await expect(page.getByText(recipeName.split(' ')[0])).not.toBeVisible();
      }
    }
  });
});