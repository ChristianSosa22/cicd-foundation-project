import { expect } from '@playwright/test';
import { test } from '../../src/fixtures';

test.describe('Login — Conductor', () => {
  test('Inicia sesión con credenciales válidas y es redirigido a disponibilidad', async ({
    loginPage,
  }) => {
    const email = process.env.CONDUCTOR_EMAIL ?? '';
    const password = process.env.CONDUCTOR_PASSWORD ?? '';

    await loginPage.goto();
    await loginPage.loginAsDriver(email, password);

    await expect(loginPage.pageInstance).toHaveURL(/\/availability/);
  });
});
