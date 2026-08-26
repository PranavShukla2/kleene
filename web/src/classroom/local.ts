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
  Role,
  Standing,
} from '@/classroom/api';
import { ApiError } from '@/classroom/api';
import type { Engine } from '@/wasm/loader';

const KEY = 'kleene.classroom';

interface Stored {
  account?: Account;
  /**
   * Everyone who has signed in on this browser.
   *
   * Needed because signing out and back in has to return you to *the same person*. A first
   * version minted a fresh id on every sign-in, so a teacher who signed out and back in was a
   * stranger to the class they had just created — their own results table was empty.
   *
   * Keyed by email, which is this adapter's stand-in for the `users.google_sub UNIQUE` in the
   * plan's schema: an identity provider hands back a stable subject, and the row is upserted
   * against it rather than inserted.
   */
  accounts?: Account[];
  /**
   * Classes, each with its own enrolment list.
   *
   * The role lives on the *membership*, not on the class. A first version put a single `role`
   * on the class record, and joining someone else's class then made you a teacher of it —
   * because there was only one field and the creator had already set it. That is the same
   * shape as the plan's `enrolments (class_id, user_id, role)` table, and for the same reason:
   * one person is a teacher in one module and a student in another, and a TA is both in the
   * same term.
   */
  classes: {
    id: string;
    name: string;
    term: string;
    joinCode: string;
    archivedAt?: string;
    members: { userId: string; role: Role }[];
  }[];
  assignments: Assignment[];
  attempts: Attempt[];
}

const EMPTY: Stored = { classes: [], assignments: [], attempts: [], accounts: [] };

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

  /**
   * What role the signed-in account has in a class.
   *
   * `undefined` for a class they are not in, which is the same answer as "not allowed" for
   * every caller here — a class you are not a member of should be indistinguishable from a
   * class that does not exist.
   */
  const roleIn = (state: Stored, classId: string): Role | undefined => {
    const account = state.account;
    if (!account) return undefined;
    const entry = state.classes.find((candidate) => candidate.id === classId);
    return entry?.members.find((member) => member.userId === account.id)?.role;
  };

  const summarise = (state: Stored, entry: Stored['classes'][number]): ClassSummary => ({
    id: entry.id,
    name: entry.name,
    term: entry.term,
    // The viewer's own role, not the class's. There is no such thing as a class's role.
    role: roleIn(state, entry.id) ?? 'student',
    joinCode: entry.joinCode,
    // Students, not members: a teacher is not one of their own students, and a roster count
    // that includes the person reading it is off by one in the direction that looks careless.
    studentCount: entry.members.filter((member) => member.role === 'student').length,
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
        const account = requireAccount(state);
        // Only classes you are in. A class you are not a member of should be indistinguishable
        // from one that does not exist.
        return state.classes
          .filter((entry) => entry.members.some((member) => member.userId === account.id))
          .map((entry) => summarise(state, entry));
      }),

    createClass: ({ name, term }) =>
      withState((state) => {
        const account = requireAccount(state);
        const entry = {
          id: id(),
          name,
          term,
          joinCode: joinCode(),
          // Creating a class is what makes you its teacher. There is no separate step, and no
          // way to be a teacher of a class you did not create or were not made one of.
          members: [{ userId: account.id, role: 'teacher' as const }],
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
        // Joining is idempotent, and never changes a role you already have — a teacher who
        // types their own join code stays the teacher.
        if (!entry.members.some((member) => member.userId === account.id)) {
          entry.members.push({ userId: account.id, role: 'student' });
        }
        return summarise(state, entry);
      }),

    archiveClass: (classId) =>
      withState((state) => {
        const entry = state.classes.find((candidate) => candidate.id === classId);
        if (!entry) throw new ApiError('No such class.', 'not-found');
        entry.archivedAt = new Date().toISOString();
      }),

    assignments: (classId) =>
      withState((state) => {
        const role = roleIn(state, classId);
        const found = state.assignments.filter((entry) => entry.classId === classId);

        // The answer key never leaves the teacher's view.
        //
        // `api.ts` has said "never sent to students" since the contract was written, and this
        // returned the whole record to everyone — so a student could read the target language
        // out of a network response and solve every problem by pasting it back. Stripping it
        // here rather than hiding it in the UI is the difference between a rule and a wish:
        // the field is not in the object, so no component can leak it by accident.
        if (role === 'teacher') return found;
        return found.map(({ targetRegex: _hidden, ...rest }) => rest);
      }),

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

        // Who else has solved what is a teacher's view. A student seeing the roster learns
        // their classmates' names, their attempt counts and who is struggling — none of which
        // is theirs to know, and none of which they asked for.
        const assignment = state.assignments.find((entry) => entry.id === assignmentId);
        if (!assignment || roleIn(state, assignment.classId) !== 'teacher') {
          throw new ApiError('Only a teacher can see the class’s results.', 'forbidden');
        }
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

        // Read from stored state, not from anything the caller sent. This is the local stand-in
        // for the plan's central decision: the server re-checks with its own copy of the
        // problem, so a student who edits their copy of the assignment changes nothing.

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

/**
 * Sign in locally, standing in for the Google round trip.
 *
 * Upserts by email rather than minting an id. Signing out and back in must return the same
 * person, or a teacher who does it becomes a stranger to their own class — which is what
 * happened, and what the accounts list exists to prevent.
 */
export function signInLocally(displayName: string, email: string): Account {
  const state = read();
  const known = (state.accounts ?? []).find((candidate) => candidate.email === email);

  const account: Account = known ?? { id: id(), email, displayName };
  if (!known) state.accounts = [...(state.accounts ?? []), account];

  state.account = account;
  write(state);
  return account;
}
