#!/usr/bin/env node
/**
 * Enforce the WebAssembly size budget from roadmap §3.2.
 *
 * Prints the current size on *every* run, not only on failure. A budget you only hear about
 * once it is already blown tells you nothing about the trend that got you there — by then
 * the cause is spread across twenty commits. Seeing the number move is what makes it
 * possible to attribute a jump to the change that caused it.
 */

import { gzipSync } from 'node:zlib';
import { readFileSync, statSync } from 'node:fs';

const BUDGET_BYTES = 400 * 1024;
const WASM = new URL('../crates/kleene-wasm/pkg/kleene_wasm_bg.wasm', import.meta.url);

function kib(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

let raw;
try {
  raw = readFileSync(WASM);
} catch {
  console.error(`✗ No wasm artifact at ${WASM.pathname}`);
  console.error('  Run: wasm-pack build crates/kleene-wasm --target web --out-dir pkg --release');
  process.exit(1);
}

const gzipped = gzipSync(raw, { level: 9 }).length;
const used = ((gzipped / BUDGET_BYTES) * 100).toFixed(1);

console.log(`wasm  raw ${kib(statSync(WASM).size)}  gzipped ${kib(gzipped)}`);
console.log(`budget ${kib(BUDGET_BYTES)} gzipped — ${used}% used`);

if (gzipped > BUDGET_BYTES) {
  console.error(`\n✗ Over budget by ${kib(gzipped - BUDGET_BYTES)}.`);
  console.error('  Traces cross this boundary in bulk; check for cloned automata in Step payloads.');
  process.exit(1);
}

console.log(`✓ ${kib(BUDGET_BYTES - gzipped)} of headroom`);
