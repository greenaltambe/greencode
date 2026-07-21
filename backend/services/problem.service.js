import Problem from "../models/problem.model.js";
import Submission from "../models/submission.model.js";
import storage from "../config/storage.js";
import { AppError } from "../utils/errors.js";
import { PROBLEM_TAG_IDS } from "../constants/problemTags.js";

function getTestPairs(inputs, outputs) {
  const pairs = [];

  for (const input of inputs) {
    const match = input.originalname.match(/input_(\d+)/);
    if (!match) continue;

    const id = match[1];
    const output = outputs.find((o) => o.originalname === `output_${id}.txt`);

    if (output) {
      pairs.push({ input, output, id });
    }
  }

  return pairs;
}

export const getAllProblems = async ({
  page = 1,
  limit = 10,
  search = "",
  difficulty = "all",
  tags = "",
  sortBy = "newest",
} = {}) => {
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const skipNum = (pageNum - 1) * limitNum;

  // Build match query
  const matchQuery = {};

  if (search) {
    matchQuery.title = { $regex: search, $options: "i" };
  }

  if (difficulty && difficulty !== "all") {
    matchQuery.difficulty = difficulty.toLowerCase();
  }

  if (tags) {
    const tagsArray = Array.isArray(tags)
      ? tags
      : tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
    if (tagsArray.length > 0) {
      matchQuery.tags = { $all: tagsArray };
    }
  }

  // Build aggregation pipeline
  const pipeline = [{ $match: matchQuery }];

  // Sorting
  if (sortBy === "title") {
    pipeline.push({ $sort: { title: 1 } });
  } else if (sortBy === "difficulty") {
    // Weighted difficulty sorting (easy -> medium -> hard)
    pipeline.push({
      $addFields: {
        difficultyWeight: {
          $cond: {
            if: { $eq: [{ $toLower: "$difficulty" }, "easy"] },
            then: 1,
            else: {
              $cond: {
                if: { $eq: [{ $toLower: "$difficulty" }, "medium"] },
                then: 2,
                else: 3,
              },
            },
          },
        },
      },
    });
    pipeline.push({ $sort: { difficultyWeight: 1, createdAt: -1 } });
  } else {
    // default: newest first
    pipeline.push({ $sort: { createdAt: -1 } });
  }

  // Facet for pagination and metadata
  pipeline.push({
    $facet: {
      metadata: [{ $count: "total" }],
      data: [{ $skip: skipNum }, { $limit: limitNum }],
    },
  });

  const aggregationResult = await Problem.aggregate(pipeline);

  const totalProblems = aggregationResult[0]?.metadata[0]?.total || 0;
  const problems = aggregationResult[0]?.data || [];
  const totalPages = Math.ceil(totalProblems / limitNum);

  return {
    problems,
    currentPage: pageNum,
    totalPages,
    totalProblems,
    limit: limitNum,
  };
};

export const getProblemById = async (id, userId) => {
  const problem = await Problem.findById(id);
  if (!problem) {
    throw new AppError("Problem not found", 400);
  }

  const lastSubmission = await Submission.findOne({
    user: userId,
    problem: problem.id,
  }).sort({ createdAt: -1 });

  return { problem, lastSubmission };
};

