/**
 * Compiling as you type, without recompiling on every keystroke.
 *
 * The debounce is in `regex.ts` with the reason it exists; this is the wiring. Nothing else
 * here is clever, which is the point — the compile itself is one wasm call, and everything
 * that could go wrong is about *when* it is made rather than what it does.
 */

import { useEffect, useState } from 'react';

import { COMPILE_DEBOUNCE_MS } from '@/convert/regex';
import type { Compilation } from '@/model/automaton';
import type { Engine } from '@/wasm/loader';

export function useCompiler(
  engine: Engine | undefined,
  source: string,
): Compilation | undefined {
  const [compilation, setCompilation] = useState<Compilation | undefined>(undefined);

  useEffect(() => {
    if (!engine || source.trim() === '') return;

    const timer = setTimeout(() => {
      setCompilation(engine.compileRegex(source));
    }, COMPILE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [engine, source]);

  // An empty bar is *derived*, not stored. Clearing it through state would mean a setState
  // inside the effect — a second render for something already knowable from the input — and
  // would leave a window where the input reads empty while the last diagram is still on
  // screen. That kind of small lie is what makes someone doubt everything else a page says.
  return source.trim() === '' ? undefined : compilation;
}
