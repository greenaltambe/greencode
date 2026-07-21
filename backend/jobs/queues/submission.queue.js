import { Queue } from "bullmq";
import connection from "../redis.js";

export const submissionQueue = new Queue("submission", {
  connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 1000,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});