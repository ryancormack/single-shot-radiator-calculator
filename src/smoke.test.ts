/**
 * Task 11.2 - Smoke / static checks.
 *
 * These tests read the real project files from disk (no mocking) and assert
 * structural / deployment invariants that keep the app a single-shot, static,
 * offline-capable site that deploys correctly to a GitHub Pages subpath.
 *
 * Validates: Requirements 6.1, 6.2, 7.1, 7.2
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// The test file lives in <projectRoot>/src, so the project root is one level up.
// Resolve it robustly from this module's own URL rather than process.cwd().
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

/** Read a project-relative file as UTF-8 text. */
function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(PROJECT_ROOT, relativePath), 'utf-8');
}

describe('smoke / static checks (Task 11.2)', () => {
  describe('single HTML entry point (Requirement 6.2)', () => {
    const html = readProjectFile('index.html');

    it('index.html exists and is non-empty', () => {
      expect(html.trim().length).toBeGreaterThan(0);
    });

    it('contains exactly one <script type="module"> tag', () => {
      const moduleScripts = html.match(/<script\b[^>]*type=["']module["'][^>]*>/gi) ?? [];
      expect(moduleScripts.length).toBe(1);
    });

    it('the module script references src/main.ts', () => {
      const moduleScript = (html.match(/<script\b[^>]*type=["']module["'][^>]*>/i) ?? [])[0] ?? '';
      // Accept both "src/main.ts" and the leading-slash form "/src/main.ts".
      expect(moduleScript).toMatch(/src=["']\/?src\/main\.ts["']/);
    });

    it('contains the #form-root mount container', () => {
      expect(html).toMatch(/id=["']form-root["']/);
    });

    it('contains the #results-root mount container', () => {
      expect(html).toMatch(/id=["']results-root["']/);
    });
  });

  describe('no network calls in core/logic modules (Requirement 6.1)', () => {
    const logicModules = [
      'src/core/calculator.ts',
      'src/core/config.ts',
      'src/validation/validate.ts',
      'src/state/store.ts',
      'src/state/controller.ts',
    ];

    // Patterns that would indicate runtime network/remote access. `import(` is
    // matched as a dynamic import call, distinct from static `import ...` and
    // `import type ...` statements (which start with the `import` keyword
    // followed by whitespace, not a parenthesis).
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

  describe('Vite base path for GitHub Pages subpath (Requirement 7.2)', () => {
    const viteConfig = readProjectFile('vite.config.ts');

    it('sets base to "/single-shot-radiator-calculator/"', () => {
      expect(viteConfig).toMatch(
        /base\s*:\s*["']\/single-shot-radiator-calculator\/["']/,
      );
    });
  });

  describe('static build script (Requirement 7.1)', () => {
    const pkg = JSON.parse(readProjectFile('package.json')) as {
      scripts?: Record<string, string>;
    };

    it('has a "build" script', () => {
      expect(pkg.scripts).toBeDefined();
      expect(typeof pkg.scripts?.build).toBe('string');
    });

    it('the build script invokes "vite build"', () => {
      expect(pkg.scripts?.build).toMatch(/\bvite\s+build\b/);
    });
  });
});
