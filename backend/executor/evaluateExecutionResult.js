/**
 * Evaluates the results of running user code inside a sandbox against an expected output.
 * Maps sandbox-level facts (exitCode, timeout, oomKilled) to standard online judge statuses
 * and returns details for stdout/stderr formatting.
 *
 * @param {Object} result Sandbox execution result
 * @param {string} expectedOutput The expected correct stdout
 * @param {boolean} [passedOverride] Optional evaluation override (e.g. from checker)
 * @returns {Object} Centralized verdict and evaluation facts
 */
export function evaluateExecutionResult(result, expectedOutput, passedOverride) {
  let actualOutput = "";
  let passed = false;
  let status = "accepted"; // Default if success and output matches
  let exitCode = typeof result.exitCode === "number" ? result.exitCode : 0;
  let compileOutput = "";
  let stderr = "";

  if (result.status === "compile_error" || result.isCompileError) {
    actualOutput = result.compileOutput || "Compile Error";
    status = "compile_error";
    exitCode = typeof result.exitCode === "number" ? result.exitCode : 111;
    compileOutput = result.compileOutput || "";
  } else if (result.status === "time_limit_exceeded" || result.timeout) {
    actualOutput = "Time Limit Exceeded";
    status = "time_limit_exceeded";
    exitCode = typeof result.exitCode === "number" ? result.exitCode : 124;
    stderr = result.stderr || "Time Limit Exceeded";
  } else if (result.status === "memory_limit_exceeded" || result.oomKilled) {
    actualOutput = "Memory Limit Exceeded";
    status = "memory_limit_exceeded";
    exitCode = typeof result.exitCode === "number" ? result.exitCode : 137;
    stderr = result.stderr || "Memory Limit Exceeded";
  } else if (result.status === "runtime_error" || result.exitCode !== 0) {
    actualOutput = result.stderr || "Runtime Error";
    status = "runtime_error";
    stderr = result.stderr || "";
  } else {
    actualOutput = result.stdout || "";
    passed = passedOverride !== undefined ? passedOverride : actualOutput.trim() === expectedOutput.trim();
    if (!passed) {
      status = "wrong_answer";
    }
  }

  return {
    status,
    actualOutput,
    passed,
    exitCode,
    compileOutput,
    stderr,
  };
}
