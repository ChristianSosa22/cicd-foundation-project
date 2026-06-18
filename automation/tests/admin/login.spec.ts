import { expect } from '@playwright/test';
import { test } from '../../src/fixtures';

test.describe('Login — Administrador', () => {
  test('Inicia sesión con credenciales válidas y es redirigido al dashboard', async ({
    loginPage,
  }) => {
    const email = process.env.ADMIN_EMAIL ?? '';
    const password = process.env.ADMIN_PASSWORD ?? '';

    await loginPage.goto();
    await loginPage.loginAsAdmin(email, password);

    await expect(loginPage.pageInstance).toHaveURL(/\/dashboard/);
  });
});
