/**
 * The local classroom.
 *
 * Worth testing properly rather than treating as scaffolding: it is what the UI is built
 * against, it is the offline story after the server exists, and one of its behaviours — that
 * deleting an account really deletes — is a legal obligation being modelled. An adapter that
 * pretended would be the wrong thing for the real one to copy.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { ApiError } from '@/classroom/api';
import { localClassroom, signInLocally } from '@/classroom/local';
import type { Engine } from '@/wasm/loader';

/** Enough engine to check an answer. The rest is never reached by these paths. */
function fakeEngine(solved: boolean, states = 2): Engine {
  return {
    fromKln: () => ({
      version: 1,
      automaton: { alphabet: [], states: [], start: 0, transitions: [] },
    }),
    checkAnswer: () => ({
      solved,
      states,
      ...(solved
        ? {}
        : { failure: { kind: 'wrong-language', input: 'ab', accepted_by_answer: true } }),
    }),
  } as unknown as Engine;
}

const api = (engine?: Engine) => localClassroom(() => engine);

beforeEach(() => {
  localStorage.clear();
});

describe('signing in', () => {
  it('reports nobody signed in rather than throwing', async () => {
    // "Signed out" is an answer, not an error — a page that has to catch an exception to
    // render its signed-out state gets that wrong somewhere.
    await expect(api().me()).resolves.toBeUndefined();
  });

  it('refuses everything else until someone is', async () => {
    await expect(api().classes()).rejects.toBeInstanceOf(ApiError);
  });

  it('remembers an account across a reload', async () => {
    signInLocally('Ada', 'ada@example.test');
    await expect(api().me()).resolves.toMatchObject({ displayName: 'Ada' });
  });
});

