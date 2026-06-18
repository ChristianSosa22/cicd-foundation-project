import { expect } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { test } from '../../src/fixtures';

test.describe('Gestión de Parqueos — Espacios', () => {
  test.beforeEach(async ({ adminSpaces }) => {
    await adminSpaces.goto();
  });

  test('Crea un nuevo espacio ejecutivo y aparece como Activo con la categoría seleccionada', async ({
    adminSpaces,
  }) => {
    // Formato E-001, sufijo aleatorio de 3 dígitos para evitar repetición
    const label = `E-${faker.string.numeric({ length: 3, allowLeadingZeros: true })}`;

    // Crear espacio a través del formulario UI
    await adminSpaces.createSpace({
      label,
      vehicleType: 'auto',
      categories: ['ejecutivo'],
    });

    // El formulario debe cerrarse tras la creación exitosa
    await expect(adminSpaces.createSpaceForm).toBeHidden();

    // Localizar el card recién creado por su label (el ID se desconoce antes de la creación)
    const newCard = adminSpaces.spacesList
      .locator('[data-testid^="space-card-"]')
      .filter({ hasText: label });

    // El card debe ser visible en la lista
    await expect(newCard).toBeVisible();

    // El badge de estado debe indicar "Activo" (los espacios se crean activos por defecto)
    await expect(newCard.getByTestId('space-status-badge')).toHaveText('Activo');

    // El card debe mostrar la categoría seleccionada
    await expect(newCard).toContainText('Ejecutivo');
  });

  test('Agrega un bloqueo por Mantenimiento a un espacio y aparece en Períodos de bloqueo con los datos correctos', async ({
    adminSpaces,
    apiClient,
  }) => {
    // ── Pre-condición: Crear un espacio vía API para tener un ID conocido ─────
    const { token: adminToken } = await apiClient.login(
      process.env.ADMIN_EMAIL!,
      process.env.ADMIN_PASSWORD!,
    );

    const spaceLabel = `B-${faker.string.numeric({ length: 3, allowLeadingZeros: true })}`;
    const space = await apiClient.withToken(adminToken).createSpace({
      label: spaceLabel,
      vehicle_type: 'auto',
      allowed_categories: ['ejecutivo'],
    });
    const spaceId = space.id;

    // Recargar la página para que el nuevo espacio aparezca en la lista
    await adminSpaces.goto();

    // ── Abrir el panel de bloqueos y agregar uno por Mantenimiento ───────
    await expect(adminSpaces.spaceCard(spaceId)).toBeVisible();
    await adminSpaces.openBlackouts(spaceId);
    await expect(adminSpaces.blackoutPanel(spaceId)).toBeVisible();

    // Fechas: mañana → pasado mañana (evita validaciones de fecha pasada)
    const startDate = formatDate(daysFromNow(1));
    const endDate   = formatDate(daysFromNow(2));

    // Registrar el listener ANTES del click para capturar el ID del bloqueo creado
    const blackoutResponsePromise = adminSpaces.pageInstance.waitForResponse(
      (r) =>
        r.url().includes('/blackouts') &&
        r.request().method() === 'POST' &&
        r.ok(),
    );

    await adminSpaces.addBlackout(spaceId, startDate, endDate, 'Mantenimiento');

    const { id: blackoutId } = await (await blackoutResponsePromise).json();

    // ── Assert: El bloqueo aparece en la tabla con los datos correctos ─────────
    const item = adminSpaces.blackoutItem(blackoutId, spaceId);

    await expect(item).toBeVisible();
    await expect(item).toContainText(startDate);
    await expect(item).toContainText(endDate);
    await expect(item).toContainText('Mantenimiento');
  });

  test('Desactiva un espacio activo y se muestra como Inactivo', async ({
    adminSpaces,
    apiClient,
  }) => {
    // Pre-condición: crear un espacio activo vía API para tener un ID conocido
    const { token: adminToken } = await apiClient.login(
      process.env.ADMIN_EMAIL!,
      process.env.ADMIN_PASSWORD!,
    );

    const spaceLabel = `D-${faker.string.numeric({ length: 3, allowLeadingZeros: true })}`;
    const space = await apiClient.withToken(adminToken).createSpace({
      label: spaceLabel,
      vehicle_type: 'auto',
      allowed_categories: ['ejecutivo'],
    });
    const spaceId = space.id;

    // Recargar la página para que el nuevo espacio aparezca en la lista
    await adminSpaces.goto();

    // Confirmar estado inicial: Activo
    await expect(adminSpaces.spaceCard(spaceId)).toBeVisible();
    await expect(adminSpaces.spaceStatusBadge(spaceId)).toHaveText('Activo');

    // Desactivar el espacio
    await adminSpaces.toggleSpaceActive(spaceId);

    // Assert: El badge debe cambiar a "Inactivo"
    await expect(adminSpaces.spaceStatusBadge(spaceId)).toHaveText('Inactivo');
  });
});

// ── Helpers de fecha ──────────────────────────────────────────────────────────

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}