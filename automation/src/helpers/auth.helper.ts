import { type Page } from '@playwright/test';

const STORAGE_KEY = 'parking.session';

export interface StoredSession {
  token: string;
  user: Record<string, unknown>;
}

/**
 * Injects a pre-obtained JWT session directly into localStorage.
 * Faster than UI login — use in setup/teardown, not in tests that validate the login flow.
 */
export async function setAuthViaLocalStorage(page: Page, session: StoredSession): Promise<void> {
  await page.evaluate(
    ({ key, value }: { key: string; value: string }) => localStorage.setItem(key, value),
    { key: STORAGE_KEY, value: JSON.stringify(session) },
  );
}

export async function clearAuth(page: Page): Promise<void> {
  await page.evaluate((key: string) => localStorage.removeItem(key), STORAGE_KEY);
}

export async function getStoredToken(page: Page): Promise<string | null> {
  return page.evaluate((key: string) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as { token: string }).token;
    } catch {
      return null;
    }
  }, STORAGE_KEY);
}
