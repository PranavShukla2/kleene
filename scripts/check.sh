#!/usr/bin/env bash
# Everything CI checks, in the order CI checks it.
#
# Exists because CI went red for four commits without being noticed: local verification was
# thorough but partial — cargo fmt was skipped after a run of Rust edits, and nothing caught
# it until the failure was several commits old. One command that runs the whole gate is
# harder to do half of.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== rust =="
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace --quiet

echo "== generated bindings =="
./scripts/generate-types.sh >/dev/null
git diff --exit-code -- web/src/model/generated \
  || { echo "Generated types are stale. Commit the regenerated files."; exit 1; }

echo "== generated docs =="
./scripts/generate-docs.sh >/dev/null
git diff --exit-code -- docs/algorithms \
  || { echo "The algorithm pages no longer match what the algorithms print. Commit them."; exit 1; }

echo "== wasm =="
wasm-pack build crates/kleene-wasm --target web --out-dir pkg --release >/dev/null 2>&1
node scripts/check-wasm-size.mjs

echo "== web =="
cd web
npx eslint .
npx prettier --check . >/dev/null
npx tsc -b --noEmit
npx vitest run --silent 2>&1 | tail -3

echo
echo "All checks passed."
