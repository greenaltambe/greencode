import { Worker } from "bullmq";
import connection, { publishSubmissionUpdate } from "../redis.js";
import { processSubmission } from "../processors/submission.processor.js";
import Submission from "../../models/submission.model.js";

const worker = new Worker(
  "submission",
  async (job) => {
    const { submissionId } = job.data;
    if (!submissionId) {
      const errMsg = "Missing submissionId in job data";
      console.error(`[Worker] Job ${job.id} failed: ${errMsg}`);
      throw new Error(errMsg);
    }

    console.log(`[Worker] Started submission ${submissionId}`);

    try {
      const finalStatus = await processSubmission(submissionId);
      console.log(`[Worker] Finished submission ${submissionId}. Status: ${finalStatus}`);
    } catch (err) {
      console.error(`[Worker] Job failed for submission ${submissionId}: ${err.message}`);

      // Try to mark the database submission as internal_error if it exists
      try {
        const submission = await Submission.findById(submissionId);
        if (submission) {
          submission.status = "internal_error";
          submission.completedAt = new Date();
          await submission.save();
          await publishSubmissionUpdate(submissionId, {
            status: "internal_error",
            submission: submission.toObject ? submission.toObject() : submission,
          });
        }
      } catch (dbErr) {
        console.error(`[Worker] Failed to mark submission ${submissionId} as internal_error: ${dbErr.message}`);
      }

      // Rethrow to let BullMQ track the failure
      throw err;
    }
  },
  {
    connection,
  }
);

worker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed with error: ${err.message}`);
});

export default worker;
