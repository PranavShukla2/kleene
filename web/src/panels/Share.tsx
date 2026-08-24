/**
 * The share link (Phase 4 Track F).
 *
 * A machine in a URL, and the whole distribution story for this project: a lecturer pastes a
 * link into slides, a student pastes one into a message, and neither needs an account or a
 * server that kept anything.
 *
 * ## Why the length is on screen (task F4)
 *
 * Because there is a limit, and a limit that only announces itself at the moment of failure is
 * a trap. The count is always visible, so the fallback is never a surprise — by the time a
 * machine is too big to link, its author has watched the number climb towards the ceiling.
 */

import { useEffect, useState } from 'react';

import { Panel } from '@/panels/Alphabet';
import { encode, linkFor, LINK_LIMIT } from '@/store/share';
import type { Document } from '@/model/automaton';

/** How long the copy button stays acknowledged. */
const COPIED_MS = 1600;

export function SharePanel({
  document,
  onSaveInstead,
}: {
  document: Document;
  /** What to do when the machine is too large to put in a link. */
  onSaveInstead: () => void;
}) {
  const [link, setLink] = useState<string | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  /*
    Encoding is async — `CompressionStream` is a stream — so the link is state rather than a
    derived value. `live` guards the write: a machine being edited re-encodes on every
    keystroke, and without it a slow encode from three edits ago could land last and show a
    link for a machine that no longer exists.
  */
  useEffect(() => {
    let live = true;
    void encode(document).then(
      (payload) => {
        if (live) setLink(linkFor(payload));
      },
      () => {
        if (live) setLink(undefined);
      },
    );
    return () => {
      live = false;
    };
  }, [document]);

  if (document.automaton.states.length === 0) {
    return (
      <Panel title="Share">
        <p className="text-sm text-k-text-faint">
          Draw a machine and it fits in a link — nothing is uploaded, because the part after the
          <span className="font-mono"> # </span> never reaches a server.
        </p>
      </Panel>
    );
  }

  if (!link) {
    return (
      <Panel title="Share">
        <p className="text-sm text-k-text-faint">Building a link…</p>
      </Panel>
    );
  }

  const tooLong = link.length > LINK_LIMIT;

  return (
    <Panel title="Share">
      <div className="flex items-center gap-2">
        <span
          className={`font-mono text-[10px] tabular-nums ${
            tooLong ? 'text-k-error' : 'text-k-text-faint'
          }`}
        >
          {link.length.toLocaleString()} / {LINK_LIMIT.toLocaleString()}
        </span>

        {!tooLong && (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(link).then(
                () => {
                  setCopied(true);
                  setTimeout(() => {
                    setCopied(false);
                  }, COPIED_MS);
                },
                () => undefined,
              );
            }}
            className={`ml-auto rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors duration-(--duration-k-hover) ${
              copied
                ? 'border-k-success/40 bg-k-success/10 text-k-success'
                : 'border-k-border text-k-text-muted hover:border-k-border-strong hover:text-k-text'
            }`}
          >
            {copied ? 'copied ✓' : 'copy link'}
          </button>
        )}
      </div>

      {/*
        A meter as well as a number. "6,200 of 8,000" is precise and takes a moment to picture;
        a bar takes none, and the two together are read faster than either.
      */}
      <div
        className="mt-2 h-1 overflow-hidden rounded-full bg-k-border"
        role="img"
        aria-label={`Link length: ${String(link.length)} of ${String(LINK_LIMIT)} characters`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-(--duration-k-panel) ${
            tooLong ? 'bg-k-error' : 'bg-k-primary'
          }`}
          style={{ width: `${String(Math.min(100, (link.length / LINK_LIMIT) * 100))}%` }}
        />
      </div>

      {tooLong ? (
        /*
          Task F3. Above the limit the answer is a file, not a link nobody can click — mail
          clients wrap a URL this long, chat apps truncate it, and a PDF splits it across lines.
        */
        <div className="mt-2 text-[11px] leading-relaxed text-k-text-muted">
          <p>
            This machine is too big for a link that survives being pasted. Send the file instead
            — it holds exactly the same thing.
          </p>
          <button
            type="button"
            onClick={onSaveInstead}
            className="mt-2 rounded-full bg-k-primary px-3 py-1 text-xs font-medium text-white"
          >
            Save as .kln
          </button>
        </div>
      ) : (
        <p className="mt-2 text-[11px] leading-relaxed text-k-text-faint">
          The machine travels in the part after the <span className="font-mono">#</span>, which
          browsers never send to a server. Nothing is uploaded and nothing is stored.
        </p>
      )}
    </Panel>
  );
}
