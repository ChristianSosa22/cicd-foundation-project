# Automation — Suite de pruebas E2E

Suite de pruebas end-to-end para el sistema de reserva de parqueos, construida con **Playwright** y **TypeScript**. Cubre los flujos completos de los dos roles del sistema: **Administrador** y **Conductor**.

---

## Tabla de contenidos

- [Stack tecnológico](#stack-tecnológico)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Prerrequisitos](#prerrequisitos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Ejecutar las pruebas](#ejecutar-las-pruebas)
- [Estrategia de autenticación](#estrategia-de-autenticación)
- [Page Object Model](#page-object-model)
- [Fixtures personalizados](#fixtures-personalizados)
- [Factories de datos de prueba](#factories-de-datos-de-prueba)
- [Agregar nuevas pruebas](#agregar-nuevas-pruebas)

---

## Stack tecnológico

| Herramienta | Versión | Propósito |
|---|---|---|
| [@playwright/test](https://playwright.dev) | ^1.49.0 | Framework de pruebas E2E |
| [TypeScript](https://www.typescriptlang.org) | ^5.7.2 | Tipado estático |
| [@faker-js/faker](https://fakerjs.dev) | ^9.3.0 | Generación de datos de prueba |
| [dotenv](https://github.com/motdotla/dotenv) | ^16.4.5 | Gestión de variables de entorno |

---

## Estructura del proyecto

```
automation/
├── config/
│   └── environments.ts          # URLs y configuración por ambiente (local/dev/prod)
│
├── src/
│   ├── fixtures/
│   │   └── index.ts             # Fixtures de Playwright con contextos y page objects
│   │
│   ├── helpers/
│   │   └── date.helper.ts       # Utilidades de fechas (today, tomorrow, nextWeekday, etc.)
│   │
│   ├── pages/
│   │   ├── base.page.ts         # Clase base con helpers comunes (goto, waitForPageLoad, etc.)
│   │   ├── login.page.ts        # Página de login (compartida entre roles)
│   │   ├── admin/               # Page objects del rol Administrador
│   │   │   ├── dashboard.page.ts
│   │   │   ├── reservations.page.ts
│   │   │   ├── settings.page.ts
│   │   │   ├── spaces.page.ts
│   │   │   ├── tariffs.page.ts
│   │   │   ├── users.page.ts
│   │   │   └── vehicles.page.ts
│   │   └── conductor/           # Page objects del rol Conductor
│   │       ├── availability.page.ts
│   │       ├── reservations.page.ts
│   │       ├── reserve.page.ts
│   │       └── vehicles.page.ts
│   │
│   └── types/
│       └── index.ts             # Tipos TypeScript espejo del frontend/API
│
├── test-data/
│   ├── index.ts                 # Re-exportaciones de todas las factories
│   └── factories/
│       ├── user.factory.ts      # buildUser, buildAdminUser, buildDriverUser
│       └── vehicle.factory.ts   # buildVehicle, buildVehicleOfType
│
├── tests/
│   ├── admin/                   # Tests del rol Administrador
│   │   └── login.spec.ts
│   └── conductor/               # Tests del rol Conductor
│       └── login.spec.ts
│
├── .env                         # Variables de entorno locales (gitignored)
├── .env.example                 # Plantilla de variables de entorno
├── playwright.config.ts         # Configuración de Playwright
├── tsconfig.json
└── package.json
```

---

## Prerrequisitos

- **Node.js** >= 18
- **npm** >= 9
- La aplicación (frontend + API) debe estar corriendo antes de ejecutar las pruebas

---

## Instalación

```bash
# Desde la raíz del repositorio, ir a la carpeta de automation
cd automation

# Instalar dependencias de Node
npm install

# Instalar los navegadores de Playwright con sus dependencias del sistema
npm run install:browsers
```

---

## Configuración

### 1. Crear el archivo `.env`

```bash
cp .env.example .env
```

### 2. Completar las variables

```dotenv
# Ambiente objetivo: local | dev | prod
TEST_ENV=local

# URLs por ambiente (necesarias cuando TEST_ENV != local)
# DEV_BASE_URL=http://<dev-alb-dns>
# PROD_BASE_URL=http://<prod-alb-dns>

# Credenciales de prueba
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=tu_password_admin

CONDUCTOR_EMAIL=conductor@example.com
CONDUCTOR_PASSWORD=tu_password_conductor
```

### URL por defecto para `TEST_ENV=local`

| Servicio | URL por defecto |
|---|---|
| Frontend (Next.js) | `http://localhost:3000` |

---

## Ejecutar las pruebas

### Comandos principales

```bash
# Ejecutar toda la suite (todos los navegadores)
npm test

# Modo UI interactivo (recomendado para desarrollo)
npm run test:ui

# Modo headed (abre el navegador visualmente)
npm run test:headed

# Modo debug paso a paso
npm run test:debug
```

### Filtrar por rol

```bash
# Solo tests del administrador
npm run test:admin

# Solo tests del conductor
npm run test:conductor
```

### Filtrar por navegador

La suite corre únicamente en Chromium. No se requiere flag adicional.

```bash
npx playwright test --project=chromium
```

### Filtrar por archivo o nombre

```bash
# Un archivo específico
npx playwright test tests/admin/login.spec.ts

# Por nombre de test (grep)
npx playwright test --grep "inicia sesión"
```

### Ver el reporte HTML tras una ejecución

```bash
npm run test:report
```

### Verificar tipos TypeScript sin ejecutar tests

```bash
npm run typecheck
```

---

## Estrategia de autenticación

Todos los tests realizan el login **a través de la UI** al inicio de cada ejecución. El fixture `loginPage` expone dos métodos que navegan a `/login` y completan el formulario en el contexto del rol correspondiente:

```typescript
// Login como administrador (opera sobre adminPage)
await loginPage.loginAsAdmin();

// Login como conductor (opera sobre conductorPage)
await loginPage.loginAsDriver();
```

Cada método incluye la navegación a `/login` y espera a que la redirección post-login se complete antes de continuar.

```typescript
// Patrón típico en beforeEach para tests de administrador
test.beforeEach(async ({ loginPage, adminSpaces }) => {
  await loginPage.loginAsAdmin();
  await adminSpaces.goto();
});
```

Para tests que requieren acciones de ambos roles (p. ej. conductor registra un vehículo y admin lo aprueba), ambos contextos pueden autenticarse en el mismo test ya que operan en páginas independientes:

```typescript
test.beforeEach(async ({ loginPage, driverVehicles }) => {
  await loginPage.loginAsDriver();   // autentica conductorPage
  await driverVehicles.goto();
  // ... pre-condición del conductor
});

test('...', async ({ loginPage, adminVehicles }) => {
  await loginPage.loginAsAdmin();    // autentica adminPage
  await adminVehicles.goto();
  // ...
});
```

---

## Page Object Model

Todos los page objects siguen el mismo patrón:

```typescript
export class AdminExamplePage extends BasePage {
  // 1. PATH estático para navegación
  static readonly PATH = '/example';

  // 2. Locators declarados como propiedades tipadas
  protected readonly pageHeading: Locator;
  readonly someButton: Locator;

  // 3. Inicializados en el constructor con data-testid
  constructor(page: Page) {
    super(page);
    this.pageHeading = page.getByTestId('example-heading');
    this.someButton  = page.getByTestId('some-btn');
  }

  // 4. Locators dinámicos (por ID) como métodos
  itemRow(id: number): Locator {
    return this.page.getByTestId(`item-row-${id}`);
  }

  // 5. Acciones (navegación, clicks, fills)
  async goto(): Promise<void> { ... }
  async doSomething(): Promise<void> { ... }

  // 6. Data queries — retornan valores
  async getItemCount(): Promise<number> { ... }

  // 7. State queries — retornan boolean, sin expect()
  async isLoaded(): Promise<boolean> {
    return this.pageHeading.isVisible();
  }
}
```

**Regla fundamental:** los page objects **nunca** contienen `expect()`. Toda aserción vive exclusivamente en los archivos `*.spec.ts`.

### Selectores

Todos los locators usan `data-testid` para desacoplarse de estilos y estructura DOM. Los atributos están definidos en el frontend en cada componente React correspondiente.

---

## Fixtures personalizados

El archivo `src/fixtures/index.ts` extiende `test` de Playwright con los siguientes fixtures listos para usar en cualquier spec:

| Fixture | Tipo | Descripción |
|---|---|---|
| `adminContext` | `BrowserContext` | Contexto de navegador para el rol administrador |
| `conductorContext` | `BrowserContext` | Contexto de navegador para el rol conductor |
| `adminPage` | `Page` | Página del contexto administrador |
| `conductorPage` | `Page` | Página del contexto conductor |
| `loginPage` | `LoginPage` | Login compartido; `loginAsAdmin()` opera en `adminPage` y `loginAsDriver()` en `conductorPage` |
| `adminDashboardPage` | `AdminDashboardPage` | — |
| `adminUsersPage` | `AdminUsersPage` | — |
| `adminVehiclesPage` | `AdminVehiclesPage` | — |
| `adminSpacesPage` | `AdminSpacesPage` | — |
| `adminTariffsPage` | `AdminTariffsPage` | — |
| `adminReservationsPage` | `AdminReservationsPage` | — |
| `adminSettingsPage` | `AdminSettingsPage` | — |
| `availabilityPage` | `AvailabilityPage` | — |
| `driverVehiclesPage` | `DriverVehiclesPage` | — |
| `driverReservationsPage` | `DriverReservationsPage` | — |
| `reservePage` | `ReservePage` | — |

```typescript
// Importar siempre desde src/fixtures, no desde @playwright/test
import { test, expect } from '../src/fixtures';
```

---

## Factories de datos de prueba

Las factories usan **Faker.js** para generar datos realistas y únicos. Importarlas desde `test-data`:

```typescript
import { buildDriverUser, buildVehicleOfType } from '../test-data';

// Usuario conductor con categoría específica
const userData = buildDriverUser('ejecutivo');
// → { email: 'juan.perez@example.com', full_name: 'Juan Pérez', password: '...', ... }

// Vehículo de un tipo específico (placa formato guatemalteco ABC-1234)
const vehicleData = buildVehicleOfType('auto');
// → { plate: 'XYZ-4567', vehicle_type: 'auto' }
```

### Factories disponibles

| Factory | Descripción |
|---|---|
| `buildUser(overrides?)` | Usuario genérico |
| `buildAdminUser(overrides?)` | Usuario con `system_role: 'admin'` |
| `buildDriverUser(category?, overrides?)` | Usuario con `system_role: 'driver'` |
| `buildVehicle(overrides?)` | Vehículo con placa aleatoria formato `ABC-1234` |
| `buildVehicleOfType(type, overrides?)` | Vehículo de tipo específico |

---

## Agregar nuevas pruebas

### 1. Crear el archivo spec en la carpeta del rol correspondiente

```
tests/admin/nombre-feature.spec.ts
tests/conductor/nombre-feature.spec.ts
```

### 2. Estructura base de un test

```typescript
import { expect } from '@playwright/test';
import { test } from '../../src/fixtures';

test.describe('Feature — Nombre descriptivo', () => {
  test.beforeEach(async ({ loginPage, adminUsersPage }) => {
    await loginPage.loginAsAdmin();
    await adminUsersPage.goto();
  });

  test('descripción del comportamiento esperado', async ({ adminUsersPage }) => {
    // Assert
    expect(await adminUsersPage.isLoaded()).toBe(true);
  });
});
```

### 3. Convenciones de nomenclatura

- Archivos: `kebab-case.spec.ts`
- `test.describe`: `'Página / Módulo — contexto'`
- `test`: descripción en tercera persona del comportamiento esperado
- Usar `waitForResponse` para capturar IDs de recursos creados durante la pre-condición UI