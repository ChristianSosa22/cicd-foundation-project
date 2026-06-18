import { expect } from '@playwright/test';
import { test } from '../../src/fixtures';
import { buildDriverUser } from '../../test-data';

test.describe('Gestión de Usuarios', () => {
  test.beforeEach(async ({ adminUsers }) => {
    await adminUsers.goto();
  });

  test('Crea un nuevo usuario conductor ejecutivo y aparece como Activo con los datos correctos', async ({
    adminUsers,
  }) => {
    const { email, full_name, password } = buildDriverUser('ejecutivo');

    // Interceptar la respuesta antes de iniciar la creación para capturar el ID
    const responsePromise = adminUsers.pageInstance.waitForResponse(
      (r) =>
        r.url().includes('/admin/users') &&
        r.request().method() === 'POST' &&
        r.ok(),
    );

    // Crear usuario a través del formulario UI
    await adminUsers.createUser({
      email,
      fullName: full_name,
      password,
      role:     'driver',
      category: 'ejecutivo',
    });

    const response = await responsePromise;
    const { id: userId } = await response.json();

    // El formulario debe cerrarse tras la creación exitosa
    await expect(adminUsers.createUserForm).toBeHidden();

    // La fila del nuevo usuario debe ser visible en la tabla
    expect(await adminUsers.isUserRowVisible(userId)).toBe(true);

    // El badge de estado debe indicar "Activo" (los usuarios se crean activos por defecto)
    await expect(adminUsers.userStatusBadge(userId)).toHaveText('Activo');

    // La fila debe mostrar los datos correctos
    const row = adminUsers.userRow(userId);
    await expect(row).toContainText(email);
    await expect(row).toContainText(full_name);
    await expect(row).toContainText('Conductor');
    await expect(row).toContainText('Ejecutivo');
  });
});