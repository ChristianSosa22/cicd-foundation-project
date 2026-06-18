import { type Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export class DriverReservationsPage extends BasePage {
  static readonly PATH = '/reservations';

  // ─── Root locators ────────────────────────────────────────────────────────────

  protected readonly pageHeading: Locator;

  // ─── Active section locators ──────────────────────────────────────────────────

  readonly activeLoading: Locator;
  readonly activeEmpty: Locator;
  readonly activeList: Locator;

  // ─── History section locators ─────────────────────────────────────────────────

  readonly historyTable: Locator;

  constructor(page: import('@playwright/test').Page) {
    super(page);
    this.pageHeading  = page.getByTestId('reservations-heading');
    this.activeLoading = page.getByTestId('active-loading');
    this.activeEmpty  = page.getByTestId('active-empty');
    this.activeList   = page.getByTestId('active-list');
    this.historyTable = page.getByTestId('history-table');
  }

  // ─── Active card locators ─────────────────────────────────────────────────────

  reservationCard(id: number): Locator {
    return this.page.getByTestId(`reservation-card-${id}`);
  }

  reservationStatus(id: number): Locator {
    return this.reservationCard(id).getByTestId('reservation-status');
  }

  reservationCountdown(id: number): Locator {
    return this.reservationCard(id).getByTestId('reservation-countdown');
  }

  confirmButton(id: number): Locator {
    return this.reservationCard(id).getByTestId('confirm-btn');
  }

  cancelButton(id: number): Locator {
    return this.reservationCard(id).getByTestId('cancel-btn');
  }

  releaseButton(id: number): Locator {
    return this.reservationCard(id).getByTestId('release-btn');
  }

  receiptButton(id: number): Locator {
    return this.reservationCard(id).getByTestId('receipt-btn');
  }

  detailLink(id: number): Locator {
    return this.reservationCard(id).getByTestId('detail-link');
  }

  actionError(id: number): Locator {
    return this.reservationCard(id).getByTestId('action-error');
  }

  lateCancelWarning(id: number): Locator {
    return this.reservationCard(id).getByTestId('late-cancel-warning');
  }

  // ─── History row locators ─────────────────────────────────────────────────────

  historyRow(id: number): Locator {
    return this.page.getByTestId(`history-row-${id}`);
  }

  historyStatus(id: number): Locator {
    return this.historyRow(id).getByTestId('history-status');
  }

  historyLateBadge(id: number): Locator {
    return this.historyRow(id).getByTestId('late-badge');
  }

  historyDetailLink(id: number): Locator {
    return this.historyRow(id).getByTestId('history-detail-link');
  }

  // ─── Navigation ───────────────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto(DriverReservationsPage.PATH);
    await this.waitForPageLoad();
  }

  // ─── Actions ──────────────────────────────────────────────────────────────────

  async confirmReservation(id: number): Promise<void> {
    await this.confirmButton(id).click();
    await this.page.waitForResponse((r) => r.url().includes('/confirm') && r.ok());
  }

  async cancelReservation(id: number): Promise<void> {
    await this.cancelButton(id).click();
    await this.page.waitForResponse((r) => r.url().includes('/cancel') && r.ok());
  }

  async releaseSpace(id: number): Promise<void> {
    await this.releaseButton(id).click();
    await this.page.waitForResponse((r) => r.url().includes('/release') && r.ok());
  }

  async openReceipt(id: number): Promise<void> {
    await this.receiptButton(id).click();
  }

  // ─── Data queries ─────────────────────────────────────────────────────────────

  async getActiveCount(): Promise<number> {
    return this.activeList.getByTestId(/^reservation-card-\d+$/).count();
  }

  async getHistoryCount(): Promise<number> {
    return this.historyTable.getByTestId(/^history-row-\d+$/).count();
  }

  async getStatusText(id: number): Promise<string | null> {
    return this.reservationStatus(id).textContent();
  }

  async getHistoryStatusText(id: number): Promise<string | null> {
    return this.historyStatus(id).textContent();
  }

  async getCountdownText(id: number): Promise<string | null> {
    return this.reservationCountdown(id).textContent();
  }

  // ─── State queries ────────────────────────────────────────────────────────────

  async isLoaded(): Promise<boolean> {
    return this.pageHeading.isVisible();
  }

  async isActiveLoading(): Promise<boolean> {
    return this.activeLoading.isVisible();
  }

  async isActiveEmpty(): Promise<boolean> {
    return this.activeEmpty.isVisible();
  }

  async isCardVisible(id: number): Promise<boolean> {
    return this.reservationCard(id).isVisible();
  }

  async isHistoryVisible(): Promise<boolean> {
    return this.historyTable.isVisible();
  }

  async isHistoryRowVisible(id: number): Promise<boolean> {
    return this.historyRow(id).isVisible();
  }

  async isConfirmButtonVisible(id: number): Promise<boolean> {
    return this.confirmButton(id).isVisible();
  }

  async isCancelButtonVisible(id: number): Promise<boolean> {
    return this.cancelButton(id).isVisible();
  }

  async isReleaseButtonVisible(id: number): Promise<boolean> {
    return this.releaseButton(id).isVisible();
  }

  async isActionErrorVisible(id: number): Promise<boolean> {
    return this.actionError(id).isVisible();
  }

  async isLateCancelWarningVisible(id: number): Promise<boolean> {
    return this.lateCancelWarning(id).isVisible();
  }

  async isHistoryLateBadgeVisible(id: number): Promise<boolean> {
    return this.historyLateBadge(id).isVisible();
  }
}