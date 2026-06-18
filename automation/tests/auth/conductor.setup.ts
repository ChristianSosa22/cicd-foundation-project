import { test as setup, request } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_FILE = path.resolve(__dirname, '../../.auth/conductor.json');

/**
 * Generates conductor auth state by obtaining a JWT via the API and injecting it
 * into localStorage, then persisting the browser storage state.
 */
setup('generate conductor auth state', async ({ page, baseURL }) => {
  const apiUrl = process.env.API_URL ?? 'http://localhost:8080';

  const apiContext = await request.newContext({ baseURL: apiUrl });
  const response = await apiContext.post('/auth/login', {
    data: {
      email: process.env.CONDUCTOR_EMAIL,
      password: process.env.CONDUCTOR_PASSWORD,
    },
  });

  if (!response.ok()) {
    throw new Error(`Conductor login failed (${response.status()}): ${await response.text()}`);
  }

  const session = await response.json();
  await apiContext.dispose();

  await page.goto(baseURL ?? 'http://localhost:3000');
  await page.evaluate(
    ({ key, value }: { key: string; value: string }) => localStorage.setItem(key, value),
    { key: 'parking.session', value: JSON.stringify(session) },
  );

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
