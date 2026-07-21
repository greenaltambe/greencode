import fs from "fs";
import path from "path";
import Storage from "./Storage.js";

class LocalStorage extends Storage {
  constructor(basePath) {
    super();
    this.basePath = basePath;

    // Ensure base directory exists
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }
  }

  async getInputContent(problemId, inputFileName) {
    const inputPath = path.join(this.basePath, problemId, inputFileName);
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }
    return fs.readFileSync(inputPath, "utf-8");
  }

  async getOutputContent(problemId, outputFileName) {
    const outputPath = path.join(this.basePath, problemId, outputFileName);
    if (!fs.existsSync(outputPath)) {
      throw new Error(`Output file not found: ${outputPath}`);
    }
    return fs.readFileSync(outputPath, "utf-8");
  }

  async listTestCases(problemId) {
    const problemPath = path.join(this.basePath, problemId);
    if (!fs.existsSync(problemPath)) return [];

    const files = fs.readdirSync(problemPath);
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
    console.log("uploadTestCase() called");
    console.log(problemId);
    console.log(inputFile.originalname);
    console.log(outputFile.originalname);

    const problemPath = path.join(this.basePath, problemId.toString());

    console.log(problemPath);

    if (!fs.existsSync(problemPath)) {
      console.log("creating directory...");
      fs.mkdirSync(problemPath, { recursive: true });
    }

    const inputPath = path.join(problemPath, `input_${index}.txt`);
    const outputPath = path.join(problemPath, `output_${index}.txt`);

    console.log(inputPath);
    console.log(outputPath);

    fs.writeFileSync(inputPath, inputFile.buffer);
    console.log("input written");

    fs.writeFileSync(outputPath, outputFile.buffer);
    console.log("output written");

    return { inputPath, outputPath };
  }

  async deleteTestCases(problemId) {
    const problemPath = path.join(this.basePath, problemId);
    if (fs.existsSync(problemPath)) {
      fs.rmSync(problemPath, { recursive: true, force: true });
    }
  }

  async isHealthy() {
    try {
      // Check if base path is writable
      const testPath = path.join(this.basePath, ".health-check");
      fs.writeFileSync(testPath, "test");
      fs.unlinkSync(testPath);
      return true;
    } catch (error) {
      console.error("Local storage health check failed:", error.message);
      return false;
    }
  }

  async uploadChecker(problemId, file) {
    const problemPath = path.join(this.basePath, problemId.toString());
    if (!fs.existsSync(problemPath)) {
      fs.mkdirSync(problemPath, { recursive: true });
    }
    const checkerPath = path.join(problemPath, "checker.py");
    fs.writeFileSync(checkerPath, file.buffer);
    return { checkerPath };
  }

  async getChecker(problemId) {
    const checkerPath = path.join(this.basePath, problemId.toString(), "checker.py");
    if (!fs.existsSync(checkerPath)) {
      throw new Error(`Checker file not found: ${checkerPath}`);
    }
    return fs.readFileSync(checkerPath, "utf-8");
  }

  async hasChecker(problemId) {
    const checkerPath = path.join(this.basePath, problemId.toString(), "checker.py");
    return fs.existsSync(checkerPath);
  }

  async deleteChecker(problemId) {
    const checkerPath = path.join(this.basePath, problemId.toString(), "checker.py");
    if (fs.existsSync(checkerPath)) {
      fs.unlinkSync(checkerPath);
    }
  }
}

export default LocalStorage;
