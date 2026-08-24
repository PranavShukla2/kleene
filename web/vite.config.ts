import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// From vitest/config, not vite, so the `test` block below is typed rather than tolerated.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    /*
      Offline (Phase 5 Track A).

      Not a nice-to-have here: the entire product runs in the browser with no server, so
      "works offline" is the natural state of the thing and failing to work offline would be
      an accident of delivery rather than a limitation. A student on a train should be able to
      open it.

      `autoUpdate` would be wrong. The app holds unsaved work in IndexedDB, and a service
      worker that swapped itself under a half-drawn machine is a way to lose one. `prompt`
      hands the decision over — see `useUpdatePrompt`.
    */
    VitePWA({
      registerType: 'prompt',
      // Both are needed: the icons and manifest are static files the plugin does not know
      // about, and the wasm is fetched by a script rather than referenced from HTML.
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'og.png'],
      manifest: {
        name: 'Kleene — automata workbench',
        short_name: 'Kleene',
        description:
          'Draw a finite automaton, read it as a transition table, and watch a conversion happen one step at a time.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // From the palette, not picked here — `docs/PALETTE.md` §Surfaces. The dark value,
        // because a splash screen is chrome and chrome recedes.
        background_color: '#0f1117',
        theme_color: '#6d5ef8',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      workbox: {
        // The wasm is ~257 KB raw and the default cap is 2 MB, but elk's worker is 1.4 MB —
        // raising this is what stops the one file that makes layout work being left out of
        // the precache and quietly failing offline.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,wasm,woff,woff2,svg,png}'],
        // A deep link opened offline has to reach index.html, exactly as `_redirects` makes it
        // reach it online. Without this, /editor works and /tools/nfa-to-dfa does not.
        navigateFallback: '/index.html',
      },
    }),
  ],
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
