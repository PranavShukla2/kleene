/**
 * The pumping lemma game (teaching layer Track E).
 *
 * The page is laid out as the lemma is written, because that is the whole idea: each move sits
 * under the quantifier that produces it, so playing the game and reading the statement are the
 * same activity rather than two things a student has to connect.
 *
 * > **for every** n · **there exists** w · **for every** split · **there exists** i
 *
 * The machine takes the "for every" moves and the student takes the "there exists" ones, which
 * is not an arbitrary division — it is what those quantifiers *mean*. A student who wins has
 * built a proof by contradiction, and the panel at the end prints it back as one.
 *
 * ## Losing is a feature
 *
 * Two of the languages are regular, and against those no choice wins. That is the lemma's
 * actual shape: it proves non-regularity and cannot prove regularity. Being unable to win, and
 * then being told why, teaches that faster than any sentence about it.
 */

import { useMemo, useState } from 'react';

import { Pill } from '@/site/Badge';
import { Lift, Reveal } from '@/site/motion';
import { Band, Masthead } from '@/site/page';
import type { Cut, Illegal, Round } from '@/model/automaton';
import type { Engine } from '@/wasm/loader';

/** Where a round has got to. */
type Phase =
  | { at: 'choosing-word' }
  | { at: 'choosing-i'; word: string; cut: Cut }
  | { at: 'done'; word: string; cut: Cut; round: Round; proof: string };

/** The machine's pumping length. Fixed rather than random, so a game is reproducible. */
const N = 4;

function illegalText(illegal: Illegal): string {
  switch (illegal.kind) {
    case 'too-short':
      return `|w| must be at least n. That word is ${String(illegal.given)} symbols and n is ${String(illegal.needed)}.`;
    case 'not-in-language':
      return 'That word is not in L. The lemma only says anything about words that are — choosing one outside L proves nothing, and it is the commonest way this argument goes wrong.';
    case 'wrong-alphabet':
      return 'That word uses symbols this language does not have.';
  }
}

