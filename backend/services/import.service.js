import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import * as problemService from "./problem.service.js";
import { AppError } from "../utils/errors.js";
import { PROBLEM_TAGS } from "../constants/problemTags.js";

// Helper to clean up a directory
function cleanupDirectory(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(`Failed to delete temporary directory: ${dirPath}`, err);
  }
}

function resolveTags(inputTags) {
  if (!inputTags || !Array.isArray(inputTags)) return [];
  const resolved = [];

  for (const inputTag of inputTags) {
    if (typeof inputTag !== "string") continue;
    const normalized = inputTag.trim().toLowerCase();

    // Look for a tag where either id or label matches (case-insensitive)
    const matchedTag = PROBLEM_TAGS.find(
      (t) =>
        t.id.toLowerCase() === normalized ||
        t.label.toLowerCase() === normalized
    );

    if (!matchedTag) {
      throw new AppError(`Invalid tag: ${inputTag}`, 400);
    }

    resolved.push(matchedTag.id);
  }

  return resolved;
}

// Helper to validate single problem package structure and contents
async function processProblemPackage(problemDir) {
  const jsonPath = path.join(problemDir, "problem.json");
  const testsDir = path.join(problemDir, "tests");

  // 1. Structure validations
  if (!fs.existsSync(jsonPath)) {
    throw new AppError("Missing problem.json in problem package.", 400);
  }
  if (!fs.existsSync(testsDir) || !fs.statSync(testsDir).isDirectory()) {
    throw new AppError("Missing tests directory in problem package.", 400);
  }

  // Parse problem.json
  let metadata;
  try {
    const rawJson = fs.readFileSync(jsonPath, "utf-8");
    metadata = JSON.parse(rawJson);
    console.log(`[Import] Parsed problem.json. Title: ${metadata.title}, tags: ${JSON.stringify(metadata.tags)}`);
  } catch (err) {
    throw new AppError(`Failed to parse problem.json: ${err.message}`, 400);
  }

  const { title, description, difficulty, tags, testCases } = metadata;

  // Metadata validation
  if (!title || typeof title !== "string" || !title.trim()) {
    throw new AppError("Invalid or missing title in problem.json.", 400);
  }
  if (!description || typeof description !== "string" || !description.trim()) {
    throw new AppError("Invalid or missing description in problem.json.", 400);
  }
  const normalizedDifficulty = difficulty ? difficulty.toLowerCase() : "";
  if (!["easy", "medium", "hard"].includes(normalizedDifficulty)) {
    throw new AppError(
      `Invalid or missing difficulty: ${difficulty}. Must be easy, medium, or hard.`,
      400,
    );
  }

  if (tags && !Array.isArray(tags)) {
    throw new AppError(
      "tags field must be an array of strings in problem.json.",
      400,
    );
  }

  const resolvedTags = resolveTags(tags);
  console.log(`[Import] Resolved tags: ${JSON.stringify(resolvedTags)}`);

  // Test Files validation
  const testFiles = fs.readdirSync(testsDir);
  const inputs = [];
  const outputs = [];

  for (const filename of testFiles) {
    if (filename.startsWith("input_") && filename.endsWith(".txt")) {
      const match = filename.match(/input_(\d+)\.txt/);
      if (match) {
        inputs.push({ originalname: filename, id: match[1] });
      }
    } else if (filename.startsWith("output_") && filename.endsWith(".txt")) {
      const match = filename.match(/output_(\d+)\.txt/);
      if (match) {
        outputs.push({ originalname: filename, id: match[1] });
      }
    }
  }

  if (inputs.length === 0 || outputs.length === 0) {
    throw new AppError(
      "At least one input/output file pair must be provided in tests/ directory.",
      400,
    );
  }

  // Validate matching output file exists for each input file
  for (const input of inputs) {
    const matchingOutput = outputs.find((o) => o.id === input.id);
    if (!matchingOutput) {
      throw new AppError(
        `Mismatched test cases: input_${input.id}.txt does not have a matching output_${input.id}.txt.`,
        400,
      );
    }
  }

  // Validate matching input file exists for each output file
  for (const output of outputs) {
    const matchingInput = inputs.find((i) => i.id === output.id);
    if (!matchingInput) {
      throw new AppError(
        `Mismatched test cases: output_${output.id}.txt does not have a matching input_${output.id}.txt.`,
        400,
      );
    }
  }

  // Generate sample test cases if missing
  let finalTestCases = testCases;
  if (
    !finalTestCases ||
    !Array.isArray(finalTestCases) ||
    finalTestCases.length === 0
  ) {
    // Generate from input_1/output_1 (and input_2/output_2 if available)
    finalTestCases = [];

    const input1Path = path.join(testsDir, "input_1.txt");
    const output1Path = path.join(testsDir, "output_1.txt");
    if (fs.existsSync(input1Path) && fs.existsSync(output1Path)) {
      finalTestCases.push({
        input: fs.readFileSync(input1Path, "utf-8").trim(),
        expectedOutput: fs.readFileSync(output1Path, "utf-8").trim(),
      });
    }

    const input2Path = path.join(testsDir, "input_2.txt");
    const output2Path = path.join(testsDir, "output_2.txt");
    if (fs.existsSync(input2Path) && fs.existsSync(output2Path)) {
      finalTestCases.push({
        input: fs.readFileSync(input2Path, "utf-8").trim(),
        expectedOutput: fs.readFileSync(output2Path, "utf-8").trim(),
      });
    }

    if (finalTestCases.length === 0) {
      throw new AppError(
        "No testCases defined in problem.json and failed to auto-generate sample test cases from input_1.txt/output_1.txt.",
        400,
      );
    }
  }

  // Convert to simulated files objects with buffers
  const simulatedFiles = {
    inputs: inputs.map((input) => ({
      originalname: input.originalname,
      buffer: fs.readFileSync(path.join(testsDir, input.originalname)),
    })),
    outputs: outputs.map((output) => ({
      originalname: output.originalname,
      buffer: fs.readFileSync(path.join(testsDir, output.originalname)),
    })),
  };

  const checkerPath = path.join(problemDir, "checker.py");
  if (fs.existsSync(checkerPath) && fs.statSync(checkerPath).isFile()) {
    const checkerStats = fs.statSync(checkerPath);
    if (checkerStats.size > 5 * 1024 * 1024) {
      throw new AppError("checker.py file exceeds the maximum allowed size (5MB).", 400);
    }
    simulatedFiles.checker = [{
      originalname: "checker.py",
      buffer: fs.readFileSync(checkerPath),
    }];
  }

  // Invoke problemService.createProblem
  const result = await problemService.createProblem({
    title,
    description,
    difficulty: normalizedDifficulty,
    testCases: finalTestCases,
    files: simulatedFiles,
    tags: resolvedTags,
  });

  return result.problem;
}

