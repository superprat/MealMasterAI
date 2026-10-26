import { TEST_PASSWORD, TEST_FAMILY_NAME } from "./config";
import { Page, expect } from '@playwright/test';

export async function loginAsTestUser(page: Page, password: string = TEST_PASSWORD) {
  await page.goto('/login');
  await page.fill('[placeholder*="password" i]', password);
  await page.click('button[type="submit"]');
  
  // Wait for successful login and redirect
  await page.waitForURL(/.*\/meal-planner/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  
  // Verify we're logged in by checking for family name
  await expect(page.getByText(new RegExp(TEST_FAMILY_NAME, 'i'))).toBeVisible();
  
  return page;
}

export async function logout(page: Page) {
  const logoutButton = page.locator('button:has-text("Logout")');
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
    await page.waitForURL(/.*\/login/, { timeout: 5000 });
  }
}

export async function ensureLoggedIn(page: Page, password: string = TEST_PASSWORD) {
  // Check if already logged in
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    await loginAsTestUser(page, password);
  } else {
    // Check if we have access by looking for family name
    const familyName = page.locator(`text=${TEST_FAMILY_NAME}`);
    if (!(await familyName.isVisible({ timeout: 2000 }))) {
      await loginAsTestUser(page, password);
    }
  }
}