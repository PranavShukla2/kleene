/**
 * What the classroom server can be asked, described before one exists.
 *
 * Phase C0, and the order matters: the UI is written against this interface and an in-memory
 * adapter, so the whole classroom is buildable, demonstrable and testable with no backend, no
 * Google project, and nobody's email in a database.
 *
 * That is not a scaffolding trick. It is the recommendation in the plan: building the server
 * first pays the entire cost — a service that can be down, data-protection duties, an uptime
 * promise landing in the week of finals — before learning whether anybody wants the thing. An
 * interface plus an adapter gets the product designed and the demo working while that question
 * is still open.
 *
 * ## What is deliberately not here
 *
 * No `grade`. The server records whether a submission solved the problem, how many states it
 * used, and what it got wrong. Turning that into a mark is a judgement made with context this
 * system does not have, and a `grade` field would invite it to pretend otherwise.
 */

import type { Feedback } from '@/model/automaton';

/** Somebody signed in. */
export interface Account {
  id: string;
  email: string;
  displayName: string;
}

/** Whether someone teaches a class or takes it. */
export type Role = 'teacher' | 'student';

export interface ClassSummary {
  id: string;
  name: string;
  /** "Autumn 2026" — free text, because term naming is not a thing to model. */
  term: string;
  role: Role;
  /** Shown to teachers, and how students join. */
  joinCode: string;
  studentCount: number;
  assignmentCount: number;
  archivedAt?: string;
}

export interface Assignment {
  id: string;
  classId: string;
  title: string;
  /** What to build, in words. */
  prompt: string;
  /** The target language, as a regular expression. Never sent to students. */
  targetRegex?: string;
  /** The most states an accepted answer may use. */
  budget?: number;
  opensAt?: string;
  dueAt?: string;
}

/** One attempt, as the server recorded it. */
export interface Attempt {
  id: string;
  assignmentId: string;
  submittedAt: string;
  /** Decided by the server re-running the check, never by the client's claim. */
  solved: boolean;
  states: number;
  /** What it got wrong, when it did. */
  feedback?: Feedback;
  /** After `dueAt`. Recorded rather than refused — refusing loses the work. */
  late: boolean;
}

/** How one student stands on one assignment. */
export interface Standing {
  studentId: string;
  displayName: string;
  email: string;
  attempts: number;
  solved: boolean;
  /** Their smallest correct machine, if they have one. */
  bestStates?: number;
  lastSubmittedAt?: string;
  /** The counterexample from their most recent failure, for a teacher scanning a column. */
  lastFailure?: string;
}

/** Something the server refused, in a shape the UI can render. */
export class ApiError extends Error {
  constructor(
    message: string,
    /** `unauthenticated` sends the visitor to sign in; the rest are shown as written. */
    readonly kind: 'unauthenticated' | 'forbidden' | 'not-found' | 'conflict' | 'offline',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Every call the classroom makes.
 *
 * One interface rather than a scattering of `fetch` calls, so that swapping the in-memory
 * adapter for the real one is a single line and the UI cannot quietly grow a dependency on
 * something the server does not offer.
 */
export interface ClassroomApi {
  /** Who is signed in, or `undefined`. Never throws for "signed out" — that is an answer. */
  me(): Promise<Account | undefined>;
  /** Begin the Google flow. Returns where to send the browser. */
  signInUrl(): string;
  signOut(): Promise<void>;

  classes(): Promise<ClassSummary[]>;
  createClass(input: { name: string; term: string }): Promise<ClassSummary>;
  joinClass(code: string): Promise<ClassSummary>;
  archiveClass(id: string): Promise<void>;

  assignments(classId: string): Promise<Assignment[]>;
  createAssignment(
    classId: string,
    input: Omit<Assignment, 'id' | 'classId'>,
  ): Promise<Assignment>;

  /** Every student's standing on one assignment. Teachers only. */
  standings(assignmentId: string): Promise<Standing[]>;

  /** Submit a machine. The server re-checks it; the client's own verdict is not sent. */
  submit(assignmentId: string, kln: string): Promise<Attempt>;
  /** This student's attempts on one assignment, most recent first. */
  attempts(assignmentId: string): Promise<Attempt[]>;

  /** Everything held about the signed-in account, for §8.3. */
  exportMe(): Promise<unknown>;
  /** Erase it, for §8.2. */
  deleteMe(): Promise<void>;
}
