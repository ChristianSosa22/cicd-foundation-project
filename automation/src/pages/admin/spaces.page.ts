import { type Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export type SpaceVehicleType = 'auto' | 'moto' | 'camioneta';
export type SpaceCategory = 'ejecutivo' | 'operativo' | 'visitante_frecuente';

export interface CreateSpaceData {
  label: string;
  vehicleType: SpaceVehicleType;
  categories?: SpaceCategory[];
}

export class AdminSpacesPage extends BasePage {
  static readonly PATH = '/spaces';

  // ─── Root locators ────────────────────────────────────────────────────────────

  protected readonly pageHeading: Locator;
  readonly toggleCreateButton: Locator;
  readonly createSpaceForm: Locator;
  readonly createLabelInput: Locator;
  readonly createVehicleTypeSelect: Locator;
  readonly createSpaceError: Locator;
  readonly createSpaceSubmit: Locator;
  readonly loadingState: Locator;
  readonly emptyState: Locator;
  readonly spacesList: Locator;

  constructor(page: import('@playwright/test').Page) {
    super(page);
    this.pageHeading         = page.getByTestId('spaces-heading');
    this.toggleCreateButton  = page.getByTestId('toggle-create-btn');
    this.createSpaceForm     = page.getByTestId('create-space-form');
    this.createLabelInput    = page.getByTestId('create-label-input');
    this.createVehicleTypeSelect = page.getByTestId('create-vehicle-type');
    this.createSpaceError    = page.getByTestId('create-space-error');
    this.createSpaceSubmit   = page.getByTestId('create-space-submit');
    this.loadingState        = page.getByTestId('spaces-loading');
    this.emptyState          = page.getByTestId('spaces-empty');
    this.spacesList          = page.getByTestId('spaces-list');
  }

  // ─── Space card locators ──────────────────────────────────────────────────────

  spaceCard(spaceId: number): Locator {
    return this.page.getByTestId(`space-card-${spaceId}`);
  }

  spaceStatusBadge(spaceId: number): Locator {
    return this.spaceCard(spaceId).getByTestId('space-status-badge');
  }

  spaceEditButton(spaceId: number): Locator {
    return this.spaceCard(spaceId).getByTestId('space-edit-btn');
  }

  spaceToggleActiveButton(spaceId: number): Locator {
    return this.spaceCard(spaceId).getByTestId('space-toggle-active-btn');
  }

  spaceBlackoutsButton(spaceId: number): Locator {
    return this.spaceCard(spaceId).getByTestId('space-blackouts-btn');
  }

  // ─── Edit form locators (scoped to card) ──────────────────────────────────────

  spaceEditForm(spaceId: number): Locator {
    return this.spaceCard(spaceId).getByTestId('space-edit-form');
  }

  spaceEditLabelInput(spaceId: number): Locator {
    return this.spaceCard(spaceId).getByTestId('edit-label-input');
  }

  spaceEditVehicleTypeSelect(spaceId: number): Locator {
    return this.spaceCard(spaceId).getByTestId('edit-vehicle-type');
  }

  spaceEditError(spaceId: number): Locator {
    return this.spaceCard(spaceId).getByTestId('edit-space-error');
  }

  spaceEditSaveButton(spaceId: number): Locator {
    return this.spaceCard(spaceId).getByTestId('edit-save-btn');
  }

  spaceEditCancelButton(spaceId: number): Locator {
    return this.spaceCard(spaceId).getByTestId('edit-cancel-btn');
  }

  // ─── Blackout panel locators (scoped to card) ────────────────────────────────

  blackoutPanel(spaceId: number): Locator {
    return this.spaceCard(spaceId).getByTestId('blackout-panel');
  }

  blackoutItem(blackoutId: number, spaceId: number): Locator {
    return this.spaceCard(spaceId).getByTestId(`blackout-item-${blackoutId}`);
  }

  blackoutStartDateInput(spaceId: number): Locator {
    return this.blackoutPanel(spaceId).getByTestId('blackout-start-date');
  }

  blackoutEndDateInput(spaceId: number): Locator {
    return this.blackoutPanel(spaceId).getByTestId('blackout-end-date');
  }

  blackoutReasonInput(spaceId: number): Locator {
    return this.blackoutPanel(spaceId).getByTestId('blackout-reason');
  }

  blackoutFormError(spaceId: number): Locator {
    return this.blackoutPanel(spaceId).getByTestId('blackout-form-error');
  }

  blackoutAddButton(spaceId: number): Locator {
    return this.blackoutPanel(spaceId).getByTestId('blackout-add-btn');
  }

  // ─── Navigation ───────────────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto(AdminSpacesPage.PATH);
    await this.waitForPageLoad();
  }

  // ─── Create space actions ────────────────────────────────────────────────────

  async openCreateForm(): Promise<void> {
    await this.toggleCreateButton.click();
    await this.createSpaceForm.waitFor({ state: 'visible' });
  }

  async closeCreateForm(): Promise<void> {
    await this.toggleCreateButton.click();
    await this.createSpaceForm.waitFor({ state: 'hidden' });
  }

  async fillCreateForm(data: CreateSpaceData): Promise<void> {
    await this.createLabelInput.fill(data.label);
    await this.createVehicleTypeSelect.selectOption(data.vehicleType);
    if (data.categories) {
      for (const cat of data.categories) {
        await this.createSpaceForm.getByTestId(`category-${cat}`).check();
      }
    }
  }

  async submitCreateForm(): Promise<void> {
    await this.createSpaceSubmit.click();
    await this.page.waitForResponse((r) => r.url().includes('/admin/spaces') && r.ok());
  }

  async createSpace(data: CreateSpaceData): Promise<void> {
    await this.openCreateForm();
    await this.fillCreateForm(data);
    await this.submitCreateForm();
  }

  // ─── Space card actions ───────────────────────────────────────────────────────

  async toggleSpaceActive(spaceId: number): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (r) =>
        r.url().includes('/spaces/') &&
        (r.url().includes('/activate') || r.url().includes('/deactivate')) &&
        r.ok(),
    );
    await this.spaceToggleActiveButton(spaceId).click();
    await responsePromise;
  }

  async openEditSpace(spaceId: number): Promise<void> {
    await this.spaceEditButton(spaceId).click();
    await this.spaceEditForm(spaceId).waitFor({ state: 'visible' });
  }

  async cancelEditSpace(spaceId: number): Promise<void> {
    await this.spaceEditCancelButton(spaceId).click();
    await this.spaceEditForm(spaceId).waitFor({ state: 'hidden' });
  }

  async saveEditSpace(spaceId: number): Promise<void> {
    await this.spaceEditSaveButton(spaceId).click();
    await this.page.waitForResponse((r) => r.url().includes('/admin/spaces/') && r.ok());
  }

  // ─── Blackout actions ─────────────────────────────────────────────────────────

  async openBlackouts(spaceId: number): Promise<void> {
    await this.spaceBlackoutsButton(spaceId).click();
    await this.blackoutPanel(spaceId).waitFor({ state: 'visible' });
  }

  async closeBlackouts(spaceId: number): Promise<void> {
    await this.spaceBlackoutsButton(spaceId).click();
    await this.blackoutPanel(spaceId).waitFor({ state: 'hidden' });
  }

  async addBlackout(
    spaceId: number,
    startDate: string,
    endDate: string,
    reason?: string,
  ): Promise<void> {
    await this.blackoutStartDateInput(spaceId).fill(startDate);
    await this.blackoutEndDateInput(spaceId).fill(endDate);
    if (reason) {
      await this.blackoutReasonInput(spaceId).fill(reason);
    }
    await this.blackoutAddButton(spaceId).click();
    await this.page.waitForResponse((r) => r.url().includes('/blackouts') && r.ok());
  }

  async deleteBlackout(blackoutId: number, spaceId: number): Promise<void> {
    await this.blackoutItem(blackoutId, spaceId).getByTestId('blackout-delete-btn').click();
    await this.page.waitForResponse((r) => r.url().includes('/blackouts/') && r.ok());
  }

  // ─── Data queries ─────────────────────────────────────────────────────────────

  async getSpaceStatusText(spaceId: number): Promise<string | null> {
    return this.spaceStatusBadge(spaceId).textContent();
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

  async isCreateFormVisible(): Promise<boolean> {
    return this.createSpaceForm.isVisible();
  }

  async isSpaceCardVisible(spaceId: number): Promise<boolean> {
    return this.spaceCard(spaceId).isVisible();
  }

  async isSpaceActive(spaceId: number): Promise<boolean> {
    const text = await this.getSpaceStatusText(spaceId);
    return text?.trim() === 'Activo';
  }

  async isEditFormVisible(spaceId: number): Promise<boolean> {
    return this.spaceEditForm(spaceId).isVisible();
  }

  async isBlackoutPanelVisible(spaceId: number): Promise<boolean> {
    return this.blackoutPanel(spaceId).isVisible();
  }

  async isBlackoutItemVisible(blackoutId: number, spaceId: number): Promise<boolean> {
    return this.blackoutItem(blackoutId, spaceId).isVisible();
  }

  async isBlackoutFormErrorVisible(spaceId: number): Promise<boolean> {
    return this.blackoutFormError(spaceId).isVisible();
  }

  async isCreateSpaceErrorVisible(): Promise<boolean> {
    return this.createSpaceError.isVisible();
  }

  async isEditSpaceErrorVisible(spaceId: number): Promise<boolean> {
    return this.spaceEditError(spaceId).isVisible();
  }
}
