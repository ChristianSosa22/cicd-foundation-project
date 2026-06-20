import { expect } from '@playwright/test';
import { test } from '../../src/fixtures';
import { buildVehicleOfType } from '../../test-data';

test.describe('Mis Vehículos', () => {
  test.beforeEach(async ({ loginPage, driverVehiclesPage }) => {
    await loginPage.loginAsDriver();
    await driverVehiclesPage.goto();
  });

  test('Registra un vehículo tipo auto y aparece como Pendiente con los datos correctos', async ({
    driverVehiclesPage,
  }) => {
    // Placa en formato ABC-1234 (3 letras + guion + 4 dígitos)
    const { plate } = buildVehicleOfType('auto');

    // Interceptar la respuesta antes de iniciar el registro para capturar el ID
    const responsePromise = driverVehiclesPage.pageInstance.waitForResponse(
      (r) =>
        r.url().includes('/me/vehicles') &&
        r.request().method() === 'POST' &&
        r.ok(),
    );

    // Registrar vehículo a través del formulario UI
    await driverVehiclesPage.registerVehicle(plate, 'auto');

    const response = await responsePromise;
    const { id: vehicleId } = await response.json();

    // El formulario debe cerrarse tras el registro exitoso
    await expect(driverVehiclesPage.registerForm).toBeHidden();

    // La card del vehículo debe ser visible en la lista
    expect(await driverVehiclesPage.isCardVisible(vehicleId)).toBe(true);

    // El badge de estado debe indicar "Pendiente" (los vehículos nuevos requieren aprobación)
    await expect(driverVehiclesPage.vehicleStatusBadge(vehicleId)).toHaveText('Pendiente');

    // La card debe mostrar la placa (frontend la guarda en mayúsculas) y el tipo correcto
    const card = driverVehiclesPage.vehicleCard(vehicleId);
    await expect(card).toContainText(plate);
    await expect(card).toContainText('Auto');
  });

  test('Registra un vehículo tipo moto y aparece como Pendiente con los datos correctos', async ({
    driverVehiclesPage,
  }) => {
    const { plate } = buildVehicleOfType('moto');

    const responsePromise = driverVehiclesPage.pageInstance.waitForResponse(
      (r) =>
        r.url().includes('/me/vehicles') &&
        r.request().method() === 'POST' &&
        r.ok(),
    );

    await driverVehiclesPage.registerVehicle(plate, 'moto');

    const { id: vehicleId } = await (await responsePromise).json();

    await expect(driverVehiclesPage.registerForm).toBeHidden();
    expect(await driverVehiclesPage.isCardVisible(vehicleId)).toBe(true);
    await expect(driverVehiclesPage.vehicleStatusBadge(vehicleId)).toHaveText('Pendiente');

    const card = driverVehiclesPage.vehicleCard(vehicleId);
    await expect(card).toContainText(plate);
    await expect(card).toContainText('Moto');
  });

  test('Registra un vehículo tipo camioneta y aparece como Pendiente con los datos correctos', async ({
    driverVehiclesPage,
  }) => {
    const { plate } = buildVehicleOfType('camioneta');

    const responsePromise = driverVehiclesPage.pageInstance.waitForResponse(
      (r) =>
        r.url().includes('/me/vehicles') &&
        r.request().method() === 'POST' &&
        r.ok(),
    );

    await driverVehiclesPage.registerVehicle(plate, 'camioneta');

    const { id: vehicleId } = await (await responsePromise).json();

    await expect(driverVehiclesPage.registerForm).toBeHidden();
    expect(await driverVehiclesPage.isCardVisible(vehicleId)).toBe(true);
    await expect(driverVehiclesPage.vehicleStatusBadge(vehicleId)).toHaveText('Pendiente');

    const card = driverVehiclesPage.vehicleCard(vehicleId);
    await expect(card).toContainText(plate);
    await expect(card).toContainText('Camioneta');
  });
});