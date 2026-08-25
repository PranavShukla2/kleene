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

# Refuse two Rust types that would write to one TypeScript file.
#
# ts-rs names the file after the type, so `teach::Verdict` and `simulate::Verdict` both produce
# `Verdict.ts` — and the second silently overwrites the first, or loses to it, depending on
# generation order. No error anywhere. The type simply does not exist in TypeScript, and the
# first sign is a compile failure somewhere unrelated, or none at all when the two happen to
# have the same shape.
#
# This has happened four times here: Verdict, Tier, Split, and Dock/dock before them. Four is
# enough to spend twenty lines on.
python3 scripts/check-type-names.py

echo "Wrote web/src/model/generated/"
