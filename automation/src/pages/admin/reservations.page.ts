import { type Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export type ReservationStatus =
  | 'reservada'
  | 'ocupada'
  | 'liberada'
  | 'cancelada'
  | 'expirada';

export class AdminReservationsPage extends BasePage {
  static readonly PATH = '/history';

  // ─── Root locators ────────────────────────────────────────────────────────────

  protected readonly pageHeading: Locator;
  readonly exportButton: Locator;
  readonly filterFrom: Locator;
  readonly filterTo: Locator;
  readonly filterStatus: Locator;
  readonly filterUserId: Locator;
  readonly clearFiltersButton: Locator;
  readonly reservationsTable: Locator;
  readonly loadingState: Locator;
  readonly emptyState: Locator;

  constructor(page: import('@playwright/test').Page) {
    super(page);
    this.pageHeading       = page.getByTestId('history-heading');
    this.exportButton      = page.getByTestId('export-csv-btn');
    this.filterFrom        = page.getByTestId('filter-from');
    this.filterTo          = page.getByTestId('filter-to');
    this.filterStatus      = page.getByTestId('filter-status');
    this.filterUserId      = page.getByTestId('filter-user-id');
    this.clearFiltersButton = page.getByTestId('clear-filters-btn');
    this.reservationsTable = page.getByTestId('reservations-table');
    this.loadingState      = page.getByTestId('loading-state');
    this.emptyState        = page.getByTestId('empty-state');
  }

  // ─── Row locators ─────────────────────────────────────────────────────────────

  reservationRow(id: number): Locator {
    return this.page.getByTestId(`row-${id}`);
  }

  // ─── Navigation ───────────────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto(AdminReservationsPage.PATH);
    await this.waitForPageLoad();
  }

  // ─── Actions ──────────────────────────────────────────────────────────────────

  async filterByStatus(status: ReservationStatus | ''): Promise<void> {
    await this.filterStatus.selectOption(status);
  }

  async filterByDateRange(from: string, to: string): Promise<void> {
    await this.filterFrom.fill(from);
    await this.filterTo.fill(to);
  }

  async filterByUserId(id: number): Promise<void> {
    await this.filterUserId.fill(String(id));
  }

  async clearFilters(): Promise<void> {
    if (await this.clearFiltersButton.isVisible()) {
      await this.clearFiltersButton.click();
    }
  }

  async exportCsv(): Promise<string> {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.exportButton.click(),
    ]);
    return download.suggestedFilename();
  }

  // ─── Data queries ─────────────────────────────────────────────────────────────

  async getVisibleRowCount(): Promise<number> {
    return this.reservationsTable
      .getByTestId(/^row-\d+$/)
      .count();
  }

  async getStatusOfRow(id: number): Promise<string | null> {
    return this.reservationRow(id).getByTestId('status-badge').textContent();
  }

  // ─── State queries ────────────────────────────────────────────────────────────

  async isLoaded(): Promise<boolean> {
    return this.pageHeading.isVisible();
  }

  async isTableVisible(): Promise<boolean> {
    return this.reservationsTable.isVisible();
  }

  async isLoading(): Promise<boolean> {
    return this.loadingState.isVisible();
  }

  async isEmpty(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  async isExportButtonEnabled(): Promise<boolean> {
    return this.exportButton.isEnabled();
  }

  async isRowVisible(id: number): Promise<boolean> {
    return this.reservationRow(id).isVisible();
  }

  async isLateCancellation(id: number): Promise<boolean> {
    return this.reservationRow(id).getByTestId('late-badge').isVisible();
  }
}