export function Pumping({ engine }: { engine: Engine | undefined }) {
  const languages = useMemo(() => engine?.pumpingLanguages() ?? [], [engine]);
  const [languageId, setLanguageId] = useState<string | undefined>(undefined);
  const [word, setWord] = useState('');
  const [phase, setPhase] = useState<Phase>({ at: 'choosing-word' });
  const [refused, setRefused] = useState<string | undefined>(undefined);

  const language = languages.find((entry) => entry.id === languageId) ?? languages[0];

  const reset = (id?: string) => {
    if (id) setLanguageId(id);
    setWord('');
    setRefused(undefined);
    setPhase({ at: 'choosing-word' });
  };

  const submitWord = () => {
    if (!engine || !language) return;
    const illegal = engine.pumpingCheckWord(language.id, word, N);
    if (illegal) {
      setRefused(illegalText(illegal));
      return;
    }
    const cut = engine.pumpingCut(language.id, word, N);
    if (!cut) {
      setRefused(
        'No legal split exists for that word, which should not happen — please report it.',
      );
      return;
    }
    setRefused(undefined);
    setPhase({ at: 'choosing-i', word, cut });
  };

  const submitI = (i: number) => {
    if (!engine || !language || phase.at !== 'choosing-i') return;
    const { round, proof } = engine.pumpingSettle(language.id, N, phase.word, phase.cut, i);
    setPhase({ at: 'done', word: phase.word, cut: phase.cut, round, proof });
  };

  return (
    <main>
      <Masthead
        eyebrow="The pumping lemma"
        title="It is a game. Play it as one."
        detail="The lemma alternates quantifiers, and alternating quantifiers are a game: the adversary picks n, you pick w, the adversary splits it, you pick i. Win and you have written a proof by contradiction — not something shaped like one."
      />

      <Band>
        <Reveal>
          <div className="flex flex-wrap items-center gap-2">
            {languages.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  reset(entry.id);
                }}
                className={`rounded-full border px-3 py-1.5 font-mono text-xs transition-colors duration-(--duration-k-hover) ${
                  entry.id === language?.id
                    ? 'border-k-primary bg-k-primary/10 text-k-text'
                    : 'border-k-border text-k-text-muted hover:border-k-border-strong'
                }`}
              >
                {entry.notation}
              </button>
            ))}
          </div>
        </Reveal>
      </Band>

      <Band>
        <div className="space-y-4">
          {/* Move one: the machine's n. Stated rather than asked, because "for every n" means
              the adversary gets to choose it and the student does not. */}
          <Reveal>
            <Move
              quantifier="for every n"
              who="adversary"
              done
              detail={
                <>
                  Suppose L is regular. Then it has a pumping length; the adversary picks{' '}
                  <strong>n = {N}</strong>.
                </>
              }
            />
          </Reveal>

          <Reveal delay={0.04}>
            <Move
              quantifier="there exists w"
              who="you"
              done={phase.at !== 'choosing-word'}
              detail={
                phase.at === 'choosing-word' ? (
                  <div className="space-y-3">
                    <p>
                      Choose a word in L with |w| ≥ {N}. Choose it well: you only get to make
                      this choice once, and every split of it has to fail.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={word}
                        onChange={(event) => {
                          setWord(event.target.value);
                          setRefused(undefined);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') submitWord();
                        }}
                        placeholder="aaaabbbb"
                        aria-label="Your choice of w"
                        className="min-w-40 rounded-lg border border-k-border bg-k-surface-raised px-3 py-1.5 font-mono text-sm outline-none focus:border-k-primary"
                      />
                      <Lift>
                        <button
                          type="button"
                          onClick={submitWord}
                          disabled={word.length === 0}
                          className="rounded-full bg-k-primary px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                        >
                          Play w
                        </button>
                      </Lift>
                    </div>
                    {refused && (
                      <p role="alert" className="text-sm text-k-error">
                        {refused}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    You chose <code className="font-mono">{phase.word}</code>.
                  </>
                )
              }
            />
          </Reveal>

          {phase.at !== 'choosing-word' && (
            <Reveal delay={0.08}>
              <Move
                quantifier="for every split w = xyz"
                who="adversary"
                done
                detail={
                  <>
                    With |xy| ≤ {N} and |y| ≥ 1, the adversary chooses the split hardest for
                    you:{' '}
                    <code className="font-mono">
                      x={phase.cut.x || 'ε'} · y={phase.cut.y} · z={phase.cut.z || 'ε'}
                    </code>
                    .
                  </>
                }
              />
            </Reveal>
          )}

          {phase.at === 'choosing-i' && (
            <Reveal delay={0.12}>
              <Move
                quantifier="there exists i"
                who="you"
                detail={
                  <div className="space-y-3">
                    <p>
                      Pick an exponent. You win if <code className="font-mono">xyⁱz</code> is
                      not in L.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <Lift key={i}>
                          <button
                            type="button"
                            onClick={() => {
                              submitI(i);
                            }}
                            className="rounded-full border border-k-border-strong bg-k-surface-raised px-4 py-1.5 font-mono text-sm"
                          >
                            i = {i}
                          </button>
                        </Lift>
                      ))}
                    </div>
                  </div>
                }
              />
            </Reveal>
          )}

          {phase.at === 'done' && (
            <Reveal delay={0.12}>
              <div
                role="status"
                className={`rounded-2xl border p-5 ${
                  phase.round.won
                    ? 'border-k-accepting/40 bg-k-accepting/10'
                    : 'border-k-border-strong bg-k-surface-raised'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">
                    {phase.round.won ? 'You win — L is not regular.' : 'The split survived.'}
                  </h3>
                  {language?.regular && !phase.round.won && (
                    <Pill tone="soon">L is regular</Pill>
                  )}
                </div>

                <p className="mt-2 text-sm text-k-text-muted">
                  xy<sup>{phase.round.i}</sup>z ={' '}
                  <code className="font-mono text-k-text">{phase.round.pumped || 'ε'}</code>,
                  which is {phase.round.won ? 'not ' : ''}in L.
                </p>

                {!phase.round.won &&
                  phase.round.hint !== undefined &&
                  phase.round.hint !== null && (
                    <p className="mt-2 text-sm text-k-text-muted">
                      Against this split, i = {phase.round.hint} would have worked.
                    </p>
                  )}

                {!phase.round.won && language?.regular && (
                  <p className="mt-2 text-sm text-k-text-muted">
                    No choice wins here, and that is the point: this language <em>is</em>{' '}
                    regular. The lemma proves non-regularity and can never prove the opposite —
                    every regular language pumps.
                  </p>
                )}

                <pre className="mt-4 overflow-x-auto rounded-xl bg-k-canvas p-3 text-xs leading-relaxed whitespace-pre-wrap text-k-text-muted">
                  {phase.proof}
                </pre>

                <Lift className="mt-4 inline-block">
                  <button
                    type="button"
                    onClick={() => {
                      reset();
                    }}
                    className="rounded-full border border-k-border-strong bg-k-surface-raised px-4 py-1.5 text-sm font-medium"
                  >
                    Play again
                  </button>
                </Lift>
              </div>
            </Reveal>
          )}
        </div>
      </Band>
    </main>
  );
}

/** One quantifier, and whose move it is. */
function Move({
  quantifier,
  who,
  detail,
  done = false,
}: {
  quantifier: string;
  who: 'you' | 'adversary';
  detail: React.ReactNode;
  done?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        done ? 'border-k-border bg-k-surface/60' : 'border-k-primary/40 bg-k-surface'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <code className="font-mono text-xs tracking-wide text-k-primary">{quantifier}</code>
        <span className="font-mono text-[10px] tracking-wider text-k-text-faint uppercase">
          {who === 'you' ? 'your move' : 'adversary'}
        </span>
      </div>
      <div className="mt-2 text-sm leading-relaxed">{detail}</div>
    </div>
  );
}