export const importProblems = async ({ zipBuffer, type }) => {
  if (!zipBuffer) {
    throw new AppError("No zip file uploaded", 400);
  }
  if (type !== "single" && type !== "bulk") {
    throw new AppError("Invalid import type. Must be single or bulk.", 400);
  }

  // Create temporary directory in workspace backend directory
  const rootTempDir = path.join(process.cwd(), "temp_import");
  if (!fs.existsSync(rootTempDir)) {
    fs.mkdirSync(rootTempDir, { recursive: true });
  }

  const tempDir = fs.mkdtempSync(path.join(rootTempDir, "import_"));

  try {
    // Unzip the file
    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(tempDir, true);

    // Read type execution
    if (type === "single") {
      let problemDir = tempDir;
      const items = fs.readdirSync(tempDir).filter(item => !item.startsWith(".") && item !== "__MACOSX");
      if (!fs.existsSync(path.join(problemDir, "problem.json")) && items.length === 1) {
        const subPath = path.join(tempDir, items[0]);
        if (fs.statSync(subPath).isDirectory() && fs.existsSync(path.join(subPath, "problem.json"))) {
          problemDir = subPath;
        }
      }

      if (!fs.existsSync(path.join(problemDir, "problem.json"))) {
        throw new AppError(
          "Invalid Single Problem package: problem.json not found in the ZIP archive.",
          400,
        );
      }
      const problem = await processProblemPackage(problemDir);
      return {
        summary: { total: 1, imported: 1, failed: 0 },
        results: [{ title: problem.title, status: "imported" }],
      };
    } else {
      // Bulk Import: folders at root
      let scanDir = tempDir;
      const itemsAtRoot = fs.readdirSync(tempDir).filter(item => !item.startsWith(".") && item !== "__MACOSX");
      if (itemsAtRoot.length === 1) {
        const checkPath = path.join(tempDir, itemsAtRoot[0]);
        if (fs.statSync(checkPath).isDirectory() && !fs.existsSync(path.join(checkPath, "problem.json"))) {
          scanDir = checkPath;
        }
      }

      const items = fs.readdirSync(scanDir);
      const subdirs = [];

      for (const item of items) {
        if (item.startsWith(".") || item === "__MACOSX") continue;
        const itemPath = path.join(scanDir, item);
        if (fs.statSync(itemPath).isDirectory()) {
          subdirs.push(itemPath);
        }
      }

      if (subdirs.length === 0) {
        throw new AppError(
          "Bulk Import: No problem subdirectories found in the archive.",
          400,
        );
      }

      const results = [];
      let importedCount = 0;
      let failedCount = 0;

      for (const problemDir of subdirs) {
        const folderName = path.basename(problemDir);
        try {
          const problem = await processProblemPackage(problemDir);
          results.push({
            title: problem.title || folderName,
            status: "imported",
          });
          importedCount++;
        } catch (err) {
          results.push({
            title: folderName,
            status: "failed",
            error: err.message || err.toString(),
          });
          failedCount++;
        }
      }

      return {
        summary: {
          total: subdirs.length,
          imported: importedCount,
          failed: failedCount,
        },
        results,
      };
    }
  } finally {
    // Cleanup temporary files
    cleanupDirectory(tempDir);
  }
};
