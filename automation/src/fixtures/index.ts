import { test as base, type Page, type BrowserContext } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { AdminDashboardPage } from '../pages/admin/dashboard.page';
import { AdminUsersPage } from '../pages/admin/users.page';
import { AdminVehiclesPage } from '../pages/admin/vehicles.page';
import { AdminSpacesPage } from '../pages/admin/spaces.page';
import { AdminTariffsPage } from '../pages/admin/tariffs.page';
import { AdminReservationsPage } from '../pages/admin/reservations.page';
import { AdminSettingsPage } from '../pages/admin/settings.page';
import { AvailabilityPage } from '../pages/conductor/availability.page';
import { DriverVehiclesPage } from '../pages/conductor/vehicles.page';
import { DriverReservationsPage } from '../pages/conductor/reservations.page';
import { ReservePage } from '../pages/conductor/reserve.page';

type Fixtures = {
  // Browser contexts per rol
  adminContext: BrowserContext;
  conductorContext: BrowserContext;
  // Raw pages (use when page object is not enough)
  adminPage: Page;
  conductorPage: Page;
  // ─── Shared page objects ──────────────────────────────────────────────────
  loginPage: LoginPage;
  // ─── Admin page objects ───────────────────────────────────────────────────
  adminDashboardPage: AdminDashboardPage;
  adminUsersPage: AdminUsersPage;
  adminVehiclesPage: AdminVehiclesPage;
  adminSpacesPage: AdminSpacesPage;
  adminTariffsPage: AdminTariffsPage;
  adminReservationsPage: AdminReservationsPage;
  adminSettingsPage: AdminSettingsPage;
  // ─── Conductor page objects ───────────────────────────────────────────────
  availabilityPage: AvailabilityPage;
  driverVehiclesPage: DriverVehiclesPage;
  driverReservationsPage: DriverReservationsPage;
  reservePage: ReservePage;
};

export const test = base.extend<Fixtures>({
  // ─── Authenticated contexts ──────────────────────────────────────────────────

  adminContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    await use(context);
    await context.close();
  },

  conductorContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    await use(context);
    await context.close();
  },

  // ─── Authenticated pages ─────────────────────────────────────────────────────

  adminPage: async ({ adminContext }, use) => {
    const page = await adminContext.newPage();
    await use(page);
    await page.close();
  },

  conductorPage: async ({ conductorContext }, use) => {
    const page = await conductorContext.newPage();
    await use(page);
    await page.close();
  },

  // ─── Shared pages ────────────────────────────────────────────────────────────

  loginPage: async ({ adminPage, conductorPage }, use) => {
    await use(new LoginPage(adminPage, conductorPage));
  },

  // ─── Admin page objects ───────────────────────────────────────────────────────

  adminDashboardPage: async ({ adminPage }, use) => {
    await use(new AdminDashboardPage(adminPage));
  },

  adminUsersPage: async ({ adminPage }, use) => {
    await use(new AdminUsersPage(adminPage));
  },

  adminVehiclesPage: async ({ adminPage }, use) => {
    await use(new AdminVehiclesPage(adminPage));
  },

  adminSpacesPage: async ({ adminPage }, use) => {
    await use(new AdminSpacesPage(adminPage));
  },

  adminTariffsPage: async ({ adminPage }, use) => {
    await use(new AdminTariffsPage(adminPage));
  },

  adminReservationsPage: async ({ adminPage }, use) => {
    await use(new AdminReservationsPage(adminPage));
  },

  adminSettingsPage: async ({ adminPage }, use) => {
    await use(new AdminSettingsPage(adminPage));
  },

  // ─── Conductor page objects ───────────────────────────────────────────────────

  availabilityPage: async ({ conductorPage }, use) => {
    await use(new AvailabilityPage(conductorPage));
  },

  driverVehiclesPage: async ({ conductorPage }, use) => {
    await use(new DriverVehiclesPage(conductorPage));
  },

  driverReservationsPage: async ({ conductorPage }, use) => {
    await use(new DriverReservationsPage(conductorPage));
  },

  reservePage: async ({ conductorPage }, use) => {
    await use(new ReservePage(conductorPage));
  },
});

export { expect } from '@playwright/test';
