import { expect } from '@playwright/test';
import { test } from '../../src/fixtures';

test.describe('Login — Conductor', () => {
  test('Inicia sesión con credenciales válidas y es redirigido a disponibilidad', async ({
    loginPage,
  }) => {
    await loginPage.loginAsDriver();

    await expect(loginPage.conductorPageInstance).toHaveURL(/\/availability/);
  });
});