#!/usr/bin/env bash
# Generate the TypeScript types the web app consumes, from the Rust definitions.
#
# The generated files are committed, so building the web app never requires a Rust
# toolchain. CI re-runs this and fails on a diff — a generated file that has drifted from
# its source is worse than a hand-written one, because it carries a promise it is not
# keeping.
set -euo pipefail

cd "$(dirname "$0")/.."

# ts-rs resolves `export_to` relative to this, which is itself relative to the crate root.
export TS_RS_EXPORT_DIR="../../web/src/model"

cargo test --features ts -p kleene-core export_bindings -- --quiet
echo "Wrote web/src/model/generated/"
