# Classroom — v2

A hosted classroom: sign in with Google, create a class, set assignments, and see who has
solved what. Implementation plan for a deliberate reversal of the project's oldest constraint.

> **This reverses a decision.** [LEFTOVERS.md](../../LEFTOVERS.md) descoped "a hosted classroom
> with accounts and rosters", and [teaching-layer.md](teaching-layer.md) says outright: _"if a
> task in this document starts to need a backend, the task is wrong, not the constraint."_
>
> That reasoning has not become false. It has been **overruled by the project's owner**, which
> is the only thing that can overrule it. This document records what the reversal costs so that
> the cost is paid deliberately rather than discovered.

---

## 1. What changes, and what must not

The zero-backend rule bought three things. Two of them can be kept.

| What it bought                     | After this                                         | How                                                                                                                       |
| ---------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Nothing to run, nothing to pay for | **Lost.** There is now a service that can be down. | Accepted. Kept small: Workers, D1, KV — all free-tier at class scale.                                                     |
| No student data to protect         | **Lost.** Names, emails, submissions.              | Minimised, documented, deletable. §8.                                                                                     |
| Works offline, no sign-in needed   | **Kept.**                                          | The editor, converter, examples, problem set and games stay exactly as they are, signed out. The classroom is _additive_. |

**The rule that replaces it:** every existing page must keep working with the network off and
nobody signed in. If a change to the classroom would break `/editor` offline, the change is
wrong. This is the constraint that stops a classroom eating the tool.

---

## 2. Why Cloudflare rather than Render

Render's free tier sleeps, and a cold start is 30–50 seconds. A student clicking "submit" at
23:57 on a deadline gets a spinner and concludes the site is broken — which, for that minute,
it is.

Cloudflare Workers do not have that failure mode: they are V8 isolates, not containers, and
start in single-digit milliseconds. The rest follows from staying on one platform:

| Need        | Cloudflare                        | Free tier                     |
| ----------- | --------------------------------- | ----------------------------- |
| API         | **Workers**                       | 100k requests/day             |
| Database    | **D1** (SQLite)                   | 5 GB, 5M row reads/day        |
| Sessions    | **KV**                            | 100k reads/day, 1k writes/day |
| Static site | **Pages** (already deployed here) | unlimited                     |

A department-sized class — say 300 students, 10 assignments — is nowhere near any of those
numbers. 🟡 **ASSUMPTION** worth checking before promising anything: KV's 1,000 writes/day is
the tightest limit, which is why sessions are cookies rather than KV rows (§4).

---

## 3. The architectural decision that makes this worth building

**The server re-checks every submission with the same Rust core the browser used.**

`kleene-core` has no browser dependencies — no `web-sys`, no `js-sys`, nothing. It already
compiles to `wasm32-unknown-unknown`, and a Cloudflare Worker runs wasm. So the exact
implementation that tells a student "your machine rejects `baabb`" is the one that decides
whether their submission counts.

This is not an optimisation. Without it the API has to trust a JSON body, and
`POST /submissions {"solved": true}` is a passing grade. With it there is one definition of
correctness in the system, and the trust boundary is explicit:

- **In the browser:** immediate feedback, unlimited attempts, no record. Cheap and fast.
- **In the Worker:** the same check, on the machine the student actually sent, written down.

One engine, two trust levels. That is the sentence this whole document exists to make true.

---

## 4. Authentication

**Google OAuth 2.0 authorization-code flow with PKCE, terminated in a Worker.**

Not Firebase, not Auth0, not NextAuth: each is a dependency that owns your user table. The flow
is ~120 lines and the alternative is a vendor between you and your own data.

### The flow

1. `GET /auth/google` — Worker generates `state` + PKCE `code_verifier`, stores both in a
   short-lived signed cookie, redirects to Google.
2. Google redirects back to `GET /auth/callback?code=…&state=…`.
3. Worker verifies `state`, exchanges `code` for tokens, verifies the `id_token` signature
   against Google's JWKS, and reads `sub`, `email`, `name`.
4. Worker upserts the user in D1 and sets a session cookie.
5. **The Google tokens are then discarded.** Nothing here needs Drive, Gmail or Calendar, so
   holding a refresh token is holding a liability for no benefit.

### Sessions are signed cookies, not KV rows

A stateless JWT in an `HttpOnly; Secure; SameSite=Lax` cookie, signed with a Worker secret.

- **Why:** KV's free tier allows 1,000 writes/day. One session write per login is fine; one per
  request is not. A signed cookie needs zero writes.
- **The cost:** logout cannot be instant server-side. Mitigated by a short expiry (7 days) and a
  `sessions_revoked_at` column per user — a user who signs out everywhere bumps it, and any
  token issued earlier is refused. One column, one comparison, no per-request write.

