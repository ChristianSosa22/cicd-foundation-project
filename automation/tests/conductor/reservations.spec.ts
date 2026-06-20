import { expect } from '@playwright/test';
import { test } from '../../src/fixtures';
import { buildVehicleOfType } from '../../test-data';

test.describe('Disponibilidad — Reservar espacio', () => {
  let vehicleId: number;
  let plate: string;

  test.beforeEach(async ({ loginPage, driverVehiclesPage }) => {
    ({ plate } = buildVehicleOfType('auto'));
    await loginPage.loginAsDriver();
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

  test.beforeEach(async ({ loginPage, adminVehiclesPage }) => {
    await loginPage.loginAsAdmin();
    await adminVehiclesPage.goto();
    await adminVehiclesPage.approveVehicle(vehicleId);
    await expect(adminVehiclesPage.pendingRow(vehicleId)).toBeHidden();
  });

  test('Confirma una reserva de auto y aparece en Mis Reservas como Reservada con las opciones correctas', async ({
    availabilityPage,
    reservePage,
    driverReservationsPage,
  }) => {
    // ── Seleccionar un espacio disponible desde Disponibilidad ────────────────
    await availabilityPage.goto();
    await availabilityPage.filterByVehicleType('auto');
    await availabilityPage.clickFirstAvailableSpace();

    // ── Completar el formulario de reserva ────────────────────────────────────
    const today = new Date().toISOString().split('T')[0];
    await reservePage.setDate(today);
    await reservePage.selectVehicleById(vehicleId);

    const reservationResponsePromise = reservePage.pageInstance.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        r.url().includes('/reservar') &&
        r.status() >= 200 &&
        r.status() < 300,
    );

    await reservePage.confirmReservation();
    const { id: reservationId } = await (await reservationResponsePromise).json();

    await reservePage.waitForRedirectToReservations();

    // ── Assert: Mis Reservas muestra la reserva con los datos correctos ───────
    await expect(driverReservationsPage.pageInstance).toHaveURL(/\/reservations/);

    await expect(driverReservationsPage.reservationCard(reservationId)).toBeVisible();
    await expect(driverReservationsPage.reservationStatus(reservationId)).toHaveText('Reservada');

    // Opciones disponibles en estado "Reservada"
    await expect(driverReservationsPage.confirmButton(reservationId)).toBeVisible();
    await expect(driverReservationsPage.cancelButton(reservationId)).toBeVisible();
    await expect(driverReservationsPage.detailLink(reservationId)).toBeVisible();

    // "Liberar espacio" solo aparece tras confirmar llegada (estado Confirmada)
    await expect(driverReservationsPage.releaseButton(reservationId)).toBeHidden();
  });
});