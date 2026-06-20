import { expect } from '@playwright/test';
import { test } from '../../src/fixtures';
import { buildVehicleOfType } from '../../test-data';

test.describe('Aprobación de Vehículos', () => {
  let vehicleId: number;
  let plate: string;

  test.beforeEach(async ({ loginPage, driverVehiclesPage }) => {
    ({ plate } = buildVehicleOfType('auto'));
    await loginPage.loginAsDriver();

    // Pre-condición: conductor registra el vehículo vía UI
    await driverVehiclesPage.goto();

    const vehicleResponsePromise = driverVehiclesPage.pageInstance.waitForResponse(
      (r) =>
        r.url().includes('/me/vehicles') &&
        r.request().method() === 'POST' &&
        r.ok(),
    );
    await driverVehiclesPage.registerVehicle(plate, 'auto');
    ({ id: vehicleId } = await (await vehicleResponsePromise).json());
  });

  test('Aprueba un vehículo pendiente y desaparece de Pendientes y aparece en Aprobados', async ({
    loginPage,
    adminVehiclesPage,
  }) => {
    await loginPage.loginAsAdmin();

    // Navegar a Aprobación de vehículos y aprobar
    await adminVehiclesPage.goto();

    // El vehículo debe aparecer en la sección Pendientes
    await expect(adminVehiclesPage.pendingRow(vehicleId)).toBeVisible();

    // Aprobar desde la UI
    await adminVehiclesPage.approveVehicle(vehicleId);

    // Assert: Ya no aparece en Pendientes
    await expect(adminVehiclesPage.pendingRow(vehicleId)).toBeHidden();

    // Assert: Aparece en la tabla de Aprobados con los datos correctos
    await adminVehiclesPage.showApproved();

    const approvedRow = adminVehiclesPage.approvedRow(vehicleId);
    await expect(approvedRow).toBeVisible();
    await expect(approvedRow).toContainText(plate);
    await expect(approvedRow).toContainText('Auto');
  });
});