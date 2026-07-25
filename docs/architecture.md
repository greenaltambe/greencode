# Architecture

GreenCode is designed as a scalable system featuring a modern frontend interface, an Express API backend, BullMQ worker queues, Redis Pub/Sub, Socket.IO WebSockets, and isolated Docker sandboxing.

---

## Component Overview

### Frontend
A single-page application (SPA) built using React, Vite, and Mantine UI. It renders problem workspaces, Monaco code editor, real-time submission consoles, spaced repetition decks, discussion boards, and user profile statistics.
* **Development Mode**: Served directly by Vite on port `5173`.
* **Production Mode**: Statically compiled and served by Nginx on port `80`, which acts as a reverse proxy routing `/api` requests directly to the **Backend** service.

### Backend & WebSocket Server
A Node.js and Express server that manages core business logic, user authentication (JWT + Nodemailer email verification), problem metadata, discussion threads, notes, and file storage. It integrates an HTTP server with **Socket.IO** for real-time WebSocket communication.

### Asynchronous Queue & Workers
* **BullMQ**: Manages job queues (`submissionQueue`) for incoming user solutions.
* **Redis**: Serves as the message broker for BullMQ and provides a Pub/Sub channel (`submission_updates`) to broadcast submission status updates across worker processes.

### Sandboxed Executor
Untrusted code is executed inside temporary, isolated Docker containers provisioned dynamically. Network access is disabled (`--network=none`), and CPU/memory constraints are strictly enforced (`MAX_CPU`, `MAX_MEMORY`).

### Database
MongoDB stores persistent application data:
* User profiles, credentials, and SHA-256 hashed email verification tokens.
* Problem metadata (titles, descriptions, difficulty, and checker configurations).
* Submission records (code, language, status, runtime, and memory metrics).
* Discussion threads, comments, custom user playlists, and private markdown notes.

### Storage Abstraction
An abstraction layer for storing test case files (inputs/outputs) and custom checker scripts:
* **Local**: Filesystem storage inside container volumes.
* **MinIO**: Self-hosted object storage.
* **S3**: AWS S3 cloud storage.

---

## Real-Time Submission Flow

The following describes how data flows when a user submits a coding solution:

```
[ Frontend Client ] ──(POST /api/problems/submit)──> [ Backend API ]
         │                                                 │
  (Join Socket Room)                                 (Enqueue Job)
         │                                                 │
         ▼                                                 ▼
[ Socket.IO Server ] <──(Redis Pub/Sub Event)────── [ BullMQ Worker ]
         │                                                 │
  (Push Event to UI)                                 (Sandbox Docker Run)
```

1. **Submission Request**: The user clicks **Submit** in the editor. The frontend locks the submit button (showing a spinner) and sends a `POST /api/problems/submit` request to the Backend.
2. **Database Record & Queue**: The Backend creates a submission record with status `queued` and enqueues `submissionId` into BullMQ `submissionQueue`.
3. **Socket Subscription**: The Frontend receives `{ submissionId }`, connects via Socket.IO, and emits `join_submission` to enter room `submission:${submissionId}`.
4. **Execution & State Transition**:
   - BullMQ worker picks up the job, updates submission status to `running`, and publishes a status event to the Redis channel `submission_updates`.
   - The Socket.IO server receives the Redis message and broadcasts `submission_update` to the frontend client in real-time.
5. **Sandbox Docker Run**: The worker retrieves test cases, executes the code inside a sandboxed Docker container, measures runtime/memory metrics, and evaluates output (via checker if configured).
6. **Verdict & Broadcast**:
   - The worker saves the final verdict (*Accepted*, *Wrong Answer*, *Time Limit Exceeded*, *Runtime Error*, etc.) to MongoDB.
   - The worker publishes the final verdict to Redis, streaming the final update to the frontend.
7. **UI Unlock**: The frontend receives the final verdict event, unlocks the editor buttons, and renders detailed test case results.

---

## Email Verification Auth Flow

```
User Registers ──> Raw Token Generated ──> Token Hashed (SHA-256) ──> Stored in DB (24h Expire)
                                                                             │
                                                                       Send Email (Nodemailer SMTP)
                                                                             │
Token Deleted <── isVerified: true <── Token Verified <── Click Verification Link
```

1. **Registration**: Upon signup, a 32-byte random hex token (`crypto.randomBytes(32)`) is generated.
2. **Hashing & Storage**: The raw token is hashed using SHA-256 before saving to MongoDB (`verificationToken`, `verificationTokenExpire`).
3. **SMTP Email**: An email containing `${FRONTEND_URL}/verify-email?token=${rawToken}` is dispatched via Nodemailer SMTP.
4. **Verification**: Clicking the link sends a request to `GET /api/auth/verify-email?token=${rawToken}`. The backend hashes the incoming token, verifies match and expiration, sets `isVerified = true`, and deletes `verificationToken` and `verificationTokenExpire`.
