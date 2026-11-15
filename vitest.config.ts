import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '.worktrees/**'],
    testTimeout: 15000,
  },
});
