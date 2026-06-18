import { expect } from '@playwright/test';
import { test } from '../../src/fixtures';
import { buildVehicleOfType } from '../../test-data';

test.describe('Mis Vehículos', () => {
  test.beforeEach(async ({ driverVehicles }) => {
    await driverVehicles.goto();
  });

  test('Registra un vehículo tipo auto y aparece como Pendiente con los datos correctos', async ({
    driverVehicles,
  }) => {
    // Placa en formato ABC-1234 (3 letras + guion + 4 dígitos)
    const { plate } = buildVehicleOfType('auto');

    // Interceptar la respuesta antes de iniciar el registro para capturar el ID
    const responsePromise = driverVehicles.pageInstance.waitForResponse(
      (r) =>
        r.url().includes('/me/vehicles') &&
        r.request().method() === 'POST' &&
        r.ok(),
    );

    // Registrar vehículo a través del formulario UI
    await driverVehicles.registerVehicle(plate, 'auto');

    const response = await responsePromise;
    const { id: vehicleId } = await response.json();

    // El formulario debe cerrarse tras el registro exitoso
    await expect(driverVehicles.registerForm).toBeHidden();

    // La card del vehículo debe ser visible en la lista
    expect(await driverVehicles.isCardVisible(vehicleId)).toBe(true);

    // El badge de estado debe indicar "Pendiente" (los vehículos nuevos requieren aprobación)
    await expect(driverVehicles.vehicleStatusBadge(vehicleId)).toHaveText('Pendiente');

    // La card debe mostrar la placa (frontend la guarda en mayúsculas) y el tipo correcto
    const card = driverVehicles.vehicleCard(vehicleId);
    await expect(card).toContainText(plate);
    await expect(card).toContainText('Auto');
  });

  test('Registra un vehículo tipo moto y aparece como Pendiente con los datos correctos', async ({
    driverVehicles,
  }) => {
    const { plate } = buildVehicleOfType('moto');

    const responsePromise = driverVehicles.pageInstance.waitForResponse(
      (r) =>
        r.url().includes('/me/vehicles') &&
        r.request().method() === 'POST' &&
        r.ok(),
    );

    await driverVehicles.registerVehicle(plate, 'moto');

    const { id: vehicleId } = await (await responsePromise).json();

    await expect(driverVehicles.registerForm).toBeHidden();
    expect(await driverVehicles.isCardVisible(vehicleId)).toBe(true);
    await expect(driverVehicles.vehicleStatusBadge(vehicleId)).toHaveText('Pendiente');

    const card = driverVehicles.vehicleCard(vehicleId);
    await expect(card).toContainText(plate);
    await expect(card).toContainText('Moto');
  });

  test('Registra un vehículo tipo camioneta y aparece como Pendiente con los datos correctos', async ({
    driverVehicles,
  }) => {
    const { plate } = buildVehicleOfType('camioneta');

    const responsePromise = driverVehicles.pageInstance.waitForResponse(
      (r) =>
        r.url().includes('/me/vehicles') &&
        r.request().method() === 'POST' &&
        r.ok(),
    );

    await driverVehicles.registerVehicle(plate, 'camioneta');

    const { id: vehicleId } = await (await responsePromise).json();

    await expect(driverVehicles.registerForm).toBeHidden();
    expect(await driverVehicles.isCardVisible(vehicleId)).toBe(true);
    await expect(driverVehicles.vehicleStatusBadge(vehicleId)).toHaveText('Pendiente');

    const card = driverVehicles.vehicleCard(vehicleId);
    await expect(card).toContainText(plate);
    await expect(card).toContainText('Camioneta');
  });
});