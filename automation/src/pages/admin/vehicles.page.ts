import { type Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export class AdminVehiclesPage extends BasePage {
  static readonly PATH = '/approvals';

  // ─── Root locators ────────────────────────────────────────────────────────────

  protected readonly pageHeading: Locator;

  // ─── Pending section locators ─────────────────────────────────────────────────

  readonly pendingTable: Locator;
  readonly pendingLoading: Locator;
  readonly pendingEmpty: Locator;

  // ─── Approved section locators ────────────────────────────────────────────────

  readonly toggleApprovedButton: Locator;
  readonly approvedTable: Locator;
  readonly approvedLoading: Locator;
  readonly approvedEmpty: Locator;

  constructor(page: import('@playwright/test').Page) {
    super(page);
    this.pageHeading          = page.getByTestId('approvals-heading');

    this.pendingTable         = page.getByTestId('pending-table');
    this.pendingLoading       = page.getByTestId('pending-loading');
    this.pendingEmpty         = page.getByTestId('pending-empty');

    this.toggleApprovedButton = page.getByTestId('toggle-approved-btn');
    this.approvedTable        = page.getByTestId('approved-table');
    this.approvedLoading      = page.getByTestId('approved-loading');
    this.approvedEmpty        = page.getByTestId('approved-empty');
  }

  // ─── Row locators ─────────────────────────────────────────────────────────────

  pendingRow(vehicleId: number): Locator {
    return this.page.getByTestId(`pending-row-${vehicleId}`);
  }

  approvedRow(vehicleId: number): Locator {
    return this.page.getByTestId(`approved-row-${vehicleId}`);
  }

  approveButton(vehicleId: number): Locator {
    return this.pendingRow(vehicleId).getByTestId('approve-btn');
  }

  // ─── Navigation ───────────────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto(AdminVehiclesPage.PATH);
    await this.waitForPageLoad();
  }

  // ─── Actions ──────────────────────────────────────────────────────────────────

  async approveVehicle(vehicleId: number): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (r) =>
        r.request().method() === 'PATCH' &&
        r.url().includes(`/admin/vehicles/${vehicleId}/approve`) &&
        r.ok(),
    );
    await this.approveButton(vehicleId).click();  
    await responsePromise;
  }

  async showApproved(): Promise<void> {
    await this.toggleApprovedButton.click();
    await this.approvedTable.waitFor({ state: 'visible' });
  }

  async hideApproved(): Promise<void> {
    await this.toggleApprovedButton.click();
    await this.approvedTable.waitFor({ state: 'hidden' });
  }

  // ─── Data queries ─────────────────────────────────────────────────────────────

  async getPendingRowCount(): Promise<number> {
    return this.pendingTable.getByTestId(/^pending-row-\d+$/).count();
  }

  async getApprovedRowCount(): Promise<number> {
    return this.approvedTable.getByTestId(/^approved-row-\d+$/).count();
  }

  // ─── State queries ────────────────────────────────────────────────────────────

  async isLoaded(): Promise<boolean> {
    return this.pageHeading.isVisible();
  }

  async isPendingLoading(): Promise<boolean> {
    return this.pendingLoading.isVisible();
  }

  async isPendingEmpty(): Promise<boolean> {
    return this.pendingEmpty.isVisible();
  }

  async isPendingRowVisible(vehicleId: number): Promise<boolean> {
    return this.pendingRow(vehicleId).isVisible();
  }

  async isApprovedTableVisible(): Promise<boolean> {
    return this.approvedTable.isVisible();
  }

  async isApprovedLoading(): Promise<boolean> {
    return this.approvedLoading.isVisible();
  }

  async isApprovedEmpty(): Promise<boolean> {
    return this.approvedEmpty.isVisible();
  }

  async isApprovedRowVisible(vehicleId: number): Promise<boolean> {
    return this.approvedRow(vehicleId).isVisible();
  }
}