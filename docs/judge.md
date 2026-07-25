# Sandboxed Executor & Judging Engine

The execution engine safely compiles and runs untrusted user submissions inside isolated Docker containers. It prevents malicious code execution, enforces runtime constraints, evaluates custom checkers, and measures execution metrics.

---

## Docker Execution & Sandboxing

To run code safely, user submissions do not execute directly on the host system. Instead, temporary isolated Docker containers are provisioned dynamically for each execution.

### Sandbox Constraints & Security
* **Network Isolation**: Containers run with `--network=none` to prevent untrusted code from making network requests or interacting with internal services.
* **CPU Limits**: CPU consumption is restricted (configurable via `MAX_CPU` in `.env`, default `0.5` cores).
* **Memory Limits**: Memory usage is capped (configurable via `MAX_MEMORY` in `.env`, default `256m`). Out-of-memory processes are automatically killed by the kernel OOM killer.
* **Timeout Protection**: Program execution is enforced via system timeout (`EXECUTION_TIMEOUT`, default `5` seconds).

---

## Supported Languages

Dedicated execution environments support the following programming languages:

| Language | Extension | Compiler / Interpreter | Command |
| :--- | :--- | :--- | :--- |
| **C++** | `.cpp` | `g++` (GCC) | `g++ /code/Main.cpp -o /code/main` |
| **Python** | `.py` | `python3` (Python 3.x) | `python3 /code/Main.py` |
| **Java** | `.java` | `openjdk-17` (Java 17) | `java -cp /code Main` |

---

## Execution & Evaluation Flow

For every submission or test run request:
1. **Queue Dispatch**: Submission job is picked up by a BullMQ worker and status updates to `running` via Redis Pub/Sub.
2. **File Setup**: Source code and test inputs are prepared in isolated temporary directories.
3. **Container Creation**: A temporary Docker container is created with restricted privileges and memory limits.
4. **Code Execution**: Source code is compiled (if compiled language) and executed, passing test inputs to `stdin`.
5. **Checker Script Execution (Optional)**: If the problem has a custom Python checker enabled, the checker script runs against `input`, `expected_output`, and `actual_output`.
6. **Metric Capturing**: Execution runtime (milliseconds) and maximum memory usage (bytes) are calculated.
7. **Container Cleanup**: The temporary container is immediately stopped and removed.

---

## Verdict Classifications

Low-level execution outcomes yield the following verdicts:

* **Accepted**: The output matched the expected output (and passed custom checker if configured).
* **Wrong Answer**: The program executed cleanly, but the output did not match expected test results.
* **Compile Error**: Compilation (`g++`, `javac`, etc.) returned a non-zero exit code. Compiler diagnostics are recorded.
* **Time Limit Exceeded**: Process execution timed out before completion.
* **Memory Limit Exceeded**: Container was killed due to memory limit breach (`OOMKilled`).
* **Runtime Error**: The program compiled but encountered a runtime crash (non-zero exit code).
* **Internal Error**: System or docker execution exception occurred.

---

## Metrics & Real-Time Reporting

- **Execution Time**: Measured in milliseconds (`ms`).
- **Memory Usage**: Tracked in megabytes (`MB`) or bytes (`bytes`).
- **WebSocket Streaming**: All verdict transitions (`queued` -> `running` -> final verdict) stream in real-time to connected client sockets.
