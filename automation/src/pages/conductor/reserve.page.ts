import { type Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export interface ReserveParams {
  spaceId: number;
  label: string;
  tipo: string;
}

export class ReservePage extends BasePage {
  static readonly PATH = '/reserve';

  // ─── Root locators ────────────────────────────────────────────────────────────

  protected readonly pageHeading: Locator;
  readonly noSpaceError: Locator;

  // ─── Space info card ──────────────────────────────────────────────────────────

  readonly spaceInfo: Locator;
  readonly spaceLabel: Locator;
  readonly spaceType: Locator;

  // ─── Form locators ────────────────────────────────────────────────────────────

  readonly reserveForm: Locator;
  readonly reserveDate: Locator;
  readonly vehicleSelect: Locator;
  readonly noVehiclesWarning: Locator;
  readonly reserveError: Locator;
  readonly confirmButton: Locator;
  readonly backButton: Locator;

  constructor(page: import('@playwright/test').Page) {
    super(page);
    this.pageHeading      = page.getByTestId('reserve-heading');
    this.noSpaceError     = page.getByTestId('no-space-error');

    this.spaceInfo        = page.getByTestId('space-info');
    this.spaceLabel       = page.getByTestId('space-label');
    this.spaceType        = page.getByTestId('space-type');

    this.reserveForm      = page.getByTestId('reserve-form');
    this.reserveDate      = page.getByTestId('reserve-date');
    this.vehicleSelect    = page.getByTestId('vehicle-select');
    this.noVehiclesWarning = page.getByTestId('no-vehicles-warning');
    this.reserveError     = page.getByTestId('reserve-error');
    this.confirmButton    = page.getByTestId('confirm-btn');
    this.backButton       = page.getByTestId('back-btn');
  }

  // ─── Navigation ───────────────────────────────────────────────────────────────

  async goto(params?: ReserveParams): Promise<void> {
    if (params) {
      const qs = new URLSearchParams({
        space: String(params.spaceId),
        label: params.label,
        tipo: params.tipo,
      });
      await this.page.goto(`${ReservePage.PATH}?${qs}`);
    } else {
      await this.page.goto(ReservePage.PATH);
    }
    await this.waitForPageLoad();
  }

  // ─── Actions ──────────────────────────────────────────────────────────────────

  async setDate(date: string): Promise<void> {
    await this.reserveDate.fill(date);
  }

  async selectVehicleById(vehicleId: number): Promise<void> {
    await this.vehicleSelect.selectOption({ value: String(vehicleId) });
  }

  async selectFirstVehicle(): Promise<void> {
    const options = await this.vehicleSelect.locator('option').all();
    if (options.length > 0) {
      await this.vehicleSelect.selectOption({ index: 0 });
    }
  }

  async confirmReservation(): Promise<void> {
    await this.confirmButton.click();
  }

  async waitForRedirectToReservations(): Promise<void> {
    await this.page.waitForURL('**/reservations**', { timeout: 10_000 });
  }

  async goBack(): Promise<void> {
    await this.backButton.click();
  }

  // ─── Data queries ─────────────────────────────────────────────────────────────

  async getSpaceLabelText(): Promise<string | null> {
    return this.spaceLabel.textContent();
  }

  async getSpaceTypeText(): Promise<string | null> {
    return this.spaceType.textContent();
  }

  async getErrorText(): Promise<string | null> {
    return this.reserveError.textContent();
  }

  async getSelectedVehicleText(): Promise<string | null> {
    return this.vehicleSelect.evaluate(
      (el: HTMLSelectElement) => el.options[el.selectedIndex]?.text ?? null,
    );
  }

  // ─── State queries ────────────────────────────────────────────────────────────

  async isLoaded(): Promise<boolean> {
    return this.pageHeading.isVisible();
  }

  async isNoSpaceErrorVisible(): Promise<boolean> {
    return this.noSpaceError.isVisible();
  }

  async isNoVehiclesWarningVisible(): Promise<boolean> {
    return this.noVehiclesWarning.isVisible();
  }

  async isVehicleSelectVisible(): Promise<boolean> {
    return this.vehicleSelect.isVisible();
  }

  async isConfirmButtonEnabled(): Promise<boolean> {
    return this.confirmButton.isEnabled();
  }

  async isReserveErrorVisible(): Promise<boolean> {
    return this.reserveError.isVisible();
  }
}