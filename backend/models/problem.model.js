import mongoose from "mongoose";
import { PROBLEM_TAG_IDS } from "../constants/problemTags.js";

const problemSchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    difficulty: {
      type: String,
      required: true,
      enum: ["easy", "medium", "hard"],
    },
    testCases: [
      {
        input: {
          type: String,
          required: true,
        },
        expectedOutput: {
          type: String,
          required: true,
        },
      },
    ],
    tags: {
      type: [String],
      enum: PROBLEM_TAG_IDS,
      default: [],
    },
    checker: {
      enabled: {
        type: Boolean,
        default: false,
      },
      language: {
        type: String,
        default: "python",
      },
      filename: {
        type: String,
        default: "checker.py",
      },
    },
  },
  {
    timestamps: true,
  },
);

const Problem = mongoose.model("Problem", problemSchema);
export default Problem;
