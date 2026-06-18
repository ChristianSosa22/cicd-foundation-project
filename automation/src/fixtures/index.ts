import { test as base, type Page, type BrowserContext } from '@playwright/test';
import * as path from 'path';
import { ApiClient } from '../api/client';
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

const AUTH_DIR = path.resolve(__dirname, '../../.auth');

type Fixtures = {
  // Authenticated browser contexts
  adminContext: BrowserContext;
  conductorContext: BrowserContext;
  // Raw authenticated pages (use when page object is not enough)
  adminPage: Page;
  conductorPage: Page;
  // API client — unauthenticated base; use .withToken(token) for auth'd calls
  apiClient: ApiClient;
  // ─── Shared page objects ──────────────────────────────────────────────────
  loginPage: LoginPage;
  // ─── Admin page objects ───────────────────────────────────────────────────
  adminDashboard: AdminDashboardPage;
  adminUsers: AdminUsersPage;
  adminVehicles: AdminVehiclesPage;
  adminSpaces: AdminSpacesPage;
  adminTariffs: AdminTariffsPage;
  adminReservations: AdminReservationsPage;
  adminSettings: AdminSettingsPage;
  // ─── Conductor page objects ───────────────────────────────────────────────
  availabilityPage: AvailabilityPage;
  driverVehicles: DriverVehiclesPage;
  driverReservations: DriverReservationsPage;
  reservePage: ReservePage;
};

export const test = base.extend<Fixtures>({
  // ─── Authenticated contexts ──────────────────────────────────────────────────

  adminContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'admin.json'),
    });
    await use(context);
    await context.close();
  },

  conductorContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'conductor.json'),
    });
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

  // ─── API client ──────────────────────────────────────────────────────────────

  apiClient: async ({ playwright }, use) => {
    const apiContext = await playwright.request.newContext({
      baseURL: process.env.API_URL ?? 'http://localhost:8080',
    });
    await use(new ApiClient(apiContext));
    await apiContext.dispose();
  },

  // ─── Shared pages ────────────────────────────────────────────────────────────

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  // ─── Admin page objects ───────────────────────────────────────────────────────

  adminDashboard: async ({ adminPage }, use) => {
    await use(new AdminDashboardPage(adminPage));
  },

  adminUsers: async ({ adminPage }, use) => {
    await use(new AdminUsersPage(adminPage));
  },

  adminVehicles: async ({ adminPage }, use) => {
    await use(new AdminVehiclesPage(adminPage));
  },

  adminSpaces: async ({ adminPage }, use) => {
    await use(new AdminSpacesPage(adminPage));
  },

  adminTariffs: async ({ adminPage }, use) => {
    await use(new AdminTariffsPage(adminPage));
  },

  adminReservations: async ({ adminPage }, use) => {
    await use(new AdminReservationsPage(adminPage));
  },

  adminSettings: async ({ adminPage }, use) => {
    await use(new AdminSettingsPage(adminPage));
  },

  // ─── Conductor page objects ───────────────────────────────────────────────────

  availabilityPage: async ({ conductorPage }, use) => {
    await use(new AvailabilityPage(conductorPage));
  },

  driverVehicles: async ({ conductorPage }, use) => {
    await use(new DriverVehiclesPage(conductorPage));
  },

  driverReservations: async ({ conductorPage }, use) => {
    await use(new DriverReservationsPage(conductorPage));
  },

  reservePage: async ({ conductorPage }, use) => {
    await use(new ReservePage(conductorPage));
  },
});

export { expect } from '@playwright/test';
