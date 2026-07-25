# GreenCode

GreenCode is an open-source online judge platform designed for practicing coding problems, running real-time tests, and submitting solutions. The system executes user submissions inside a sandboxed environment to assess code correctness, execution time, and memory usage.

## Features

### Problem Solving
* **Multi-Language Code Execution**: Support for C++, Python, and Java.
* **Interactive Editor**: Integrated Monaco code editor with syntax highlighting, autocomplete, and custom font size/theme configurations.
* **Real-Time WebSockets Verification**: Instant solution status updates (`Queued` -> `Running` -> Verdict) using Socket.IO and Redis Pub/Sub instead of HTTP polling.
* **Submission Locking**: Automatic button disabling and loading spinners to prevent double-submissions while solutions evaluate.

### Learning Features
* **Private Notes**: Maintain personal markdown notes for each problem.
* **Performance Insights**: View detailed run times, memory usage metrics, compilation outputs, and sandbox stderr logs.

### Community Features
* **Discussion Forums**: Share solutions and discuss approaches directly under each problem.
* **Curated Playlists**: Group and star problems to create custom lists with spaced repetition reviews.

### Admin Features
* **Problem Package Import**: Import single or bulk problems using structured ZIP files.
* **Management Console**: Control database records, uploads, and execution settings.

### Platform & Security
* **Authentication**: Secure user signup, login using JWT tokens, and SHA-256 hashed email verification tokens via Nodemailer SMTP.
* **Storage Options**: Flexible storage abstraction for test cases supporting local directories, MinIO, or AWS S3.

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React, Vite, Mantine UI |
| **Backend** | Node.js, Express, Socket.IO |
| **Queue & Real-Time** | BullMQ, Redis (Pub/Sub) |
| **Email Service** | Nodemailer (SMTP) |
| **Database** | MongoDB, Mongoose |
| **Sandbox Execution** | Docker, Docker CLI |
| **Storage** | Local Filesystem, MinIO, AWS S3 |
| **Containerization** | Docker, Docker Compose |

## Project Structure

* **`backend/`**: Express API server, Socket.IO server, BullMQ workers, and submission judgment logic.
* **`frontend/`**: Vite-based React single-page application styled with Mantine UI.
* **`docker-compose.dev.yml`**: Hot-reloading development compose configuration.
* **`docker-compose.prod.yml`**: Production compose configuration with Nginx static file serving.
* **`docs/`**: Detailed technical documentation on architecture, importer specifications, and sandboxing.

## Getting Started

### Prerequisites

* Docker and Docker Compose
* Node.js v20+ (for local scripts)

### Setup and Execution

1. **Clone the Repository**
   ```bash
   git clone https://github.com/greenaltambe/online-judge.git
   cd online-judge
   ```

2. **Configure Environment Variables**
   Create a `.env` file by copying the example file:
   ```bash
   cp .env.example .env
   ```
   *Note: Update the SMTP configurations (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) inside `.env` using your email SMTP credentials (e.g. Gmail App Password).*

3. **Start the Application in Development Mode**
   ```bash
   npm run dev
   # or
   ./scripts/start-dev.sh
   ```
   *The dev frontend will be accessible at `http://localhost:5173` and the backend at `http://localhost:5000`.*

4. **Start the Application in Production Mode**
   ```bash
   npm run prod
   # or
   ./scripts/start-prod.sh
   ```
   *The production site is served using Nginx on port `80`, proxying API requests to the backend.*

5. **Stop Containers**
   ```bash
   # Development
   npm run dev:down
   # or
   ./scripts/stop-dev.sh

   # Production
   npm run prod:down
   # or
   ./scripts/stop-prod.sh
   ```

## Environment Variables

The `.env` file contains configuration settings categorized as follows:
* **Environment**: Platform mode (`NODE_ENV`).
* **JWT**: Secret keys and expiration limits for user authentication.
* **SMTP Email Configuration**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, and `FRONTEND_URL` for sending email verification links.
* **Storage Configuration**: Local (`local`), MinIO (`minio`), or S3 (`s3`) toggle.
* **Storage Credentials**: Credentials for MinIO and AWS S3 connections.
* **Frontend**: API connection URLs for Vite (`VITE_API_URL`).

## Problem Import

Problems can be imported using standard ZIP archives.

### Single Problem Import
A single problem ZIP archive must contain a single root folder (or files directly at the root) with this structure:
```text
├── problem.json
└── tests/
    ├── input_1.txt
    ├── output_1.txt
    ├── input_2.txt
    └── output_2.txt
```

### Bulk Import
A bulk import ZIP archive must contain multiple problem directories at the root level, each matching the Single Problem Import format:
```text
├── problem-one/
│   ├── problem.json
│   └── tests/
│       ├── input_1.txt
│       └── output_1.txt
└── problem-two/
    ├── problem.json
    └── tests/
        ├── input_1.txt
        └── output_1.txt
```

## Documentation

For deeper technical insight, explore the documentation files in the `docs/` directory:
* [Architecture Documentation](docs/architecture.md)
* [Judge Execution & Sandboxing](docs/judge.md)
* [Problem Package Importer](docs/importer.md)