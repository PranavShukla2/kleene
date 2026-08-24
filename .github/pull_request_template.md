<!--
  Thanks for this. A sentence on *why* is worth more than a list of what changed —
  the diff already says what changed.
-->

## What this does

## Why

<!--
  If it fixes an issue: "Fixes #123".
  If it changes an algorithm, say what the reasoning steps now look like — the trace is
  part of the output here, not a debug aid, and a step list that stopped making sense is
  a broken change even when the result is right.
-->

## Checks

- [ ] `./scripts/check.sh` passes
- [ ] Tests cover the change (unit, and a property test if it touches an algorithm)
- [ ] `./scripts/generate-types.sh` re-run and committed, if a type crossing the wasm
      boundary changed
- [ ] No AI-assistant trailers in the commit messages
