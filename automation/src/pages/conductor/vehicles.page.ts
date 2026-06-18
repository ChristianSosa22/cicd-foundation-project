import { type Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export type VehicleType = 'auto' | 'moto' | 'camioneta';

export class DriverVehiclesPage extends BasePage {
  static readonly PATH = '/vehicles';

  // ─── Root locators ────────────────────────────────────────────────────────────

  protected readonly pageHeading: Locator;
  readonly toggleRegisterButton: Locator;

  // ─── Register form locators ───────────────────────────────────────────────────

  readonly registerForm: Locator;
  readonly registerPlateInput: Locator;
  readonly registerTypeSelect: Locator;
  readonly registerError: Locator;
  readonly registerSubmit: Locator;

  // ─── List locators ────────────────────────────────────────────────────────────

  readonly loadingState: Locator;
  readonly emptyState: Locator;
  readonly vehiclesList: Locator;

  constructor(page: import('@playwright/test').Page) {
    super(page);
    this.pageHeading        = page.getByTestId('vehicles-heading');
    this.toggleRegisterButton = page.getByTestId('toggle-register-btn');

    this.registerForm       = page.getByTestId('register-form');
    this.registerPlateInput = page.getByTestId('register-plate-input');
    this.registerTypeSelect = page.getByTestId('register-type-select');
    this.registerError      = page.getByTestId('register-error');
    this.registerSubmit     = page.getByTestId('register-submit');

    this.loadingState       = page.getByTestId('vehicles-loading');
    this.emptyState         = page.getByTestId('vehicles-empty');
    this.vehiclesList       = page.getByTestId('vehicles-list');
  }

  // ─── Vehicle card locators ────────────────────────────────────────────────────

  vehicleCard(vehicleId: number): Locator {
    return this.page.getByTestId(`vehicle-card-${vehicleId}`);
  }

  vehicleStatusBadge(vehicleId: number): Locator {
    return this.vehicleCard(vehicleId).getByTestId('vehicle-status-badge');
  }

  vehicleEditButton(vehicleId: number): Locator {
    return this.vehicleCard(vehicleId).getByTestId('vehicle-edit-btn');
  }

  vehicleDeleteButton(vehicleId: number): Locator {
    return this.vehicleCard(vehicleId).getByTestId('vehicle-delete-btn');
  }

  vehicleConfirmDeleteButton(vehicleId: number): Locator {
    return this.vehicleCard(vehicleId).getByTestId('vehicle-confirm-delete-btn');
  }

  vehicleCancelDeleteButton(vehicleId: number): Locator {
    return this.vehicleCard(vehicleId).getByTestId('vehicle-cancel-delete-btn');
  }

  vehicleDeleteError(vehicleId: number): Locator {
    return this.vehicleCard(vehicleId).getByTestId('vehicle-delete-error');
  }

  // ─── Edit form locators (scoped to card) ──────────────────────────────────────

  editVehicleForm(vehicleId: number): Locator {
    return this.vehicleCard(vehicleId).getByTestId('edit-vehicle-form');
  }

  editPlateInput(vehicleId: number): Locator {
    return this.vehicleCard(vehicleId).getByTestId('edit-plate-input');
  }

  editTypeSelect(vehicleId: number): Locator {
    return this.vehicleCard(vehicleId).getByTestId('edit-type-select');
  }

  editVehicleError(vehicleId: number): Locator {
    return this.vehicleCard(vehicleId).getByTestId('edit-vehicle-error');
  }

  editSaveButton(vehicleId: number): Locator {
    return this.vehicleCard(vehicleId).getByTestId('edit-save-btn');
  }

  editCancelButton(vehicleId: number): Locator {
    return this.vehicleCard(vehicleId).getByTestId('edit-cancel-btn');
  }

  // ─── Navigation ───────────────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto(DriverVehiclesPage.PATH);
    await this.waitForPageLoad();
  }

  // ─── Register form actions ────────────────────────────────────────────────────

  async openRegisterForm(): Promise<void> {
    await this.toggleRegisterButton.click();
    await this.registerForm.waitFor({ state: 'visible' });
  }

  async closeRegisterForm(): Promise<void> {
    await this.toggleRegisterButton.click();
    await this.registerForm.waitFor({ state: 'hidden' });
  }

  async fillRegisterForm(plate: string, vehicleType: VehicleType): Promise<void> {
    await this.registerPlateInput.fill(plate);
    await this.registerTypeSelect.selectOption(vehicleType);
  }

  async submitRegisterForm(): Promise<void> {
    await this.registerSubmit.click();
    await this.page.waitForResponse((r) => r.url().includes('/me/vehicles') && r.ok());
  }

  async registerVehicle(plate: string, vehicleType: VehicleType): Promise<void> {
    await this.openRegisterForm();
    await this.fillRegisterForm(plate, vehicleType);
    await this.submitRegisterForm();
    await this.registerForm.waitFor({ state: 'hidden', timeout: 10_000 });
  }

  // ─── Vehicle card actions ─────────────────────────────────────────────────────

  async openEdit(vehicleId: number): Promise<void> {
    await this.vehicleEditButton(vehicleId).click();
    await this.editVehicleForm(vehicleId).waitFor({ state: 'visible' });
  }

  async cancelEdit(vehicleId: number): Promise<void> {
    await this.editCancelButton(vehicleId).click();
    await this.editVehicleForm(vehicleId).waitFor({ state: 'hidden' });
  }

  async saveEdit(vehicleId: number): Promise<void> {
    await this.editSaveButton(vehicleId).click();
    await this.page.waitForResponse((r) => r.url().includes('/me/vehicles/') && r.ok());
  }

  async clickDelete(vehicleId: number): Promise<void> {
    await this.vehicleDeleteButton(vehicleId).click();
    await this.vehicleConfirmDeleteButton(vehicleId).waitFor({ state: 'visible' });
  }

  async confirmDelete(vehicleId: number): Promise<void> {
    await this.vehicleConfirmDeleteButton(vehicleId).click();
    await this.page.waitForResponse((r) => r.url().includes('/me/vehicles/') && r.ok());
  }

  async cancelDelete(vehicleId: number): Promise<void> {
    await this.vehicleCancelDeleteButton(vehicleId).click();
    await this.vehicleDeleteButton(vehicleId).waitFor({ state: 'visible' });
  }

  async deleteVehicle(vehicleId: number): Promise<void> {
    await this.clickDelete(vehicleId);
    await this.confirmDelete(vehicleId);
  }

  // ─── Data queries ─────────────────────────────────────────────────────────────

  async getStatusText(vehicleId: number): Promise<string | null> {
    return this.vehicleStatusBadge(vehicleId).textContent();
  }

  async getVehicleCount(): Promise<number> {
    return this.vehiclesList.getByTestId(/^vehicle-card-\d+$/).count();
  }

  // ─── State queries ────────────────────────────────────────────────────────────

  async isLoaded(): Promise<boolean> {
    return this.pageHeading.isVisible();
  }

  async isLoading(): Promise<boolean> {
    return this.loadingState.isVisible();
  }

  async isEmpty(): Promise<boolean> {
    return this.emptyState.isVisible();
  }

  async isRegisterFormVisible(): Promise<boolean> {
    return this.registerForm.isVisible();
  }

  async isCardVisible(vehicleId: number): Promise<boolean> {
    return this.vehicleCard(vehicleId).isVisible();
  }

  async isVehicleApproved(vehicleId: number): Promise<boolean> {
    const text = await this.getStatusText(vehicleId);
    return text?.trim() === 'Aprobado';
  }

  async isEditFormVisible(vehicleId: number): Promise<boolean> {
    return this.editVehicleForm(vehicleId).isVisible();
  }

  async isConfirmDeleteVisible(vehicleId: number): Promise<boolean> {
    return this.vehicleConfirmDeleteButton(vehicleId).isVisible();
  }

  async isDeleteErrorVisible(vehicleId: number): Promise<boolean> {
    return this.vehicleDeleteError(vehicleId).isVisible();
  }

  async isRegisterErrorVisible(): Promise<boolean> {
    return this.registerError.isVisible();
  }

  async isEditErrorVisible(vehicleId: number): Promise<boolean> {
    return this.editVehicleError(vehicleId).isVisible();
  }
}