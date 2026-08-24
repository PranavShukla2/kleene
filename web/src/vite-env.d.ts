/// <reference types="vite/client" />

/*
 * Vite's ambient types, which is what teaches TypeScript about `?url` imports — the font
 * embedding in `export/font.ts` needs the *bytes* of a woff2, and `?url` is how a bundler
 * hands over a path to an asset it has fingerprinted rather than inlining it.
 *
 * `tsconfig.json` sets `types` explicitly, which switches off automatic `@types` discovery,
 * so this reference has to be written out rather than picked up.
 */
/// <reference types="vite-plugin-pwa/react" />

/*
 * `virtual:pwa-register/react` is a module the plugin synthesises at build time, so there is
 * no file for TypeScript to find and no package to install types from. This reference is what
 * makes `useRegisterSW` typed rather than `any`.
 */
