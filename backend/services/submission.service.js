import Problem from "../models/problem.model.js";
import Submission from "../models/submission.model.js";
import { AppError } from "../utils/errors.js";
import { executeCode } from "../executor/executeCode.js";
import { enqueueSubmission } from "../jobs/producers/submission.producer.js";
import { evaluateExecutionResult } from "../executor/evaluateExecutionResult.js";
import { runChecker } from "../executor/runChecker.js";
import storage from "../config/storage.js";

export const runSolution = async ({ problemId, code, language }) => {
  if (!problemId || !code || !language) {
    throw new AppError("One or more fields are missing while submitting solution", 400);
  }

  const problem = await Problem.findById(problemId);

  if (!problem) {
    throw new AppError("Problem not found while submitting solution", 400);
  }

  const testCases = problem.testCases;
  const response = [];

  for (const testCase of testCases) {
    const input = testCase.input;
    const expectedOutput = testCase.expectedOutput;

    // Directly execute the code
    const result = await executeCode({
      code,
      language,
      input,
    });

    let passedOverride = undefined;
    const isExecutionSuccessful = result.status === "success";

    if (problem.checker && problem.checker.enabled && isExecutionSuccessful) {
      const checkerCode = await storage.getChecker(problem._id.toString());
      const checkerResult = await runChecker({
        checkerCode,
        input,
        expectedOutput,
        actualOutput: result.stdout || "",
      });
      passedOverride = checkerResult.passed;
    }

    const evaluated = evaluateExecutionResult(result, expectedOutput, passedOverride);

    response.push({
      input,
      output: evaluated.actualOutput,
      expectedOutput,
      passed: evaluated.passed,
    });
  }

  return { response };
};

export const submitSolution = async ({ userId, problemId, code, language }) => {
  if (!problemId || !code || !language) {
    throw new AppError("One or more fields are missing while submitting solution", 400);
  }

  const problem = await Problem.findById(problemId);

  if (!problem) {
    throw new AppError("Problem not found while submitting solution", 400);
  }

  // Create Submission(status="queued")
  const submission = await Submission.create({
    user: userId,
    problem: problemId,
    code: code,
    language: language,
    status: "queued",
    queuedAt: new Date(),
  });

  // Enqueue submissionId
  await enqueueSubmission({
    submissionId: submission._id,
  });

  // Immediately return queued status details
  return {
    status: "queued",
    submissionId: submission._id,
  };
};

export const getSubmissionById = async (submissionId) => {
  if (!submissionId) {
    throw new AppError("Submission ID is required", 400);
  }
  const submission = await Submission.findById(submissionId);
  if (!submission) {
    throw new AppError("Submission not found", 404);
  }
  return submission;
};

export const getSubmissions = async (problemId) => {
  if (!problemId) {
    throw new AppError("Problem not found", 400);
  }

  const submissions = await Submission.find({ problem: problemId });
  return { submissions };
};
