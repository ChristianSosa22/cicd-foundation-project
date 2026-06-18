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
│   ├── api/
│   │   ├── client.ts            # ApiClient: llamadas REST directas para setup/teardown
│   │   └── endpoints.ts         # Mapa de todos los endpoints de la API
│   │
│   ├── fixtures/
│   │   └── index.ts             # Fixtures de Playwright con contextos autenticados y page objects
│   │
│   ├── helpers/
│   │   ├── auth.helper.ts       # Inyección de JWT en localStorage
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
│       ├── vehicle.factory.ts   # buildVehicle, buildVehicleOfType
│       └── reservation.factory.ts # buildReservation
│
├── tests/
│   ├── auth/                    # Setup de estado de autenticación (no son tests)
│   │   ├── admin.setup.ts       # Genera .auth/admin.json
│   │   └── conductor.setup.ts   # Genera .auth/conductor.json
│   ├── admin/                   # Tests del rol Administrador
│   │   └── login.spec.ts
│   └── conductor/               # Tests del rol Conductor
│       └── login.spec.ts
│
├── .auth/                       # Estado de sesión generado (gitignored)
│   ├── admin.json
│   └── conductor.json
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

# Opcional: sobrescribir URLs del ambiente seleccionado
# BASE_URL=http://localhost:3000
# API_URL=http://localhost:8080

# URLs por ambiente (necesarias cuando TEST_ENV != local)
# DEV_BASE_URL=http://<dev-alb-dns>
# DEV_API_URL=http://<dev-alb-dns>
# PROD_BASE_URL=http://<prod-alb-dns>
# PROD_API_URL=http://<prod-alb-dns>

# Credenciales de prueba
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=tu_password_admin

CONDUCTOR_EMAIL=conductor@example.com
CONDUCTOR_PASSWORD=tu_password_conductor
```

### URLs por defecto para `TEST_ENV=local`

| Servicio | URL por defecto |
|---|---|
| Frontend (Next.js) | `http://localhost:3000` |
| API (backend) | `http://localhost:8080` |

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

Los tests **no realizan login a través de la UI** en cada ejecución. En su lugar, el proyecto usa un mecanismo en dos fases:

### Fase 1 — Setup (se ejecuta una vez antes de todos los tests)

Los archivos `tests/auth/admin.setup.ts` y `tests/auth/conductor.setup.ts` obtienen un JWT directamente de la API mediante una llamada `POST /auth/login` y lo inyectan en el `localStorage` del navegador bajo la clave `parking.session`. El estado resultante se guarda en `.auth/admin.json` y `.auth/conductor.json`.

```
POST /auth/login  →  JWT  →  localStorage['parking.session']  →  .auth/*.json
```

### Fase 2 — Tests

Los fixtures `adminContext` y `conductorContext` cargan el estado guardado al crear el contexto del navegador, evitando el login en cada test.

```typescript
// Ejemplo de uso en un test
test('Navegar al dashboard', async ({ adminDashboard }) => {
  await adminDashboard.goto();
  expect(await adminDashboard.isLoaded()).toBe(true);
});
```

> Los archivos `.auth/` están en `.gitignore` y se regeneran en cada ejecución de CI.

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
| `adminContext` | `BrowserContext` | Contexto autenticado como administrador |
| `conductorContext` | `BrowserContext` | Contexto autenticado como conductor |
| `adminPage` | `Page` | Página autenticada como administrador |
| `conductorPage` | `Page` | Página autenticada como conductor |
| `apiClient` | `ApiClient` | Cliente de API sin autenticar (usar `.withToken(token)`) |
| `loginPage` | `LoginPage` | Página de login (sin autenticación previa) |
| `adminDashboard` | `AdminDashboardPage` | — |
| `adminUsers` | `AdminUsersPage` | — |
| `adminVehicles` | `AdminVehiclesPage` | — |
| `adminSpaces` | `AdminSpacesPage` | — |
| `adminTariffs` | `AdminTariffsPage` | — |
| `adminReservations` | `AdminReservationsPage` | — |
| `adminSettings` | `AdminSettingsPage` | — |
| `availabilityPage` | `AvailabilityPage` | — |
| `driverVehicles` | `DriverVehiclesPage` | — |
| `driverReservations` | `DriverReservationsPage` | — |
| `reservePage` | `ReservePage` | — |

```typescript
// Importar siempre desde src/fixtures, no desde @playwright/test
import { test, expect } from '../src/fixtures';
```

---

## Factories de datos de prueba

Las factories usan **Faker.js** para generar datos realistas y únicos. Importarlas desde `test-data`:

```typescript
import { buildDriverUser, buildVehicleOfType, buildReservation } from '../test-data';

// Usuario conductor con categoría específica
const userData = buildDriverUser('ejecutivo');
// → { email: 'juan.perez@example.com', full_name: 'Juan Pérez', password: '...', ... }

// Vehículo de un tipo específico (placa formato guatemalteco ABC-123)
const vehicleData = buildVehicleOfType('auto');
// → { plate: 'XYZ-456', vehicle_type: 'auto' }

// Reserva con overrides
const reservationData = buildReservation(spaceId, vehicleId, { reservation_date: '2026-07-01' });
```

### Factories disponibles

| Factory | Descripción |
|---|---|
| `buildUser(overrides?)` | Usuario genérico |
| `buildAdminUser(overrides?)` | Usuario con `system_role: 'admin'` |
| `buildDriverUser(category?, overrides?)` | Usuario con `system_role: 'driver'` |
| `buildVehicle(overrides?)` | Vehículo con placa aleatoria formato `ABC-123` |
| `buildVehicleOfType(type, overrides?)` | Vehículo de tipo específico |
| `buildReservation(spaceId, vehicleId, overrides?)` | Payload de reserva |

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
  test.beforeEach(async ({ adminDashboard }) => {
    await adminDashboard.goto();
  });

  test('descripción del comportamiento esperado', async ({ adminUsers, apiClient }) => {
    // Arrange: crear datos via API para no depender de estado previo
    const userData = buildDriverUser();
    await apiClient.withToken(process.env.ADMIN_TOKEN!).createUser(userData);

    // Act
    await adminUsers.goto();

    // Assert
    expect(await adminUsers.isLoaded()).toBe(true);
  });
});
```

### 3. Convenciones de nomenclatura

- Archivos: `kebab-case.spec.ts`
- `test.describe`: `'Página / Módulo — contexto'`
- `test`: descripción en tercera persona del comportamiento esperado
- Preferir setup vía API (`apiClient`) sobre setup vía UI para mayor velocidad y confiabilidad