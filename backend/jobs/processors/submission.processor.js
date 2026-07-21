import Submission from "../../models/submission.model.js";
import Problem from "../../models/problem.model.js";
import storage from "../../config/storage.js";
import { executeCode } from "../../executor/executeCode.js";
import { evaluateExecutionResult } from "../../executor/evaluateExecutionResult.js";
import { runChecker } from "../../executor/runChecker.js";
import { publishSubmissionUpdate } from "../redis.js";

/**
 * Core business logic for processing and judging a solution submission.
 *
 * @param {string} submissionId ID of the submission to judge
 * @returns {Promise<string>} Final status verdict of the submission
 */
export async function processSubmission(submissionId) {
  const submission = await Submission.findById(submissionId);
  if (!submission) {
    throw new Error(`Submission not found: ${submissionId}`);
  }

  // Update status to running and set startedAt timestamp
  submission.status = "running";
  submission.startedAt = new Date();
  await submission.save();

  await publishSubmissionUpdate(submission._id.toString(), {
    status: "running",
    submission: submission.toObject ? submission.toObject() : submission,
  });

  const problem = await Problem.findById(submission.problem);
  if (!problem) {
    throw new Error(`Problem not found: ${submission.problem}`);
  }

  const testCases = await storage.listTestCases(problem._id.toString());
  const results = [];
  let finalStatus = "accepted";
  let maxTime = 0;
  let maxMemory = 0;
  let finalExitCode = 0;
  let finalCompileOutput = "";
  let finalStderr = "";

  for (const tc of testCases) {
    const inputContent = await storage.getInputContent(problem._id.toString(), tc.input);
    const expectedOutputContent = await storage.getOutputContent(
      problem._id.toString(),
      tc.output,
    );

    // Invoke executor directly
    const result = await executeCode({
      code: submission.code,
      language: submission.language,
      input: inputContent,
    });

    let passedOverride = undefined;
    const isExecutionSuccessful = result.status === "success";

    if (problem.checker && problem.checker.enabled && isExecutionSuccessful) {
      const checkerCode = await storage.getChecker(problem._id.toString());
      const checkerResult = await runChecker({
        checkerCode,
        input: inputContent,
        expectedOutput: expectedOutputContent,
        actualOutput: result.stdout || "",
      });
      passedOverride = checkerResult.passed;
    }

    const evaluated = evaluateExecutionResult(result, expectedOutputContent, passedOverride);

    if (typeof result.executionTime === "number" && result.executionTime > maxTime) {
      maxTime = result.executionTime;
    }
    if (typeof result.memoryUsage === "number" && result.memoryUsage > maxMemory) {
      maxMemory = result.memoryUsage;
    }

    results.push({
      input: inputContent,
      output: evaluated.actualOutput,
      expectedOutput: expectedOutputContent.trim(),
      passed: evaluated.passed,
    });

    if (evaluated.status !== "accepted") {
      finalStatus = evaluated.status;
      finalExitCode = evaluated.exitCode;
      finalCompileOutput = evaluated.compileOutput;
      finalStderr = evaluated.stderr;
      break; // Stop running further test cases on first failure
    }
  }

  // Update submission with final verdict and completed timing
  submission.status = finalStatus;
  submission.executionTime = maxTime;
  submission.memoryUsage = maxMemory;
  submission.exitCode = finalExitCode;
  submission.compileOutput = finalCompileOutput;
  submission.stderr = finalStderr;
  submission.results = results;
  submission.completedAt = new Date();
  await submission.save();

  await publishSubmissionUpdate(submission._id.toString(), {
    status: finalStatus,
    submission: submission.toObject ? submission.toObject() : submission,
  });

  return finalStatus;
}

