import { submissionQueue } from "../queues/submission.queue.js";

// add key-value pair to queue with submission data
// key is job name
export async function enqueueSubmission(data) {
  return submissionQueue.add("judge-submission", data);
}