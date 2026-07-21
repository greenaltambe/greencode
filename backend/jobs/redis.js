import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

connection.on("connect", () => {
  console.log("Redis Connected");
});

connection.on("error", (error) => {
  console.log("Redis Error:", error);
});

export const publisher = connection;
export const subscriber = connection.duplicate();

export const SUBMISSION_CHANNEL = "submission_updates";

export const publishSubmissionUpdate = async (submissionId, data) => {
  try {
    const payload = JSON.stringify({ submissionId, ...data });
    await publisher.publish(SUBMISSION_CHANNEL, payload);
  } catch (err) {
    console.error(`[Redis Pub/Sub] Failed to publish update for ${submissionId}:`, err);
  }
};

export default connection;