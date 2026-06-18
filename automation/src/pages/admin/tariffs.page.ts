import { type Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export type VehicleTypeOption = 'auto' | 'moto' | 'camioneta';

export class AdminTariffsPage extends BasePage {
  static readonly PATH = '/tariffs';

  // ─── Root locators ────────────────────────────────────────────────────────────

  protected readonly pageHeading: Locator;
  readonly currentTariffsTable: Locator;
  readonly currentTariffsEmpty: Locator;
  readonly createTariffForm: Locator;
  readonly vehicleTypeSelect: Locator;
  readonly priceInput: Locator;
  readonly currencyInput: Locator;
  readonly createTariffError: Locator;
  readonly createTariffSuccess: Locator;
  readonly createTariffSubmit: Locator;
  readonly historyTable: Locator;

  constructor(page: import('@playwright/test').Page) {
    super(page);
    this.pageHeading         = page.getByTestId('tariffs-heading');
    this.currentTariffsTable = page.getByTestId('current-tariffs-table');
    this.currentTariffsEmpty = page.getByTestId('current-tariffs-empty');
    this.createTariffForm    = page.getByTestId('create-tariff-form');
    this.vehicleTypeSelect   = page.getByTestId('tariff-vehicle-type');
    this.priceInput          = page.getByTestId('tariff-price-input');
    this.currencyInput       = page.getByTestId('tariff-currency-input');
    this.createTariffError   = page.getByTestId('create-tariff-error');
    this.createTariffSuccess = page.getByTestId('create-tariff-success');
    this.createTariffSubmit  = page.getByTestId('create-tariff-submit');
    this.historyTable        = page.getByTestId('tariff-history-table');
  }

  // ─── Row locators ─────────────────────────────────────────────────────────────

  currentRow(vehicleType: VehicleTypeOption): Locator {
    return this.page.getByTestId(`current-row-${vehicleType}`);
  }

  historyRow(id: number): Locator {
    return this.page.getByTestId(`history-row-${id}`);
  }

  // ─── Navigation ───────────────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto(AdminTariffsPage.PATH);
    await this.waitForPageLoad();
  }

  // ─── Actions ──────────────────────────────────────────────────────────────────

  async fillCreateForm(
    vehicleType: VehicleTypeOption,
    price: string,
    currency = 'GTQ',
  ): Promise<void> {
    await this.vehicleTypeSelect.selectOption(vehicleType);
    await this.priceInput.fill(price);
    await this.currencyInput.fill(currency);
  }

  async submitCreateForm(): Promise<void> {
    await this.createTariffSubmit.click();
    await this.page.waitForResponse((r) => r.url().includes('/admin/tariffs') && r.ok());
  }

  async createTariff(
    vehicleType: VehicleTypeOption,
    price: string,
    currency = 'GTQ',
  ): Promise<void> {
    await this.fillCreateForm(vehicleType, price, currency);
    await this.submitCreateForm();
  }

  // ─── Data queries ─────────────────────────────────────────────────────────────

  async getCurrentPrice(vehicleType: VehicleTypeOption): Promise<string | null> {
    return this.currentRow(vehicleType).getByTestId('tariff-price').textContent();
  }

  async getCurrentCurrency(vehicleType: VehicleTypeOption): Promise<string | null> {
    return this.currentRow(vehicleType).getByTestId('tariff-currency').textContent();
  }

  async getHistoryRowCount(): Promise<number> {
    return this.historyTable.getByTestId(/^history-row-\d+$/).count();
  }

  // ─── State queries ────────────────────────────────────────────────────────────

  async isLoaded(): Promise<boolean> {
    return this.pageHeading.isVisible();
  }

  async isCurrentTableEmpty(): Promise<boolean> {
    return this.currentTariffsEmpty.isVisible();
  }

  async isCurrentRowVisible(vehicleType: VehicleTypeOption): Promise<boolean> {
    return this.currentRow(vehicleType).isVisible();
  }

  async isHistoryVisible(): Promise<boolean> {
    return this.historyTable.isVisible();
  }

  async isHistoryRowVisible(id: number): Promise<boolean> {
    return this.historyRow(id).isVisible();
  }

  async isCreateErrorVisible(): Promise<boolean> {
    return this.createTariffError.isVisible();
  }

  async isCreateSuccessVisible(): Promise<boolean> {
    return this.createTariffSuccess.isVisible();
  }
}