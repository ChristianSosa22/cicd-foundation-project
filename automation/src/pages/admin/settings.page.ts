import { type Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export class AdminSettingsPage extends BasePage {
  static readonly PATH = '/settings';

  // ─── Root locators ────────────────────────────────────────────────────────────

  protected readonly pageHeading: Locator;
  readonly loadingState: Locator;
  readonly cancellationWindowSection: Locator;
  readonly cancellationWindowInput: Locator;
  readonly cancellationWindowSaveButton: Locator;
  readonly cancellationWindowSavedIndicator: Locator;
  readonly cancellationWindowError: Locator;
  readonly otherSettingsSection: Locator;
  readonly settingsTable: Locator;

  constructor(page: import('@playwright/test').Page) {
    super(page);
    this.pageHeading                    = page.getByTestId('settings-heading');
    this.loadingState                   = page.getByTestId('settings-loading');
    this.cancellationWindowSection      = page.getByTestId('cancellation-window-section');
    this.cancellationWindowInput        = page.getByTestId('cancellation-window-input');
    this.cancellationWindowSaveButton   = page.getByTestId('cancellation-window-save-btn');
    this.cancellationWindowSavedIndicator = page.getByTestId('cancellation-window-saved');
    this.cancellationWindowError        = page.getByTestId('cancellation-window-error');
    this.otherSettingsSection           = page.getByTestId('other-settings-section');
    this.settingsTable                  = page.getByTestId('settings-table');
  }

  // ─── Row locators ─────────────────────────────────────────────────────────────

  settingRow(key: string): Locator {
    return this.page.getByTestId(`setting-row-${key}`);
  }

  // ─── Navigation ───────────────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto(AdminSettingsPage.PATH);
    await this.waitForPageLoad();
  }

  // ─── Actions ──────────────────────────────────────────────────────────────────

  async updateCancellationWindow(hours: number): Promise<void> {
    await this.cancellationWindowInput.fill(String(hours));
    await this.cancellationWindowSaveButton.click();
    await this.page.waitForResponse(
      (r) => r.url().includes('/admin/settings/cancellation_window_hours') && r.ok(),
    );
  }

  async openEditSetting(key: string): Promise<void> {
    await this.settingRow(key).getByTestId('setting-edit-btn').click();
  }

  async saveEditSetting(key: string, value: string): Promise<void> {
    const row = this.settingRow(key);
    await row.getByTestId('setting-edit-input').fill(value);
    await row.getByTestId('setting-save-btn').click();
    await this.page.waitForResponse(
      (r) => r.url().includes(`/admin/settings/${key}`) && r.ok(),
    );
  }

  async cancelEditSetting(key: string): Promise<void> {
    await this.settingRow(key).getByTestId('setting-cancel-btn').click();
  }

  // ─── Data queries ─────────────────────────────────────────────────────────────

  async getCancellationWindowValue(): Promise<number> {
    const raw = await this.cancellationWindowInput.inputValue();
    return Number(raw);
  }

  async getSettingValue(key: string): Promise<string | null> {
    return this.settingRow(key).getByTestId('setting-value').textContent();
  }

  // ─── State queries ────────────────────────────────────────────────────────────

  async isLoaded(): Promise<boolean> {
    return this.pageHeading.isVisible();
  }

  async isLoading(): Promise<boolean> {
    return this.loadingState.isVisible();
  }

  async isCancellationWindowSectionVisible(): Promise<boolean> {
    return this.cancellationWindowSection.isVisible();
  }

  async isCancellationWindowSaved(): Promise<boolean> {
    return this.cancellationWindowSavedIndicator.isVisible();
  }

  async isCancellationWindowErrorVisible(): Promise<boolean> {
    return this.cancellationWindowError.isVisible();
  }

  async isSettingRowVisible(key: string): Promise<boolean> {
    return this.settingRow(key).isVisible();
  }

  async isSettingInEditMode(key: string): Promise<boolean> {
    return this.settingRow(key).getByTestId('setting-edit-input').isVisible();
  }

  async isSettingEditErrorVisible(key: string): Promise<boolean> {
    return this.settingRow(key).getByTestId('setting-edit-error').isVisible();
  }
}
