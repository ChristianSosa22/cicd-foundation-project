import { type Page, type Locator, expect } from '@playwright/test';

export abstract class BasePage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  get pageInstance(): Page {
    return this.page;
  }

  protected heading(text: string | RegExp): Locator {
    return this.page.getByRole('heading', { name: text });
  }

  protected button(name: string | RegExp): Locator {
    return this.page.getByRole('button', { name });
  }

  protected link(name: string | RegExp): Locator {
    return this.page.getByRole('link', { name });
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async expectOnPage(headingText: string | RegExp): Promise<void> {
    await expect(this.heading(headingText)).toBeVisible();
  }

  async getErrorMessage(): Promise<string | null> {
    const error = this.page
      .locator('.bg-red-50')
      .filter({ has: this.page.locator('.text-red-700, p') })
      .first();
    return (await error.isVisible()) ? error.textContent() : null;
  }

  async expectNoError(): Promise<void> {
    const msg = await this.getErrorMessage();
    expect(msg).toBeNull();
  }

  /** Navigates via the admin top nav bar. */
  async navigateTo(
    label: 'Dashboard' | 'Usuarios' | 'Parqueos' | 'Aprobaciones' | 'Tarifas' | 'Historial' | 'Configuración',
  ): Promise<void> {
    await this.link(label).click();
    await this.waitForPageLoad();
  }
}
