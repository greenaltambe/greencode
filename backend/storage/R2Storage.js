import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import Storage from "./Storage.js";

class R2Storage extends Storage {
  constructor({ endpoint, accessKeyId, secretAccessKey, bucket }) {
    super();
    this.bucket = bucket;
    this.s3 = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async getInputContent(problemId, inputFileName) {
    const key = `${problemId}/${inputFileName}`;
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const response = await this.s3.send(command);
    return await response.Body.transformToString("utf-8");
  }

  async getOutputContent(problemId, outputFileName) {
    const key = `${problemId}/${outputFileName}`;
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const response = await this.s3.send(command);
    return await response.Body.transformToString("utf-8");
  }

  async listTestCases(problemId) {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: `${problemId}/`,
    });
    const response = await this.s3.send(command);

    if (!response.Contents) return [];

    const files = response.Contents.map((f) => f.Key.split("/").pop());
    const testCases = [];

    files.forEach((file) => {
      if (file.startsWith("input_")) {
        const num = file.match(/\d+/)[0];
        const outputFile = `output_${num}.txt`;
        if (files.includes(outputFile)) {
          testCases.push({ input: file, output: outputFile });
        }
      }
    });

    return testCases;
  }

  async uploadTestCase(problemId, inputFile, outputFile, index) {
    const inputKey = `${problemId}/input_${index}.txt`;
    const outputKey = `${problemId}/output_${index}.txt`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: inputKey,
        Body: inputFile.buffer,
      })
    );

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: outputKey,
        Body: outputFile.buffer,
      })
    );

    return { inputKey, outputKey };
  }

  async deleteTestCases(problemId) {
    const listCommand = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: `${problemId}/`,
    });

    const { Contents } = await this.s3.send(listCommand);
    if (!Contents || Contents.length === 0) return;

    const deleteCommand = new DeleteObjectsCommand({
      Bucket: this.bucket,
      Delete: {
        Objects: Contents.map(({ Key }) => ({ Key })),
      },
    });

    await this.s3.send(deleteCommand);
  }

  async isHealthy() {
    try {
      await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          MaxKeys: 1,
        })
      );
      return true;
    } catch (error) {
      console.error("R2 health check failed:", error.message);
      return false;
    }
  }
}

export default R2Storage;
