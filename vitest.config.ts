import { defineConfig } from 'vitest/config';

const project = (name: string, include = ['src/**/*.test.{ts,tsx}']) => ({
  test: {
    name,
    root: `./${name}`,
    include,
    environment: 'node' as const,
  },
});

export default defineConfig({
  test: {
    projects: [
      project('shared'),
      project('nim'),
      project('milk'),
      project('poster'),
      // Telephone is the only workspace with a server half, and it lives outside src/.
      project('telephone', ['src/**/*.test.{ts,tsx}', 'worker/**/*.test.ts']),
    ],
  },
});
