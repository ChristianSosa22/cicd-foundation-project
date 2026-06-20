import { expect } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { test } from '../../src/fixtures';

test.describe('Gestión de Parqueos — Espacios', () => {
  test.beforeEach(async ({ loginPage, adminSpacesPage }) => {
    await loginPage.loginAsAdmin();
    await adminSpacesPage.goto();
  });

  test('Crea un nuevo espacio ejecutivo y aparece como Activo con la categoría seleccionada', async ({
    adminSpacesPage,
  }) => {
    const label = `E-${faker.string.numeric({ length: 3, allowLeadingZeros: true })}`;

    // Crear el nuevo espacio
    await adminSpacesPage.createSpace({
      label,
      vehicleType: 'auto',
      categories: ['ejecutivo'],
    });

    await expect(adminSpacesPage.createSpaceForm).toBeHidden();

    // Assert: Se muestra la una nueva card con el espacio creado
    const newCard = adminSpacesPage.spacesList
      .locator('[data-testid^="space-card-"]')
      .filter({ hasText: label });

    await expect(newCard).toBeVisible();
    await expect(newCard.getByTestId('space-status-badge')).toHaveText('Activo');
    await expect(newCard).toContainText('Ejecutivo');
  });

  test('Agrega un bloqueo por Mantenimiento a un espacio y aparece en Períodos de bloqueo con los datos correctos', async ({
    adminSpacesPage,
  }) => {
    const spaceLabel = `B-${faker.string.numeric({ length: 3, allowLeadingZeros: true })}`;

    // Registrar el listener antes de crear el espacio para capturar el ID
    const createSpaceResponsePromise = adminSpacesPage.pageInstance.waitForResponse(
      (r) =>
        r.url().includes('/admin/spaces') &&
        r.request().method() === 'POST' &&
        r.ok(),
    );

    await adminSpacesPage.createSpace({
      label: spaceLabel,
      vehicleType: 'auto',
      categories: ['ejecutivo'],
    });

    const { id: spaceId } = await (await createSpaceResponsePromise).json();

    await expect(adminSpacesPage.createSpaceForm).toBeHidden();

    // Abrir el panel de bloqueos y agregar uno por Mantenimiento
    await expect(adminSpacesPage.spaceCard(spaceId)).toBeVisible();
    await adminSpacesPage.openBlackouts(spaceId);
    await expect(adminSpacesPage.blackoutPanel(spaceId)).toBeVisible();

    const startDate = formatDate(daysFromNow(1));
    const endDate   = formatDate(daysFromNow(2));

    const blackoutResponsePromise = adminSpacesPage.pageInstance.waitForResponse(
      (r) =>
        r.url().includes('/blackouts') &&
        r.request().method() === 'POST' &&
        r.ok(),
    );

    await adminSpacesPage.addBlackout(spaceId, startDate, endDate, 'Mantenimiento');

    const { id: blackoutId } = await (await blackoutResponsePromise).json();

    // Assert: El bloqueo aparece en la tabla con los datos correctos
    const item = adminSpacesPage.blackoutItem(blackoutId, spaceId);

    await expect(item).toBeVisible();
    await expect(item).toContainText(startDate);
    await expect(item).toContainText(endDate);
    await expect(item).toContainText('Mantenimiento');
  });

  test('Desactiva un espacio activo y se muestra como Inactivo', async ({
    adminSpacesPage,
  }) => {
    const spaceLabel = `D-${faker.string.numeric({ length: 3, allowLeadingZeros: true })}`;

    // Registrar el listener antes de crear el espacio para capturar el ID
    const createSpaceResponsePromise = adminSpacesPage.pageInstance.waitForResponse(
      (r) =>
        r.url().includes('/admin/spaces') &&
        r.request().method() === 'POST' &&
        r.ok(),
    );

    await adminSpacesPage.createSpace({
      label: spaceLabel,
      vehicleType: 'auto',
      categories: ['ejecutivo'],
    });

    const { id: spaceId } = await (await createSpaceResponsePromise).json();

    await expect(adminSpacesPage.createSpaceForm).toBeHidden();

    // Confirmar estado inicial: Activo
    await expect(adminSpacesPage.spaceCard(spaceId)).toBeVisible();
    await expect(adminSpacesPage.spaceStatusBadge(spaceId)).toHaveText('Activo');

    // Desactivar el espacio
    await adminSpacesPage.toggleSpaceActive(spaceId);

    // Assert: El badge debe cambiar a "Inactivo"
    await expect(adminSpacesPage.spaceStatusBadge(spaceId)).toHaveText('Inactivo');
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