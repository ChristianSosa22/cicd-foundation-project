import { expect } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { test } from '../../src/fixtures';

test.describe('Gestión de Tarifas', () => {
  test.beforeEach(async ({ loginPage, adminTariffsPage }) => {
    await loginPage.loginAsAdmin();
    await adminTariffsPage.goto();
  });

  test('Actualiza la tarifa del auto con moneda GTQ y aparece correctamente en tarifas actuales e historial', async ({
    adminTariffsPage,
  }) => {
    // Monto aleatorio entre Q1 y Q50 (límite de negocio)
    const price = faker.number.int({ min: 1, max: 50 });
    const expectedPrice = price.toFixed(2);
    const currency = 'GTQ';

    // Interceptar la respuesta antes de iniciar la creación para capturar el ID
    const responsePromise = adminTariffsPage.pageInstance.waitForResponse(
      (r) =>
        r.url().includes('/admin/tariffs') &&
        r.request().method() === 'POST' &&
        r.ok(),
    );

    // Registrar la nueva tarifa a través del formulario UI
    await adminTariffsPage.createTariff('auto', String(price), currency);

    const response = await responsePromise;
    const { id: tariffId } = await response.json();

    // Debe aparecer un mensaje de éxito tras el envío
    await expect(adminTariffsPage.createTariffSuccess).toBeVisible();

    // Tabla de tarifas actuales
    expect(await adminTariffsPage.isCurrentRowVisible('auto')).toBe(true);

    const currentRow = adminTariffsPage.currentRow('auto');
    await expect(currentRow.getByTestId('tariff-price')).toHaveText(expectedPrice);
    await expect(currentRow.getByTestId('tariff-currency')).toHaveText(currency);

    // Tabla de historial
    expect(await adminTariffsPage.isHistoryRowVisible(tariffId)).toBe(true);

    const historyRow = adminTariffsPage.historyRow(tariffId);
    await expect(historyRow).toContainText('Auto');
    await expect(historyRow).toContainText(expectedPrice);
    await expect(historyRow).toContainText(currency);
  });
});