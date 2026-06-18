import { faker } from '@faker-js/faker';
import type { CreateUserPayload, SystemRole, UserCategory } from '../../src/types';

const CATEGORIES: UserCategory[] = ['ejecutivo', 'operativo', 'visitante_frecuente'];

export function buildUser(overrides: Partial<CreateUserPayload> = {}): CreateUserPayload {
  const role: SystemRole = overrides.system_role ?? 'driver';
  return {
    email: faker.internet.email({ provider: 'test.com' }).toLowerCase(),
    full_name: faker.person.fullName(),
    password: faker.internet.password({ length: 12 }),
    system_role: role,
    category: role === 'driver' ? (overrides.category ?? faker.helpers.arrayElement(CATEGORIES)) : null,
    phone: faker.helpers.maybe(() => faker.phone.number({ style: 'national' }), { probability: 0.4 }),
    ...overrides,
  };
}

export function buildAdminUser(overrides: Partial<CreateUserPayload> = {}): CreateUserPayload {
  return buildUser({ ...overrides, system_role: 'admin', category: null });
}

export function buildDriverUser(
  category?: UserCategory,
  overrides: Partial<CreateUserPayload> = {},
): CreateUserPayload {
  return buildUser({ category: category ?? faker.helpers.arrayElement(CATEGORIES), ...overrides, system_role: 'driver' });
}
