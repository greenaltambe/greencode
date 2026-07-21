import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import Storage from "./Storage.js";

class MinIOStorage extends Storage {
  constructor({ endpoint, accessKey, secretKey, bucket }) {
    super();
    this.bucket = bucket;
    this.s3 = new S3Client({
      region: "us-east-1",
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
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
    if (!response.Contents) {
      return [];
    }
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
    console.log(testCases);
    return testCases;
  }

  async uploadTestCase(problemId, inputFile, outputFile, index) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `${problemId}/input_${index}.txt`,
        Body: inputFile.buffer,
      }),
    );

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `${problemId}/output_${index}.txt`,
        Body: outputFile.buffer,
      }),
    );

    return {
      inputKey: `${problemId}/input_${index}.txt`,
      outputKey: `${problemId}/output_${index}.txt`,
    };
  }

  async deleteTestCases(problemId) {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: `${problemId}/`,
    });
    const response = await this.s3.send(command);
    if (!response.Contents) {
      return;
    }
    const objectsToDelete = response.Contents.map((f) => ({ Key: f.Key }));
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: this.bucket,
      Delete: { Objects: objectsToDelete },
    });
    await this.s3.send(deleteCommand);
  }

  async isHealthy() {
    try {
      await this.s3.send(
        new ListObjectsV2Command({ Bucket: this.bucket, MaxKeys: 1 }),
      );
      return true;
    } catch (error) {
      console.error("MinIO health check failed:", error);
      return false;
    }
  }

  async uploadChecker(problemId, file) {
    const key = `${problemId}/checker.py`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
      }),
    );
    return { key };
  }

  async getChecker(problemId) {
    const key = `${problemId}/checker.py`;
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const response = await this.s3.send(command);
    return await response.Body.transformToString("utf-8");
  }

  async hasChecker(problemId) {
    const key = `${problemId}/checker.py`;
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (error) {
      return false;
    }
  }

  async deleteChecker(problemId) {
    const key = `${problemId}/checker.py`;
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      // Ignore errors
    }
  }
}

export default MinIOStorage;
