// @ts-check
import path from 'node:path';
import js from '@eslint/js';
import angular from 'angular-eslint';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const CONTROL_PATH_MODULES = [
  'decision',
  'risk',
  'policy',
  'interventions',
  'accounts',
  'transactions',
  'security-events',
  'alerts',
];
const CONTROL_PATH_FILE = new RegExp(
  `^apps/core/src/(modules/(${CONTROL_PATH_MODULES.join('|')})/|composition/control-path\\.composition\\.ts$)`,
);
const INTELLIGENCE_PATH_TARGET = /^apps\/core\/src\/(modules\/(intelligence|investigations)\/|infrastructure\/ai\/)/;
const AI_SDKS = ['@google/genai', '@google-cloud/vertexai', '@google-cloud/aiplatform'];
const GOOGLE_SDK = /^@google(-cloud)?\//;
const GENERIC_MODULE_NAMES = new Set(['utils', 'util', 'helpers', 'helper', 'common', 'misc', 'manager']);

/** @param {string | null} target */
function uiFeatureOf(target) {
  const match = target?.match(/^apps\/ui\/src\/app\/features\/([^/]+)(?:\/(.+))?$/);
  if (!match) return null;
  const rest = match[2];
  return { name: match[1], isPublicEntry: rest === undefined || /^index(\.ts|\.js)?$/.test(rest) };
}

/** Tests may import the test runner; production sources in a pure package may not. */
function isSpecImportingTestRunner(/** @type {string} */ file, /** @type {string} */ specifier) {
  return file.endsWith('.spec.ts') && specifier === 'vitest';
}

/** @param {string} repoPath */
function appOf(repoPath) {
  return repoPath.split('/')[1];
}

/**
 * Each boundary returns a reason when an import breaks it, otherwise null.
 * `target` is the repo-relative path of a relative import, or null for a package import.
 * @type {Array<{ appliesTo: (file: string) => boolean, check: (fact: { file: string, specifier: string, target: string | null }) => string | null }>}
 */
const BOUNDARIES = [
  {
    appliesTo: (file) => file.startsWith('packages/domain/src/'),
    check: ({ file, specifier, target }) => {
      if (isSpecImportingTestRunner(file, specifier)) return null;
      if (target === null) return 'packages/domain has zero dependencies.';
      return target.startsWith('packages/domain/') ? null : 'packages/domain never imports outside itself.';
    },
  },
  ...['rules', 'scenarios'].map((name) => ({
    appliesTo: (/** @type {string} */ file) => file.startsWith(`packages/${name}/src/`),
    check: (/** @type {{ file: string, specifier: string, target: string | null }} */ { file, specifier, target }) => {
      if (isSpecImportingTestRunner(file, specifier)) return null;
      if (target === null) {
        return specifier === '@sentinel/domain' ? null : `packages/${name} depends only on @sentinel/domain (pure, zero I/O).`;
      }
      return target.startsWith(`packages/${name}/`) ? null : `packages/${name} never imports outside itself.`;
    },
  })),
  {
    appliesTo: (file) => file.startsWith('apps/'),
    check: ({ file, target }) =>
      target?.startsWith('apps/') && appOf(target) !== appOf(file)
        ? 'Apps never import another app; share contracts through @sentinel/domain.'
        : null,
  },
  {
    appliesTo: (file) => file.startsWith('apps/core/src/') && !file.startsWith('apps/core/src/infrastructure/'),
    check: ({ specifier }) =>
      specifier === 'mongodb' || specifier === 'google-auth-library' || GOOGLE_SDK.test(specifier)
        ? 'Database and Google SDKs are confined to apps/core/src/infrastructure.'
        : null,
  },
  {
    appliesTo: (file) => /^apps\/core\/src\/modules\/[^/]+\/application\//.test(file),
    check: ({ specifier, target }) => {
      if (target && /^apps\/core\/src\/(infrastructure|composition|api)\//.test(target)) {
        return 'Application code depends on ports, never on infrastructure, composition or HTTP.';
      }
      if (target && /^apps\/core\/src\/modules\/[^/]+\/presentation\//.test(target)) {
        return 'Application code never depends on presentation.';
      }
      return ['express', 'pino', 'ws'].includes(specifier) ? 'Application code is framework-free.' : null;
    },
  },
  {
    appliesTo: (file) => CONTROL_PATH_FILE.test(file),
    check: ({ specifier, target }) => {
      if (AI_SDKS.includes(specifier)) return 'The control path never reaches a language model.';
      return target && INTELLIGENCE_PATH_TARGET.test(target)
        ? 'The control path never imports the intelligence path (Rules decide. AI explains.).'
        : null;
    },
  },
  {
    appliesTo: (file) => file.startsWith('apps/stream/src/'),
    check: ({ specifier }) =>
      specifier === '@sentinel/rules' || specifier === '@sentinel/scenarios' || GOOGLE_SDK.test(specifier)
        ? 'sentinel-stream is transport only: no rules, scenarios or Google SDKs.'
        : null,
  },
  {
    appliesTo: (file) => file.startsWith('apps/stream/src/') && !/^apps\/stream\/src\/(change-stream|snapshot)\//.test(file),
    check: ({ specifier }) =>
      specifier === 'mongodb' ? 'In sentinel-stream the MongoDB driver is confined to change-stream/ and snapshot/.' : null,
  },
  {
    appliesTo: (file) => file.startsWith('apps/simulator/src/'),
    check: ({ specifier }) =>
      specifier === '@sentinel/rules' ? 'The simulator plays the bank; it never scores transactions.' : null,
  },
  {
    appliesTo: (file) => file.startsWith('apps/simulator/src/') && !file.startsWith('apps/simulator/src/pubsub-publisher/'),
    check: ({ specifier }) =>
      GOOGLE_SDK.test(specifier) ? 'In the simulator, Google SDKs are confined to pubsub-publisher/.' : null,
  },
  {
    appliesTo: (file) => file.startsWith('apps/ui/src/'),
    check: ({ specifier }) =>
      ['mongodb', 'express', 'ws', 'pino', 'google-auth-library', '@sentinel/scenarios'].includes(specifier) || GOOGLE_SDK.test(specifier)
        ? 'The browser never holds database drivers, server frameworks, scenarios or Google SDKs.'
        : null,
  },
  {
    appliesTo: (file) => /^apps\/ui\/src\/app\/(core|shared|state|design-system|workers)\//.test(file),
    check: ({ target }) =>
      uiFeatureOf(target) ? 'core/, shared/, state/, design-system/ and workers/ never depend on features.' : null,
  },
  {
    appliesTo: (file) => file.startsWith('apps/ui/src/app/'),
    check: ({ file, target }) => {
      const targetFeature = uiFeatureOf(target);
      if (!targetFeature || uiFeatureOf(file)?.name === targetFeature.name || targetFeature.isPublicEntry) return null;
      return `Import feature "${targetFeature.name}" through its index.ts; deep imports are forbidden.`;
    },
  },
];

