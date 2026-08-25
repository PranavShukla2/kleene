#!/usr/bin/env python3
"""Refuse two exported Rust types that would land in one TypeScript file.

ts-rs writes one file per type *name*, ignoring the module it came from. Two types called
`Verdict` therefore produce one `Verdict.ts`, and whichever runs second wins — silently. The
failure has no error message and no stack trace: the type is simply absent from TypeScript.

Run from the repository root by `scripts/generate-types.sh`.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CORE = ROOT / "crates" / "kleene-core" / "src"

# A type is exported when its declaration carries a ts-rs `export` attribute. Matching the
# attribute rather than every struct keeps this to the types that can actually collide.
DECLARATION = re.compile(
    r'ts\(export[^)]*\)\s*\)\s*\]\s*(?:#\[[^\]]*\]\s*)*pub\s+(?:struct|enum)\s+(\w+)',
    re.MULTILINE,
)


def exported_names() -> dict[str, list[str]]:
    found: dict[str, list[str]] = {}
    for path in CORE.rglob("*.rs"):
        text = path.read_text(encoding="utf-8")
        for name in DECLARATION.findall(text):
            found.setdefault(name, []).append(str(path.relative_to(ROOT)))
    return found


def main() -> int:
    clashes = {name: where for name, where in exported_names().items() if len(where) > 1}
    if not clashes:
        return 0

    print("Two Rust types share a name and both export to TypeScript:", file=sys.stderr)
    for name, where in sorted(clashes.items()):
        print(f"  {name}: {', '.join(where)}", file=sys.stderr)
    print(
        "\nts-rs writes one file per type name, so one of them silently does not exist.\n"
        "Rename one — see the note on `Cut` in crates/kleene-core/src/teach/pumping.rs.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
