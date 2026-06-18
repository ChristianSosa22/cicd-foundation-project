import { expect } from '@playwright/test';
import { test } from '../../src/fixtures';
import { buildVehicleOfType } from '../../test-data';

test.describe('Aprobación de Vehículos', () => {
  test('Aprueba un vehículo pendiente y desaparece de Pendientes y aparece en Aprobados', async ({
    adminVehicles,
    apiClient,
  }) => {
    // Pre-condición: Registrar un vehículo como conductor 
    const { token: conductorToken } = await apiClient.login(
      process.env.CONDUCTOR_EMAIL!,
      process.env.CONDUCTOR_PASSWORD!,
    );

    const { plate } = buildVehicleOfType('auto');

    const vehicle = await apiClient.withToken(conductorToken).createVehicle(plate, 'auto');
    const vehicleId = vehicle.id;

    // Navegar a Aprobación de vehículos y aprobar
    await adminVehicles.goto();

    // El vehículo debe aparecer en la sección Pendientes
    await expect(adminVehicles.pendingRow(vehicleId)).toBeVisible();

    // Aprobar desde la UI
    await adminVehicles.approveVehicle(vehicleId);

    // Assert: Ya no aparece en Pendientes
    await expect(adminVehicles.pendingRow(vehicleId)).toBeHidden();

    // Assert: Aparece en la tabla de Aprobados con los datos correctos
    await adminVehicles.showApproved();

    const approvedRow = adminVehicles.approvedRow(vehicleId);
    await expect(approvedRow).toBeVisible();
    await expect(approvedRow).toContainText(plate);
    await expect(approvedRow).toContainText('Auto');
  });
});