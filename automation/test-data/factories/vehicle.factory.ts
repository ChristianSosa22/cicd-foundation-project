import { faker } from '@faker-js/faker';
import type { VehicleType } from '../../src/types';

const VEHICLE_TYPES: VehicleType[] = ['auto', 'moto', 'camioneta'];

/** Generates a Guatemala-style plate: ABC-1234 */
function generatePlate(): string {
  const letters = faker.string.alpha({ length: 3, casing: 'upper' });
  const digits = faker.string.numeric({ length: 4 });
  return `${letters}-${digits}`;
}

export interface VehicleData {
  plate: string;
  vehicle_type: VehicleType;
}

export function buildVehicle(overrides: Partial<VehicleData> = {}): VehicleData {
  return {
    plate: overrides.plate ?? generatePlate(),
    vehicle_type: overrides.vehicle_type ?? faker.helpers.arrayElement(VEHICLE_TYPES),
  };
}

export function buildVehicleOfType(type: VehicleType, overrides: Partial<VehicleData> = {}): VehicleData {
  return buildVehicle({ ...overrides, vehicle_type: type });
}
