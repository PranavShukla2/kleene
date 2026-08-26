/**
 * The classroom, running entirely in this browser (phase C0.2).
 *
 * A working implementation of `ClassroomApi` backed by `localStorage`. It is not a mock in the
 * testing sense — it is a real classroom that a person can use on their own machine: create a
 * class, set an assignment, submit an answer, and have it checked by the actual engine.
 *
 * ## Why this exists and is not throwaway
 *
 * It keeps the project's oldest promise alive while the plan reverses it. Signed out, or with
 * no server configured, everything still works offline — which is the constraint §1 says must
 * survive the classroom. It also means the UI is buildable, demonstrable and testable before
 * any Google project exists, and it stays useful afterwards as the offline story.
 *
 * ## The one thing it cannot honestly do
 *
 * A single browser cannot be two people. Joining a class you created makes you a student in
 * your own class, and the "roster" is whoever has used this browser. That is a limitation of
 * having no server, stated rather than hidden — the UI reads the same either way, and the real
 * adapter differs only in where the rows live.
 *
 * Answers are checked by the real engine, not stubbed, because the check is the interesting
 * part and a fake one would let the UI be designed around feedback that never arrives.
 */

import type {
  Account,
  Assignment,
  Attempt,
  ClassSummary,
  ClassroomApi,
  Standing,
} from '@/classroom/api';
import { ApiError } from '@/classroom/api';
import type { Engine } from '@/wasm/loader';

const KEY = 'kleene.classroom';

interface Stored {
  account?: Account;
  classes: (Omit<ClassSummary, 'studentCount' | 'assignmentCount'> & { members: string[] })[];
  assignments: Assignment[];
  attempts: Attempt[];
}

const EMPTY: Stored = { classes: [], assignments: [], attempts: [] };

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return structuredClone(EMPTY);
    // Merged over a known-good shape, so a record written by an older build cannot leave a
    // field undefined and take a page down on the next render.
    return { ...structuredClone(EMPTY), ...(parsed as Partial<Stored>) };
  } catch {
    return structuredClone(EMPTY);
  }
}

function write(state: Stored): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Blocked storage. A classroom that cannot persist is still usable for one sitting, which
    // is better than a page that refuses to render.
  }
}

/** Short, unambiguous, and readable aloud in a lecture — no O/0 or I/1. */
function joinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(
    { length: 6 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)] ?? 'A',
  ).join('');
}

const id = () => Math.random().toString(36).slice(2, 10);

/**
 * A local classroom.
 *
 * `engine` is required because submissions are genuinely checked. Without it a submission
 * cannot be judged, and the honest response is a refusal rather than a guess.
 */
