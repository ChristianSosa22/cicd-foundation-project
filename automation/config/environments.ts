export type Environment = 'local' | 'dev' | 'prod';

export interface EnvironmentConfig {
  name: Environment;
  baseUrl: string;
}

const ALL_ENVS: Record<Environment, EnvironmentConfig> = {
  local: {
    name: 'local',
    baseUrl: 'http://localhost:3000',
  },
  dev: {
    name: 'dev',
    baseUrl: process.env.DEV_BASE_URL ?? '',
  },
  prod: {
    name: 'prod',
    baseUrl: process.env.PROD_BASE_URL ?? '',
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
