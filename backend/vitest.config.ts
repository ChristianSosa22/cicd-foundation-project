import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 20000,
    sequence: { sequential: true },
    env: {
      NODE_ENV: 'test',
      // Port 5433 is the alternate mapping for the Docker DB container (5432 may be used by a local PG install).
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/parking',
      JWT_SECRET: 'test-secret-at-least-16-chars',
      JWT_EXPIRES_IN: '1h',
      AWS_REGION: 'us-east-1',
      BCRYPT_ROUNDS: '4',
      // 'test-encryption-key-for-testing!' (32 bytes) in base64
      ENCRYPTION_KEY: 'dGVzdC1lbmNyeXB0aW9uLWtleS1mb3ItdGVzdGluZyE=',
      HMAC_KEY: 'test-hmac-key-for-testing',
    },
  },
});
