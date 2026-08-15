import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
// From vitest/config, not vite, so the `test` block below is typed rather than tolerated.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The wasm bindings are generated, never committed, and live outside this
      // package. Aliasing them keeps that fact in one place instead of scattering
      // '../../crates/...' across imports.
      '@wasm': fileURLToPath(new URL('../crates/kleene-wasm/pkg', import.meta.url)),
    },
  },
  server: {
    // wasm-pack writes into a sibling directory of the Vite root.
    fs: { allow: ['..'] },
  },
  build: {
    target: 'es2022',
    // The landing page must paint before a 400 KB wasm module arrives, so the
    // engine is deliberately split out rather than inlined into the entry chunk.
    rollupOptions: {
      output: {
        manualChunks: { react: ['react', 'react-dom'] },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
