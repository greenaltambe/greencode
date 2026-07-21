import asyncHandler from "express-async-handler";
import * as problemService from "../services/problem.service.js";
import * as submissionService from "../services/submission.service.js";
import * as importService from "../services/import.service.js";

// @desc    Get all problems
// @route   GET /api/problems
// @access  Private
export const getProblems = asyncHandler(async (req, res) => {
  const result = await problemService.getAllProblems(req.query);
  res.status(200).json(result);
});

// @desc    Get single problem
// @route   GET /api/problems/:id
// @access  Private
export const getProblem = asyncHandler(async (req, res) => {
  const result = await problemService.getProblemById(req.params.id, req.user._id);
  res.status(200).json(result);
});

// @desc    Set problem
// @route   POST /api/problems
// @access  Private
export const setProblem = asyncHandler(async (req, res) => {
  const result = await problemService.createProblem({
    title: req.body.title,
    description: req.body.description,
    difficulty: req.body.difficulty,
    testCases: req.body.testCases,
    files: req.files,
    tags: req.body.tags,
  });
  res.status(201).json(result);
});

// @desc    Update problem
// @route   PUT /api/problems/:id
// @access  Private
export const updateProblem = asyncHandler(async (req, res) => {
  const result = await problemService.updateProblem(req.params.id, {
    ...req.body,
    files: req.files,
  });
  res.status(200).json(result);
});

// @desc    Delete problem
// @route   DELETE /api/problems/:id
// @access  Private
export const deleteProblem = asyncHandler(async (req, res) => {
  const result = await problemService.deleteProblem(req.params.id);
  res.status(200).json(result);
});

// @desc    Run solution
// @route   POST /api/problems/run
// @access  Private
export const runSolution = asyncHandler(async (req, res) => {
  const result = await submissionService.runSolution({
    problemId: req.body.problemId,
    code: req.body.code,
    language: req.body.language,
  });
  res.status(200).json(result);
});

// @desc    Submit solution
// @route   POST /api/problems/submit
// @access  Private
export const submitSolution = asyncHandler(async (req, res) => {
  const result = await submissionService.submitSolution({
    userId: req.user._id,
    problemId: req.body.problemId,
    code: req.body.code,
    language: req.body.language,
  });
  res.status(200).json(result);
});

// @desc    Get submissions for a problem
// @route   GET /api/problems/:id/submissions
// @access  Private
export const getSubmissions = asyncHandler(async (req, res) => {
  const result = await submissionService.getSubmissions(req.params.id);
  res.status(200).json(result);
});

// @desc    Get submission status/details by ID
// @route   GET /api/problems/submissions/:submissionId
// @access  Private
export const getSubmissionStatus = asyncHandler(async (req, res) => {
  const result = await submissionService.getSubmissionById(req.params.submissionId);
  res.status(200).json(result);
});

// @desc    Import problems from a ZIP archive
// @route   POST /api/problems/import
// @access  Private/Admin
export const importProblems = asyncHandler(async (req, res) => {
  const result = await importService.importProblems({
    zipBuffer: req.file?.buffer,
    type: req.body.type,
  });
  res.status(201).json(result);
});
