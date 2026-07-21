import mongoose from "mongoose";

const submissionSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Problem",
      required: true,
    },

    code: {
      type: String,
      required: true,
    },

    language: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      required: true,
      enum: [
        "queued",
        "running",
        "accepted",
        "wrong_answer",
        "compile_error",
        "runtime_error",
        "time_limit_exceeded",
        "memory_limit_exceeded",
        "internal_error",
      ],
      default: "queued",
    },

    executionTime: {
      type: Number,
      default: 0,
    },

    memoryUsage: {
      type: Number,
      default: 0,
    },

    exitCode: {
      type: Number,
      default: 0,
    },

    compileOutput: {
      type: String,
      default: "",
    },

    stderr: {
      type: String,
      default: "",
    },

    queuedAt: {
      type: Date,
    },

    startedAt: {
      type: Date,
    },

    completedAt: {
      type: Date,
    },

    results: [
      {
        input: {
          type: String,
          default: "",
        },
        output: {
          type: String,
          default: "",
        },
        expectedOutput: {
          type: String,
          default: "",
        },
        passed: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

const Submission = mongoose.model("Submission", submissionSchema);
export default Submission;
