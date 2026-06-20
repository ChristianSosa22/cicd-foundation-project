import type { Page } from '@playwright/test';

export class LoginPage {
  static readonly PATH = '/login';

  constructor(
    private readonly adminPage: Page,
    private readonly conductorPage: Page,
  ) {}

  get adminPageInstance(): Page { return this.adminPage; }
  get conductorPageInstance(): Page { return this.conductorPage; }

  async loginAsAdmin(): Promise<void> {
    await this.adminPage.goto(LoginPage.PATH);
    await this.adminPage.waitForLoadState('networkidle');
    await this.adminPage.locator('input[type="email"]').fill(process.env.ADMIN_EMAIL!);
    await this.adminPage.locator('input[type="password"]').fill(process.env.ADMIN_PASSWORD!);
    await this.adminPage.getByRole('button', { name: /ingresar/i }).click();
    await this.adminPage.waitForURL('**/dashboard', { timeout: 15_000 });
  }

  async loginAsDriver(): Promise<void> {
    await this.conductorPage.goto(LoginPage.PATH);
    await this.conductorPage.waitForLoadState('networkidle');
    await this.conductorPage.locator('input[type="email"]').fill(process.env.CONDUCTOR_EMAIL!);
    await this.conductorPage.locator('input[type="password"]').fill(process.env.CONDUCTOR_PASSWORD!);
    await this.conductorPage.getByRole('button', { name: /ingresar/i }).click();
    await this.conductorPage.waitForURL('**/availability', { timeout: 15_000 });
  }
}