### Scopes

`openid email profile`, and nothing else. Every additional scope is a consent screen a lecturer
has to read and a reason for their IT department to say no.

---

## 5. Data model

Deliberately small. Every column below is one someone could be asked to justify.

```sql
users        (id, google_sub UNIQUE, email, display_name, created_at, sessions_revoked_at)
classes      (id, owner_id → users, name, term, join_code UNIQUE, archived_at, created_at)
enrolments   (class_id, user_id, role CHECK(role IN ('teacher','student')), joined_at,
              PRIMARY KEY (class_id, user_id))
assignments  (id, class_id, title, prompt, target_regex, budget, opens_at, due_at, created_at)
submissions  (id, assignment_id, user_id, kln TEXT, states INT, solved INT,
              counterexample TEXT, checked_at)
```

Notes that are decisions rather than description:

- **`target_regex`, not a reference automaton.** Same reasoning as `ProblemSpec`: a machine is
  larger and leaks one particular solution.
- **`submissions` keeps every attempt**, not the latest. A student asking "what did I submit at
  4pm" deserves an answer, and a lecturer investigating an appeal needs the history.
- **No `grade` column.** The system records `solved`, `states` and a counterexample. Turning
  those into a mark is a judgement a lecturer makes with context this database does not have.
- **`join_code`, not email invitations.** Sending email means an email provider, a bounce
  policy, and an abuse vector. A six-character code read out in a lecture is enough.

---

## 6. API surface

Every route is authenticated except the two auth routes and `GET /health`.

```
POST   /auth/google              → redirect to Google
GET    /auth/callback            → set session, redirect to /classroom
POST   /auth/signout             → clear cookie, bump sessions_revoked_at

GET    /me                       → { id, email, name, classes[] }
DELETE /me                       → erase everything (§8)
GET    /me/export                → everything held about you, as JSON

POST   /classes                  → create (teacher)
GET    /classes/:id              → detail + roster (member)
POST   /classes/join             → { code } (student)
PATCH  /classes/:id              → rename, archive (owner)

POST   /classes/:id/assignments  → create (teacher)
GET    /classes/:id/assignments  → list (member)
GET    /assignments/:id/results  → per-student status (teacher)

POST   /assignments/:id/submit   → { kln } → server re-checks, records, returns feedback
GET    /assignments/:id/mine     → this student's attempts
```

---

## 7. Phases

Each is a shippable step. Nothing here requires the previous phase to be _finished_ to start —
except that C2 gates everything.

### C0 — Contract first

- [ ] **C0.1.** A typed client interface in `web/src/classroom/api.ts` describing every call
      above, with no implementation.
- [ ] **C0.2.** An in-memory adapter that satisfies it, so the UI is buildable and testable
      **before any server exists**. This is the phase's whole point: the UI is not blocked on
      the backend, and the backend has a written target.
- [ ] **C0.3.** A `VITE_API_URL` switch choosing adapter vs `fetch`.

### C1 — Worker skeleton

- [ ] **C1.1.** `api/` — a Worker with `wrangler.toml`, `GET /health`, and a D1 binding.
- [ ] **C1.2.** Migrations as numbered `.sql` files, applied by `wrangler d1 migrations apply`.
- [ ] **C1.3.** CORS restricted to the Pages origin. Not `*` — the cookie is the credential.

### C2 — Auth 🔴 **needs Pranav** (§9)

- [ ] **C2.1.** The flow in §4, with `state` and PKCE.
- [ ] **C2.2.** `id_token` verified against Google's JWKS, cached in KV by `kid`.
- [ ] **C2.3.** Session cookie signed with `SESSION_SECRET`; `sessions_revoked_at` honoured.
- [ ] **C2.4.** A test that an unsigned and a tampered cookie are both refused.

### C3 — Classes and enrolment

- [ ] **C3.1.** Create, join by code, roster, archive.
- [ ] **C3.2.** Role checks in one middleware, not per handler — an authorisation check that
      is written twenty times is one that is wrong once.

### C4 — Assignments and server-side checking

- [ ] **C4.1.** `kleene-core` compiled into the Worker.
- [ ] **C4.2.** `POST /submit` re-checks server-side and stores the result. The client's opinion
      of its own correctness is never read.
- [ ] **C4.3.** Deadlines: submissions after `due_at` are recorded and flagged late, not
      refused. Refusing loses the work; flagging is a lecturer's decision to make.

### C5 — Teacher UI

- [ ] **C5.1.** Class list, create, join code with a copy button.
- [ ] **C5.2.** Assignment composer — prompt, target expression, optional budget, due date —
      with the target _validated live by the local engine_, including whether the budget is
      achievable.
