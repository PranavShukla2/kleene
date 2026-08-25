/**
 * `/tools/<slug>` — one page per task (roadmap §6.1).
 *
 * Someone with a conversion to do does not search for an automata workbench. They search for
 * "nfa to dfa converter", and they arrive wanting one thing done. So the shape of this page is
 * the opposite of the landing page's: the tool is first, above the fold, already running on a
 * worked example — and the explanation is underneath, for the half of visitors who got the
 * answer and now want to know why.
 *
 * The converter here is the real one. There is no lightweight embed, because a lightweight
 * embed is a second implementation of the thing this whole project exists to have exactly one
 * of.
 */

import { Convert } from '@/convert/Convert';
import { Lift, Reveal, RevealGroup, RevealItem } from '@/site/motion';
import { Band, BandHeading } from '@/site/page';
import { TOOLS, type Tool as ToolSpec } from '@/site/tools';
import { toolPath } from '@/router';
import type { Automaton } from '@/model/automaton';
import type { Engine } from '@/wasm/loader';
import type { Route } from '@/router';

export function Tool({
  tool,
  engine,
  onNavigate,
  onOpenTool,
  onOpenInEditor,
}: {
  tool: ToolSpec;
  engine: Engine | undefined;
  onNavigate: (to: Route, search?: string) => void;
  /** Go to another tool page. Parameterised routes cannot be reached through `onNavigate`. */
  onOpenTool: (path: string) => void;
  onOpenInEditor: (automaton: Automaton) => void;
}) {
  return (
    <main>
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="k-aurora pointer-events-none absolute inset-x-0 -top-32 h-[26rem] opacity-70"
        />
        <div className="relative mx-auto w-full max-w-6xl px-6 pt-16 pb-2">
          <Reveal>
            <span className="font-mono text-xs tracking-wider text-k-primary uppercase">
              Free tool · nothing uploaded
            </span>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              {tool.title}
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-k-text-muted">
              {tool.tagline}
            </p>
          </Reveal>
        </div>
      </section>

      {/*
        The converter, immediately. Everything a landing page would put here — the pitch, the
        features, the proof — is below, because the visitor already decided by searching.
      */}
      {/*
        No key needed: the shell keys the whole page on the location, so moving between tool
        pages remounts this along with everything else. It did not always — that was the bug
        where the URL changed and the page did not.
      */}
      <Convert
        engine={engine}
        onOpenInEditor={onOpenInEditor}
        embedded={{ source: tool.example, panes: tool.panes, elimination: tool.elimination }}
      />

      <Band>
        <BandHeading title="How it works" />
        <Reveal delay={0.05}>
          <div className="mt-6 max-w-3xl space-y-4">
            {tool.detail.map((paragraph) => (
              <p key={paragraph} className="leading-relaxed text-k-text-muted">
                {paragraph}
              </p>
            ))}
          </div>
        </Reveal>
      </Band>

      <Band>
        <BandHeading title="Questions people have on this page" />
        <RevealGroup className="mt-6 grid gap-4 lg:grid-cols-2">
          {tool.faq.map((entry) => (
            <RevealItem
              key={entry.question}
              className="rounded-2xl border border-k-border bg-k-surface p-6"
            >
              <h3 className="font-medium tracking-tight">{entry.question}</h3>
              <p className="mt-2 text-sm leading-relaxed text-k-text-muted">{entry.answer}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </Band>

      <Band>
        <BandHeading
          title="The other conversions"
          detail="Same engine, same traces — a different question."
        />
        <RevealGroup className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.filter((other) => other.slug !== tool.slug).map((other) => (
            <RevealItem key={other.slug}>
              <a
                href={toolPath(other.slug)}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
                    return;
                  }
                  event.preventDefault();
                  onOpenTool(toolPath(other.slug));
                }}
                className="k-card k-spotlight block h-full rounded-2xl border border-k-border bg-k-surface p-5 hover:border-k-primary/40"
              >
                <span className="font-medium tracking-tight">{other.title}</span>
                <span className="mt-1 block text-sm text-k-text-muted">{other.tagline}</span>
              </a>
            </RevealItem>
          ))}
        </RevealGroup>
      </Band>

      <Band>
        <div className="relative overflow-hidden rounded-3xl border border-k-border p-8 text-center sm:p-12">
          <div
            aria-hidden
            className="k-aurora pointer-events-none absolute inset-0 opacity-50"
          />
          <div className="relative">
            <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              This is one page of a whole workbench
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-k-text-muted">
              Draw machines by hand, run strings through them a symbol at a time, and read any
              of it as a transition table or a 5-tuple. Free, no account, nothing uploaded.
            </p>
            <Lift className="mt-7 inline-block">
              <button
                type="button"
                onClick={() => {
                  onNavigate('editor');
                }}
                className="k-glow rounded-full bg-k-primary px-6 py-3 font-medium text-white"
              >
                Open the editor →
              </button>
            </Lift>
          </div>
        </div>
      </Band>
    </main>
  );
}
