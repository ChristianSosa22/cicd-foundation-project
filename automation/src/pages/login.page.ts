import { expect } from '@playwright/test';
import { BasePage } from './base.page';

export class LoginPage extends BasePage {
  static readonly PATH = '/login';

  private readonly emailInput = this.page.locator('input[type="email"]');
  private readonly passwordInput = this.page.locator('input[type="password"]');
  private readonly submitButton = this.page.getByRole('button', { name: /ingresar/i });

  async goto(): Promise<void> {
    await this.page.goto(LoginPage.PATH);
    await this.page.waitForLoadState('networkidle');
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async loginAsAdmin(email: string, password: string): Promise<void> {
    await this.login(email, password);
    await this.page.waitForURL('**/dashboard', { timeout: 15_000 });
  }

  async loginAsDriver(email: string, password: string): Promise<void> {
    await this.login(email, password);
    await this.page.waitForURL('**/availability', { timeout: 15_000 });
  }

  async expectFormVisible(): Promise<void> {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  async expectLoginError(): Promise<void> {
    const error = this.page.locator('.bg-red-50');
    await expect(error).toBeVisible();
  }

  async isSubmitDisabled(): Promise<boolean> {
    return this.submitButton.isDisabled();
  }
}