- [ ] **C5.3.** Results table: student, attempts, solved, states, counterexample. Sortable, and
      exportable as the same CSV `kleene grade` produces, so the two paths agree.

### C6 — Student UI

- [ ] **C6.1.** Join a class, see assignments with due dates and status.
- [ ] **C6.2.** Open one in the editor, work, submit. The existing solve view, with a submit
      button added when signed in.
- [ ] **C6.3.** History of attempts, with what each one got wrong.

### C7 — Abuse and limits

- [ ] **C7.1.** Rate limits per user on submit and on class creation.
- [ ] **C7.2.** Payload caps: a `.kln` over ~64 KB is not an automaton anyone drew.
- [ ] **C7.3.** Join codes expire and can be rotated.

### C8 — Obligations 🔴 **needs a decision**

- [ ] **C8.1.** Privacy policy naming exactly what is stored and why.
- [ ] **C8.2.** `DELETE /me` genuinely deletes, including submissions.
- [ ] **C8.3.** `GET /me/export` returns everything.
- [ ] **C8.4.** Retention: classes archived after a term, deleted after a year.
- [ ] **C8.5.** A named contact for data requests. This is a person, not a feature.

### C9 — Operations

- [ ] **C9.1.** Structured request logging without PII in log lines.
- [ ] **C9.2.** D1 backup on a schedule. Cloudflare's is not a substitute for one you have
      restored from at least once.
- [ ] **C9.3.** A status note on the classroom page when the API is unreachable — signed-out
      Kleene still works, and the page should say so rather than appearing broken.

---

## 8. What holding this data commits you to

Not legal advice; a list of things that become true the moment the first student signs in.

- **You are a data controller.** Under India's DPDP Act, GDPR if a single EU student uses it,
  and FERPA-adjacent expectations if a US institution adopts it.
- **Deletion is not optional.** C8.2 is a legal obligation in at least two jurisdictions.
- **A breach has notification duties** measured in days.
- **Minors.** If any student is under 18, consent rules differ. The cheapest honest answer is a
  terms line saying the service is for higher education, and to mean it.

**The mitigation that matters most is storing less.** No profile photos, no Google tokens, no
IP logs beyond what Cloudflare keeps by default, no analytics tied to a user id.

---

## 9. What Pranav has to do

Two accounts and four secrets. **Never paste any of these into a chat, including to me** —
a leaked client secret means rotating it.

### Google Cloud

1. [console.cloud.google.com](https://console.cloud.google.com) → new project, _Kleene_.
2. **APIs & Services → OAuth consent screen** → External. App name, support email, developer
   email. Scopes: `openid`, `email`, `profile` — nothing more.
3. **Credentials → Create credentials → OAuth client ID → Web application.**
   - Authorised JavaScript origins: `https://kleene.pranavmshukla.in`
   - Authorised redirect URIs: `https://api.kleene.pranavmshukla.in/auth/callback`
     _(and `http://localhost:8787/auth/callback` for local work)_
4. Note the **client ID** (public, safe to commit) and **client secret** (never).
5. While "Testing", only listed test users can sign in. Publishing needs a verification review
   — start in Testing, add yourself and one colleague.

### Cloudflare

```sh
npm i -D wrangler
npx wrangler login

npx wrangler d1 create kleene-classroom     # copy the id into wrangler.toml
npx wrangler kv namespace create JWKS       # same

npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET      # openssl rand -base64 48
```

Then a DNS record for `api.kleene.pranavmshukla.in` pointing at the Worker, so the cookie is
same-site with the Pages origin.

### The decisions only you can make

|                                             |                                                                                           |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Is this a product or a portfolio piece?** | It changes whether C8 is a checklist or a commitment.                                     |
| **Who is the named data contact?**          | C8.5. It has to be a person.                                                              |
| **Under-18 students?**                      | If yes, the consent story changes materially.                                             |
| **Does a real lecturer want this?**         | The original descope said to wait for one. Building first is a bet that they will appear. |

---

## 10. My recommendation, plainly

Build C0 and C5/C6 **against the in-memory adapter first** — the entire UI, working, with no
server. That is what this document's phase order is for.

It gets you the resume artefact (a real classroom UI, demonstrably designed) and the honest
demo (it works, offline, today) without taking on a single data-protection duty until you
decide to. If a lecturer then appears, C1–C4 is a weekend and the UI is already built. If none
does, you have lost nothing and are storing nobody's email.

The thing I would _not_ do is stand up auth and a database first and build the UI against it.
That order pays the entire cost before learning whether anyone wants the thing.
