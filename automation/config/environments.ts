export type Environment = 'local' | 'dev' | 'staging' | 'prod';

export interface EnvironmentConfig {
  name: Environment;
  baseUrl: string;
  apiUrl: string;
}

const ALL_ENVS: Record<Environment, EnvironmentConfig> = {
  local: {
    name: 'local',
    baseUrl: process.env.BASE_URL ?? 'http://localhost:3000',
    apiUrl: process.env.API_URL ?? 'http://localhost:8080',
  },
  dev: {
    name: 'dev',
    baseUrl: process.env.BASE_URL ?? process.env.DEV_BASE_URL ?? '',
    apiUrl: process.env.API_URL ?? process.env.DEV_API_URL ?? '',
  },
  staging: {
    name: 'staging',
    baseUrl: process.env.BASE_URL ?? process.env.STAGING_BASE_URL ?? '',
    apiUrl: process.env.API_URL ?? process.env.STAGING_API_URL ?? '',
  },
  prod: {
    name: 'prod',
    baseUrl: process.env.BASE_URL ?? process.env.PROD_BASE_URL ?? '',
    apiUrl: process.env.API_URL ?? process.env.PROD_API_URL ?? '',
  },
};

export function getEnvironmentConfig(): EnvironmentConfig {
  const envName = (process.env.TEST_ENV as Environment) ?? 'local';
  const config = ALL_ENVS[envName];
  if (!config) {
    const valid = Object.keys(ALL_ENVS).join(', ');
    throw new Error(`Unknown TEST_ENV "${envName}". Valid values: ${valid}`);
  }
  if (envName !== 'local' && !config.baseUrl) {
    const varName = `${envName.toUpperCase()}_BASE_URL`;
    throw new Error(`${varName} (or BASE_URL) must be set when TEST_ENV="${envName}"`);
  }
  return config;
}
