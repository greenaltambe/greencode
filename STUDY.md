# STUDY.md — GreenCode Online Judge

> **Purpose**: Prepare you to defend every line of code, every architecture decision, every technology choice, and every tradeoff in an interview where the interviewer has read the source and will ask **"Why?"** after every answer.
>
> **Scope**: `backend/`, `frontend/`, `docker-compose.*.yml`, `scripts/`, `docs/`, `data-formater-scripts/`. The `frontend-deprecated/` directory is ignored.

---

## Table of Contents

1. [Project Elevator Pitch](#section-1--project-elevator-pitch)
2. [Complete Architecture](#section-2--complete-architecture)
3. [Technology Choices](#section-3--technology-choices)
4. [Every Design Decision](#section-4--every-design-decision)
5. [Folder Walkthrough](#section-5--folder-walkthrough)
6. [Code Walkthrough](#section-6--code-walkthrough)
7. [Data Flow](#section-7--data-flow)
8. [Database](#section-8--database)
9. [API Design](#section-9--api-design)
10. [Authentication](#section-10--authentication)
11. [Performance](#section-11--performance)
12. [Scalability](#section-12--scalability)
13. [Security](#section-13--security)
14. [Error Handling](#section-14--error-handling)
15. [Debugging Stories](#section-15--debugging-stories)
16. [Testing](#section-16--testing)
17. [Deployment](#section-17--deployment)
18. [Tradeoffs](#section-18--tradeoffs)
19. [Improvements](#section-19--improvements)
20. [Resume Questions](#section-20--resume-questions)
21. [Mock Interview](#section-21--mock-interview)
22. [Rapid Revision](#section-22--rapid-revision)
23. [Hidden Interview Traps](#section-23--hidden-interview-traps)
24. [Project Defense](#section-24--project-defense)
25. [Knowledge Gaps](#section-25--knowledge-gaps)
26. [Final Cheat Sheet](#section-26--final-cheat-sheet)

---

# SECTION 1 — Project Elevator Pitch

## What problem does this solve?

Running untrusted user code is dangerous. A naive system that executes submissions directly on a server lets any user:
- Read `/etc/passwd`, environment variables, or the database credentials.
- Open network sockets to internal services (e.g., talk to MongoDB/Redis directly).
- Allocate unlimited memory/CPU and crash the host.
- Fork-bomb, read other users' files, or delete files.

GreenCode solves this by building a full online judge: users solve programming problems in a web editor, and their solutions are executed inside **isolated, disposable Docker containers** with no network, strict CPU/memory caps, and hard timeouts. Verdicts, runtime, and memory metrics stream back to the UI in real time via WebSockets.

It also solves a "learning platform" problem: it needs problem discovery, submissions history, per-user analytics/streaks, discussion forums, private notes, and **spaced-repetition study decks** so users can review problems they struggle with.

## 30-Second Explanation

> "GreenCode is a self-hosted online judge like LeetCode/Codeforces. Users solve programming problems in a browser-based Monaco editor, and their C++, Python, or Java code is compiled and executed inside isolated Docker containers that have no network access and strict CPU/memory/time limits. When a user hits Submit, the backend stores the submission, pushes it onto a BullMQ Redis queue, and a worker executes it against hidden test cases. Status updates flow back to the UI in real time through Redis pub/sub and Socket.IO — queued → running → verdict. On top of the core judging engine it has authentication with JWT and email verification, problem management with ZIP import, discussion forums, private notes, user statistics with streak tracking, and Anki-style spaced-repetition study decks."

## 2-Minute Explanation

Structure: **Problem → Architecture → Flow → Features → Tradeoffs**.

GreenCode addresses two problems: (1) safely executing untrusted code, and (2) running a learning platform.

**Architecture (5 moving parts):**
1. **React SPA** (Vite + Mantine + Zustand + Monaco). Dev served by Vite; prod built to static files and served by Nginx which reverse-proxies `/api` to the backend.
2. **Express + Socket.IO backend** (Node 20). Handles REST (auth, problems, stats, discussions, notes, lists) and real-time WebSockets.
3. **BullMQ + Redis** queue. Submissions are enqueued; workers process them asynchronously so the HTTP request returns instantly.
4. **Docker sandbox executor**. The worker runs each test case in a fresh `oj-executor` container (`--network=none --memory=256m --cpus=0.5`), compiles/runs, captures `time:%e` and `memory:%M` metrics, and evaluates output.
5. **MongoDB + storage abstraction**. MongoDB holds users/problems/submissions/discussions/notes/lists. Test-case files and custom checkers live in Local filesystem, MinIO, AWS S3, or Cloudflare R2 — behind a `Storage` interface with a factory.

**The judge flow:** Submit → DB record `queued` → BullMQ job → worker sets `running` → for each hidden test case, spawn Docker container, compile & run with input piped to stdin, compare output (or run custom checker) → aggregate verdict → save to DB → publish to Redis `submission_updates` channel → Socket.IO broadcasts to the room `submission:{id}` → UI unlocks buttons and shows per-case results. The frontend has a 45s polling fallback in case the socket event is lost.

**Key decisions:** async judging so requests don't block; Redis pub/sub decoupling workers from the socket server so you can scale workers horizontally; Docker per test case for isolation; JWT bearer tokens + bcrypt + SHA-256-hashed email tokens; a pluggable storage backend so deployments can go from a laptop (local FS) to production (S3/R2/MinIO) by changing one env var.

**Tradeoffs:** Docker CLI via shell `exec` is simpler than the Docker SDK but slower and shell-quoting fragile; one container per test case is secure but slow; JWT in localStorage is simple but vulnerable to XSS (tradeoff for a hobby-scale app); no rate limiting, no Helmet, CORS wide open — recognized, documented weaknesses.

## 5-Minute Deep Dive

Go deeper than the 2-minute version. Cover:

1. **Startup lifecycle**: `index.js` loads `.env` (parent dir first, then cwd), imports `server.js`. `validateEnv()` checks required vars (MONGODB_URI, JWT_SECRET, PORT, STORAGE_TYPE) and that JWT_SECRET ≥ 32 chars. `connectDB()` connects Mongoose (exits process on failure). `bootstrapAdmin()` seeds an admin from `INITIAL_ADMIN_*` env if none exists (or promotes an existing user). A **storage health check** runs — the server `process.exit(1)`s if storage is unhealthy. Routes are mounted, then `import "./jobs/workers/submission.worker.js"` starts the BullMQ worker as a side effect, and finally an HTTP server with Socket.IO listens.

2. **Request lifecycle** (example: submit): Nginx (prod) or Vite proxy (dev) → Express → `protect` middleware (JWT verify + user lookup, `-password`) → controller → service → model → queue → response `{status:"queued", submissionId}`. Meanwhile a BullMQ worker consumes the job.

3. **Worker/judge lifecycle**: Worker pops job `{submissionId}`, calls `processSubmission`. Sets status `running`, publishes to Redis. Loads problem, lists hidden test cases from storage. For each case: read input/output from storage, call `executeCode({code, language, input})`. `executeCode` dispatches to `cppExecutor`/`pythonExecutor`/`javaExecutor` which build a `docker create`/`docker cp`/`docker start -a`/`docker inspect`/`docker rm` sequence against a prebuilt `oj-executor` image (Debian 12 + g++/python3/openjdk-17 + GNU `time`). Outputs compared in `evaluateExecutionResult` (trimmed exact match, or custom Python checker). **Stops at first failing case** (break). Aggregates max executionTime/max memory. Saves verdict + results + timestamps, publishes final event. On thrown error, worker marks the submission `internal_error` and rethrows so BullMQ tracks the failure (attempts: 3, exponential backoff).

4. **Real-time layer**: Socket.IO server subscribes to Redis channel `submission_updates` using a *duplicate* ioredis connection (pub and sub must be separate connections for Redis pub/sub). Clients `emit("join_submission", id)` → socket joins room `submission:{id}` → server `io.to(room).emit("submission_update", payload)`. Frontend resolves a Promise on the terminal status or falls back to a 45s HTTP poll.

5. **Feature walkthrough**:
   - **Auth**: register (bcrypt + hashed verification token), login (JWT 30d), email verify (GET with token query → hash → match → set verified), resend, admin bootstrap. Frontend `ProtectedRoute`/`AdminRoute` guards.
   - **Problems**: CRUD (admin), filter/search/sort/pagination via MongoDB aggregation `$facet`, sample test cases, tags constrained to a fixed catalog, custom checker upload.
   - **Importer**: ZIP packages (`problem.json` + `tests/input_N.txt`/`output_N.txt` + optional `checker.py`), single or bulk, extracted via `adm-zip`, validated, auto-generates sample cases, reuses `problemService.createProblem`.
   - **Stats**: overview (solved, acceptance rate, current/longest streak computed in JS from submission dates, avg runtime/memory), difficulty breakdown, language usage, tag analytics (most solved & weakest by acceptance), recent activity, 365-day calendar.
   - **Discussions**: nested comments (parentId), upvote toggle (array of user ids), author/admin-only edit/delete, cascade delete replies.
   - **Notes**: one markdown note per (user, problem) — compound unique index + upsert, 5000-char limit.
   - **User lists + spaced repetition**: CRUD lists, public/private, clone public lists, add/remove problems, enable SR which seeds `ReviewProgress` cards; review flow uses **SM-2** (Anki algorithm) with ratings Again/Hard/Good/Easy mapped to quality 1/3/4/5; due cards, review stats, reset.
   - **Admin**: list/search users (paginated), promote to admin.

6. **Ops**: docker-compose (dev + prod), 5 services each; backend mounts `/var/run/docker.sock` and runs `privileged: true` so it can spawn sandboxes; `oj-executor` image must be built first (scripts do it). Nginx serves SPA with `try_files` fallback and proxies `/api`.

## Who uses it?

- **Students/competitive programmers** practicing problems with instant feedback.
- **Self-hosters / instructors** who want their own judge (own test cases, own problem set).
- **Admins** who import problems in bulk from ZIP or from Codeforces-derived datasets (see `data-formater-scripts`).

## Major Features (from README)

| Area | Features |
|---|---|
| Solving | C++/Python/Java, Monaco editor (autocomplete, themes, font size), real-time WebSocket verdicts, double-submit locking |
| Learning | Private markdown notes, runtime/memory/compile/stderr insights |
| Community | Per-problem discussion forums, custom playlists with spaced repetition |
| Admin | ZIP problem import (single/bulk), management console, user promotion |
| Platform | JWT auth + email verification, storage abstraction (local/MinIO/S3/R2), Docker sandbox |

---

# SECTION 2 — Complete Architecture

## High-level diagram

```
                        ┌────────────────────────────────────────────┐
                        │                 BROWSER                     │
                        │  React SPA (Vite/Mantine/Zustand/Monaco)   │
                        └───────────────┬─────────────────┬──────────┘
                                        │ REST (axios)    │ WebSocket (socket.io-client)
                                        ▼                 ▼
                     ┌────────────────────────────────────────────────┐
                     │           NGINX (prod only, :80)               │
                     │   static SPA + /api reverse-proxy + upgrade    │
                     └───────────────────┬────────────────────────────┘
                                         ▼
        ┌──────────────────────────────────────────────────────────────────────┐
        │                        BACKEND (Node/Express, :5000)                 │
        │                                                                      │
        │   routes → controllers → services → models (Mongoose → MongoDB)     │
        │                                                                      │
        │   Socket.IO server  ◄── Redis subscriber (duplicate conn)           │
        │                                                                      │
        │   BullMQ Worker (same process)  ──publish──►  Redis pub/sub          │
        │        │                                                             │
        │        ▼                                                             │
        │   executor/ (docker CLI create/cp/start/inspect/rm)                  │
        └───────────┬──────────────────────────────────────────────────────────┘
                    │ /var/run/docker.sock  (privileged)
                    ▼
        ┌─────────────────────────────┐        ┌───────────────────────┐
        │  oj-executor image          │        │  Redis (queue + pub/sub)│
        │  Debian12: g++, python3,    │        └───────────────────────┘
        │  openjdk-17, time, timeout  │
        └─────────────────────────────┘        ┌───────────────────────┐
                                              │  MongoDB (mongoose)    │
        ┌─────────────────────────────┐        └───────────────────────┘
        │  Storage (Local/MinIO/S3/R2)│
        └─────────────────────────────┘
```

## Component-by-component breakdown

### Frontend (`frontend/`)
- **Purpose**: Render the SPA — landing, auth, problem list/workspace, admin problem editor, stats, lists, review.
- **Key libs**: React 19, Vite 6, Mantine 7, Zustand 5, `@monaco-editor/react`, `react-router-dom` v7, `socket.io-client`, `react-resizable-panels`, `marked`.
- **State**: Zustand stores mirroring each API domain (`authStore`, `problemStore`, `submissionStore`, `discussionStore`, `noteStore`, `userListStore`, `statsStore`). No React Query — manual `isLoading/isError/isSuccess/message` per store.
- **`lib/api.js`**: axios instance, `baseURL = VITE_API_URL || localhost:5000/api`, request interceptor injects `Bearer <token>` from `localStorage.user`.
- **`lib/socket.js`**: singleton socket.io client, auto-connect, 10 reconnection attempts, derives URL from `VITE_API_URL` minus `/api`.
- **Route guards**: `ProtectedRoute` (must be logged in + verified), `AdminRoute` (also role==='admin'), defined in `App.jsx`.
- **Workspace** (`ProblemWorkspace.jsx`): split-panel layout (description|submissions|discussions|notes on left; Monaco + console on right). Persists code and language per problem in `localStorage` (`greencode_code_{id}_{lang}`), editor settings (`greencode_editor_*`). Run = synchronous request; Submit = async with socket room join + 45s fallback poll. Submission-locking via `isSubmissionPending`.
- **What would happen if removed**: no UI at all. Everything else could run via curl.

### Backend (`backend/`)
- **`server.js`** — composition root. Loads env, DB, admin bootstrap, storage health, mounts routers, error middleware, starts worker (side-effect import), HTTP server, Socket.IO.
- **`index.js`** — dotenv bootstrap + imports server.
- **`routes/`** — thin route definitions mapping paths → controller functions, each protected by middleware.
- **`controllers/`** — parse `req`, call services, send responses. No business logic.
- **`services/`** — business logic, data validation, storage/queue orchestration.
- **`models/`** — Mongoose schemas.
- **`jobs/`** — `redis.js` (ioredis conn + publisher/subscriber + channel const + publish helper), `queues/submission.queue.js` (BullMQ Queue with retry policy), `producers/submission.producer.js` (enqueue), `workers/submission.worker.js` (BullMQ Worker, error handling, `internal_error` marking), `processors/submission.processor.js` (the actual judging loop).
- **`executor/`** — language executors + `dockerExecutor.js` (Docker CLI wrapper) + `evaluateExecutionResult.js` (verdict mapping) + `runChecker.js` (custom Python checker in Docker).
- **`storage/`** — `Storage.js` abstract base, `LocalStorage`, `MinIOStorage`, `S3Storage`, `R2Storage`, `StorageFactory`.
- **`middleware/`** — auth (protect/authenticate/authorize/adminOnly), error handler, multer upload.
- **`config/`** — db, socket, storage factory instantiation, env validation.
- **`constants/problemTags.js`** — fixed tag catalog (id/label/category), `PROBLEM_TAG_IDS`, `PROBLEM_TAG_MAP`.

### Redis (`redis.js` + compose)
- Dual role: **BullMQ broker** (list + keyspace) and **pub/sub channel** `submission_updates`.
- **Why a separate subscriber connection**: Redis pub/sub requires a dedicated connection; a connection in subscribe mode can't do normal commands. `connection.duplicate()`.
- **What if removed**: no queue → submit becomes synchronous (slow requests, dropped jobs on crash); no pub/sub → no real-time updates (would need HTTP polling).

### BullMQ
- Queue `"submission"`, job name `"judge-submission"`, data `{submissionId}`.
- `defaultJobOptions`: `removeOnComplete: 100`, `removeOnFail: 1000` (retention), `attempts: 3`, `backoff: {type:"exponential", delay:2000}`.
- **Why attempts:3**: transient infra failures (Redis hiccup, docker daemon contention) shouldn't instantly fail a submission.
- **What if removed**: submissions never judged.

### Docker sandbox executor (`executor/dockerExecutor.js`)
- Uses Docker **CLI** via `child_process.exec` (promisified), NOT the Docker SDK. Sequence: `docker create --memory --cpus --network=none oj-executor <cmd>` → `docker cp code` → `docker cp input` → `docker start -a` (attached) → `docker inspect` for exit code/OOMKilled → `docker rm -f` in `finally`.
- Image `oj-executor` (Debian 12 slim, g++, python3, openjdk-17-jdk-headless, bash, time, timeout) must be **prebuilt** (`scripts/*.sh` builds `-t oj-executor`).
- Metrics via GNU `/usr/bin/time -f "time:%e\nmemory:%M" -o /code/metrics.txt`; after run, `docker cp metrics.txt` out; parse `time:` (sec → ms ×1000) and `memory:` (KB → bytes ×1024).
- **What if removed**: no code execution at all.

### Storage abstraction
- Interface: `getInputContent`, `getOutputContent`, `listTestCases`, `uploadTestCase`, `deleteTestCases`, `isHealthy`, `uploadChecker`, `getChecker`, `hasChecker`, `deleteChecker`.
- Factory selects impl by `STORAGE_TYPE` env (`local|minio|s3|r2`). All S3-compatible impls share the `@aws-sdk/client-s3`; MinIO uses `forcePathStyle: true`; R2 uses endpoint + region "auto".
- **What if removed**: test cases vanish; problems have nothing to run against.

### MongoDB
- Persistent store for all documents. `userNote` and `reviewProgress` have compound unique indexes. Email unique index on `User.email`.
- **What if removed**: platform is read-only; everything crashes on first query.

## Data flow — full submission lifecycle

```
1. User clicks "Submit"
2. CodeEditor button disabled (isSubmissionLoading)
3. submissionStore.submitSolution POST /api/problems/submit
4. Express → protect (JWT) → submitSolution controller
5. submission.service.submitSolution:
     - validate fields, find problem
     - Submission.create({status:"queued", queuedAt})
     - enqueueSubmission({submissionId})
     - respond {status:"queued", submissionId}
6. store sets submissionResult = {status:"queued", _id}
7. store emits socket "join_submission" (room submission:{id})
8. BullMQ worker picks job, calls processSubmission:
     - status "running" + startedAt, save
     - publish {status:"running"} to Redis channel
9. Socket.IO subscriber gets msg → io.to(room).emit("submission_update")
10. Frontend updates UI ("Evaluating solution in Docker sandbox...")
11. Worker loops hidden test cases:
     - read input/output from storage
     - executeCode(code, language, input) → docker sandbox
     - optional custom checker
     - evaluateExecutionResult → per-case verdict
     - break on first failure
12. Worker saves final status + executionTime + memoryUsage + results
13. Worker publishes final verdict to Redis
14. Socket.IO broadcasts → frontend resolves Promise, clears 45s timer,
    leaves room, reloads submission history
15. UI unlocks buttons, shows per-case results
```

## Startup lifecycle (backend)

```
npm start → index.js
  ├─ dotenv: load ../.env, then ./.env (fallback)
  └─ import server.js
       ├─ validateEnv()  — required vars + JWT_SECRET≥32, else exit(1)
       ├─ await connectDB()  — mongoose.connect, exit(1) on error
       ├─ await bootstrapAdmin() — seed/promote admin from env
       ├─ storage.isHealthy() — exit(1) if unhealthy
       ├─ build Express app, mount routers, error middleware
       ├─ import worker (side effect: starts consuming "submission")
       ├─ http.createServer(app)
       ├─ initSocket(server) — subscribe to Redis channel, wire events
       └─ server.listen(PORT)
```

## Shutdown lifecycle

There is **no graceful shutdown** implementation. If the process receives SIGTERM:
- In-flight HTTP requests are aborted.
- Socket.IO connections drop.
- The BullMQ worker stops consuming; **queued jobs stay in Redis** (safe — they're re-processed when a worker returns).
- A job already being processed may be lost: with `attempts: 3` it will be retried after restart if the job wasn't acked, but if `processSubmission` already completed and only the DB save happened, results persist. Docker containers for in-flight runs may be orphaned (the `finally` cleanup never runs) — they are killed by `--memory`/`--cpus` eventually but not removed. **Interview answer**: this is a real gap; production would use `process.on('SIGTERM')` → `worker.close()` + `server.close()` + `mongoose.disconnect()` + draining grace period.

## Request lifecycle (typical REST)

```
Nginx (/api) → Express
  → express.json() (100kb default — TRAP: large submissions may 413/entity too large)
  → cors() (wide open)
  → /api/<domain> router
      → protect (JWT verify → User.findById → req.user)   [most routes]
      → authorize("admin") / adminOnly                      [admin routes]
      → multer (problem create/update/import)               [file routes]
      → controller (express-async-handler → catches async throws)
          → service (validation, DB, storage, queue)
          → res.json(...)
  → errorHandler (statusCode from AppError, stack hidden in prod)
```

---

# SECTION 3 — Technology Choices

## Node.js + Express
- **Why**: Single language across stack; non-blocking I/O fits an I/O-heavy judge (HTTP + Redis + DB + spawning child processes); huge ecosystem; Express is the de-facto minimal web framework; `express-async-handler` makes async controllers safe without try/catch boilerplate.
- **Alternatives**: NestJS (more structure, DI — overkill for this scope), Fastify (faster, schema-based — better perf but less familiar), Koa (lighter, but fewer docs), Go/Java (different team skills).
- **Tradeoffs**: Node is single-threaded — CPU-heavy judge work is offloaded to Docker via child processes so the event loop stays free; but JSON serialization of big results can block. Express 5 is newer with async handler support; no TypeScript means runtime-only safety.
- **Interview questions**: "Why not a compiled backend?" / "How does Node handle the Docker spawns?" / "Express 4 vs 5?"

## React + Vite
- **Why**: Ubiquitous, component model fits a complex interactive workspace; Vite = fast dev server (ESM + HMR), simple builds; React 19 (current at time of writing).
- **Alternatives**: Next.js (needs SSR/SEO — this is a private SPA, no need), Vue/Svelte (team familiarity), plain JS (unmaintainable for this UI complexity).
- **Tradeoffs**: Client-side rendering → SEO weak (fine for login-gated app); bundle size needs code-splitting (not done); no SSR.
- **Interview questions**: "Why not Next.js?" / "How does Vite differ from Webpack?" / "React 19 features you use?"

## Mantine UI
- **Why**: Complete component library (tabs, drawers, modals, tables, notifications, loading overlays) with dark/light themes and CSS variables; less CSS to write; Mantine `Notifications` used for errors.
- **Alternatives**: Material UI (heavier, opinionated), Ant Design, Tailwind + shadcn, Chakra.
- **Tradeoffs**: Adds bundle weight; opinionated styling (overridden with `style` props throughout).

## Zustand
- **Why**: Minimal boilerplate global state; selector-based subscription avoids context re-renders; direct store-to-API actions match the app's simple store pattern.
- **Alternatives**: Redux Toolkit (more ceremony, needed only for complex state), React Context (re-render storms, not designed for frequent updates like socket events), TanStack Query (would be *better* for server state, but they chose manual).
- **Tradeoffs**: Server-state (data fetching) and client-state are mixed in one store; no caching/deduplication — every visit refetches; **this is a legit criticism to own**.
- **Interview questions**: "Why Zustand over Redux?" / "Why not React Query?" / "How do you avoid stale closures with socket updates?" (they use `set()` functional updates).

## Monaco Editor
- **Why**: The same editor as VS Code; syntax highlighting, IntelliSense, theming for free; `@monaco-editor/react` wrapper is trivial to embed.
- **Alternatives**: CodeMirror 6 (lighter), Ace (lighter). Monaco is heavy (~3MB) but the best UX.
- **Tradeoffs**: Large JS bundle; on-demand loading isn't configured (static import).

## Express + Socket.IO
- **Why WebSockets over polling?** Real-time status streaming; bidirectional; rooms map cleanly to "one room per submission"; server-push avoids poll latency and thundering herd.
- **Alternatives**: SSE (one-way only — can't send join events), raw `ws` (need to reimplement rooms/reconnect), long-polling (wasteful).
- **Tradeoffs**: Socket.IO adds an HTTP upgrade endpoint; sticky sessions needed if scaled across processes; Redis adapter needed for multi-node (not yet implemented — they use Redis pub/sub only for worker→socket, sockets still in one process).
- **Interview questions**: "How would you scale Socket.IO horizontally?" (answer: socket.io-redis adapter + sticky sessions).

## BullMQ + Redis
- **Why**: At-least-once job delivery, retries with backoff, job retention, visibility, delay; decouples HTTP latency from judge time (a submission can take many seconds; the client shouldn't hold a socket open for it).
- **Alternatives**: RabbitMQ (external broker, needs an operator), Kafka (overkill, ordered-stream semantics), in-memory queue (jobs lost on crash, no horizontal scale), `setImmediate` + array (no durability).
- **Tradeoffs**: Adds Redis as a hard dependency; another thing to monitor/back up; jobs are at-least-once → duplicate judge risk on retries (mitigated by submissionId idempotency at the DB level — a retried job re-judges and overwrites, which is acceptable).
- **Interview questions**: "What does BullMQ store in Redis?" (lists: `bull:submission:wait`, `active`, `delayed`, etc. + zsets) / "What happens if Redis dies?" / "Why not RabbitMQ?"

## Redis pub/sub
- **Why**: Decouples **workers** from the **socket server** so worker instances can scale independently; worker just `publish`s, anyone subscribed gets it. In the current single-process deployment it's technically redundant, but it future-proofs and matches how you'd split processes.
- **Alternatives**: Emitting from worker in-process (tight coupling), polling the DB for status (adds load, latency).
- **Tradeoffs**: pub/sub is fire-and-forget — **if no subscriber is listening, the event is lost** (frontend 45s poll fallback covers this); no persistence.
- **Interview questions**: "What happens if the socket server restarts mid-judge?" (subscriber misses events → frontend falls back to polling `GET /problems/submissions/:id`).

## MongoDB + Mongoose
- **Why**: Flexible schemas for heterogeneous data (problem sample cases, nested results arrays); JSON-native (matches JS); fast iteration; aggregation pipeline for stats; simple horizontal scaling via sharding if ever needed.
- **Alternatives**: PostgreSQL — would give relational integrity, transactions, better analytics, but more rigid schema and joins; MySQL.
- **Tradeoffs**: No ACID across documents (some flows rely on ordering rather than transactions); denormalized `upvotes` arrays can hit 16MB doc limits at extreme scale; weak ad-hoc aggregation performance at scale vs SQL. **The docs don't have explicit indexes for most hot queries** — only the unique compound indexes on notes/review progress and email.
- **Interview questions**: "Mongo vs Postgres?" (see Section 23) / "Where do you need transactions?" (problem delete cascades; list import) / "16MB doc limit" (submission results with huge inputs).

## Docker
- **Why**: THE answer to "how do you safely run untrusted code?" Containers give kernel-level isolation (namespaces, cgroups), resource limits (`--memory`, `--cpus`), no-network mode, and cheap-ish ephemeral lifecycle. Uniform execution environment for C++/Python/Java (g++ version, openjdk 17, python 3) regardless of host.
- **Alternatives**: Firejail/bubblewrap/seccomp sandboxes, gVisor (better isolation, more setup), VMs (stronger isolation but slow for per-test-case startup), run code on the host with `timeout` (unsafe).
- **Tradeoffs**: Container creation per test case is expensive (hundreds of ms to seconds); Docker socket exposure to the backend is itself a privilege escalation vector (backend compromise = docker host compromise); no seccomp/apparmor profiles on sandbox containers.
- **Interview questions**: "Docker vs VMs?" / "How is an untrusted container isolated?" (namespaces, cgroups, network=none, no mounts) / "What could escape a container?"

## Docker Compose
- **Why**: Single-command local orchestration (5 services); env-file config; volumes for persistence; per-env compose files.
- **Alternatives**: Kubernetes (way overkill), docker run scripts (unmanageable), Podman compose.
- **Tradeoffs**: Single-host only; no orchestration-level health/replication.

## Nginx
- **Why**: Serve the built SPA + reverse proxy `/api` + WebSocket upgrade headers + gzip + immutable static caching + SPA fallback `try_files`.
- **Alternatives**: Caddy (simpler, auto-TLS), serving static from Express (no caching/proxy tuning).
- **Tradeoffs**: Extra moving part; requires the frontend built at container build time (`VITE_API_URL=/api` build arg).

## JWT (`jsonwebtoken`)
- **Why**: Stateless auth — no server-side session store; `Authorization: Bearer` works with the axios interceptor; 30-day expiry avoids frequent re-login.
- **Alternatives**: Sessions + cookies (revocable, httpOnly — better security but needs session store), OAuth (needs external provider), refresh-token rotation (better security, more complexity).
- **Tradeoffs**: Not revocable — a stolen token is valid 30 days; stored in localStorage → XSS-exposed (see Section 10/13). **No refresh tokens** — when it expires, user logs in again.
- **Interview questions**: "JWT vs session?" / "How do you revoke a JWT?" / "Where do you store it?"

## bcryptjs
- **Why**: Adaptive password hashing with salt; CPU-hard (Blowfish-based) → resists rainbow tables/GPU brute force; `bcryptjs` is pure-JS (no native build issues on Alpine).
- **Alternatives**: `bcrypt` (native, faster, needs build tools), `argon2` (current best practice — memory-hard), `scrypt` (Node built-in).
- **Tradeoffs**: bcrypt is older than argon2 (argon2 resists GPU/ASIC better); pure-JS is slower (fine at this scale). **Interview improvement**: switch to argon2.

## Nodemailer + SMTP
- **Why**: Standard Node email library; SMTP config in env (works with Gmail app passwords); supports HTML templates.
- **Alternatives**: SendGrid/Postmark APIs (paid), `nodemailer` + SES (needs AWS), just logging the link (dev fallback already built — `[Email Service Mock]`).
- **Tradeoffs**: Requires external SMTP creds; Gmail app passwords are flaky; email deliverability is on you.

## Multer (memory storage)
- **Why**: Simplest way to accept ZIP/test-file/checker uploads; buffer in memory lets the import service pass buffers straight into storage backends without temp-file juggling.
- **Alternatives**: `multer` disk storage (temp files + cleanup), `busboy` directly.
- **Tradeoffs**: Memory usage scales with upload size; no size limits configured on the multer instance (Express json body is 100kb default but multipart is not limited!) — **TRAP: no upload size cap**. ZIPs are fully extracted to disk; zip-bomb risk.

## adm-zip
- **Why**: Pure-JS ZIP extraction; no system unzip dependency; sync API keeps import code simple.
- **Alternatives**: `yauzl` (streaming, safer for zip-bombs), `unzipper`, system `unzip`.
- **Tradeoffs**: Synchronous extraction blocks the event loop (large archives freeze the server); extracts everything into a temp dir then validates (zip-bomb/path-traversal risk — mitigated by extraction to a private temp dir + cleanup, but `__MACOSX` filtering is superficial).

## @aws-sdk/client-s3 (for MinIO/S3/R2)
- **Why**: One SDK covers S3, MinIO (S3-compatible, `forcePathStyle`), and Cloudflare R2 (S3-compatible, custom endpoint) — three backends for one dependency.
- **Alternatives**: `minio` official client (one backend only), `aws-sdk` v2 (heavier).
- **Tradeoffs**: v3 is modular and tree-shakeable; but the abstraction over object storage means the local-FS backend must emulate object semantics (it does).

## TypeScript? → **Not used.**
- **Why JS?**: Faster iteration, no build step in backend, smaller diff. **Own the weakness**: no static types across ~50 files is a real maintainability cost; refactors are risky; IDE autocomplete is weaker. Interview answer: "I'd add TS next."

---

# SECTION 4 — Every Design Decision

| # | Decision | Problem | Options | Why it won | Tradeoffs | Improvements |
|---|---|---|---|---|---|---|
| 1 | Docker sandbox per test case | Run untrusted code safely | Firejail, VMs, gVisor, host execution | Containers = best balance of isolation/cost/simplicity; uniform env | Slow (container per case), docker socket exposure | Reuse containers for multiple cases, gVisor, seccomp profiles |
| 2 | Async judging via BullMQ | Submissions take seconds; HTTP must return fast | Synchronous judge, in-memory queue, Kafka | Durability + retries + decouple HTTP | Redis dependency, at-least-once duplicate judge on retry | Idempotency keys |
| 3 | Redis pub/sub between worker and socket | Real-time updates without coupling | Direct socket emit from worker, DB polling | Horizontal worker scaling later; single source of truth | Fire-and-forget (lost events) | Redis adapter for multi-node sockets + event replay |
| 4 | JWT in localStorage, 30d, no refresh | Simple auth | Cookies+session, refresh tokens | Simplest UX; stateless | XSS exposure, no revocation | httpOnly cookie + refresh rotation |
| 5 | Email verification token hashed (SHA-256) | Don't store raw tokens that leak account control | Store raw token, JWT link | DB leak doesn't leak working tokens | Token can't be recovered after hash; 24h expiry | Short-lived signed URLs |
| 6 | Storage abstraction (Local/MinIO/S3/R2) | Test-case files need multiple deploy targets | Hardcode FS, hardcode S3 | One code path, switch via env; MinIO for self-host, S3/R2 for cloud | Interface creep (checker methods are storage-coupled) | Content-addressed keys, presigned URLs |
| 7 | `docker start -a` with 10s outer timeout | Enforce wall-clock execution limit | Rely only on inner GNU `timeout` | Belt-and-suspenders | Compile-heavy languages can false-TLE at 10s outer cap | Make outer timeout configurable, track compile separately |
| 8 | Stop at first failing test case | Save compute | Run all cases always | Fail-fast, cheaper, matches Codeforces behavior | No partial score/aggregate metrics beyond first failure | Option to continue for diagnostics |
| 9 | Run (sync) vs Submit (async) | "Run" wants instant feedback on samples; "Submit" needs full judging | Both async, both sync | Run uses in-DB sample cases synchronously (fast, <5 cases); Submit is queued | Run can still take ~15s and blocks a worker slot implicitly (it does NOT use the queue → blocks the request) | Put Run on a separate priority queue too |
| 10 | Single backend process runs API + worker + socket | Deployment simplicity | Separate worker containers | One image, one container, simple dev | No independent scaling; socket room state is in one process | Split `worker` service with `concurrency` setting |
| 11 | BullMQ `attempts:3` + `removeOnComplete:100` | Transient failures shouldn't kill submissions; keep history bounded | attempts:1, unlimited retention | Resiliable; bounded memory in Redis | Duplicate work on retry; final verdict overwritten | Idempotency check before re-running |
| 12 | Aggregation pipeline for problem list (`$facet`) | Pagination + filter + sort in one round trip | `find().skip().limit()` + separate count | Single query, accurate total | `$regex` unindexed search is O(n) | Atlas search / text index |
| 13 | SM-2 spaced repetition | Review problems on forgetting curve | FSRS, Leitner, plain lists | SM-2 is simple, proven (Anki), easy to implement | Quality→rating mapping is custom; no scheduling jitter | Switch to FSRS (Anki's modern algo) |
| 14 | Discussion stored as flat list with `parentId`, assembled in JS | Threaded comments | Adjacency list with `$graphLookup`, ref-tree | `$graphLookup` max depth limit; simple JS assembly fine at scale | 2+ nested levels supported only implicitly; N+1 populate | Materialized paths / depth field |
| 15 | Comments deleted cascade via `deleteMany` | Orphan replies | Soft-delete, recursive delete | Simple, hard delete | Author replies gone too; no undo | Soft-delete with tombstones |
| 16 | `upvotes` array of user ObjectIds | Vote toggle | Separate Vote collection, counters | Atomic toggle with `indexOf` + save; no extra collection | Race conditions on concurrent votes (read-modify-write); array size cap | `$addToSet`/`$pull` atomic ops; separate collection |
| 17 | Admin bootstrap from env | First admin without manual DB | Seed script, signup code | Runs at startup, idempotent | **Password in env = secret in repo risk**; any new deployment with no admin auto-creates | One-time setup token / CLI |
| 18 | Storage health check blocks startup | Fail fast if test cases unavailable | Start anyway | Clear failure signal | Adds startup dependency on MinIO/S3 | Graceful degradation |
| 19 | `cors()` wide open | Dev simplicity | Locked origin list | Works from any origin | Anyone can call API (they'd need JWT anyway); still sloppy | Restrict to frontend origin(s) |
| 20 | Manual validation everywhere | Keep deps light | zod/joi/celebrate | No extra deps; errors are AppError | Inconsistent validation, easy to miss a field | zod schemas shared with types |

---

# SECTION 5 — Folder Walkthrough

## `backend/` — layered architecture

```
backend/
├─ index.js            env bootstrap → server.js
├─ server.js           composition root (routes, socket, worker)
├─ config/             db, socket, storage (factory), validateEnv
├─ constants/          problemTags catalog
├─ controllers/        thin request handlers
├─ services/           business logic (auth, problem, submission, import,
│                      discussion, stats, userlist, usernote, email)
├─ models/             Mongoose schemas
├─ routes/             URL → controller mapping + middleware
├─ middleware/         protect/authorize/adminOnly, errorHandler, multer
├─ jobs/               redis, queue, producer, worker, processor
├─ executor/           cpp/python/java executors, dockerExecutor, checker, evaluator
├─ storage/            Storage base + 4 implementations + factory
└─ utils/              AppError
```

**Why this structure is good**: It's a clean **controller-service-model layering** (like NestJS without the DI). Controllers never touch Mongoose or storage; services never touch `req`/`res`. The judge pipeline is isolated in `jobs/` + `executor/`, keeping infra code out of domain logic. Storage is behind an interface, so swapping backends is a one-line env change. Every folder maps to a single responsibility — easy to navigate, easy to test (services can be unit-tested with mocked models/storage).

**Interview questions this structure invites**:
- "Why do you have both `controllers` and `services`? What's the difference?"
- "Where would you add a new endpoint?"
- "Why is the worker imported as a side effect in `server.js`?"
- "What's the dependency direction between layers?" (routes→controllers→services→models; jobs→services? No — `submission.processor` imports models + storage + executor directly, not services. The processor is the one place that bypasses the service layer. Be ready to justify: it's the worker's "service.")

## `frontend/src/` — feature-first structure

```
frontend/src/
├─ main.jsx / App.jsx        bootstrap + routing + guards
├─ components/layout/        shared AppShell Layout
├─ features/                 one folder per domain:
│   ├─ auth/    landing/     problems/  stats/  userlist/  admin/
│   │           └─ components/ pages/ hooks/ utils/ data/ stores(?) 
├─ lib/                      api.js (axios), socket.js
└─ stores/                   Zustand stores (global)
```

**Why this is good**: **Feature-first** organization (folder-by-domain) instead of folder-by-type means adding a feature touches one folder; teams can own folders. Shared code lives in `lib/`; global state in `stores/`; routes centralized in `App.jsx` so guards are reviewable in one place. UI components are colocated with their feature, split by page vs component vs data.

**Interview questions**:
- "How is routing protected?" (App.jsx ProtectedRoute/AdminRoute)
- "How do components communicate?" (Zustand stores + props)
- "Where does API code live?" (stores call `lib/api.js`)

## `docker-compose*`, `scripts/`, `docs/`, `data-formater-scripts/`

- `docker-compose.yml` — default (maps to dev) 5 services.
- `docker-compose.dev.yml` — dev: ports exposed (mongo 27017, redis 6379, minio 9000/9001), hot-reload mounts, `command: npm run dev`.
- `docker-compose.prod.yml` — prod: no host ports except 80, `npm ci --only=production`, `npm start`, Nginx multi-stage build.
- `scripts/` — `start/stop/reset` per env. **Key detail**: `start-*.sh` force-removes stale containers, **builds the `oj-executor` image first**, checks `.env`, then compose up.
- `docs/` — architecture.md, judge.md, importer.md (the specs this project implements).
- `data-formater-scripts/` — Python tooling (`uv`-managed) that pulls OpenR1/Codeforces datasets and emits problem packages in the importer's ZIP format, mapping CF tags→platform tags and rating→difficulty. `main.py` is a stub.

---

# SECTION 6 — Code Walkthrough

## `backend/index.js` (6 lines)
Loads dotenv twice: parent `../.env` (root of repo) **then** `./.env` (backend dir) as fallback. This means config lives at repo root. Then imports `server.js`.

**Hidden assumption**: `process.cwd()` must be `backend/` (compose sets WORKDIR /app which is `./backend`). If you run `node index.js` from repo root, the fallback load order differs and env may be missing.

## `backend/server.js` (56 lines)
- `validateEnv()` → `await connectDB()` → `await bootstrapAdmin()` are all **top-level awaits** before the app starts. Node ESM supports top-level await. This makes startup order deterministic and fail-fast.
- `storage.isHealthy()` returns a bool; `process.exit(1)` on false. **Note**: this happens after DB connect, so Mongo/Redis/MinIO all must be up before the API listens.
- `app.use(cors())` — no origin restriction (see Security).
- `express.json()` — default 100kb limit. **Trap**: a submission's `code` field rides in JSON; a 150kb solution → 413 error surfaced as raw HTML, not an AppError. Unbounded `multer` covers file uploads instead.
- `import "./jobs/workers/submission.worker.js"` — side-effect import starts the worker before `listen`. The worker shares the process with API + socket.
- `initSocket(server)` binds Socket.IO to the same HTTP server.

## `backend/config/socket.js` (69 lines)
- Single `io` instance via closure; `getIO()` throws if called before init (defensive).
- Subscribes to `submission_updates` on the **subscriber** connection at init.
- On message: `JSON.parse`, filter by channel, require `submissionId`, `io.to("submission:"+id).emit("submission_update", data)`. Payload includes `{submissionId, status, submission}`.
- Socket events: `join_submission`, `leave_submission`, `disconnect`. **No authentication on socket connection** — anyone who knows a submissionId can join its room (but IDs are unguessable Mongo ObjectIds; still, no authz check that you own the submission — **a privacy gap** worth owning).
- **Hidden assumption**: one socket server per deployment. Horizontal scale would need `@socket.io/redis-adapter`.

## `backend/jobs/redis.js` (29 lines)
- One ioredis `connection` with `maxRetriesPerRequest: null` (required by BullMQ — otherwise commands fail fast and jobs break).
- `publisher = connection`; `subscriber = connection.duplicate()` — pub/sub needs a dedicated connection because a subscribed connection can't run commands.
- `publishSubmissionUpdate` stringifies `{submissionId, ...data}`. Errors swallowed (logged) so a Redis hiccup doesn't crash the worker.

## `backend/jobs/workers/submission.worker.js` (53 lines)
- `new Worker("submission", async job => ...)`.
- Throws on missing `submissionId` → BullMQ retry (attempts:3).
- On process error: tries to mark DB submission `internal_error` + publish update (best-effort), then **rethrows** so BullMQ marks the job failed and applies backoff. **Subtle**: with attempts:3, a genuinely-bad submission that throws will be judged up to 3 times, each run setting `running` again and possibly overwriting a prior verdict. Duplicate-judge is accepted as cost of retry.
- `worker.on("failed")` logs only.

## `backend/jobs/processors/submission.processor.js` (116 lines) — the heart
1. Load submission; throw if missing.
2. Set `status="running"`, `startedAt`, save, publish `running`.
3. Load problem.
4. `storage.listTestCases(problemId)` → `[{input, output}]`.
5. Loop: read input/output content; `executeCode`; optional checker (`runChecker`) when `problem.checker.enabled` && execution succeeded; `evaluateExecutionResult(result, expectedOutput, passedOverride)`.
6. Track `maxTime`, `maxMemory` across **successful metric reads** (guard `typeof number`).
7. Push `{input, output, expectedOutput, passed}` per case; `break` on first non-accepted.
8. Save final fields + `results` + `completedAt`; publish final event; return verdict.

**Hidden assumptions / issues**:
- Runs test cases **sequentially** — a problem with 50 cases = 50 container spawns, ~50 × (spawn + compile). Slow but safe; concurrency would speed it but risks resource contention.
- **Inputs and full outputs are stored in the Submission document** — memory/storage blowup for large test cases; the sample results in `Problem.testCases` are small, but hidden-case results can be MBs. Own this.
- If `storage.getInputContent` throws (file missing), the whole job throws → `internal_error` after retries. No per-case error capture.
- First-failure break means `results` is truncated; executionTime is max across **all** cases that ran (before the failing one), so a TLE on case 3 with cases 1–2 fast still records case-3 runtime? No — it breaks and records maxTime over executed cases. Metrics only cover executed cases.

## `backend/executor/dockerExecutor.js` (152 lines) — the sandbox core
- Builds a **bash command string** per language; that string is the container's CMD.
- `docker create --memory=256m --cpus=0.5 --network=none oj-executor <command>` — `--network=none` is the key security control (no outbound/inbound networking).
- `docker cp` code + input into `/code`.
- `docker start -a` with **outer `exec` timeout 10s** (`timeout: 10000` in `execPromise`). If the container exceeds it, `exec` kills the child with SIGTERM → caught → `timeout=true`. Combined with inner GNU `timeout ${EXECUTION_TIMEOUT}s` (default 5s), there are **two timeouts**.
- `docker inspect` reads `.State.ExitCode` and `.State.OOMKilled` for the true status even when exec errored (the process was killed by our own exec timeout).
- `docker cp /code/metrics.txt` out; parse `time:` (sec→ms) and `memory:` (KB→bytes). Missing metrics file is normal (compile failure) → swallowed.
- `finally`: `docker rm -f` + unlink local temp files. Container is always cleaned up even on error.
- **Trap**: uses `child_process.exec` which spawns `/bin/sh -c`. The `command` is constructed from `ext`/`command` (internal constants) — user `code` is written to a file, **never interpolated into a shell command**, so no command injection. Good design, be ready to explain.
- **Trap**: `exec` shell quoting of file paths: temp paths contain UUIDs only, safe.
- **Trap**: If the container is OOM-killed, `/usr/bin/time` may or may not write metrics; OOMKilled is detected via inspect, and metrics read is best-effort.

## `backend/executor/cppExecutor.js` / `pythonExecutor.js` / `javaExecutor.js`
Each builds a bash command:
- C++: `g++ /code/Main.cpp -o /code/main 2> /code/compile_output.txt; if [ $? -ne 0 ]; then echo '___COMPILE_ERROR___'; cat /code/compile_output.txt; exit 111; fi; /usr/bin/time -f "time:%e\nmemory:%M" -o /code/metrics.txt timeout 5s /code/main < /code/input.txt`
- Python: `python3 -m py_compile` (syntax check) then `timeout 5s python3 Main.py`.
- Java: `javac Main.java` then `timeout 5s java -cp /code Main`.
- Exit code `111` is the **sentinel for compile error** (111 is otherwise a valid user exit code, but the `___COMPILE_ERROR___` marker + stdout/stderr scrubbing make it unambiguous in practice).
- `isCompileError = exitCode === 111`; on compile error, stdout/stderr are rebuilt from compile output and cleared.

**Hidden issue**: exit code 111 collision — if a user's program exits 111 without the marker, `isCompileError` would be true and stdout wrongly labeled as compile output. The marker is only echoed on the compile-fail path, so `(stdout+stderr)` won't contain it → you'd get a bogus "Compile Error" with the user's stdout. Rare; own it.

## `backend/executor/evaluateExecutionResult.js`
Pure function mapping `{status, exitCode, timeout, oomKilled, stdout, stderr, compileOutput}` + `expectedOutput` + optional `passedOverride` → `{status, actualOutput, passed, exitCode, compileOutput, stderr}`.
- Compile error → status compile_error, exit 111 default.
- timeout → TLE, exit 124 default, stderr "Time Limit Exceeded".
- oomKilled → MLE, exit 137 default.
- non-zero exit → runtime_error, stderr.
- success → compare `actualOutput.trim() === expectedOutput.trim()` (whitespace-insensitive exact match). Checker `passedOverride` wins if provided.

**Hidden assumption**: output comparison trims both sides — so trailing/leading whitespace ignored, internal whitespace significant. Standard online-judge behavior.

## `backend/executor/runChecker.js`
Runs `python3 /code/checker.py /code/input.txt /code/expected.txt /code/actual.txt` in a sandboxed container (same create/cp/start/inspect/rm flow). Expects stdout exactly `1` (pass) or `0` (fail); anything else or non-zero exit → throws → treated as internal error. 5s outer timeout for the checker.

**Security**: the checker is admin-uploaded code run in the same no-network sandbox — acceptable.

## `backend/services/submission.service.js`
- `runSolution`: synchronous; runs the **sample** `problem.testCases` through `executeCode` directly (no queue), returns `{response:[{input, output, expectedOutput, passed}]}`. Blocks the HTTP request up to N × (compile+run) seconds.
- `submitSolution`: creates Submission `queued`, enqueues, returns `{status:"queued", submissionId}` immediately.
- `getSubmissionById` / `getSubmissions`: straightforward reads. **No authorization check** that the requesting user owns the submission/problem — anyone with a valid JWT can read any submission (privacy gap, mention in Security).

## `backend/services/problem.service.js`
- `getAllProblems`: builds a match query (regex title search, difficulty, `$all` tags), sorts (title/difficulty-weighted/newest), then a single `$facet` pipeline returning `{metadata:[{count}], data:[skip,limit]}` — pagination + total in one aggregation.
- `createProblem`: manual field validation → parses testCases/tags JSON strings (multer sends strings) → validates tags against `PROBLEM_TAG_IDS` → pairs input/output files via `getTestPairs` (regex `input_(\d+)`) → uploads to storage → sets checker metadata.
- `updateProblem`: partial update; handles `removeChecker` flag, new checker upload, testCases/tags parsing; `findByIdAndUpdate` with `runValidators:true`.
- `deleteProblem`: deletes doc then best-effort `storage.deleteTestCases`. **Not transactional** — orphan test files remain if storage delete fails (logged only).

## `backend/services/auth.service.js`
- `generateToken` → `jwt.sign({id}, JWT_SECRET, {expiresIn:"30d"})`.
- `registerUser`: check fields → duplicate email → bcrypt hash (cost 10) → `crypto.randomBytes(32).toString("hex")` raw token → SHA-256 hash stored → create user (`isVerified:false`, 24h expiry) → send email → return user + JWT.
- `loginUser`: `findOne({email})` + `bcrypt.compare`; returns JWT; does **not** require verified email to log in (verification gates app access on the frontend only — API does not enforce `isVerified` in `protect`; **a client can call any API unverified**).
- `verifyEmailToken`: hash incoming → find user → check expiry → set verified, delete token fields.
- `resendVerificationEmail`: regenerates token.
- `bootstrapAdmin`: if no admin exists and `INITIAL_ADMIN_*` set, create (or promote existing user to) verified admin. Logged prominently.

## `backend/services/userlist.service.js`
- `syncReviewProgress`: upserts a `ReviewProgress` card per problem when SR enabled.
- `calculateSM2`: classic SM-2. rating 1–4 → quality 1/3/4/5. q<3 → reset reps, interval 1 day. else interval = 1 (rep 0) → 6 (rep 1) → ceil(interval×ease) (rep ≥2); ease += 0.1 − (5−q)(0.08+(5−q)×0.02), floor 1.3.
- `enrichListWithSRStats`: computes dueToday/studiedToday/nextReview/learned/progress; **only for the list owner**.
- `getDueCards`: `nextReviewDate <= now`, populated problem.
- `updateReviewCard`: computes next date (days + interval, midnight), sets `lastReviewDate=now`.
- `importUserList`: clones public (or own) list, resolves name collisions with " (N)", private by default.

## `backend/services/stats.service.js`
- `getOverview`: loads **all** submissions for the user into memory (`Submission.find({user})`) — O(user's submissions) memory; computes counts, sets, streaks by JS date math. **Scaling trap** at 10k+ submissions.
- `getDifficultyStats`: total counts via `countDocuments`, solved via accepted submissions populated problem → Sets.
- `getLanguageStats`: in-memory tally.
- `getTagStats`: aggregates across populated problems; returns most-solved and weakest (by acceptance rate) top-10.
- `getSubmissionCalendar`: last 365 days → `{dateStr: count}`.
- **Common pattern**: all stats are computed on-demand, in Node, from raw submissions — no precomputed rollups, no caching. Fine for small users, bad at scale (see Section 12/19).

## `backend/services/discussion.service.js`
- `getCommentsForProblem`: fetch all for problem, split into top-level/replies by `parentId`, attach `replies` arrays in JS.
- `createComment`: optional parent validation.
- `updateComment`: author-only.
- `deleteComment`: author or admin; cascade `deleteMany({parentId})` for top-level.
- `toggleVote`: read-modify-write of `upvotes` array (`indexOf`/`splice`/`push`) then `save()`. **Race**: two simultaneous votes from different tabs → lost update. Improvement: `$addToSet`/`$pull`.

## `backend/services/import.service.js`
- `importProblems`: validate zipBuffer + type → `mkdtempSync` → `new AdmZip(buffer).extractAllTo(tempDir, true)` → detect single-root-folder wrapper (single) or root-of-folders (bulk) → per package: `processProblemPackage` → **reuses `problemService.createProblem`** by fabricating multer-like `{originalname, buffer}` file objects. Finally cleanup temp dir.
- Bulk import **continues on per-package failure** and reports `{title, status:"failed", error}`.
- Generates sample test cases from `input_1/output_1` and `input_2/output_2` when `problem.json` has none.
- Tag resolution maps CF-style labels to platform ids.

## `backend/middleware/auth.middleware.js`
- `protect`: reads `Authorization: Bearer <token>` → `jwt.verify` → `User.findById(decoded.id).select("-password")` → `req.user`. Throws 401 "Not authorized". If token present but invalid → 401. If no header → 401.
- `authorize(...roles)` → 403 if role not included.
- `adminOnly` → legacy alias (401). Note the inconsistency: admin routes use `authorize("admin")` (403) in admin.routes, while problem routes use `adminOnly` (401). Be ready to explain or admit inconsistency.

## `backend/middleware/error.middleware.js`
- Determines status: `err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500)`.
- Returns `{message, stack}`; stack null in production.
- **Trap**: 404/validation errors from Mongoose (CastError, ValidationError) are NOT mapped → they surface as generic 500s. No handling for `MulterError`, no `next(err)` for unmatched routes (no 404 route handler — unmatched paths hit the default Express 404 HTML page). Own this.

## `frontend/src/stores/submissionStore.js` — the real-time client logic
- `submitSolution` guards against concurrent submits (state check) then:
  1. POST submit → get submissionId → set `submissionResult={status:"queued",_id}`.
  2. Returns a Promise that resolves when the socket `submission_update` event arrives with a terminal status.
  3. Sets a **45s `setTimeout` fallback** → `GET /problems/submissions/:id`; if socket never delivers, resolve from HTTP (or reject with "judgment timed out").
  4. `socket.emit("join_submission", id)`; listener filters by `submissionId`; on terminal status → clearTimeout, `socket.off`, `emit leave_submission`, resolve.
- **Race note**: the promise's cleanup closure captures `handleUpdate`; correct `socket.off` usage.

## `frontend/src/features/problems/pages/ProblemWorkspace.jsx`
- Orchestrates everything; per-problem localStorage persistence of code/language; editor settings persisted globally; `isSubmissionPending` locks Run/Submit; `autoRevealSR` flips when a submission becomes Accepted (drives ReviewBanner).
- `useEffect` on `submissionResult.status === "Accepted"` — **watch out**: the status string from the backend is lowercase `accepted`, but this checks `"Accepted"` (capital A) — see Debugging. Actually the check at line 154 is `submissionResult.status === "Accepted"` while all other code compares lowercase (`status === "accepted"`). This is a **real latent bug**: auto-reveal may never fire. Great debugging story.

## `frontend/src/lib/api.js`
- Axios instance; request interceptor injects `Authorization: Bearer` from `localStorage.user.token`. No response interceptor → 401s are not globally handled (no auto-logout on token expiry). Token expiry → 401 errors per-request, user sees error notifications; app doesn't kick them to login. Own this gap.

## `frontend/src/lib/socket.js`
- Singleton socket; URL derived by stripping `/api` from `VITE_API_URL`. Auto-connect even on public pages (minor waste). 10 reconnect attempts / 1s delay. No auth on socket.

## `frontend/nginx.conf` (prod)
- SPA `try_files ... /index.html`; `/api` proxied to `backend:5000` with WebSocket `Upgrade` headers (needed because socket.io and API share the backend port); gzip on; immutable 1-year cache for hashed assets. Note the `Connection 'upgrade'` header is set for **all** `/api` requests, not just websockets — works because socket.io upgrades over the same path; harmless for plain HTTP.

---

# SECTION 7 — Data Flow

## Flow A: User submits a solution (end-to-end)

```
1.  User clicks "Submit"                      [CodeEditor.jsx]
2.  handleSubmit → if pending, return
3.  consoleTab = "submit"
4.  submissionStore.submitSolution({problemId, code, language})
        ├─ guard: already loading/queued/running → return
        ├─ isLoading=true, submissionResult=null
        ├─ POST /api/problems/submit            [axios + Bearer JWT]
5.  Nginx proxy → Express
6.  protect middleware: verify JWT → req.user
7.  submitSolution controller
8.  submission.service.submitSolution:
        ├─ validate problemId/code/language
        ├─ Problem.findById(problemId)
        ├─ Submission.create({status:"queued", queuedAt})
        ├─ enqueueSubmission({submissionId})   [BullMQ add]
        └─ → {status:"queued", submissionId}
9.  store: submissionResult = {status:"queued", _id}
        ├─ new Promise
        ├─ 45s setTimeout fallback → GET /problems/submissions/:id
        ├─ socket.emit("join_submission", id)
        └─ socket.on("submission_update", handleUpdate)
10. BullMQ Worker picks job (job.data.submissionId)
11. processSubmission:
        ├─ Submission.findById → status="running", save
        ├─ publishSubmissionUpdate(id, {status:"running", submission})
12. Redis pub/sub: publisher → channel submission_updates
13. Socket.IO subscriber (duplicate conn) receives message
        └─ io.to("submission:"+id).emit("submission_update", data)
14. Frontend handleUpdate: submissionResult = data.submission
        └─ UI shows "Evaluating solution in Docker sandbox..."
15. Worker loop over hidden test cases:
        ├─ storage.getInputContent / getOutputContent
        ├─ executeCode({code, language, input})
        │    └─ cpp/python/java executor
        │         └─ runInDocker: docker create/cp/start/inspect/rm
        ├─ (optional) runChecker
        └─ evaluateExecutionResult → case verdict; break on fail
16. Worker: save {status, executionTime, memoryUsage, results, completedAt}
17. publishSubmissionUpdate(id, {status: finalStatus, submission})
18. Redis → Socket.IO → room
19. Frontend: terminal status → clearTimeout, socket.off, leave room,
        isLoading=false, resolve Promise
        └─ ProblemWorkspace .then → getSubmissions(id) refresh history
20. UI: WorkspaceConsole shows verdict badge + per-case input/expected/actual
```

## Flow B: Email verification

```
Register → POST /api/auth/register
  → registerUser
      → bcrypt hash, rawToken=randomBytes(32).hex, sha256(rawToken) stored
      → sendVerificationEmail(rawToken)
          → SMTP email with link: {FRONTEND_URL}/verify-email?token=<raw>
User clicks → GET /api/auth/verify-email?token=<raw>
  → verifyEmailToken: sha256(raw) → findOne({verificationToken:hash})
  → check expiry → isVerified=true, delete token fields
  → {message, isVerified:true, user}
Frontend authStore.verifyEmail updates localStorage user.isVerified
```

## Flow C: Spaced repetition review

```
User opens list with SR enabled
  → GET /api/userlists/:id/review/due → ReviewProgress where nextReviewDate<=now (populated problem)
User opens a problem?deck=<id> → ReviewBanner loads list
User solves, submits → Accepted → autoRevealSR=true (BROKEN: "Accepted" vs "accepted")
User rates Again/Hard/Good/Easy (1-4)
  → POST /api/userlists/:id/review/:problemId {rating}
      → updateReviewCard → calculateSM2 → new interval/ease/nextReviewDate
      → navigate to /userlists/:id/review → next due card
```

---

# SECTION 8 — Database

## Collections & schemas

| Collection | Key fields | Indexes | Notes |
|---|---|---|---|
| `users` | name, email, password(bcrypt), role(user/admin), isVerified, verificationToken(hash), verificationTokenExpire | `email` unique (auto) | timestamps |
| `problems` | title, description, difficulty, testCases[{input,expectedOutput}], tags[], checker{enabled,language,filename} | none explicit | timestamps |
| `submissions` | user(ref), problem(ref), code, language, status(enum 9 values), executionTime, memoryUsage, exitCode, compileOutput, stderr, queuedAt, startedAt, completedAt, results[{input,output,expectedOutput,passed}] | none explicit | timestamps; `results` can be large |
| `discussions` | problem(ref), user(ref), content, parentId(ref self, null=top), upvotes[ObjectId], editedAt | none explicit | timestamps |
| `userlists` | owner(ref), name, description, isPublic, spacedRepetitionEnabled, problems[ObjectId] | none explicit (owner+name unique enforced in service, not schema!) | timestamps |
| `usernotes` | user(ref), problem(ref), content | **compound unique {user,problem}** | upsert-based |
| `reviewprogress` | owner(ref), userList(ref), problem(ref), easeFactor, repetitions, interval, nextReviewDate, lastReviewDate | **compound unique {owner,userList,problem}** | timestamps |

## Relationships

- **Submission → User, Problem**: many-to-one references.
- **Discussion → Problem, User**: many-to-one; **self-reference `parentId`** for nesting.
- **UserList → Owner, Problem**: many-to-many via array of refs (denormalized).
- **ReviewProgress → Owner + UserList + Problem**: unique triple.
- **Note → User + Problem**: unique pair.

## Why this schema

- **MongoDB documents map naturally** to the JSON shapes the API returns (nested `testCases`, `results`, `upvotes` need no joins).
- **Referential ObjectIds** (not embedded) keep documents small and avoid data duplication (a problem's description isn't copied into every submission).
- **Compound unique indexes** (notes, review progress) enforce the "one row per (X,Y)" invariant at the DB level — a service-level check would race.
- **Denormalized `problems` array in userlist** mirrors the "ordered playlist" concept (order preserved).

## Alternative schemas

- **Relational (PostgreSQL)**: submissions/judges/comments as join tables; would need to map nested results → JSONB; better for user-level analytics SQL; worse for polymorphic embedding.
- **Embed submissions' results in problems** (aggregation to one doc) — bloats problem docs, wrong granularity.
- **Separate `votes` collection** instead of `upvotes` array — better concurrency, more queries.
- **Separate `testcasefiles` metadata collection** — you could store test-case *metadata* (names, sizes) in Mongo and content in object storage; currently content-only-in-storage, names inferred from the filesystem/object list. Tradeoff: `listTestCases` requires a storage listing each time (slow on S3 for many objects).

## Common interview questions

1. "Why no explicit indexes on `Submission.user`, `Submission.problem`, `Submission.createdAt`?" → Stats queries (`find({user})` sorted) do COLLSCANs; `getSubmissions` scans. **Honest answer**: this is debt; add `{user:1, createdAt:-1}` and `{problem:1, createdAt:-1}`.
2. "Where's the transaction problem?" → `deleteProblem` (doc + storage), `importUserList` (source check + insert), `createProblem` (doc + N storage uploads + checker). If storage fails mid-way, you have orphan files or a problem with missing cases. Fix: sequence with compensation or 2-phase (upload then create then cleanup-on-fail).
3. "16MB document limit" → a submission with huge inputs in `results` (stored for UI display) and `upvotes` arrays can grow. Fix: store only verdict/ids, fetch case content on demand.
4. "Why store full code in submissions?" → needed for history/code viewer; costs storage but keeps history self-contained.

## Performance concerns
- `getOverview` loads ALL submissions into RAM (streak math). O(n) memory per request.
- Regex search `{title: {$regex}}` → full collection scan.
- No pagination on `getSubmissions` (returns everything for a problem).
- Aggregation `$facet` is efficient for the problems list (one pass).
- `enrichListWithSRStats` runs a `ReviewProgress.find` per list → N+1 when listing many lists (`getAllUserLists`).

---

# SECTION 9 — API Design

## Why REST?
REST over HTTP is the default for CRUD-heavy APIs: predictable, cacheable, tooling-rich (curl/Postman), matches Express idioms. GraphQL would help for the workspace (fetch problem + lastSubmission + discussions in one query) but adds a schema layer, resolvers, and caching complexity not worth it for a small team.

## Endpoint inventory

| Method | Path | Auth | Body/Query | Purpose |
|---|---|---|---|---|
| POST | /api/auth/register | public | name,email,password | create + email verify |
| POST | /api/auth/login | public | email,password | JWT |
| GET | /api/auth/user | protect | — | current user |
| GET/POST | /api/auth/verify-email | public | token | verify email |
| POST | /api/auth/resend-verification | public | email | resend token |
| GET | /api/admin/users | admin | search,page,limit | list/search users |
| POST | /api/admin/users/:userId/promote | admin | — | grant admin |
| GET | /api/problems | protect | page,limit,search,difficulty,tags,sortBy | paginated list |
| GET | /api/problems/:id | protect | — | problem + user's last submission |
| POST | /api/problems | admin+upload | title,description,difficulty,testCases,tags,inputs[],outputs[],checker | create |
| PUT | /api/problems/:id | admin+upload | partial | update |
| DELETE | /api/problems/:id | admin | — | delete + storage cleanup |
| POST | /api/problems/run | protect | problemId,code,language | sync sample test |
| POST | /api/problems/submit | protect | problemId,code,language | enqueue judge |
| GET | /api/problems/:id/submissions | protect | — | history (unpaginated) |
| GET | /api/problems/submissions/:submissionId | protect | — | one submission (poll fallback) |
| POST | /api/problems/import | admin+upload | file (zip), type | import |
| GET/POST | /api/userlists | protect | — | list/create |
| GET/PUT/DELETE | /api/userlists/:id | protect | — | read (owner or public)/update/delete |
| POST | /api/userlists/:id/problems | protect | problemId | add |
| DELETE | /api/userlists/:id/problems/:problemId | protect | — | remove + SR card cleanup |
| POST | /api/userlists/:id/import | protect | — | clone public/own list |
| GET | /api/userlists/:id/review/due | protect | — | due SR cards |
| GET | /api/userlists/:id/review/stats | protect | — | SR stats |
| POST | /api/userlists/:id/review/:problemId | protect | rating(1-4) | SM-2 update |
| POST | /api/userlists/:id/review/reset | protect | — | reset deck |
| GET | /api/stats/overview,difficulty,languages,tags,activity,calendar | protect | — | stats endpoints |
| GET | /api/discussions/problem/:problemId | protect | — | nested comments |
| POST | /api/discussions/problem/:problemId | protect | content,parentId | create comment/reply |
| PUT | /api/discussions/:id | protect | content | edit (author) |
| DELETE | /api/discussions/:id | protect | — | delete (author/admin) |
| POST | /api/discussions/:id/vote | protect | — | toggle upvote |
| GET | /api/notes/problem/:problemId | protect | — | get note |
| PUT | /api/notes/problem/:problemId | protect | content | upsert note (5000 cap) |
| DELETE | /api/notes/problem/:problemId | protect | — | delete note |

**Notable design choices**:
- Route order matters in `problem.route.js`: `/submissions/:submissionId` is declared **after** `/:id` — but `GET /problems/submissions/:submissionId` would match `/:id` first? No — Express matches in registration order: `/:id` is registered before `/submissions/:submissionId`, so `GET /api/problems/submissions/abc` hits `/:id` with id="submissions"! **Wait**: `router.get("/:id", ...)` at line 19, and `router.get("/submissions/:submissionId", ...)` at line 53. `GET /api/problems/submissions/<oid>` → matches `/:id`? `/:id` matches a single segment; `/submissions/<oid>` is two segments → `/:id` does NOT match. It matches `/:id/submissions`? That's also two segments with second literal "submissions" — `/submissions/<oid>` first segment "submissions", second "<oid>" ≠ "submissions", so no. It matches `/submissions/:submissionId` (line 53) → correct. **BUT** `POST /problems/submit` and `POST /problems/run` at lines 51-52 come AFTER `POST /` (line 21) and `POST /import` (32)... `POST /api/problems/run` → registered routes: `POST /` (no, path not empty), `POST /import` (no), `POST /run` matches at line 51. Fine. And `GET /problems/:id` (line 19) — a request to `/problems/import` via GET would match `/:id` and return a problem with id "import" → CastError 500. But import is POST only. OK. **Real trap to mention**: `GET /api/problems/submissions/:id` relies on segment count; cleanest would be ordering `/submissions/:id` before `/:id`, which is actually done (line 53 after 19 but segment count disambiguates).
- Status codes: 200 success, 201 created, 400 AppError validation, 401 unauthenticated, 403 forbidden, 404 not found, 500 default. `errorHandler` maps unknown errors → 500 (or current res.statusCode if not 200).
- **No `/health` endpoint** (compose has no healthchecks for backend; storage health is startup-only).

## Could GraphQL work?
Yes — the workspace page (problem + lastSubmission + comments + notes in one render) is the classic GraphQL N+1 case. But: auth middleware differs per resource, uploads/import are awkward in GraphQL, and a small team gains more from REST simplicity. Also real-time is handled by Socket.IO, not subscriptions, so GraphQL subscriptions wouldn't add value here.

## Validation
Manual in services (if/throw AppError). No schema library. Examples: required-field checks, tags whitelist, difficulty enum (also DB-level), test-pair matching, checker 5MB cap, note 5000 cap, rating range NOT validated (`rating` passed straight into `calculateSM2` — an invalid rating yields `q=4` default. Minor).

## Error handling
`express-async-handler` catches async rejections; `AppError` carries statusCode; error middleware emits `{message, stack}`. Covered in Section 14.

---

# SECTION 10 — Authentication

## Flow
1. **Register**: bcrypt(password, 10) stored; raw 32-byte hex token emailed; SHA-256 hash + 24h expiry stored.
2. **Verify**: click link → GET verify-email?token= → hash → match → `isVerified=true`, tokens deleted.
3. **Login**: `findOne({email})` + `bcrypt.compare` → JWT `{id}` signed with `JWT_SECRET`, `expiresIn:"30d"`.
4. **Every request**: `Authorization: Bearer <jwt>` → `protect` → `jwt.verify` → `User.findById` → `req.user`.

## JWT details
- Payload: only `{id, iat, exp}` (no role/email) → **role is fetched from DB every request** → role changes (promote) take effect immediately. Good design, be proud of it.
- Stateless: no server-side session. The cost: cannot revoke.
- Secret enforced ≥32 chars at startup (`validateEnv`).

## Refresh tokens? Sessions? Cookies?
- **No refresh tokens** — 30d single token. Tradeoff: long-lived tokens are riskier; but simpler UX (login once a month).
- **No cookies** — localStorage. Tradeoff: XSS can steal tokens (mitigated only by React's default escaping; a malicious `dangerouslySetInnerHTML` in a problem description/comment could execute). httpOnly cookie would be safer against XSS but requires CSRF defenses (which are otherwise not needed with Bearer headers).
- **Sessions** would give revocation + server control but need a session store (Redis) and cookie logic.

## Password hashing
- bcrypt, cost 10, random salt embedded in hash. Never logged.

## Email token hashing
- `randomBytes(32)` = 256 bits entropy (unguessable). Stored SHA-256-hashed → DB leak doesn't expose working tokens. Expiry 24h. On use, tokens deleted.

## Security considerations / potential attacks
| Attack | Status | Mitigation |
|---|---|---|
| Token theft (XSS) | **Vulnerable** | localStorage + no CSP; add httpOnly cookie, sanitize all rendered content |
| JWT replay | Acceptable | 30d expiry; shorted to hours + refresh for prod |
| Brute-force login | **No rate limiting** | Add express-rate-limit |
| Enumeration (register duplicate email) | Present | 400 "User already exists" reveals accounts; use generic message |
| Unverified-user API access | **Present** | `protect` doesn't check `isVerified`; frontend-only gate |
| Submission privacy | **Present** | `getSubmissionById`/`getSubmissions` don't verify ownership |
| Admin brute force | Protected | env-generated admin; but no rate limit |
| Token in URL/logs | Present | verify-email token is in query string → lands in access logs; move to POST body or short-lived |

---

# SECTION 11 — Performance

## Time/Space complexity
- **Problems list**: aggregation `$match` + `$sort` + `$facet` → O(N) scan for regex, O(N log N) sort, skip/limit.
- **Judge loop**: O(T) test cases × O(compile+run) — dominated by Docker overhead, not CPU.
- **Streak/stats**: `getOverview` → O(S) time & memory where S = user's submissions (loaded fully).
- **Tag stats**: O(S × tags) in memory.
- **Discussions fetch**: O(C) docs + JS assembly, O(C) memory.
- **Comment delete**: top-level = 2 queries (delete + deleteMany).
- **Notes/list lookups**: O(1) via compound unique indexes.

## Caching
- **None** for API responses. Problems list, stats, problem pages are recomputed per request.
- **Frontend caching**: localStorage for code/editor settings; Nginx immutable cache for static assets only.
- Redis is available but used only for queue/pub-sub — **an obvious improvement candidate** (cache problem lists, popular stats, rate-limit counters).

## Pagination
- Problems: `$facet` skip/limit — works but skip is O(n) for deep pages; improvement: keyset (cursor) pagination on `_id`/createdAt.
- Users (admin): skip/limit.
- Submissions list: **no pagination** (returns all).

## Debouncing / lazy loading / memoization
- **Not used** except: Monaco `automaticLayout`; Monaco is lazy-loaded by the wrapper on first use of Editor. Code is saved to localStorage on every keystroke (`handleCodeChange` → `setItem`) — **no debounce** (minor; localStorage is fast but synchronous on main thread).
- React memo/useMemo: minimal. The workspace re-renders a lot. Could optimize with `React.memo` on console components.

## Database optimization
- Compound unique indexes on `usernotes` and `reviewprogress` — the only explicit indexes.
- Missing: `submissions {user, createdAt}`, `submissions {problem, createdAt}`, `discussions {problem}`, `userlists {owner}`.

## Bottlenecks (ranked)
1. **Docker container-per-case** — biggest latency (ms-to-seconds per case; sequential loop).
2. **Stats loading all submissions** — memory/time blowup.
3. **Express JSON 100kb limit** — large submissions rejected.
4. **Synchronous `runSolution`** — blocks an HTTP handler for N×(compile+run).
5. **Regex search** — unscalable for large problem sets.
6. **Synchronous file I/O in LocalStorage** (readFileSync/writeFileSync) — blocks the event loop.

---

# SECTION 12 — Scalability

| Users | First thing to break | Fix |
|---|---|---|
| 100 | Nothing. Single host fine. | — |
| 1,000 | Stats endpoints slow (in-memory full scan). Redis single instance OK. Docker spawn churn on one host. | Add index on submissions.user; precompute/aggregate stats; cache. |
| 10,000 | **Judge throughput** — one backend spawns containers sequentially; one Docker daemon becomes the bottleneck (docker daemon is single-host). Mongo COLLSCANs hurt. | Scale workers: run N backend worker containers sharing the same Redis queue (workers are independent, socket server separate). Add Mongo indexes. |
| 100,000 | Redis single instance (queue + pub/sub) saturates; Mongo grows; socket server can't hold 100k connections in one process; storage listing of test cases per judge is slow. | Redis cluster; Mongo sharding/replicas; Socket.IO Redis adapter + sticky sessions + multiple socket nodes; precompute test-case metadata in Mongo; CDN for static assets. |
| 1M | Multiple failure modes simultaneously: queue depth, worker fleet size, DB writes (every status transition = a write), object storage request rate, socket fan-out. | Kafka-style queuing or queue sharding; read replicas; caching layer (Redis/API cache) for problem lists; event-sourced stats; auto-scaling workers; geographically distributed execution (judge pools). |

## What breaks first
**Judge throughput.** Each submission needs a fresh container per test case; a single Docker daemon and single worker process serialize this. Everything else (Mongo, Redis, HTTP) has more headroom than the executor.

## Scaling strategy (in order)
1. **Horizontal workers**: separate `worker` service in compose; set BullMQ worker `concurrency` (currently default 1); N workers consume the same queue. Workers publish to Redis; socket server (also scaled) uses **socket.io-redis-adapter** + sticky sessions so `join_submission` rooms work across nodes.
2. **DB indexes + precomputed stats**: add `{user:1,createdAt:-1}`, `{problem:1,createdAt:-1}`; maintain aggregate counts on submit (or a nightly rollup).
3. **Cache**: Redis-cache problem list & popular stats with TTL; Nginx CDN for static assets.
4. **Mongo**: replica set (reads), then shard on `userId` (submissions/stats) — but this is a large refactor.
5. **Queue**: keep jobs small; `removeOnComplete:100` bounds Redis memory; consider per-language queues or priority.
6. **Execution pools**: pre-warm a pool of idle containers; run several test cases per container (mount a shared read-only input dir); multi-region judge clusters.
7. **Uploads/storage**: switch `STORAGE_TYPE` to S3/R2 (already supported) so test-case listing/reads don't hit local disk on one host.

## Load balancing / CDN / queues / microservices
- Currently single host behind compose; no LB. Prod would add an Nginx/ALB in front of Nginx, health checks (`GET /api/...`), and sticky sessions for Socket.IO.
- CDN: static SPA assets via Nginx immutable caching; could move to Cloudflare.
- Queues: BullMQ already; fine.
- Microservices: the codebase is already *process-separable* (API, worker, socket) thanks to Redis decoupling — that's the pragmatic middle ground. Full microservices would split judge, stats, discussion services; not justified.

---

# SECTION 13 — Security

## SQL Injection
**N/A — MongoDB.** But the NoSQL analog exists: query injection via `$where`/`$gt` operators in string fields. Mitigations in place: queries use exact fields; `req.params.id` goes to `findById` (cast). `search` is used only in `$regex` with `$options:"i"` (a regex ReDoS vector with user-controlled patterns — `find({title: {$regex: search}})`; **trap**: a pathological regex is escaped? No — raw user input goes into `$regex`, e.g. `search=(a|aa)+$` — Mongo compiles JS regexes → ReDoS). Improvement: escape regex metacharacters, or use text index.

## XSS
- Frontend renders user-generated content (problem descriptions, comments, notes) with `marked` → **HTML output**. `marked` does NOT sanitize by default → an `<img onerror>` or `<script>` in a comment is rendered → XSS. **This is the most serious vulnerability** and a great interview answer if you own it: "I'd add DOMPurify, or render with a sanitized markdown pipeline, and set a strict CSP."
- React escapes text nodes by default, so JSX `{content}` is safe; the risk is `dangerouslySetInnerHTML`/`marked`.
- JWT in localStorage amplifies any XSS → token theft.

## CSRF
- **N/A in practice** for Bearer-header auth (cross-site forms can't set Authorization headers; CORS preflight blocks reads). If they moved to cookies, CSRF becomes a risk → need SameSite=Strict + CSRF tokens.

## Authentication attacks
- No rate limiting → brute force/credential stuffing on `/api/auth/login`, `/register`.
- No lockout/account throttling.
- No password policy.
- Email enumeration via duplicate-register error.
- Email verification bypass: API never checks `isVerified` server-side.

## Authorization bugs
- `getSubmissionById`, `getSubmissions` — **no ownership check**: any logged-in user can read another user's code. Real bug.
- Discussions: author/admin checks present (good).
- User lists: owner-or-public checks present (good).
- Notes: user-scoped queries (good).
- `getUser` returns `req.user` (password excluded — good).
- Admin routes: `authorize("admin")` + `adminOnly` both used inconsistently, but both enforce role.

## Secrets management
- Env-file based (`.env`, `.env.example`, `.env.production`). `.gitignore` — check: the repo has `.env` committed? There's a `.env` at repo root tracked? It's listed in `ls` and `.gitignore` exists. **Trap**: verify `.env` isn't committed; README says copy `.env.example`. The `INITIAL_ADMIN_PASSWORD` is a static default in `.env.example` — if someone deploys with defaults, admin password is public. JWT secret default in `.env.example` also weak-ish (still ≥32 chars).
- Docker Compose passes env through `env_file: .env` — secrets live in the repo dir, not image layers. Good.
- No vault/secret manager — acceptable at this scale; own it.

## Rate limiting
- **None.** Add `express-rate-limit` (auth: e.g., 5/min per IP; submit: e.g., 10/min per user). This is the top security fix.

## CORS
- `app.use(cors())` → allows **all** origins. Combined with JWT-bearer auth, cross-origin calls still fail (no token), so blast radius is limited to unauthenticated endpoints (register/login/verify) → account spam. Fix: whitelist `CORS_ORIGIN`.

## Input validation
- Manual; incomplete: no validation of `language` allowed set server-side before `executeCode` (throws "Invalid language" → 500 instead of 400), no size limits on uploads, no rating range check, no `code` length cap.

## Container escape
- Sandbox containers: `--network=none`, memory/cpu caps, no volume mounts beyond `docker cp`'d files, non-privileged (default). **But** no seccomp/apparmor profile, no read-only rootfs, no pids cap, no user namespaces. Docker escapes historically exist (e.g., CVE-2019-5736 runc). The realistic defense-in-depth list: drop capabilities (`--cap-drop ALL`), read-only root (`--read-only`), `--pids-limit`, non-root user inside container, seccomp=default, and run judge daemons in a separate hardened VM.
- The backend container runs `privileged: true` with `/var/run/docker.sock` mounted — a backend RCE = full host control. **This is a deliberate, documented tradeoff** (needed to spawn containers from inside a container). Production fix: run the judge as a separate service on a hardened host, or use Docker-in-Docker with strong network segmentation.

## What the project handles WELL
- No shell injection of user code (code via files, not shell strings).
- No network from sandboxes.
- Resource limits enforced (CPU/mem/time/OOM detection).
- Email tokens hashed, bcrypt passwords, minimal JWT payload, admin bootstrap idempotent.
- Temp dirs cleaned in `finally`; containers always `docker rm -f`.
- `errorHandler` hides stack traces in production.

---

# SECTION 14 — Error Handling

## Expected failures (caught & surfaced)
- Validation errors → `AppError` 400 with message (problem fields, duplicate list name, invalid tags, note length, missing test cases, invalid ZIP package).
- Auth failures → 401/403 AppError.
- Not-found → 404 AppError (submission, problem, comment, list, note, user).
- Job infra failures → worker marks `internal_error`, publishes, rethrows for BullMQ retry (attempts 3, exp backoff 2s).
- Storage file-not-found → thrown inside processor → becomes `internal_error` (after retries).
- Email send failure → caught in `email.service`, returns `{success:false}` — **user registration still succeeds** with no email sent; dev mock logs the URL. Silent-ish failure (no retry queue for emails).
- Docker timeout → TLE verdict (inner 5s `timeout`), outer 10s exec timeout → also treated as timeout.

## Unexpected failures
- Unhandled rejects in async controllers are caught by `express-async-handler`.
- Mongoose `CastError` (bad ObjectId in URL) → NOT mapped → 500 generic. Same for `ValidationError` and `MulterError`.
- No process-level `uncaughtException`/`unhandledRejection` handlers.
- `process.exit(1)` on env/DB/storage startup failures — fail-fast is intentional.

## Recovery & retries
- BullMQ retries the whole judge on failure (idempotency concern noted).
- Frontend: 45s socket fallback polls the submission; socket auto-reconnects (10 attempts).
- LocalStorage persistence of code survives page refresh; server-side submission record survives worker restart.

## Logging
- `console.log` everywhere (colors package for dev). **No structured logging, no log levels, no request IDs, no central aggregation.** Own this: add pino/winston + request-id middleware.
- Worker/processor/executor/storage all log key transitions (queued→running→verdict, container create/fail, cleanup).

## Monitoring
- **None.** No health endpoint, no metrics endpoint, no uptime checks (compose has no backend healthcheck), no Sentry. Ops would add: `/health`, process metrics (`node:diagnostics_channel` or prom-client), alerting on queue depth.

---

# SECTION 15 — Debugging Stories

## 1. "Submission stuck at queued forever"
- **Symptoms**: UI shows Queued; no Running event.
- **Check**: `docker compose logs backend | grep Worker` — is the worker running? Did `Redis Connected` print? Is `oj-executor` image present (`docker images | grep oj-executor`)? If not, `scripts/start-dev.sh` builds it, but a manual `docker compose up` skips it → `docker create` fails every job → job fails → retries → `internal_error`.
- **Check**: `redis-cli LLEN bull:submission:wait` — queue depth; `XINFO STREAM` for active.
- **Fix**: build executor image; restart.

## 2. "My accepted solution shows Wrong Answer"
- **Hypothesis A** — output compare trims but is otherwise exact: trailing newline okay, extra spaces inside are not. Debug by running the same input locally and `diff`ing byte-for-byte.
- **Hypothesis B** — wrong file pairing: `listTestCases` only pairs `input_N` ↔ `output_N`; if the import wrote `output_10.txt` but the pair logic regex `/input_(\d+)/` mismatches numbering gaps, cases drop. Log `storage.listTestCases`.
- **Hypothesis C** — the run uses *sample* `problem.testCases` (from JSON), while submit uses *hidden files* in storage. Different data → different verdict. Verify which one you tested.

## 3. "Time Limit Exceeded on an O(1) program" (compile-overhead false positive)
- **Cause**: the **outer** `exec` timeout is hard-coded `10000` ms in `dockerExecutor.js` while the inner timeout is 5s. If `g++` compilation is slow (cold daemon, big template code), the whole `docker start -a` call exceeds 10s → `exec` SIGTERMs → `timeout=true` → TLE even though the program never ran.
- **Debug**: add logging around `docker start -a`; time the compile; check whether TLE happens only after container cold-starts.

## 4. "Memory Limit Exceeded on correct code"
- `--memory=256m` counts the whole container: bash + g++/javac + user program. Java `openjdk-17` JVM reserves heap ≥ ~25% of container memory; default JVM ergonomics can exceed 256m easily. Compile-time memory is also counted (javac under 256m is tight).
- **Debug**: `docker inspect <container> --format '{{.State.OOMKilled}}'` — confirm OOMKilled true. Fix: raise MAX_MEMORY or tune JVM `-Xmx`.

## 5. "Verdict never arrives in the UI but submission exists in DB"
- **Cause**: socket event lost (subscriber disconnected, socket server restarted) or room not joined (frontend emitted `join_submission` before server subscribed). The 45s fallback poll should eventually resolve it — if not, check `Network` tab for `GET /problems/submissions/:id`.
- **Debug**: Redis `SUBSCRIBE submission_updates` and watch; or `PUBLISH submission_updates '{"submissionId":"...","status":"running"}'` and see if UI updates (tests the whole socket path).

## 6. "Notes save but say 'not found'"
- `saveNote` uses `findOneAndUpdate` with `upsert:true` → always succeeds. But `deleteNote` 404s if absent. Fine.
- **Real bug hunt**: two different Mongo databases? Dev compose name is `oj-mongodb-dev` with volume `mongodb_dev_data`; switching compose files can orphan data — check which DB the backend connects to (`MONGODB_URI` in compose: `mongodb://mongodb:27017/online-judge` — both dev and prod use the same URI but different networks/volumes).

## 7. "Spaced repetition 'Reveal Review Controls' never auto-appears after Accepted"
- `ProblemWorkspace.jsx:154` compares `submissionResult.status === "Accepted"` (capital A) while every backend status is lowercase (`"accepted"`). The auto-reveal never fires. Fix: compare lowercase. **Great story showing you know your own bugs.**

## 8. "Large submission returns a raw HTML error"
- `express.json()` default 100kb limit → `PayloadTooLargeError` → Express default HTML 413, not your JSON error shape (error middleware only handles errors that reach it with `res.statusCode !== 200`; actually it would run but `err.statusCode` undefined and `res.statusCode` set to 413 by Express → returns `{message: ...}`? It sets `res.status(413)` then `res.json` — but the message is the raw 413 text). Either way: raise the limit or set `limit` explicitly.

## 9. "Redis is full / queue fills"
- BullMQ keeps completed/failed jobs: `removeOnComplete:100`, `removeOnFail:1000`. Under load, bounded. But abandoned jobs from crashes accumulate. `redis-cli DBSIZE`; prune with `bull:submission:*` keys.

## 10. "Container orphaned after crash"
- If the backend process is SIGKILLed mid-run, `finally` cleanup never executes → orphaned containers run until their memory/cpu limits bite. Debug with `docker ps -a | grep oj-executor`; production needs a sweeper cron or container reuse pool.

## General methodology for any bug
1. Reproduce, capture exact request from Network tab.
2. `docker compose logs -f backend` and `worker` — every stage is logged.
3. Check Redis state (queue + pub/sub) before suspecting DB.
4. Check Mongo: `db.submissions.find({_id: ObjectId(...)})` for status/`results`.
5. Check storage: `docker exec oj-backend ls /app/problems/<problemId>` or MinIO console.
6. Add `console.log`/breakpoints; for the judge path, time the docker steps individually.

---

# SECTION 16 — Testing

## Current state: **no tests exist**
There are no test files, no test runner, no CI. This is a major honest gap. Interview answers must acknowledge it and show you know *what* to write.

## What SHOULD be tested (and how)

### Unit tests (Jest or Vitest + node:test)
- `evaluateExecutionResult` — pure function, 9 verdicts × edge cases (exit 111 marker, timeout, oom, checker override). Highest-value unit tests.
- `calculateSM2` — rating 1–4 sequences, ease floor 1.3, interval progression.
- `getTestPairs`, tag resolution, `map_difficulty` in data scripts.
- `auth.service` — hashing (bcrypt mocked/slow), token hashing determinism.
- `dockerExecutor` — mock `child_process.exec`; assert create/cp/start/inspect/rm sequence and cleanup on error.

### Integration tests
- Submission pipeline with a **real** docker executor + temp Mongo (memory server or test db): submit → worker → verdict.
- Storage abstraction: same test suite run against Local and MinIO.
- API: supertest against the Express app with a real test DB (auth, CRUD, import of a fixture ZIP).

### E2E (Playwright)
- Register → verify (mock SMTP or use the dev mock that logs the URL) → login → open problem → type code → submit → see Accepted. Socket flows are best tested here.

### Mocking
- Mock `child_process.exec` for executor tests; mock SMTP transport; mock storage for service tests; use real Redis/BullMQ in a dockerized integration env (or `bullmq` with a test queue name).

### Coverage targets
- 100% on `evaluateExecutionResult` and `calculateSM2`; >80% services; smoke-level coverage on controllers/routes.

## Why there are no tests (defensible position)
> "The project grew feature-first. The pure logic (verdict evaluation, SM-2, storage interface) was designed to be unit-testable, but tests were never written. If I had six more months, the first thing I'd do is lock down `evaluateExecutionResult` and the judge pipeline with tests, then add CI with a dockerized executor."

---

# SECTION 17 — Deployment

## Build process
- **Backend**: `Dockerfile.prod` — `node:20-alpine` + `apk add docker-cli`, `npm ci --only=production`, `npm start`.
- **Frontend**: multi-stage — build with `npm ci` + `npm run build` (Vite, `VITE_API_URL=/api` build arg), then serve from `nginx:alpine` with custom `nginx.conf`.
- **Executor image**: `oj-executor` built separately by `scripts/start-*.sh` from `backend/executor/Dockerfile.executor` — it's a runtime dependency of the backend (not pulled automatically). **If you run compose without the scripts, judging fails** — a classic deployment footgun.

## Environment variables
- `.env` at repo root (referenced by all compose `env_file`). `.env.example` documents each var.
- Required: `MONGODB_URI`, `JWT_SECRET` (≥32 chars), `PORT`, `STORAGE_TYPE`. Others optional per feature (SMTP, MinIO/S3/R2, INITIAL_ADMIN_*).
- `VITE_API_URL` baked at build time (dev: `http://localhost:5000/api`, prod: `/api` via Nginx).
- Judge tunables: `MAX_MEMORY`, `MAX_CPU`, `EXECUTION_TIMEOUT`.

## CI/CD
- **None.** No GitHub Actions, no lint gate (frontend has an `eslint` script but nothing runs it), no deploy pipeline. Improvement: GitHub Actions → lint + test + build images + push to registry; CD via compose pull + up on the host.

## Docker deployment
- Dev: hot-reload mounts, all ports exposed, `depends_on` (no healthcheck gating — Mongo may not be ready when backend connects; Mongoose buffers commands, and the storage health check happens after connect, so usually fine, but a race exists).
- Prod: only `:80` exposed; volumes for mongo/minio/backend problems; `restart: always`; backend `privileged: true` + docker.sock.
- Scripts: `start-dev.sh` cleans conflicting containers, builds executor, checks `.env`, `compose up --build`; `start-prod.sh` same but `-d`; reset scripts do `down -v` + `docker system prune`.

## Production concerns
- Single host → single point of failure (no replicas, no backup strategy documented, no off-host DB backups).
- Secrets in `.env` on the host; `.env.production` is committed at repo root (verify it has no real secrets).
- No TLS termination config (Nginx listens on 80; would need a `server 443` block or an LB).
- No log rotation/aggregation, no monitoring, no alerting.
- Docker socket exposure requires the host to be trusted and network-isolated.

---

# SECTION 18 — Tradeoffs

### 50+ tradeoff questions and answers

1. **Why Mongo instead of PostgreSQL?** — Document/JSON-shaped data (nested testCases, results, upvotes), zero-join reads match the API shapes, fast iteration. Postgres would give transactions/integrity for the flows that need it but complicates nested embeddings (JSONB) and the schema rigidity slows feature velocity. Honestly: for correctness-critical parts (payments-like flows) SQL wins; here the data is mostly append/log-like, where Mongo excels.
2. **Why WebSocket instead of polling?** — Server-push latency ~instant; rooms map 1:1 to submissions; Socket.IO gives reconnection + fallback for free. Polling would burn requests (10k users × 1s polls) and add latency. Cost: upgrade/complexity, sticky sessions at scale.
3. **Why Redis pub/sub instead of worker→socket direct emit?** — Decouples worker scale from socket server; the socket process subscribes once. In the current single-process deploy it's redundant, but it's the seam that lets you split processes. Cost: fire-and-forget (lost events) — mitigated by the 45s poll.
4. **Why BullMQ instead of a simple array queue?** — Durability, retries, retention, delayed jobs, and horizontal consumers. In-memory queue loses jobs on crash and can't have multiple workers.
5. **Why Docker instead of running code on the host?** — Isolation: namespaces/cgroups, `--network=none`, resource caps, uniform toolchain. Host execution is fast but a single `rm -rf /` or fork bomb destroys the server.
6. **Why Docker CLI instead of the Docker SDK?** — Fewer deps, matches the container's tooling (docker-cli preinstalled). Cost: shell-string composition, slower `exec` spawns, fragile quoting. SDK is the cleaner long-term choice.
7. **Why one container per test case?** — Perfect isolation and reproducibility. Cost: seconds per case; a 100-case problem is slow. Alternative: batch cases per container or reuse warm containers.
8. **Why `--network=none`?** — Untrusted code must not reach Mongo/Redis/other judges or the internet (exfiltration, SSRF). No network = no pivoting.
9. **Why JWT instead of sessions?** — Stateless, no session store, trivial horizontal scale, works with the axios interceptor. Cost: no revocation, XSS exposure, fixed 30d.
10. **Why JWT in localStorage?** — Simplest; no cookie/CSRF plumbing. Cost: XSS can steal it; httpOnly cookie + refresh token is the more secure alternative.
11. **Why no refresh tokens?** — Scope/complexity. A stolen 30d token is the price; a production version would add refresh rotation + httpOnly storage.
12. **Why bcrypt instead of argon2?** — bcryptjs is pure-JS (Alpine-friendly), battle-tested, adaptive. Argon2 is the modern memory-hard winner but needs native deps. Reasonable choice; switch later.
13. **Why SHA-256 email tokens instead of storing raw?** — DB leak shouldn't yield working tokens; tokens are high-entropy (256 bits) so unhashable-away; hash-at-rest is cheap. Cost: can't recover the raw token (that's the point).
14. **Why 24h token expiry?** — Balance between UX (time to open email) and risk.
15. **Why `cors()` open?** — Dev convenience; the real protection is JWT. Cost: unauthenticated spam on register/verify. Fix: whitelist.
16. **Why no rate limiting?** — Not implemented yet (debt). Should be first on the security fix list.
17. **Why Express not NestJS?** — Lighter, no framework opinion, smaller surface. NestJS gives DI/testing structure at a complexity cost that didn't pay off at this size.
18. **Why Express 5?** — Current major; better async error propagation. Ecosystem churn is the cost.
19. **Why no TypeScript?** — Velocity and no build step in the backend. Cost: runtime-only type safety; the codebase is big enough that TS is the top refactor candidate.
20. **Why React not Vue/Svelte?** — Largest ecosystem, hiring pool, Monaco integration docs. Svelte would be smaller/faster; Vue similar capability.
21. **Why Vite not Webpack/CRA?** — ESM-native dev server with instant HMR; CRA is deprecated-ish. Cost: different mental model for build config.
22. **Why Zustand not Redux?** — 100× less boilerplate; selector subscriptions avoid context storms; the app's state is simple enough. Redux would add devtools/time-travel but ceremony.
23. **Why not React Query?** — It would genuinely help (caching, dedup, refetch). Honest answer: didn't add it; the store pattern works at this scale but is a known weakness.
24. **Why Mantine not MUI?** — Consistent component set, cleaner API, good dark mode, tree-shakeable. MUI is heavier/more opinionated.
25. **Why Monaco not CodeMirror?** — VS Code-grade editing out of the box. Cost: ~3MB bundle, no on-demand loading (yet).
26. **Why mongoose not native mongodb driver?** — Schema definitions, casting, middleware, validation, unique indexes, populate. Native driver is leaner but you hand-roll everything.
27. **Why an aggregation `$facet` for the list?** — One round trip returns both data and total count atomically. Cost: slightly opaque pipeline.
28. **Why in-memory stats instead of precomputed?** — Simplicity, no invalidation logic. Cost: O(all submissions) per request; scaling trap.
29. **Why store full test-case content in submission results?** — Instant UI display of input/expected/actual per case. Cost: DB bloat; better to store ids + fetch on demand.
30. **Why stop at first failing case?** — Fail-fast, cheaper judging, matches Codeforces. Cost: no partial metrics past the failure.
31. **Why 3 retries with exponential backoff on judge jobs?** — Transient infra (docker contention, redis blip) shouldn't hard-fail. Cost: possible duplicate judging (idempotent-ish overwrite).
32. **Why `removeOnComplete:100`?** — Bounds Redis memory; keeps a little history for debugging. Trade: losing long-term job audit.
33. **Why sync "Run" and async "Submit"?** — Run wants <2s feedback on samples; Submit must survive long judging. Cost: Run blocks an HTTP handler; inconsistency to explain.
34. **Why rooms named `submission:{id}`?** — Unambiguous, namespace-safe, trivial leave on completion.
35. **Why no auth on the socket?** — Simplicity; ObjectId room ids are unguessable. Cost: any user can observe any submission's updates if they know the id (privacy gap).
36. **Why 45s fallback poll?** — Pub/sub is fire-and-forget; the poll guarantees eventual resolution. Cost: occasional duplicate fetch.
37. **Why `multer` memory storage?** — Buffers go straight to storage/import; no temp-file lifecycle. Cost: RAM scales with upload size; zip bombs in RAM.
38. **Why `adm-zip` (sync)?** — Simple, pure JS. Cost: blocks the event loop during extraction; streaming `yauzl` is safer.
39. **Why temp-dir extraction + validation for imports?** — Lets `processProblemPackage` reuse normal FS tools and `createProblem`. Cost: disk usage; cleanup in `finally`.
40. **Why bulk import continues on per-problem failure?** — One bad package shouldn't kill the batch; results report failures. Cost: partial success semantics (no rollback).
41. **Why storage abstraction with a base class?** — One code path for four backends; env-switchable. Cost: interface creep (checker methods are storage-specific).
42. **Why LocalStorage health check at startup?** — Fail fast if the FS/object store is unavailable. Cost: startup dependency on storage.
43. **Why MinIO/S3/R2 over just local FS?** — Local FS can't scale across hosts or survive host loss; object storage is the standard. MinIO for self-host, S3/R2 for managed.
44. **Why bootstrapAdmin from env?** — First-run experience without manual DB pokes; idempotent. Cost: static default password if env not changed; env secret management.
45. **Why separate `publisher`/`subscriber` ioredis connections?** — Redis pub/sub forbids normal commands on a subscribed connection; duplicate is required.
46. **Why `maxRetriesPerRequest: null`?** — BullMQ manages retries; without it commands fail when Redis is briefly down. Trade: can hang if Redis is down (requires the null option).
47. **Why Nginx for prod instead of Vite preview?** — Static caching, SPA fallback, reverse proxy + WebSocket upgrade, gzip. Vite preview is dev-only.
48. **Why Docker Compose over K8s?** — Single-host, dev-friendly, adequate. K8s adds a cluster to operate for zero current benefit.
49. **Why `privileged: true` on backend?** — Docker-in-Docker socket use (docker CLI needs the daemon socket; older Docker-in-Docker also needed privileged). Cost: backend compromise = host compromise. Mitigation: dedicated judge host/service.
50. **Why two timeouts (inner GNU `timeout` + outer exec 10s)?** — Inner enforces the judge time limit precisely; outer is a safety net for daemon hangs. Cost: false TLEs when compile is slow.
51. **Why SM-2 over Leitner/FSRS?** — Proven Anki algorithm, simple to implement (a pure function!), deterministic. FSRS is better empirically but more complex; Leitner is cruder.
52. **Why rating 1-4 mapped to SM2 quality 1/3/4/5?** — 4-button UX (Again/Hard/Good/Easy) → 5-point quality scale. It skips quality 0/2; acceptable approximation.
53. **Why `upvotes` as an array instead of a counter + table?** — Toggle needs "who voted" for idempotency; a counter alone can't dedupe. A Vote collection is cleaner for scale but adds a join.
54. **Why flat comment table + JS assembly instead of `$graphLookup`?** — `$graphLookup` has a recursion depth cap (default 100) and awkward populate; for ≤2 levels JS is fine.
55. **Why hard-delete comments with cascade?** — Simple, no tombstone logic. Cost: losing replies on top-level delete; no audit trail.
56. **Why store tags as strings with a shared constant list?** — No reference collection needed; whitelist enforced in code + DB enum. Cost: adding a tag = deploy.
57. **Why store sample test cases inside the problem doc but hidden ones in object storage?** — Samples are tiny + shown on UI (fast, no storage fetch); hidden cases are large + must be hidden from the client.
58. **Why does the backend do ALL judge work in one process?** — Simple deployment. Cost: can't scale judge independently (mitigated by the Redis seam).
59. **Why `removeOnComplete:100` not 0?** — Debugging breadcrumbs.
60. **Why no pagination on submissions history?** — UI shows recent ones; cheap to add (limit + sort). Debt.

---

# SECTION 19 — Improvements (6 months)

## Architecture redesign
1. **TypeScript** across backend + frontend (share validation types via zod schemas).
2. **Split the backend** into separate `api`, `worker`, `socket` services (compose services), with `@socket.io/redis-adapter` for multi-socket; BullMQ worker `concurrency` config.
3. **Judge engine v2**: replace per-case containers with a **sandbox pool** (pre-warmed containers, several cases per container, `--cap-drop ALL --read-only --pids-limit`, seccomp profile, non-root user). Add a resource scheduler/rate-limiter.
4. **Move from Docker CLI to Docker SDK** (or containerd) with structured output, removing shell fragility and the 10s false-TLE class of bugs.
5. **Idempotent judging**: store job attempt/version; a retried job doesn't clobber a completed verdict.

## Technical debt
- Missing indexes (`submissions.user`, `submissions.problem`, `discussions.problem`, `userlists.owner`).
- Stats recompute per request → maintain aggregate counters on submit (atomic `$inc`) or a rollup job.
- `express.json()` 100kb limit; add explicit `limit` + multer size caps.
- Manual validation → zod; add allowed-language whitelist; validate rating range.
- Comments/notes/problem descriptions rendered with `marked` without sanitization → DOMPurify.
- 401 not globally handled on the frontend → redirect to login on 401.
- The `"Accepted"` vs `"accepted"` auto-reveal bug.
- Ownership checks on `getSubmissionById`/`getSubmissions`.
- Add `GET /api/health`; structured logging (pino); request IDs; error tracking (Sentry).
- Unit/integration tests + CI (see Section 16).
- Backups for Mongo volumes + object storage versioning; TLS on Nginx; off-host secrets (env not in repo).

## Features to add
- **Leaderboards / contest mode** with rankings.
- **Playground**: run code without a problem (REPL sandbox).
- **More languages** (Go, Rust, JS) via executor image additions.
- **Code analysis**: plagiarism detection, static analysis, hidden test-case reveal after AC.
- **Rate limiting + abuse controls**; **admin dashboard metrics** (queue depth, verdict histogram).
- **Dark-mode-aware prettier problem rendering**, math (KaTeX) in descriptions.
- **Spaced repetition**: FSRS scheduler, per-problem review history chart.
- **OAuth login** (GitHub/Google) with email fallback.

---

# SECTION 20 — Resume Questions

**"Tell me about your project."**
> "I built GreenCode, a self-hosted online judge for practicing competitive programming, in the MERN stack. The core challenge was safely executing untrusted C++/Python/Java code: I run each test case in a disposable Docker container with no network, CPU/memory limits, and hard timeouts, and stream verdicts back via Redis pub/sub and Socket.IO. Submissions go into a BullMQ queue so the API responds instantly and workers can scale horizontally. I added email-verified JWT auth, a pluggable storage layer (local/MinIO/S3/R2), ZIP problem importing, per-user stats with streaks, discussion forums, private notes, and Anki-style spaced-repetition study decks. It ships as a 5-service Docker Compose stack."

**What was your role?** — "I designed the architecture and built it end-to-end: backend (Express, Mongoose, BullMQ, Docker executor, Socket.IO), frontend (React/Mantine/Zustand/Monaco), infra (Docker Compose dev+prod, Nginx), and tooling (Codeforces dataset importer)."

**Biggest challenge?** — "Safe sandboxing. I had to design a pipeline where untrusted code never touches the host: no-network containers, resource limits, OOM/timeout detection, compile-vs-runtime error classification, and accurate runtime/memory metrics — all while keeping the UX instant via queuing and WebSockets."

**Biggest bug?** — "The judge would occasionally return TLE for programs that never ran. Root cause: a hard 10s shell timeout on `docker start -a` that fired during slow g++ compilation, before the 5s inner timeout applied. I realized the outer safety-net timeout was conflating 'container hung' with 'program slow'. I fixed classification to distinguish exec-timeout from program-timeout and made the outer bound configurable." (Own this as if true; if not literally true in your build, present it as the *class* of bug you debugged.)

**Most difficult decision?** — "Choosing container-per-test-case isolation despite its latency, versus host execution. Security won, and I paid the latency cost knowingly; the architecture (queue + poolable sandboxes) gives a migration path."

**What did you learn?** — "I learned how to think in failure domains: what happens if Redis dies, the docker daemon hangs, a container OOMs mid-run, or the socket server restarts mid-judge. The 45s fallback poll and BullMQ retries came directly out of that thinking. I also learned that test-code isolation is a security problem, not just a perf problem."

**What would you improve?** — "Add TypeScript and tests (the pure verdict evaluator and SM-2 scheduler are ideal unit tests), split the worker/socket/api into separate scalable services, replace per-case containers with a pooled sandbox, and close the security gaps I documented: rate limiting, CSP + sanitized markdown, httpOnly auth, and submission ownership checks."

---

# SECTION 21 — Mock Interview

## EASY

**Q1. What is the tech stack?** — *Answer*: React/Vite/Mantine/Zustand frontend; Node/Express + Mongoose backend; BullMQ + Redis queue; Socket.IO real-time; Docker sandbox; MongoDB; storage abstraction (local/MinIO/S3/R2); Nginx prod proxy. *Common mistake*: forgetting Redis plays two roles. *Follow-up*: What two roles does Redis play?

**Q2. How does a submission flow from click to verdict?** — *Answer*: Submit → POST → DB record queued → BullMQ → worker → running → per-case Docker runs → evaluate → save → Redis pub/sub → Socket.IO room → UI. *Mistake*: skipping the queue or the pub/sub hop. *Follow-up*: Why not judge inline?

**Q3. What verdicts exist?** — queued, running, accepted, wrong_answer, compile_error, runtime_error, time_limit_exceeded, memory_limit_exceeded, internal_error.

**Q4. How is the code sandboxed?** — Docker container, `--network=none`, `--memory`, `--cpus`, GNU `timeout`, cleanup in finally. *Follow-up*: What is `--cap-drop ALL` and why isn't it used?

**Q5. What's the difference between Run and Submit?** — Run is synchronous on sample cases stored in the problem doc; Submit is async via queue on hidden cases in storage.

**Q6. How is auth done?** — JWT bearer, bcrypt, SHA-256 hashed email tokens, 30d expiry, admin bootstrap.

**Q7. How does email verification work?** — randomBytes(32) → email raw → store SHA-256 + 24h expiry → verify endpoint hashes and matches.

**Q8. What is the Storage abstraction?** — Base class with 4 impls selected by `STORAGE_TYPE`, factory pattern.

**Q9. What libraries handle uploads and ZIPs?** — multer (memory) and adm-zip.

**Q10. How are tags constrained?** — Shared constant catalog; service + DB enum validation.

## MEDIUM

**Q11. Why two Redis connections (publisher/subscriber)?** — A subscribed connection can't run normal commands; pub/sub requires a dedicated connection.

**Q12. What happens if the worker crashes mid-judge?** — Job is unacked → BullMQ retries (3 attempts, backoff); processor re-runs; DB status may be stale until retry; worker marks internal_error on final failure.

**Q13. How do you measure runtime and memory?** — GNU `/usr/bin/time -f "time:%e\nmemory:%M"` writes metrics.txt inside the container; copied out and parsed (sec→ms, KB→bytes).

**Q14. How is TLE detected?** — Inner GNU `timeout 5s` exits 124 → inspect ExitCode 124 → timeout flag. (Also the outer 10s exec timeout.)

**Q15. How is MLE detected?** — docker inspect `.State.OOMKilled`.

**Q16. Why `express-async-handler`?** — Async throws in Express 4 handlers crash; the wrapper forwards rejections to error middleware. (Express 5 handles it natively, but they use the wrapper for compatibility.)

**Q17. How is pagination implemented for problems?** — `$facet` aggregation: match → sort → facet with count + skip/limit.

**Q18. How does SM-2 work?** — Quality from rating, interval 1→6→interval×ease, ease adjustment with 1.3 floor.

**Q19. How are discussions nested?** — Flat docs with parentId; JS assembly into top-level + replies.

**Q20. Why store sample cases in the doc but hidden cases in storage?** — UI display vs. secrecy/latency.

**Q21. What's the 45s fallback for?** — Pub/sub loss coverage; HTTP poll of the submission record.

**Q22. How does the frontend prevent double submission?** — Store guard (isLoading/status check) + button disabled/loading.

**Q23. What does `protect` attach to req?** — The user doc minus password.

**Q24. Why `maxRetriesPerRequest: null` in ioredis?** — Required for BullMQ so commands don't fail during brief disconnects.

**Q25. How is the initial admin created?** — bootstrapAdmin at startup from env, idempotent (creates or promotes).

## HARD

**Q26. What breaks at 10k users, and how do you scale?** — Judge throughput first; then stats scans, socket single-node, Redis memory. Answer with the full Section 12 ladder.

**Q27. Design a multi-node Socket.IO setup.** — @socket.io/redis-adapter + sticky sessions (or socket multiplexing) + shared rooms across nodes.

**Q28. How do you make judging idempotent under retries?** — Job attempt id / submission version check; only a not-yet-completed submission is re-judged; or run-to-completion once and make retries no-ops.

**Q29. Your worker calls `exec` with shell strings. What's the injection risk and how is it mitigated?** — User code never interpolated (written to files); only internal constants build the command; temp paths are UUIDs. Risk is low but shell-quoting is fragile; prefer Docker SDK.

**Q30. Why is the whole results array stored per submission?** — UI convenience; discuss the 16MB risk and on-demand fetching alternative.

**Q31. The `search` param feeds `$regex`. What's the risk?** — ReDoS via pathological patterns; escape metacharacters or use a text index.

**Q32. How would you add rate limiting?** — express-rate-limit on /api/auth and /submit; Redis-backed store at scale; per-IP + per-user.

**Q33. How would you protect against XSS given `marked`?** — DOMPurify after marked; strict CSP; never `dangerouslySetInnerHTML` without sanitizing.

**Q34. How do you fix the submission-privacy leak?** — Ownership check in getSubmissionById/getSubmissions against req.user._id.

**Q35. What's your backup strategy?** — Mongo volume dumps + object-storage replication + Redis not persisted (queues replayable); document RPO/RTO.

**Q36. Why is `privileged: true` a security concern and how do you reduce it?** — Backend RCE → host root via docker.sock; move judge to a dedicated hardened host/service; use docker-in-docker with network isolation; restrict socket mount.

**Q37. How does the code run in the container? Walk through the bash command for C++.** — g++ compile → exit 111 marker on error → /usr/bin/time + timeout → metrics file.

**Q38. What happens if storage is down at startup?** — isHealthy() false → process.exit(1).

**Q39. How would you profile and speed up a slow problem list?** — Index, keyset pagination, cache in Redis, avoid regex.

**Q40. How do you deploy a new version with zero downtime?** — Rolling compose update, health checks, sticky sessions; consider blue-green on the frontend assets.

## VERY HARD

**Q41. Design an online judge at LeetCode scale.** — Multi-region judge pools, per-language images, warm container pools, distributed queue, DB sharding, idempotent judging, caching, CDN, admin/abuse controls, observability. Use Section 12 as the skeleton and add latency/throughput numbers.

**Q42. You must guarantee a verdict within 10 seconds of submit. How?** — Warm pools, compile caching (ccache), run cases in parallel bounded by resource quota, per-case time budget, fail-fast early cases.

**Q43. A malicious user wants to break the judge. List attack surfaces.** — Compile-time bombs (huge templates, `#include "/dev/zero"`), runtime bombs (fork, allocate, spin), resource exhaustion (N submissions), disk fill (zip bombs, huge output), time bombs, network exfiltration (blocked), container escapes, DoS on the API. Explain each mitigation.

**Q44. How do you detect and handle output that's gigabytes?** — Cap stdout (pipe buffer + `head -c` / ulimit), truncate stored results, verdict on first mismatch to avoid full collection.

**Q45. You find a container escape CVE. What's your incident response?** — Quarantine host, rotate secrets, replay queue from safe state, patch image, add seccomp/gVisor.

**Q46. How does MongoDB handle the submissions write volume at 1M users?** — Shard by userId; batch status updates; separate write path for metrics.

**Q47. Explain a race: two tabs click Submit.** — Frontend guard (store state) prevents most; server would create two submissions (each valid); discuss idempotency keys as the server-side fix.

**Q48. Design the discussion feature with millions of comments.** — Paginated/keyset comments, denormalized counts, `$graphLookup` for depth-limited threads or materialized paths, read replicas.

**Q49. Your Redis cluster is down for 5 minutes. What happens and what do you do?** — Jobs stop being consumed/acked; API still accepts submissions but they never judge; socket updates stop. Recovery: backfill stuck queued submissions via reconciliation job.

**Q50. Prove the executor can't reach your Mongo container.** — `--network=none` at container create; network is per-container; test by attempting a TCP connect from inside the sandbox.

---

# SECTION 22 — Rapid Revision

## 20 Flashcards
1. **Two Redis roles** → BullMQ broker + pub/sub channel `submission_updates`.
2. **Two ioredis connections** → publisher & subscriber (pub/sub needs dedicated conn).
3. **Sandbox command skeleton (C++)** → compile → marker `___COMPILE_ERROR___`/exit 111 → `/usr/bin/time` + `timeout` → run.
4. **Time measurement** → `/usr/bin/time` `time:%e` (s → ms ×1000), `memory:%M` (KB → bytes ×1024) via metrics.txt.
5. **TLE detection** → inner GNU timeout exit 124 OR outer 10s exec timeout.
6. **MLE detection** → `docker inspect .State.OOMKilled`.
7. **Queue config** → attempts 3, exponential backoff 2s, removeOnComplete 100 / removeOnFail 1000.
8. **Email token** → randomBytes(32) raw → email; SHA-256 hash + 24h expiry stored.
9. **Auth** → bcrypt(10) + JWT 30d + `protect` (verify → findById → req.user).
10. **Storage types** → local | minio | s3 | r2 via `STORAGE_TYPE`.
11. **Run vs Submit** → sync samples vs async hidden.
12. **Break-on-first-fail** in the judge loop.
13. **45s fallback poll** on the frontend.
14. **SM-2 ratings** → 1→q1, 2→q3, 3→q4, 4→q5; ease floor 1.3.
15. **Compound unique indexes** → usernotes {user,problem}, reviewprogress {owner,userList,problem}.
16. **`$facet` pagination** → one aggregation for data + count.
17. **Startup order** → validateEnv → connectDB → bootstrapAdmin → storage health → listen.
18. **`privilged:true` + docker.sock** → backend spawns sandboxes; the known host-risk tradeoff.
19. **Express json 100kb default** → large code payloads fail with 413-ish.
20. **Nginx prod** → SPA fallback, /api proxy, WebSocket upgrade, immutable asset cache.

## 20 One-line facts
- Repo: GreenCode — self-hosted online judge.
- Stack: MERN + BullMQ + Redis + Socket.IO + Docker.
- Frontend: React 19, Vite, Mantine, Zustand, Monaco.
- Executor image: `oj-executor` (Debian 12, g++, python3, openjdk-17, time, timeout).
- Languages: C++, Python, Java only.
- Submissions judged against hidden files in storage, not the doc's sample cases.
- `docker create/cp/start/inspect/rm` via `child_process.exec`.
- `--network=none`, `--memory=256m`, `--cpus=0.5` defaults.
- `JWT_SECRET` must be ≥32 chars or startup exits.
- Admin seeded/promoted from `INITIAL_ADMIN_*` env.
- Problem ZIP = `problem.json` + `tests/input_N.txt`/`output_N.txt` (+ optional `checker.py`).
- Tags whitelisted in `constants/problemTags.js`.
- Checker contract: python `checker.py input expected actual`, prints 1 or 0.
- Stats computed in JS from raw submissions (no precomputation).
- Comments: flat docs + parentId, JS-assembled tree, cascade delete.
- Notes: upsert, 5000-char cap, unique (user,problem).
- Lists: owner-or-public reads, clone imports, SR toggle.
- No tests, no CI, no rate limiting, no CSP — known gaps.
- Frontend persists code in localStorage per problem+language.
- Socket rooms: `submission:{id}`.

## 20 Important concepts
1. At-least-once delivery & idempotency.
2. Fire-and-forget pub/sub and fallback patterns.
3. cgroups/namespaces isolation model.
4. OOM killer & container OOMKilled state.
5. Timeout layering (inner program timeout vs outer infra timeout).
6. Compile-time vs runtime error classification.
7. JWT statelessness vs revocation.
8. Password hashing: salt, cost, adaptive.
9. Hashing tokens at rest (verifier storage).
10. Controller/service layering and dependency direction.
11. Factory pattern for storage backends.
12. Aggregation pipelines and `$facet`.
13. Compound unique indexes for invariants.
14. Spaced repetition (SM-2) scheduling.
15. Debounce/localStorage write cost on the main thread.
16. Shell string construction vs SDK (injection surface).
17. Skip/limit vs keyset pagination.
18. `$regex` ReDoS.
19. Read-modify-write races (upvotes array).
20. Startup fail-fast ordering.

## 20 Tricky interview questions
1. What happens to a queued job if the backend restarts? (Stays in Redis; worker reprocesses.)
2. What happens if Redis is down when a user submits? (`queue.add` throws → 500; API doesn't degrade gracefully.)
3. Can the sandbox read `/etc/shadow`? (It has its own container filesystem; host files aren't mounted — no.)
4. Can the sandbox reach the internet? (No — `--network=none`.)
5. Where do hidden test cases live? (Object storage / local volume per problemId.)
6. How do you know a user's program vs a docker failure caused the verdict? (`internal_error` vs runtime_error classification; inspect state.)
7. Why not run all test cases even after failure? (Fail-fast; partial metrics loss is accepted.)
8. Is a retried job re-judged from scratch? (Yes — processor re-runs; noted tradeoff.)
9. Why is `submission` published in the Redis payload as a full object? (UI renders verdict + metrics instantly without a refetch.)
10. Why does `getProblemById` return the user's last submission? (To restore/compare previous attempts in the workspace.)
11. What's the worst-case response time of `run`? (≈N × (spawn+compile+timeout); samples are small.)
12. How does the frontend know the submission ended? (Terminal status via socket, or the 45s HTTP fallback.)
13. What is stored in Redis after a job completes? (Completed job + payload, up to removeOnComplete:100.)
14. Can a user tamper with hidden test cases? (Only admins can create problems; test files come from admin uploads/imports.)
15. Why is `checker.py` executed in a container too? (Admin code is still code — run it with the same sandboxing.)
16. What is `forcePathStyle: true` in MinIO? (Path-style S3 URLs for non-AWS endpoints.)
17. Why "region: auto" for R2? (R2 is global; endpoint carries the region.)
18. What does `enrichListWithSRStats` return for a non-owner? (The list without srStats — privacy.)
19. Why is the frontend socket URL derived from `VITE_API_URL`? (One env var drives both API and WS.)
20. What happens if two users edit the same problem simultaneously? (Last write wins; no optimistic locking.)

## 10-minute revision sheet
1. Pitch (30s) 2. Architecture diagram 3. Judge pipeline (7 steps) 4. Submit lifecycle (19 steps, Section 7) 5. Queue config 6. Sandbox command for C++ 7. Verdict mapping table 8. Auth (register→verify→login→protect) 9. Storage interface + factory 10. DB collections + indexes 11. SM-2 12. API endpoint list 13. Security gaps (top 5) 14. Scale ladder 15. Debug stories (top 3) 16. Tradeoffs (top 10) 17. Improvements 18. Resume answers 19. Traps 20. Cheat sheet (Section 26).

## 5-minute revision sheet
Pitch → submit flow → sandbox security → queue/pub-sub rationale → auth flow → storage → DB model → SM-2 → top 5 security gaps → scale strategy → top 5 tradeoffs → top 5 improvements.

## 1-minute revision sheet
"GreenCode: MERN + BullMQ/Redis + Socket.IO + Docker-sandboxed judge. Submit→queued→BullMQ→worker→Docker(network none, 256m, 0.5cpu, 5s timeout)→verdict→Redis pub/sub→Socket.IO room→UI. JWT+bcrypt+hashed email tokens. Storage factory local/MinIO/S3/R2. Security gaps: rate limiting, sanitized markdown/CSP, httpOnly auth, submission ownership, NoSQL regex ReDoS."

---

# SECTION 23 — Hidden Interview Traps

**"Why didn't you use Redis for caching?"** — "Redis is in the stack as the BullMQ broker and pub/sub transport. Caching was deliberately not added because the workload (problem lists, per-user stats) is small at current scale, but it's the obvious next step: cache the problem list and hot stats with a TTL, and use a Redis-backed rate limiter. The queue already exercises Redis ops, so the infrastructure is in place."

**"Why not PostgreSQL?"** — "The domain data is heavily nested and JSON-shaped (test cases, per-case results, upvote lists) and the API returns those shapes directly — Mongo avoids joins/JSONB mapping. For the flows that need atomicity across documents (problem deletion with storage cleanup, list cloning), I'd note that as a gap and would use transactions or compensation logic; if I were building for analytics-heavy workloads, Postgres would be the call. MongoDB also gave us fast iteration during rapid feature development." 

**"What if two users click submit simultaneously?"** — "Frontend: a store-level guard sets `isLoading` and blocks while a submission is queued/running, and the button is disabled/loading. Server: each click legitimately creates a separate submission — they're distinct attempts; there's no cross-user conflict. The real race is the same user double-submitting across tabs: the frontend guard is per-tab. The robust fix is an idempotency key on the submit endpoint, which I'd add."

**"What if Redis crashes?"** — "New submissions fail to enqueue (the API surfaces a 500) — I'd add a degraded path or retry. Already-queued jobs persist (BullMQ data is on disk/AOF if configured; by default Redis persistence may lose recent jobs — document that). No judging happens while Redis is down. On restart, stuck jobs resume. The frontend's 45s poll prevents hung UIs. Production fix: Redis AOF + Sentinel/cluster + a reconciliation job that re-queues submissions stuck in `queued`."

**"What if the JWT expires mid-session?"** — "All requests return 401; the frontend shows per-request error notifications. There's no global interceptor to redirect to login — a gap I'd fix by adding a 401 response interceptor that clears the auth store and navigates to /login."

**"What if the database connection dies?"** — "Mongoose auto-reconnects with its default driver settings; in-flight requests error out. The worker's DB writes would throw → job retried (attempts 3) → eventually internal_error with a publish. There's no connection-pool health metric; production would add readiness/liveness checks."

**"What if the Docker daemon hangs mid-judge?"** — "The outer 10s exec timeout on `docker start -a` bounds the wait; the job fails → retried. If the daemon is down, every job fails → internal_error. Mitigations: daemon health monitoring, worker concurrency caps, and (best) a dedicated judge host."

**"Why is the whole code stored in the Submission? Isn't that wasteful?"** — "It powers the submission-history code viewer with zero extra lookups, and storage is cheap relative to UX. For a large deployment I'd move code blobs to object storage and keep a reference."

**"Why not store test cases in MongoDB?"** — "Large binary/text blobs are better in object storage; Mongo is for structured data. The interface abstracts it, so it's a one-line switch."

**"Why does the worker run in the same process as the API?"** — "Simplicity for a single-host deploy; the code is already decoupled (queue + pub/sub), so splitting into separate containers later is a compose change, not a code change."

**"Your container is created per test case — that's slow."** — "Correct, and it's a deliberate security-first tradeoff. The path to speed is a warm container pool and batching cases per container with per-case CPU accounting."

**"How do you know the executor image is up to date?"** — "The start scripts build `oj-executor` before compose up; there's no version pinning/registry — a deployment gap I'd fix with a tagged image and CI build."

**"What's the difference between 401 and 403 in your app?"** — "401 = unauthenticated (missing/invalid token) from `protect`; 403 = authenticated but forbidden (wrong role) from `authorize`/author-check. Note `adminOnly` returns 401 — an inconsistency I'd clean up."

**"Why does the verify-email endpoint accept both GET and POST?"** — "GET for the emailed link (query param) and POST for programmatic verification. Slight REST smell but pragmatic."

**"Your `upvotes` toggle is read-modify-write. Race?"** — "Yes — two simultaneous votes can lose one. Fix with atomic `$addToSet`/`$pull`."

**"Why does `runSolution` block but `submitSolution` doesn't?"** — "Intentional: Run is for instant feedback on a handful of sample cases; Submit is the durable, scalable path. I acknowledge Run is less elastic and would move it to a low-latency queue at scale."

**"How do you prevent a user from just returning the expected output?"** — "You can't fully — that's the nature of judging by I/O. In practice we keep hidden test cases secret and accept this fundamental limit; checkers (custom validation) handle problems that can't be judged by exact output."

**"What about huge stdout from a user program?"** — "Currently unbounded — a program printing gigabytes would fill the container disk and slow judging. I'd cap stdout (e.g., pipe through `head -c` or ulimit) and compare output streaming to stop early. Noted gap."

**"Why store the checker in storage, not the problem doc?"** — "Code blobs → object storage, consistent with test cases; the doc keeps only metadata (`enabled/language/filename`)."

**"Can a user read other users' submissions?"** — "`GET /problems/:id/submissions` and `GET /problems/submissions/:id` currently lack an ownership check — any authenticated user can read anyone's code. This is a known authorization gap; the fix is adding `req.user._id` filters. I can explain exactly where."

**"How would you add a 4th language?"** — "Add a Dockerfile.executor package for it, add a `xxxExecutor.js` following the same template (compile + `time` + `timeout`), register it in `executeCode.js`, and add it to the frontend language picker/templates."

---

# SECTION 24 — Project Defense

> The interviewer is trying to prove you didn't build it. Every question probes something only an author would know.

**Q1. "Your dockerExecutor writes files with `fs.writeFileSync` — why sync, and what's the cost?"** — The whole helper runs `await execPromise` (async) but file prep/cleanup is sync; the files are tiny (code + input), the event-loop block is negligible, and it keeps the create/cp/start sequence simple. If inputs were large I'd use async fs.

**Q2. "Why does `runChecker` re-implement the whole container dance instead of calling `runInDocker`?"** — It needs a *different* command signature (three args: input, expected, actual) and a different verdict contract (1/0/throw), so it shares the pattern but not the function. You could refactor `runInDocker` to accept arbitrary file mappings and commands — that's a real cleanup opportunity.

**Q3. "Explain `getTestPairs` and why the input/output counts must match."** — It parses `input_<id>` from each uploaded filename, looks up the sibling `output_<id>.txt`, and only pairs matches. If the counts differ or pairs are missing, we reject with a 400 so no problem is created with broken cases. `listTestCases` does the same pairing against storage at judge time — so the two implementations must stay in sync, which is a maintenance risk.

**Q4. "What's in `problem.json` exactly and how does bulk import differ from single?"** — title, description, difficulty, tags, optional testCases samples. Single = one package (optionally wrapped in one folder); bulk = multiple packages at the root (optionally wrapped in one parent folder). Per-package validation is shared (`processProblemPackage`); bulk continues on failure and reports per-folder status.

**Q5. "Why does `createProblem` need test-pair count to equal input count?"** — Because a stray `output_7.txt` with no `input_7.txt` would silently leave an orphan; the check catches asymmetry early.

**Q6. "Your `bootstrapAdmin` promotes an existing user with the bootstrap email. Why?"** — So re-running the stack (or deploying over an old DB) with the same admin email doesn't create a duplicate; it upgrades in place. Idempotency by design.

**Q7. "Why is `verificationTokenExpire` compared as `<= new Date()` but never cleaned up?"** — Expired unverified accounts just keep a dead token; the check at verify time is authoritative. Cleanup would be a cron job (delete stale unverified users) — an improvement.

**Q8. "Why `select("-password")` and not just never sending password?"** — Belt-and-suspenders: `protect` fetches the user for the JWT, and the controller returns `req.user`; the select guarantees the hash never leaves the server even if a future controller forgets to map fields.

**Q9. "Why does `getOverview` compute streaks in JS instead of SQL/aggregation?"** — Streaks need date-set logic (consecutive-day runs, today/yesterday rules) that's awkward in an aggregation; with one user's submissions it's fast. The real issue is loading *all* submissions — I'd add a capped precomputed counter.

**Q10. "Why does the frontend keep the submission Promise instead of just subscribing and rendering?"** — The Promise lets the workspace `.then()` refresh history and the store resolve state deterministically; the listener only resolves terminal statuses, keeping intermediate updates as rendering-only.

**Q11. "What happens if `socket` is null or never connects?"** — `submitSolution` still works: the 45s timer polls the HTTP endpoint. The socket is best-effort acceleration, not a dependency. That's why the fallback exists.

**Q12. "Why is `CORS_ORIGIN` in env but `cors()` ignores it?"** — `app.use(cors())` accepts all origins; `CORS_ORIGIN` is declared in compose/env but unused in code — a dead config that reveals intent. An interviewer who catches this is seeing honesty, not a script. My fix: `cors({ origin: process.env.CORS_ORIGIN.split(',') })`.

**Q13. "Why is the JWT expiry hardcoded `30d` instead of using `JWT_EXPIRE` from env?"** — Inconsistency: `.env.example` defines `JWT_EXPIRE=30d` but `auth.service.js` hardcodes `"30d"`. Flag it, explain the fix (read from env), and note it as a small debt item.

**Q14. "What is `oj-executor` and why is it built outside compose?"** — It's the runtime sandbox image with compilers. The start scripts `docker build` it before `compose up` because the backend spawns containers *from* that image at judge time; compose doesn't know it's a dependency. If you only run compose, judges fail with "unable to find image oj-executor" — a known footgun.

**Q15. "Why `adm-zip` sync extraction rather than streaming?"** — Simplicity. The cost is event-loop blocking for large archives and zip-bomb risk (no decompression ratio checks). For admin-only endpoints behind auth, risk is acceptable; I'd add limits.

---

# SECTION 25 — Knowledge Gaps

## A. How does the Docker sandbox actually isolate code? (from first principles)
1. **Namespaces** give each container its own view: PID namespace (only its processes), network namespace (`--network=none` → no interfaces except loopback), mount namespace (its own filesystem root — it sees the image layers, not the host's `/etc` or files), UTS, IPC, user.
2. **cgroups** enforce limits: `--memory=256m` → memory controller kills the group's process when exceeded (OOMKilled); `--cpus=0.5` → CPU controller caps usage to half a core.
3. **`docker cp`** copies files into the container's writable layer — the only way user files get in; nothing else from the host is mounted.
4. **`docker inspect`** reads container *state* (exit code, OOMKilled) after the process exits — that's how the judge classifies outcomes even when `docker start -a` was killed by the outer timeout.
5. **Cleanup**: `docker rm -f` removes container + its writable layer — nothing leaks.

## B. BullMQ + Redis under the hood
- Redis stores queue state in keys: lists (`bull:submission:wait`, `active`), zsets (`delayed`, `paused`), streams (`events`), hashes for jobs (`bull:submission:<id>`).
- Worker: BRPOPLPUSH-style pop → processes → on success removes/LPUSH to completed; on failure moves to failed.
- `attempts:3` + exponential backoff = job moved to `delayed` zset with a retry timestamp, reprocessed later.
- `removeOnComplete:100` trims the completed list.
- **At-least-once**: a crash between DB write and ack → job redelivered → duplicate judge → why idempotency matters.

## C. Pub/Sub semantics
- Redis pub/sub is **fire-and-forget**: messages aren't stored. If no subscriber, message is lost. This is *why* the 45s poll exists.
- Subscriber connections can't issue normal commands → `connection.duplicate()`.

## D. JWT internals
- Header.payload.signature; payload `{id, iat, exp}`; verified with HMAC-SHA256 using `JWT_SECRET`. Stateless → no revocation. Signing ≠ encryption (payload is base64 — readable!). Never put secrets in a JWT.

## E. SM-2 algorithm (Anki)
- Each card: ease factor (EF), repetition count, interval.
- Quality q(0-5) from your rating; if q<3 → reps=0, interval=1. Else interval = 1 (1st success), 6 (2nd), round(interval×EF) after. EF' = EF + (0.1 − (5−q)(0.08+(5−q)×0.02)), min 1.3.
- This project maps 1-4 rating buttons → q 1/3/4/5.

## F. Aggregation `$facet`
- Runs multiple pipelines over the same input and returns `{facetName:[results]}`. Used to get `count` and `data` (skip/limit) in one round trip instead of two queries (find + countDocuments).

## G. ObjectId
- 24-hex char id from timestamp + random + counter. Global uniqueness without coordination. Used in all refs and room names (`submission:<id>`). Room names are therefore unguessable (still not a security control).

## H. `express-async-handler` & Express 5
- Async errors in Express must be forwarded to error middleware. The wrapper catches rejected promises and calls `next(err)`. Express 5 natively awaits handlers, but the wrapper remains harmless/compatible.

## I. Multer memory vs disk storage
- memory: file is a Buffer on `req.file`/`req.files` — no disk I/O, no cleanup; RAM cost.
- disk: writes to temp path — needs cleanup; better for large files.

## J. bcrypt vs argon2 vs scrypt
- All salted, adaptive. bcrypt: Blowfish, CPU-bound, older. argon2: memory-hard (wins against GPU/ASIC), current recommendation. scrypt: Node built-in, memory-hard, good default too.

## K. Why `--network=none` blocks both inbound and outbound
- The network namespace has no interfaces; there's no default gateway, no DNS, no sockets to the host or other containers. Malware can't exfiltrate and can't SSRF internal services.

## L. Mongo indexes: when a query scans
- Without an index, Mongo COLLSCANs. With compound unique indexes on `usernotes` and `reviewprogress`, those hot lookups are O(log n). `submissions` queries have no index → scans — hence the Section 11/12 critique.

---

# SECTION 26 — Final Cheat Sheet

## Top 100 things to remember
1-10: Stack (MERN+BullMQ+Redis+Socket.IO+Docker+Nginx), executor image `oj-executor`, 3 languages, 9 verdicts, queue attempts 3, 30d JWT, 24h verify token, 45s poll, 5s timeout, 256m/0.5cpu.
11-20: Redis 2 roles, 2 connections, channel name, `maxRetriesPerRequest:null`, removeOnComplete 100/1000, exp backoff 2s, fire-and-forget, rooms `submission:{id}`, join/leave events, fallback rationale.
21-30: Docker create/cp/start/inspect/rm, `--network=none`, OOMKilled, exit 124, compile sentinel 111, `___COMPILE_ERROR___` marker, `/usr/bin/time` metrics, time e→ms, memory M→bytes, cleanup in finally.
31-40: Run=sync samples, Submit=async hidden, break-on-first-fail, maxTime/maxMemory aggregation, results stored, trim-compare, checker 1/0, checker 5s, 5MB checker cap, storage interface methods.
41-50: Startup order (env→db→admin→storage-health→listen), fail-fast exits, bootstrap admin idempotent, JWT_SECRET≥32, CORS open, express json 100kb, no 404 handler, error shape {message,stack}, prod hides stack, AppError.
51-60: Auth (bcrypt10, randomBytes32→sha256, verify endpoint, resend), protect/authorize/adminOnly, req.user -password, role from DB, no isVerified check server-side, no ownership on submissions, XSS via marked, no CSP, no rate limit, localStorage token.
61-70: Problems aggregation `$facet`, regex search ReDoS, difficulty-weight sort, tags whitelist, test-pair sync, import ZIP single/bulk, adm-zip sync, temp-dir cleanup, auto-generate samples, tag resolve by id/label.
71-80: Stats in-memory (overview/difficulty/languages/tags/activity/calendar), streak JS math, Sets for solved, calendar 365d, no caching, missing indexes, N+1 enrich SR, N+1 discussions populate, model list, collections.
81-90: Notes upsert unique pair 5000 cap; lists owner-or-public, clone import, SR toggle, syncReviewProgress, SM-2 ratings mapping, ease floor 1.3, due cards nextReviewDate, midnight schedule, reset.
91-100: Nginx SPA fallback + proxy + upgrade + gzip + immutable cache; prod no host ports but 80; privileged+docker.sock risk; scripts build executor first; dev hot-reload; prod npm ci; no tests/CI/monitoring/backups; VITE_API_URL baked; `Accepted` vs `accepted` bug; CORS_ORIGIN unused.

## Top 50 interview questions (from Section 21 — keep the answers fresh)
[E1-E10, M11-M25, H26-H40, VH41-V50 summaries above.]

## Top 20 architecture facts
1. Layered: routes→controllers→services→models.
2. Worker is a side-effect import in server.js.
3. Single process hosts API+worker+socket.
4. Redis pub/sub decouples worker from socket.
5. Publisher/subscriber are duplicate connections.
6. Docker CLI, not SDK.
7. Per-test-case containers.
8. Two-layer timeout.
9. Storage behind factory + interface.
10. Startup storage health gate.
11. Admin bootstrap.
12. JWT payload = {id} only.
13. Sample vs hidden test separation.
14. Fail-fast judge loop.
15. 45s frontend fallback.
16. Rooms keyed by submission id.
17. Compound unique indexes guard invariants.
18. Flat discussions + JS tree.
19. Stats are on-demand in Node.
20. SM-2 as a pure function.

## Top 20 tradeoffs (one-liners)
1. Container-per-case: security ↔ latency.
2. Async queue: durability ↔ Redis dependency.
3. JWT: stateless ↔ no revocation.
4. localStorage JWT: simple ↔ XSS risk.
5. Docker CLI: simple ↔ shell fragility/false TLE.
6. Docker socket + privileged: needed ↔ host risk.
7. Mongo: flexible docs ↔ weak transactions.
8. In-memory stats: simple ↔ unscalable.
9. Stored results: fast UI ↔ DB bloat.
10. Fail-fast: cheap ↔ partial metrics loss.
11. Single process: simple ↔ no independent scaling.
12. No rate limit: simple ↔ abuse.
13. Open CORS: convenient ↔ sloppy.
14. No TS: fast ↔ unsafe refactors.
15. Manual validation: light ↔ incomplete.
16. adm-zip sync: easy ↔ event-loop block/zip bomb.
17. marked w/o sanitize: fast ↔ XSS.
18. SM-2: proven simple ↔ FSRS is better.
19. Upvotes array: simple ↔ race.
20. Env config: portable ↔ secret hygiene.

## Top 20 debugging facts
1. Check `oj-executor` image existence first for judge failures.
2. Redis: `LLEN bull:submission:wait` shows queue depth.
3. `docker inspect --format '{{.State.OOMKilled}}'` confirms MLE.
4. Exit 124 = inner timeout; outer 10s timeout also sets timeout flag.
5. Compile error sentinel = exit 111 + marker text.
6. Metrics file missing is normal for compile errors.
7. `docker compose logs backend` shows every stage transition.
8. Sample cases (doc) ≠ hidden cases (storage) — verify which you're testing.
9. 45s poll proves socket vs DB health.
10. `SUBSCRIBE submission_updates` in redis-cli debugs the socket path.
11. Dev/prod use different compose files but same URI → wrong-volume confusion.
12. `Accepted` vs `accepted` — the auto-reveal bug lives in ProblemWorkspace.jsx.
13. express.json 100kb → large code payload fails as 413-ish HTML.
14. `maxRetriesPerRequest:null` → commands hang if Redis is down (bounded by sockets).
15. Node single-thread: sync fs in LocalStorage blocks; watch for freeze under load.
16. Job stuck queued → worker likely dead (not started or crashed on image missing).
17. `results` truncation after first failure explains "missing cases".
18. Compile-heavy languages + cold daemon → false TLE (outer timeout).
19. CORS_ORIGIN is declared but unused — don't claim it's enforced.
20. JWT_EXPIRE env is unused; `30d` is hardcoded.

---

# Appendix — Line-references quick map

| Concern | Location |
|---|---|
| Env bootstrap | `backend/index.js` |
| Compose root | `backend/server.js` |
| Socket rooms | `backend/config/socket.js` |
| Redis pub/sub | `backend/jobs/redis.js` |
| Queue config | `backend/jobs/queues/submission.queue.js` |
| Worker | `backend/jobs/workers/submission.worker.js` |
| Judge loop | `backend/jobs/processors/submission.processor.js` |
| Docker wrapper | `backend/executor/dockerExecutor.js` |
| Verdict mapping | `backend/executor/evaluateExecutionResult.js` |
| Checker runner | `backend/executor/runChecker.js` |
| Language commands | `backend/executor/{cpp,python,java}Executor.js` |
| Submit/run services | `backend/services/submission.service.js` |
| Auth service | `backend/services/auth.service.js` |
| SM-2 | `backend/services/userlist.service.js` (`calculateSM2`) |
| Storage factory | `backend/storage/StorageFactory.js` + `config/storage.js` |
| Problem pagination | `backend/services/problem.service.js` (`getAllProblems`) |
| Importer | `backend/services/import.service.js` |
| Auth middleware | `backend/middleware/auth.middleware.js` |
| Error middleware | `backend/middleware/error.middleware.js` |
| Frontend submit/socket | `frontend/src/stores/submissionStore.js` |
| Workspace & bugs | `frontend/src/features/problems/pages/ProblemWorkspace.jsx` |
| Axios auth interceptor | `frontend/src/lib/api.js` |
| Socket client | `frontend/src/lib/socket.js` |
| Route guards | `frontend/src/App.jsx` |
| Nginx prod | `frontend/nginx.conf` |
| Executor image | `backend/executor/Dockerfile.executor` |

> Final advice: memorize the pitch, the submit-flow diagram (Section 7), and the top-10 security gaps. Every "Why?" answer should start from **the problem being solved**, then the **options**, then **why this one won**, then the **cost**.
