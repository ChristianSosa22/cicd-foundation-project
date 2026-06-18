import { type Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export type OccupancyStatus = 'Disponible' | 'Reservado' | 'Ocupado';
export type VehicleTypeColumn = 'auto' | 'moto' | 'camioneta';

export class AdminDashboardPage extends BasePage {
  static readonly PATH = '/dashboard';

  // ─── Root locators ────────────────────────────────────────────────────────────

  protected readonly pageHeading: Locator;
  readonly lastUpdated: Locator;
  readonly occupancySummary: Locator;
  readonly occupancyTable: Locator;
  readonly totalsRow: Locator;

  constructor(page: import('@playwright/test').Page) {
    super(page);
    this.pageHeading    = page.getByTestId('dashboard-heading');
    this.lastUpdated    = page.getByTestId('last-updated');
    this.occupancySummary = page.getByTestId('occupancy-summary');
    this.occupancyTable = page.getByTestId('occupancy-table');
    this.totalsRow      = page.getByTestId('row-totals');
  }

  // ─── Navigation ───────────────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto(AdminDashboardPage.PATH);
    await this.waitForPageLoad();
  }

  // ─── Summary cards ────────────────────────────────────────────────────────────

  statusCard(status: OccupancyStatus): Locator {
    return this.page.getByTestId(`card-${status.toLowerCase()}`);
  }

  async getCardCount(status: OccupancyStatus): Promise<number> {
    const text = await this.statusCard(status).getByTestId('card-count').textContent();
    return parseInt(text?.trim() ?? '0', 10);
  }

  async getCardPercentage(status: OccupancyStatus): Promise<number> {
    const text = await this.statusCard(status).getByTestId('card-pct').textContent();
    return parseInt(text?.match(/(\d+)/)?.[1] ?? '0', 10);
  }

  // ─── Breakdown table ──────────────────────────────────────────────────────────

  tableRow(status: OccupancyStatus): Locator {
    return this.page.getByTestId(`row-${status.toLowerCase()}`);
  }

  async getTableCount(
    row: OccupancyStatus | 'totals',
    col: VehicleTypeColumn | 'Total',
  ): Promise<number> {
    const rowLocator = row === 'totals' ? this.totalsRow : this.tableRow(row);
    const cellTestId = col === 'Total' ? 'cell-total' : `cell-${col}`;
    const text = await rowLocator.getByTestId(cellTestId).textContent();
    return parseInt(text?.trim() ?? '0', 10);
  }

  // ─── State queries ────────────────────────────────────────────────────────────

  async isLoaded(): Promise<boolean> {
    return (
      (await this.pageHeading.isVisible()) &&
      (await this.occupancyTable.isVisible())
    );
  }

  async isLastUpdatedVisible(): Promise<boolean> {
    return this.lastUpdated.isVisible();
  }

  async isCardVisible(status: OccupancyStatus): Promise<boolean> {
    return this.statusCard(status).isVisible();
  }

  async areAllCardsVisible(): Promise<boolean> {
    const results = await Promise.all(
      (['Disponible', 'Reservado', 'Ocupado'] as OccupancyStatus[]).map((s) =>
        this.isCardVisible(s),
      ),
    );
    return results.every(Boolean);
  }

  async isGrandTotalConsistent(): Promise<boolean> {
    const [disponible, reservado, ocupado, grandTotal] = await Promise.all([
      this.getTableCount('Disponible', 'Total'),
      this.getTableCount('Reservado', 'Total'),
      this.getTableCount('Ocupado', 'Total'),
      this.getTableCount('totals', 'Total'),
    ]);
    return disponible + reservado + ocupado === grandTotal;
  }
}
