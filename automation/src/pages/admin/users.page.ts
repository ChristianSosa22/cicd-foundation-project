import { type Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export interface CreateUserData {
  email: string;
  fullName: string;
  password: string;
  role?: 'driver' | 'admin';
  category?: 'ejecutivo' | 'operativo' | 'visitante_frecuente';
  phone?: string;
}

export class AdminUsersPage extends BasePage {
  static readonly PATH = '/users';

  // ─── Root locators ────────────────────────────────────────────────────────────

  protected readonly pageHeading: Locator;
  readonly toggleCreateButton: Locator;

  // ─── Create form locators ─────────────────────────────────────────────────────

  readonly createUserForm: Locator;
  readonly createEmailInput: Locator;
  readonly createFullnameInput: Locator;
  readonly createPasswordInput: Locator;
  readonly createPhoneInput: Locator;
  readonly createRoleSelect: Locator;
  readonly createCategorySelect: Locator;
  readonly createUserError: Locator;
  readonly createUserSubmit: Locator;

  // ─── Filter locators ──────────────────────────────────────────────────────────

  readonly filterStatus: Locator;
  readonly filterRole: Locator;
  readonly filterCategory: Locator;
  readonly clearFiltersButton: Locator;

  // ─── Table locators ───────────────────────────────────────────────────────────

  readonly usersTable: Locator;
  readonly loadingState: Locator;
  readonly emptyState: Locator;

  constructor(page: import('@playwright/test').Page) {
    super(page);
    this.pageHeading        = page.getByTestId('users-heading');
    this.toggleCreateButton = page.getByTestId('toggle-create-btn');

    this.createUserForm     = page.getByTestId('create-user-form');
    this.createEmailInput   = page.getByTestId('create-email-input');
    this.createFullnameInput = page.getByTestId('create-fullname-input');
    this.createPasswordInput = page.getByTestId('create-password-input');
    this.createPhoneInput   = page.getByTestId('create-phone-input');
    this.createRoleSelect   = page.getByTestId('create-role-select');
    this.createCategorySelect = page.getByTestId('create-category-select');
    this.createUserError    = page.getByTestId('create-user-error');
    this.createUserSubmit   = page.getByTestId('create-user-submit');

    this.filterStatus       = page.getByTestId('filter-status');
    this.filterRole         = page.getByTestId('filter-role');
    this.filterCategory     = page.getByTestId('filter-category');
    this.clearFiltersButton = page.getByTestId('clear-filters-btn');

    this.usersTable         = page.getByTestId('users-table');
    this.loadingState       = page.getByTestId('users-loading');
    this.emptyState         = page.getByTestId('users-empty');
  }

  // ─── Row locators ─────────────────────────────────────────────────────────────

  userRow(userId: number): Locator {
    return this.page.getByTestId(`user-row-${userId}`);
  }

  userStatusBadge(userId: number): Locator {
    return this.userRow(userId).getByTestId('user-status-badge');
  }

  userEditButton(userId: number): Locator {
    return this.userRow(userId).getByTestId('user-edit-btn');
  }

  userToggleActiveButton(userId: number): Locator {
    return this.userRow(userId).getByTestId('user-toggle-active-btn');
  }

  // ─── Edit form locators (scoped to row) ──────────────────────────────────────

  editUserForm(userId: number): Locator {
    return this.userRow(userId).getByTestId('edit-user-form');
  }

  editFullnameInput(userId: number): Locator {
    return this.userRow(userId).getByTestId('edit-fullname-input');
  }

  editRoleSelect(userId: number): Locator {
    return this.userRow(userId).getByTestId('edit-role-select');
  }

  editCategorySelect(userId: number): Locator {
    return this.userRow(userId).getByTestId('edit-category-select');
  }

  editUserError(userId: number): Locator {
    return this.userRow(userId).getByTestId('edit-user-error');
  }

  editUserSaveButton(userId: number): Locator {
    return this.userRow(userId).getByTestId('edit-user-save-btn');
  }

  editUserCancelButton(userId: number): Locator {
    return this.userRow(userId).getByTestId('edit-user-cancel-btn');
  }

  // ─── Navigation ───────────────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.page.goto(AdminUsersPage.PATH);
    await this.waitForPageLoad();
  }

  // ─── Create form actions ─────────────────────────────────────────────────────

  async openCreateForm(): Promise<void> {
    await this.toggleCreateButton.click();
    await this.createUserForm.waitFor({ state: 'visible' });
  }

  async closeCreateForm(): Promise<void> {
    await this.toggleCreateButton.click();
    await this.createUserForm.waitFor({ state: 'hidden' });
  }

  async fillCreateForm(data: CreateUserData): Promise<void> {
    await this.createEmailInput.fill(data.email);
    await this.createFullnameInput.fill(data.fullName);
    await this.createPasswordInput.fill(data.password);
    if (data.phone) {
      await this.createPhoneInput.fill(data.phone);
    }
    if (data.role) {
      await this.createRoleSelect.selectOption(data.role);
    }
    if (data.category) {
      await this.createCategorySelect.selectOption(data.category);
    }
  }

  async submitCreateForm(): Promise<void> {
    await this.createUserSubmit.click();
    await this.page.waitForResponse((r) => r.url().includes('/admin/users') && r.ok());
  }

  async createUser(data: CreateUserData): Promise<void> {
    await this.openCreateForm();
    await this.fillCreateForm(data);
    await this.submitCreateForm();
    await this.createUserForm.waitFor({ state: 'hidden', timeout: 10_000 });
  }

  // ─── Filter actions ───────────────────────────────────────────────────────────

  async filterByStatus(value: '' | 'true' | 'false'): Promise<void> {
    await this.filterStatus.selectOption(value);
  }

  async filterByRole(value: '' | 'admin' | 'driver'): Promise<void> {
    await this.filterRole.selectOption(value);
  }

  async filterByCategory(value: string): Promise<void> {
    await this.filterCategory.selectOption(value);
  }

  async clearFilters(): Promise<void> {
    if (await this.clearFiltersButton.isVisible()) {
      await this.clearFiltersButton.click();
    }
  }

  // ─── User row actions ─────────────────────────────────────────────────────────

  async openEdit(userId: number): Promise<void> {
    await this.userEditButton(userId).click();
    await this.editUserForm(userId).waitFor({ state: 'visible' });
  }

  async cancelEdit(userId: number): Promise<void> {
    await this.editUserCancelButton(userId).click();
    await this.editUserForm(userId).waitFor({ state: 'hidden' });
  }

  async saveEdit(userId: number): Promise<void> {
    await this.editUserSaveButton(userId).click();
    await this.page.waitForResponse((r) => r.url().includes('/admin/users/') && r.ok());
  }

  async toggleUserActive(userId: number): Promise<void> {
    await this.userToggleActiveButton(userId).click();
    await this.page.waitForResponse(
      (r) =>
        r.url().includes('/admin/users/') &&
        (r.url().includes('/activate') || r.url().includes('/deactivate')) &&
        r.ok(),
    );
  }

  // ─── Data queries ─────────────────────────────────────────────────────────────

  async getUserStatusText(userId: number): Promise<string | null> {
    return this.userStatusBadge(userId).textContent();
  }

  async getVisibleRowCount(): Promise<number> {
    return this.usersTable.getByTestId(/^user-row-\d+$/).count();
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
    return this.createUserForm.isVisible();
  }

  async isUserRowVisible(userId: number): Promise<boolean> {
    return this.userRow(userId).isVisible();
  }

  async isUserActive(userId: number): Promise<boolean> {
    const text = await this.getUserStatusText(userId);
    return text?.trim() === 'Activo';
  }

  async isEditFormVisible(userId: number): Promise<boolean> {
    return this.editUserForm(userId).isVisible();
  }

  async isCreateErrorVisible(): Promise<boolean> {
    return this.createUserError.isVisible();
  }

  async isEditErrorVisible(userId: number): Promise<boolean> {
    return this.editUserError(userId).isVisible();
  }
}