/// <reference types="vite/client" />

/*
 * Vite's ambient types, which is what teaches TypeScript about `?url` imports — the font
 * embedding in `export/font.ts` needs the *bytes* of a woff2, and `?url` is how a bundler
 * hands over a path to an asset it has fingerprinted rather than inlining it.
 *
 * `tsconfig.json` sets `types` explicitly, which switches off automatic `@types` discovery,
 * so this reference has to be written out rather than picked up.
 */
