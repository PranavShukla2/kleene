#!/usr/bin/env bash
# Generate the algorithm pages from the algorithms.
#
# Every step in `docs/algorithms/` is a sentence the implementation produced while running on a
# real machine — not prose written about it. The pages are committed and CI diffs them, the
# same arrangement as the generated TypeScript, and for the same reason: a generated file that
# has drifted from its source is worse than a hand-written one, because it carries a promise it
# is not keeping.
#
# This is also the only place the architecture's central claim is checkable from outside. One
# implementation serves the browser's step-through, the CLI's verbose mode and these pages; if
# that stopped being true, this diff is where it would show.
set -euo pipefail

cd "$(dirname "$0")/.."

cargo run -q -p kleene-core --example algorithms