export const createProblem = async ({ title, description, difficulty, testCases, files, tags }) => {
  if (!title) {
    throw new AppError("Please add a title field", 400);
  }
  if (!description) {
    throw new AppError("Please add a description field", 400);
  }
  if (!difficulty) {
    throw new AppError("Please add a difficulty field", 400);
  }
  if (!testCases) {
    throw new AppError("Please add test cases", 400);
  }

  let parsedTestCases;
  try {
    parsedTestCases = typeof testCases === "string" ? JSON.parse(testCases) : testCases;
  } catch (error) {
    throw new AppError("Invalid test cases format", 400);
  }

  let parsedTags = [];
  if (tags) {
    try {
      parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
    } catch (e) {
      if (Array.isArray(tags)) {
        parsedTags = tags;
      } else {
        parsedTags = [tags];
      }
    }

    if (!Array.isArray(parsedTags)) {
      throw new AppError("Tags must be an array of strings", 400);
    }

    for (const tag of parsedTags) {
      if (!PROBLEM_TAG_IDS.includes(tag)) {
        throw new AppError(`Invalid tag: ${tag}`, 400);
      }
    }
  }

  const inputs = files?.inputs || [];
  const outputs = files?.outputs || [];
  const checkerFiles = files?.checker || [];

  // Validate that there is at least one input and output file, and that they match in number
  if (inputs.length === 0 || outputs.length === 0) {
    throw new AppError("Please upload both input and output test files", 400);
  }

  if (inputs.length !== outputs.length) {
    throw new AppError("Mismatched input/output submission test files", 400);
  }

  const testPairs = getTestPairs(inputs, outputs);
  if (testPairs.length !== inputs.length) {
    throw new AppError("Mismatched number of test pairs", 400);
  }

  // Validate checker file if provided
  let checkerMeta = {
    enabled: false,
    language: "python",
    filename: "checker.py",
  };

  if (checkerFiles.length > 0) {
    const checkerFile = checkerFiles[0];
    if (checkerFiles.length > 1) {
      throw new AppError("Only one custom checker file can be uploaded", 400);
    }
    if (checkerFile.originalname !== "checker.py") {
      throw new AppError("Checker file must be named strictly 'checker.py'", 400);
    }
    if (!checkerFile.originalname.endsWith(".py")) {
      throw new AppError("Checker file must be a Python script (.py)", 400);
    }
    if (checkerFile.buffer.length > 5 * 1024 * 1024) {
      throw new AppError("Checker file exceeds the maximum allowed size (5MB)", 400);
    }
    checkerMeta = {
      enabled: true,
      language: "python",
      filename: "checker.py",
    };
  }

  console.log(`New problem added: ${title} [${difficulty}]`);

  const problem = await Problem.create({
    title,
    description,
    difficulty,
    testCases: parsedTestCases,
    tags: parsedTags,
    checker: checkerMeta,
  });

  for (const pair of testPairs) {
    console.log(pair);
    await storage.uploadTestCase(problem._id, pair.input, pair.output, pair.id);
    console.log("Uploaded testcase", pair.id);
  }

  if (checkerFiles.length > 0) {
    await storage.uploadChecker(problem._id, checkerFiles[0]);
    console.log("Uploaded checker file");
  }

  console.log(problem);
  return { problem };
};

export const updateProblem = async (id, updateData) => {
  const problem = await Problem.findById(id);

  if (!problem) {
    throw new AppError("Problem not found", 400);
  }

  const files = updateData.files;
  delete updateData.files;

  // Handle checker removal if flag passed
  if (updateData.removeChecker === true || updateData.removeChecker === "true") {
    try {
      await storage.deleteChecker(id);
    } catch (e) {
      console.error(`Failed to delete checker for problem ${id}:`, e.message);
    }
    updateData.checker = {
      enabled: false,
      language: "python",
      filename: "checker.py",
    };
    delete updateData.removeChecker;
  }

  // Handle new custom checker upload if uploaded
  const checkerFiles = files?.checker || [];
  if (checkerFiles.length > 0) {
    const checkerFile = checkerFiles[0];
    if (checkerFiles.length > 1) {
      throw new AppError("Only one custom checker file can be uploaded", 400);
    }
    if (checkerFile.originalname !== "checker.py") {
      throw new AppError("Checker file must be named strictly 'checker.py'", 400);
    }
    if (!checkerFile.originalname.endsWith(".py")) {
      throw new AppError("Checker file must be a Python script (.py)", 400);
    }
    if (checkerFile.buffer.length > 5 * 1024 * 1024) {
      throw new AppError("Checker file exceeds the maximum allowed size (5MB)", 400);
    }

    await storage.uploadChecker(id, checkerFile);
    updateData.checker = {
      enabled: true,
      language: "python",
      filename: "checker.py",
    };
  }

  // Parse and validate testCases if provided as string
  if (updateData.testCases) {
    try {
      updateData.testCases = typeof updateData.testCases === "string" 
        ? JSON.parse(updateData.testCases) 
        : updateData.testCases;
    } catch (error) {
      throw new AppError("Invalid test cases format", 400);
    }
  }

  // Parse and validate tags if provided
  let parsedTags = updateData.tags;
  if (parsedTags) {
    try {
      parsedTags = typeof parsedTags === "string" ? JSON.parse(parsedTags) : parsedTags;
    } catch (e) {
      if (!Array.isArray(parsedTags)) {
        parsedTags = [parsedTags];
      }
    }

    if (!Array.isArray(parsedTags)) {
      throw new AppError("Tags must be an array of strings", 400);
    }

    for (const tag of parsedTags) {
      if (!PROBLEM_TAG_IDS.includes(tag)) {
        throw new AppError(`Invalid tag: ${tag}`, 400);
      }
    }

    updateData.tags = parsedTags;
  }

  const updatedProblem = await Problem.findByIdAndUpdate(
    id,
    updateData,
    {
      new: true,
      runValidators: true,
    },
  );

  return { problem: updatedProblem };
};

export const deleteProblem = async (id) => {
  const problem = await Problem.findById(id);

  if (!problem) {
    throw new AppError("Problem not found", 400);
  }

  await problem.deleteOne();

  try {
    await storage.deleteTestCases(problem._id);
  } catch (storageError) {
    console.error(`Failed to delete test cases for problem ${id} from storage:`, storageError);
  }

  return { message: "Problem removed" };
};
