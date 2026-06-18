import { expect } from '@playwright/test';
import { test } from '../../src/fixtures';
import { buildVehicleOfType } from '../../test-data';

test.describe('Disponibilidad — Reservar espacio', () => {
  test('Confirma una reserva de auto y aparece en Mis Reservas como Reservada con las opciones correctas', async ({
    availabilityPage,
    reservePage,
    driverReservations,
    apiClient,
  }) => {
    // ── Pre-condición: crear y aprobar un vehículo tipo auto vía API ──────────
    // La reserva requiere al menos un vehículo aprobado; se usa API para no
    // depender de datos de seed ni de un flujo de aprobación manual.
    const { token: conductorToken } = await apiClient.login(
      process.env.CONDUCTOR_EMAIL!,
      process.env.CONDUCTOR_PASSWORD!,
    );
    const { token: adminToken } = await apiClient.login(
      process.env.ADMIN_EMAIL!,
      process.env.ADMIN_PASSWORD!,
    );

    const { plate } = buildVehicleOfType('auto');

    const vehicle = await apiClient.withToken(conductorToken).createVehicle(plate, 'auto');
    await apiClient.withToken(adminToken).approveVehicle(vehicle.id);

    // Seleccionar un espacio disponible desde Disponibilidad
    await availabilityPage.goto();
    await availabilityPage.filterByVehicleType('auto');
    await availabilityPage.clickFirstAvailableSpace();

    // Completar el formulario de reserva
    const today = new Date().toISOString().split('T')[0];
    await reservePage.setDate(today);
    await reservePage.selectVehicleById(vehicle.id);

    // Registrar el listener antes del click para capturar el ID de la reserva.
    const reservationResponsePromise = reservePage.pageInstance.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        r.url().includes('/reservar') &&
        r.status() >= 200 &&
        r.status() < 300,
    );

    await reservePage.confirmReservation();
    const response = await reservationResponsePromise;
    const { id: reservationId } = await response.json();

    await reservePage.waitForRedirectToReservations();

    // Assert: Mis Reservas muestra la reserva con los datos correctos 
    await expect(driverReservations.pageInstance).toHaveURL(/\/reservations/);

    await expect(driverReservations.reservationCard(reservationId)).toBeVisible();
    await expect(driverReservations.reservationStatus(reservationId)).toHaveText('Reservada');

    // Opciones disponibles en estado "Reservada"
    await expect(driverReservations.confirmButton(reservationId)).toBeVisible();  // Confirmar llegada
    await expect(driverReservations.cancelButton(reservationId)).toBeVisible();   // Cancelar
    await expect(driverReservations.detailLink(reservationId)).toBeVisible();     // Ver detalle

    // "Liberar espacio" solo aparece tras confirmar llegada (estado Confirmada)
    await expect(driverReservations.releaseButton(reservationId)).toBeHidden();
  });
});