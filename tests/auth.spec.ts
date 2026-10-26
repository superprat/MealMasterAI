import { TEST_PASSWORD, TEST_FAMILY_NAME } from "./helpers/config";
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('should show login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should reject invalid password', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[placeholder*="password" i]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error and stay on login page
    await expect(page.getByText(/invalid/i)).toBeVisible();
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('should login with valid password', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[placeholder*="password" i]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Wait for redirect and page load
    await page.waitForURL(/.*\/meal-planner/, { timeout: 10000 });
    await expect(page.getByText(new RegExp(TEST_FAMILY_NAME, 'i'))).toBeVisible();
  });

  test('should maintain session after login', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[placeholder*="password" i]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*\/meal-planner/, { timeout: 10000 });
    
    // Navigate to different page and back
    await page.goto('/recipe-library');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /recipe library/i })).toBeVisible();
    
    // Go back to meal planner - should still be logged in
    await page.goto('/meal-planner');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(new RegExp(TEST_FAMILY_NAME, 'i'))).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[placeholder*="password" i]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*\/meal-planner/, { timeout: 10000 });
    
    // Logout
    await page.click('button:has-text("Logout")');
    
    // Should redirect to login
    await page.waitForURL(/.*\/login/, { timeout: 5000 });
    
    // Verify session is cleared by trying to access protected page
    await page.goto('/meal-planner');
    await page.waitForURL(/.*\/login/, { timeout: 5000 });
  });
});