/** @param {import('eslint').Rule.RuleContext} context */
function repoPathOf(context) {
  return path.relative(context.cwd, context.filename).split(path.sep).join('/');
}

/** @type {import('eslint').ESLint.Plugin} */
const sentinelArchitecture = {
  rules: {
    'import-boundaries': {
      meta: { type: 'problem', schema: [], messages: { violation: '{{reason}}' } },
      create(context) {
        const file = repoPathOf(context);
        const boundaries = BOUNDARIES.filter((boundary) => boundary.appliesTo(file));
        if (boundaries.length === 0) return {};
        /** @param {any} source */
        const inspect = (source) => {
          if (source?.type !== 'Literal' || typeof source.value !== 'string') return;
          const specifier = source.value;
          const target = specifier.startsWith('.')
            ? path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
            : null;
          for (const boundary of boundaries) {
            const reason = boundary.check({ file, specifier, target });
            if (reason) context.report({ node: source, messageId: 'violation', data: { reason } });
          }
        };
        return {
          ImportDeclaration: (node) => inspect(node.source),
          ExportNamedDeclaration: (node) => inspect(node.source),
          ExportAllDeclaration: (node) => inspect(node.source),
          ImportExpression: (node) => inspect(node.source),
        };
      },
    },
    'no-generic-module-names': {
      meta: {
        type: 'suggestion',
        schema: [],
        messages: { generic: 'Name modules by capability; "{{name}}" becomes a dumping ground.' },
      },
      create(context) {
        const name = path.basename(context.filename).split('.')[0] ?? '';
        return {
          Program: (node) => {
            if (GENERIC_MODULE_NAMES.has(name)) context.report({ node, messageId: 'generic', data: { name } });
          },
        };
      },
    },
  },
};

export default defineConfig(
  {
    ignores: ['**/dist/**', '**/.angular/**', '**/node_modules/**', '**/coverage/**', 'docs/**'],
  },
  {
    files: ['**/*.{js,ts}'],
    extends: [js.configs.recommended],
  },
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommended],
    plugins: { sentinel: sentinelArchitecture },
    rules: {
      'sentinel/import-boundaries': 'error',
      'sentinel/no-generic-module-names': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      // Express recognises error handlers by arity; `{ _id, ...rest }` strips storage fields.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    files: ['apps/ui/src/**/*.ts'],
    extends: [angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'sentinel', style: 'kebab-case' }],
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'sentinel', style: 'camelCase' }],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
    },
  },
  {
    files: ['apps/ui/src/app/**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
  },
);