export function localClassroom(engine: () => Engine | undefined): ClassroomApi {
  /**
   * Run against stored state, and settle as a promise either way.
   *
   * `async` is doing something specific: without it a refusal escapes as a *synchronous*
   * throw, because the body runs before `Promise.resolve` wraps anything. The real adapter is
   * `fetch`-based and always rejects, so the two would disagree about how failure arrives —
   * and a caller writing `.catch()` would handle one and be killed by the other. Caught by a
   * test asserting `rejects`, which is exactly the difference.
   */
  const withState = <T>(fn: (state: Stored) => T): Promise<T> => {
    try {
      const state = read();
      const result = fn(state);
      write(state);
      return Promise.resolve(result);
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const requireAccount = (state: Stored): Account => {
    if (!state.account) {
      throw new ApiError('Sign in to use the classroom.', 'unauthenticated');
    }
    return state.account;
  };

  const summarise = (state: Stored, entry: Stored['classes'][number]): ClassSummary => ({
    id: entry.id,
    name: entry.name,
    term: entry.term,
    role: entry.role,
    joinCode: entry.joinCode,
    studentCount: entry.members.length,
    assignmentCount: state.assignments.filter((a) => a.classId === entry.id).length,
    ...(entry.archivedAt !== undefined ? { archivedAt: entry.archivedAt } : {}),
  });

  return {
    // Not `withState`: "signed out" is an answer rather than a refusal, and a page that has to
    // catch an exception to render its signed-out state gets that wrong somewhere.
    me: () => Promise.resolve(read().account),

    // No redirect to perform: signing in locally is a local act. The real adapter returns
    // Google's URL, and the caller navigates either way.
    signInUrl: () => '#local-sign-in',

    signOut: () =>
      withState((state) => {
        delete state.account;
      }),

    classes: () =>
      withState((state) => {
        requireAccount(state);
        return state.classes.map((entry) => summarise(state, entry));
      }),

    createClass: ({ name, term }) =>
      withState((state) => {
        const account = requireAccount(state);
        const entry = {
          id: id(),
          name,
          term,
          role: 'teacher' as const,
          joinCode: joinCode(),
          members: [account.id],
        };
        state.classes.push(entry);
        return summarise(state, entry);
      }),

    joinClass: (code) =>
      withState((state) => {
        const account = requireAccount(state);
        const entry = state.classes.find(
          (candidate) => candidate.joinCode.toUpperCase() === code.trim().toUpperCase(),
        );
        if (!entry) throw new ApiError('No class has that code.', 'not-found');
        if (!entry.members.includes(account.id)) entry.members.push(account.id);
        return summarise(state, entry);
      }),

    archiveClass: (classId) =>
      withState((state) => {
        const entry = state.classes.find((candidate) => candidate.id === classId);
        if (!entry) throw new ApiError('No such class.', 'not-found');
        entry.archivedAt = new Date().toISOString();
      }),

    assignments: (classId) =>
      Promise.resolve(read().assignments.filter((entry) => entry.classId === classId)),

    createAssignment: (classId, input) =>
      withState((state) => {
        requireAccount(state);
        const assignment: Assignment = { ...input, id: id(), classId };
        state.assignments.push(assignment);
        return assignment;
      }),

    standings: (assignmentId) =>
      withState((state) => {
        const account = requireAccount(state);
        const mine = state.attempts.filter((a) => a.assignmentId === assignmentId);
        if (mine.length === 0) return [];

        const solved = mine.filter((attempt) => attempt.solved);
        const best = solved.length
          ? Math.min(...solved.map((attempt) => attempt.states))
          : undefined;
        const lastFailure = [...mine]
          .reverse()
          .find((attempt) => !attempt.solved && attempt.feedback?.failure);

        // One row, because one browser is one person. The real adapter returns the roster.
        return [
          {
            studentId: account.id,
            displayName: account.displayName,
            email: account.email,
            attempts: mine.length,
            solved: solved.length > 0,
            ...(best !== undefined ? { bestStates: best } : {}),
            ...(mine.at(-1) ? { lastSubmittedAt: mine.at(-1)?.submittedAt } : {}),
            ...(lastFailure?.feedback?.failure?.kind === 'wrong-language'
              ? { lastFailure: lastFailure.feedback.failure.input || 'ε' }
              : {}),
          } satisfies Standing,
        ];
      }),

    submit: (assignmentId, kln) =>
      withState((state) => {
        requireAccount(state);
        const assignment = state.assignments.find((entry) => entry.id === assignmentId);
        if (!assignment) throw new ApiError('No such assignment.', 'not-found');

        const running = engine();
        if (!running) {
          throw new ApiError('The engine has not finished loading.', 'offline');
        }

        // Checked properly, exactly as the server would — which is the point of this adapter
        // being real rather than stubbed.
        const document = running.fromKln(kln);
        const feedback = running.checkAnswer(
          JSON.stringify({
            version: 1,
            prompt: assignment.prompt,
            target: assignment.targetRegex ?? '',
            ...(assignment.budget !== undefined ? { budget: assignment.budget } : {}),
          }),
          document.automaton,
        );

        const attempt: Attempt = {
          id: id(),
          assignmentId,
          submittedAt: new Date().toISOString(),
          solved: feedback.solved,
          states: feedback.states,
          feedback,
          late: assignment.dueAt !== undefined && new Date() > new Date(assignment.dueAt),
        };
        state.attempts.push(attempt);
        return attempt;
      }),

    attempts: (assignmentId) =>
      Promise.resolve(
        read()
          .attempts.filter((entry) => entry.assignmentId === assignmentId)
          .reverse(),
      ),

    exportMe: () => Promise.resolve(read()),

    deleteMe: () =>
      withState((state) => {
        // Actually erased, not flagged. C8.2 is a legal obligation in at least two
        // jurisdictions, and an adapter that pretended would be the wrong thing to copy.
        state.account = undefined;
        state.classes = [];
        state.assignments = [];
        state.attempts = [];
      }),
  };
}

/** Sign in locally, standing in for the Google round trip. */
export function signInLocally(displayName: string, email: string): Account {
  const state = read();
  const account: Account = { id: id(), email, displayName };
  state.account = account;
  write(state);
  return account;
}
