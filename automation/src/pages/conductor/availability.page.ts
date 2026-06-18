import { type Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export type VehicleTypeFilter = 'auto' | 'moto' | 'camioneta' | '';

export class AvailabilityPage extends BasePage {
  static readonly PATH = '/availability';

  // ─── Root locators ────────────────────────────────────────────────────────────

  protected readonly pageHeading: Locator;
  readonly dateFilter: Locator;
  readonly vehicleTypeFilter: Locator;
  readonly lastUpdated: Locator;
  readonly spacesLoading: Locator;
  readonly spacesEmpty: Locator;
  readonly spacesGrid: Locator;

  constructor(page: import('@playwright/test').Page) {
    super(page);
    this.pageHeading      = page.getByTestId('availability-heading');
    this.dateFilter       = page.getByTestId('date-filter');
    this.vehicleTypeFilter = page.getByTestId('vehicle-type-filter');
    this.lastUpdated      = page.getByTestId('last-updated');
    this.spacesLoading    = page.getByTestId('spaces-loading');
    this.spacesEmpty      = page.getByTestId('spaces-empty');
    this.spacesGrid       = page.getByTestId('spaces-grid');
  }

  // ─── Space button locators ────────────────────────────────────────────────────

  spaceButton(spaceId: number): Locator {
    return this.page.getByTestId(`space-btn-${spaceId}`);
  }

  spaceStatus(spaceId: number): Locator {
    return this.spaceButton(spaceId).getByTestId('space-status');
  }

  // ─── Navigation ───────────────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto(AvailabilityPage.PATH);
    await this.waitForPageLoad();
  }

  // ─── Actions ──────────────────────────────────────────────────────────────────

  async setDate(date: string): Promise<void> {
    await this.dateFilter.fill(date);
    await this.dateFilter.press('Tab');
  }

  async filterByVehicleType(type: VehicleTypeFilter): Promise<void> {
    await this.vehicleTypeFilter.selectOption(type);
  }

  async waitForSpaces(): Promise<void> {
    await Promise.race([
      this.spacesGrid.waitFor({ state: 'visible', timeout: 15_000 }),
      this.spacesEmpty.waitFor({ state: 'visible', timeout: 15_000 }),
    ]);
  }

  async clickSpace(spaceId: number): Promise<void> {
    await this.spaceButton(spaceId).click();
    await this.page.waitForURL('**/reserve**');
  }

  async clickFirstAvailableSpace(): Promise<void> {
    await this.waitForSpaces();
    const btn = this.spacesGrid
      .getByTestId(/^space-btn-\d+$/)
      .filter({
        has: this.page.locator('[data-testid="space-status"]', { hasText: 'Disponible' }),
      })
      .first();
    await btn.waitFor({ state: 'visible', timeout: 15_000 });
    await btn.click();
    await this.page.waitForURL('**/reserve**');
  }

  // ─── Data queries ─────────────────────────────────────────────────────────────

  async getSpaceStatusText(spaceId: number): Promise<string | null> {
    return this.spaceStatus(spaceId).textContent();
  }

  async getAvailableSpaceCount(): Promise<number> {
    await this.waitForSpaces();
    return this.spacesGrid
      .getByTestId(/^space-btn-\d+$/)
      .filter({
        has: this.page.locator('[data-testid="space-status"]', { hasText: 'Disponible' }),
      })
      .count();
  }

  async getTotalSpaceCount(): Promise<number> {
    await this.waitForSpaces();
    return this.spacesGrid.getByTestId(/^space-btn-\d+$/).count();
  }

  // ─── State queries ────────────────────────────────────────────────────────────

  async isLoaded(): Promise<boolean> {
    return this.pageHeading.isVisible();
  }

  async isLoading(): Promise<boolean> {
    return this.spacesLoading.isVisible();
  }

  async isEmpty(): Promise<boolean> {
    return this.spacesEmpty.isVisible();
  }

  async isSpaceVisible(spaceId: number): Promise<boolean> {
    return this.spaceButton(spaceId).isVisible();
  }

  async isSpaceAvailable(spaceId: number): Promise<boolean> {
    const text = await this.getSpaceStatusText(spaceId);
    return text?.trim() === 'Disponible';
  }

  async isLastUpdatedVisible(): Promise<boolean> {
    return this.lastUpdated.isVisible();
  }
}