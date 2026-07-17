/**
 * Smoke / static checks for the Air Conditioning Calculator.
 *
 * These tests read the real project files from disk (no mocking) and assert
 * structural / deployment invariants that keep the cooling calculator a static,
 * offline-capable feature that deploys correctly to the GitHub Pages subpath.
 *
 * Validates: Requirements 8.1, 8.2, 9.1, 9.2
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(PROJECT_ROOT, relativePath), 'utf-8');
}

describe('cooling smoke / static checks', () => {
  describe('cooling mount containers in index.html (Requirement 8.1)', () => {
    const html = readProjectFile('index.html');

    it('contains the #cooling-form-root mount container', () => {
      expect(html).toMatch(/id=["']cooling-form-root["']/);
    });

    it('contains the #cooling-results-root mount container', () => {
      expect(html).toMatch(/id=["']cooling-results-root["']/);
    });

    it('still contains the heating mount containers (both calculators coexist)', () => {
      expect(html).toMatch(/id=["']form-root["']/);
      expect(html).toMatch(/id=["']results-root["']/);
    });

    it('references air conditioning in the page copy', () => {
      expect(html.toLowerCase()).toContain('air conditioning');
    });
  });

  describe('no network access in cooling logic modules (Requirements 8.1, 8.2)', () => {
    const logicModules = [
      'src/core/coolingCalculator.ts',
      'src/core/coolingConfig.ts',
      'src/core/coolingTypes.ts',
      'src/validation/coolingValidate.ts',
      'src/state/coolingStore.ts',
      'src/state/coolingController.ts',
    ];

    // Patterns that would indicate runtime network/remote access. `import(` is
    // matched as a dynamic import call, distinct from static `import ...` and
    // `import type ...` statements. This mirrors the existing `smoke.test.ts`.
    const forbiddenPatterns: { name: string; regex: RegExp }[] = [
      { name: 'fetch(', regex: /\bfetch\s*\(/ },
      { name: 'XMLHttpRequest', regex: /\bXMLHttpRequest\b/ },
      { name: 'WebSocket', regex: /\bWebSocket\b/ },
      { name: 'dynamic import()', regex: /\bimport\s*\(/ },
    ];

    for (const modulePath of logicModules) {
      describe(modulePath, () => {
        const source = readProjectFile(modulePath);

        for (const { name, regex } of forbiddenPatterns) {
          it(`does not use ${name}`, () => {
            expect(regex.test(source)).toBe(false);
          });
        }
      });
    }
  });

  describe('cooling core + validation are free of DOM access (Requirement 8.2)', () => {
    // Only the pure calculation core and validation layer must be DOM-free; the
    // state modules describe themselves as pure-of-DOM in prose, so they are
    // excluded here to avoid matching comment text. Comments are stripped before
    // matching so JSDoc references to "document"/"window" do not cause false
    // positives.
    const pureModules = [
      'src/core/coolingCalculator.ts',
      'src/core/coolingConfig.ts',
      'src/core/coolingTypes.ts',
      'src/validation/coolingValidate.ts',
    ];

    /** Remove block and line comments so prose does not trip the checks. */
    function stripComments(source: string): string {
      return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
    }

    const domPatterns: { name: string; regex: RegExp }[] = [
      { name: 'document', regex: /\bdocument\b/ },
      { name: 'window', regex: /\bwindow\b/ },
    ];

    for (const modulePath of pureModules) {
      describe(modulePath, () => {
        const code = stripComments(readProjectFile(modulePath));
        for (const { name, regex } of domPatterns) {
          it(`does not access ${name}`, () => {
            expect(regex.test(code)).toBe(false);
          });
        }
      });
    }
  });

  describe('main.ts wires the cooling calculator (Requirement 8.1)', () => {
    const main = readProjectFile('src/main.ts');

    it('imports and creates the cooling store and controller', () => {
      expect(main).toContain('createCoolingStore');
      expect(main).toContain('createCoolingController');
    });

    it('renders the cooling form and results', () => {
      expect(main).toContain('renderCoolingForm');
      expect(main).toContain('renderCoolingResults');
    });
  });

  describe('static build + GitHub Pages base path (Requirements 9.1, 9.2)', () => {
    it('the build script invokes "vite build"', () => {
      const pkg = JSON.parse(readProjectFile('package.json')) as {
        scripts?: Record<string, string>;
      };
      expect(pkg.scripts?.build).toMatch(/\bvite\s+build\b/);
    });

    it('sets the Vite base to the GitHub Pages project subpath', () => {
      const viteConfig = readProjectFile('vite.config.ts');
      expect(viteConfig).toMatch(
        /base\s*:\s*["']\/single-shot-radiator-calculator\/["']/,
      );
    });
  });
});
