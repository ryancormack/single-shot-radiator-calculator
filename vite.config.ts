/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// GitHub Pages serves project sites from a subpath
// (https://<owner>.github.io/<repo>/), so `base` must be set to the repository
// name for hashed asset URLs to resolve without 404s (Requirement 7.2).
export default defineConfig({
  base: '/single-shot-radiator-calculator/',
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