describe('classes', () => {
  beforeEach(() => {
    signInLocally('Ada', 'ada@example.test');
  });

  it('creates one with a readable join code', async () => {
    const created = await api().createClass({ name: 'Formal Languages', term: 'Autumn 2026' });
    expect(created.role).toBe('teacher');
    // No O/0 or I/1: this gets read aloud in a lecture theatre.
    expect(created.joinCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  it('joins by code, ignoring case and stray spaces', async () => {
    const created = await api().createClass({ name: 'FL', term: 'Autumn' });
    const joined = await api().joinClass(`  ${created.joinCode.toLowerCase()} `);
    expect(joined.id).toBe(created.id);
  });

  it('says so when a code matches nothing', async () => {
    await expect(api().joinClass('ZZZZZZ')).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('counts assignments per class', async () => {
    const created = await api().createClass({ name: 'FL', term: 'Autumn' });
    await api().createAssignment(created.id, { title: 'One', prompt: 'p', targetRegex: 'a' });
    const [summary] = await api().classes();
    expect(summary?.assignmentCount).toBe(1);
  });
});

describe('submitting', () => {
  beforeEach(() => {
    signInLocally('Ada', 'ada@example.test');
  });

  it('records a correct answer as solved', async () => {
    const engine = fakeEngine(true, 2);
    const klass = await api(engine).createClass({ name: 'FL', term: 'Autumn' });
    const task = await api(engine).createAssignment(klass.id, {
      title: 'Even as',
      prompt: 'An even number of a’s.',
      targetRegex: '(b + ab*a)*',
    });

    const attempt = await api(engine).submit(task.id, '{}');
    expect(attempt.solved).toBe(true);
    expect(attempt.states).toBe(2);
  });

  it('keeps what a wrong answer got wrong', async () => {
    const engine = fakeEngine(false);
    const klass = await api(engine).createClass({ name: 'FL', term: 'Autumn' });
    const task = await api(engine).createAssignment(klass.id, {
      title: 'Even as',
      prompt: 'p',
      targetRegex: '(b + ab*a)*',
    });

    const attempt = await api(engine).submit(task.id, '{}');
    expect(attempt.solved).toBe(false);
    expect(attempt.feedback?.failure).toMatchObject({ kind: 'wrong-language' });
  });

  it('keeps every attempt, most recent first', async () => {
    // A student asking "what did I submit at 4pm" deserves an answer, and an appeal needs the
    // history. Keeping only the latest throws both away.
    const engine = fakeEngine(false);
    const klass = await api(engine).createClass({ name: 'FL', term: 'Autumn' });
    const task = await api(engine).createAssignment(klass.id, { title: 'T', prompt: 'p' });

    await api(engine).submit(task.id, '{}');
    await api(engine).submit(task.id, '{}');

    const history = await api(engine).attempts(task.id);
    expect(history).toHaveLength(2);
    expect(new Date(history[0]?.submittedAt ?? 0).getTime()).toBeGreaterThanOrEqual(
      new Date(history[1]?.submittedAt ?? 0).getTime(),
    );
  });

  it('flags a late submission rather than refusing it', async () => {
    // Refusing loses the work. Flagging leaves the decision with the lecturer, who has the
    // context — an extension, an illness, a clock in the wrong timezone.
    const engine = fakeEngine(true);
    const klass = await api(engine).createClass({ name: 'FL', term: 'Autumn' });
    const task = await api(engine).createAssignment(klass.id, {
      title: 'T',
      prompt: 'p',
      dueAt: new Date(Date.now() - 60_000).toISOString(),
    });

    const attempt = await api(engine).submit(task.id, '{}');
    expect(attempt.late).toBe(true);
    expect(attempt.solved).toBe(true);
  });

  it('refuses to guess when the engine has not loaded', async () => {
    const klass = await api(fakeEngine(true)).createClass({ name: 'FL', term: 'Autumn' });
    const task = await api(fakeEngine(true)).createAssignment(klass.id, {
      title: 'T',
      prompt: 'p',
    });
    await expect(api(undefined).submit(task.id, '{}')).rejects.toMatchObject({
      kind: 'offline',
    });
  });
});

describe('the obligations', () => {
  beforeEach(() => {
    signInLocally('Ada', 'ada@example.test');
  });

  it('exports everything held', async () => {
    await api().createClass({ name: 'FL', term: 'Autumn' });
    const exported = (await api().exportMe()) as { classes: unknown[] };
    expect(exported.classes).toHaveLength(1);
  });

  it('deletes for real, not by flagging', async () => {
    // §8.2 is a legal obligation in at least two jurisdictions. An adapter that soft-deleted
    // would be the wrong pattern for the server to copy.
    const engine = fakeEngine(true);
    const klass = await api(engine).createClass({ name: 'FL', term: 'Autumn' });
    const task = await api(engine).createAssignment(klass.id, { title: 'T', prompt: 'p' });
    await api(engine).submit(task.id, '{}');

    await api().deleteMe();

    const left = (await api().exportMe()) as {
      account?: unknown;
      classes: unknown[];
      attempts: unknown[];
    };
    expect(left.account).toBeUndefined();
    expect(left.classes).toHaveLength(0);
    expect(left.attempts).toHaveLength(0);
  });
});

describe('storage that is not co-operating', () => {
  it('starts empty rather than throwing on corrupt JSON', async () => {
    localStorage.setItem('kleene.classroom', '{not json');
    await expect(api().me()).resolves.toBeUndefined();
  });

  it('survives a record written by an older build', async () => {
    // Merged over a known-good shape, so a missing field cannot take a page down on render.
    localStorage.setItem('kleene.classroom', JSON.stringify({ account: { id: 'x' } }));
    const state = (await api().exportMe()) as { classes: unknown[] };
    expect(state.classes).toEqual([]);
  });
});

describe('what one browser cannot honestly do', () => {
  it('reports a single-person roster, because it is one browser', async () => {
    // Stated rather than hidden: the real adapter returns the roster, and the UI reads the
    // same either way.
    signInLocally('Ada', 'ada@example.test');
    const engine = fakeEngine(true);
    const klass = await api(engine).createClass({ name: 'FL', term: 'Autumn' });
    const task = await api(engine).createAssignment(klass.id, { title: 'T', prompt: 'p' });
    await api(engine).submit(task.id, '{}');

    const standings = await api(engine).standings(task.id);
    expect(standings).toHaveLength(1);
    expect(standings[0]?.solved).toBe(true);
  });
});
