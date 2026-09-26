import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const fromRoot = (relativePath: string): string => fileURLToPath(new URL(relativePath, import.meta.url));

// Tests run against workspace sources, so no package has to be built before `npm test`.
const workspaceSourceAliases = {
  '@sentinel/domain': fromRoot('./packages/domain/src/index.ts'),
  '@sentinel/rules': fromRoot('./packages/rules/src/index.ts'),
  '@sentinel/scenarios': fromRoot('./packages/scenarios/src/index.ts'),
};

const INTEGRATION_SPECS = 'test/integration/**/*.integration.spec.ts';

function nodeProject(name: string, directory: string) {
  return {
    root: fromRoot(directory),
    resolve: { alias: workspaceSourceAliases },
    test: {
      name,
      environment: 'node' as const,
      include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
      exclude: [INTEGRATION_SPECS, '**/node_modules/**'],
    },
  };
}

/** Real MongoDB Atlas, never part of `npm test`: run with `npm run test:integration` and a local .env. */
function integrationProject(name: string, directory: string) {
  return {
    root: fromRoot(directory),
    resolve: { alias: workspaceSourceAliases },
    test: {
      name,
      environment: 'node' as const,
      include: [INTEGRATION_SPECS],
      testTimeout: 120_000,
      hookTimeout: 120_000,
      fileParallelism: false,
    },
  };
}

// apps/ui is tested through the Angular unit-test builder (`ng test`), which also runs Vitest.
export default defineConfig({
  test: {
    projects: [
      nodeProject('domain', './packages/domain'),
      nodeProject('rules', './packages/rules'),
      nodeProject('scenarios', './packages/scenarios'),
      nodeProject('core', './apps/core'),
      nodeProject('stream', './apps/stream'),
      nodeProject('simulator', './apps/simulator'),
      integrationProject('core-integration', './apps/core'),
      integrationProject('stream-integration', './apps/stream'),
    ],
  },
});
