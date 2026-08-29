import { defineConfig } from 'vitest/config';

const project = (name: string) => ({
  test: {
    name,
    root: `./${name}`,
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node' as const,
  },
});

export default defineConfig({
  test: {
    projects: [project('shared'), project('nim'), project('milk'), project('poster')],
  },
});
