import { expect } from '@playwright/test';
import { test } from '../../src/fixtures';

test.describe('Login — Administrador', () => {
  test('Inicia sesión con credenciales válidas y es redirigido al dashboard', async ({
    loginPage,
  }) => {
    await loginPage.loginAsAdmin();

    await expect(loginPage.adminPageInstance).toHaveURL(/\/dashboard/);
  });
});