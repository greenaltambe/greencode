import { exec } from "child_process";
import util from "util";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const execPromise = util.promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMP_DIR = path.join(__dirname, "temp");

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Runs a custom python checker inside the Docker sandbox.
 * Invocation: python3 checker.py input.txt expected.txt actual.txt
 *
 * @param {Object} params
 * @param {string} params.checkerCode Custom python checker source code
 * @param {string} params.input Input testcase file content
 * @param {string} params.expectedOutput Expected correct output content
 * @param {string} params.actualOutput User's generated output content
 * @returns {Promise<Object>} { passed: boolean }
 */
export async function runChecker({ checkerCode, input, expectedOutput, actualOutput }) {
  const jobId = uuidv4();
  const checkerFile = path.join(TEMP_DIR, `checker_${jobId}.py`);
  const inputFile = path.join(TEMP_DIR, `input_${jobId}.txt`);
  const expectedFile = path.join(TEMP_DIR, `expected_${jobId}.txt`);
  const actualFile = path.join(TEMP_DIR, `actual_${jobId}.txt`);

  // Write temporary files inside the backend container
  fs.writeFileSync(checkerFile, checkerCode);
  fs.writeFileSync(inputFile, input || "");
  fs.writeFileSync(expectedFile, expectedOutput || "");
  fs.writeFileSync(actualFile, actualOutput || "");

  let containerId = null;

  try {
    const maxMemory = process.env.MAX_MEMORY || "256m";
    const maxCpu = process.env.MAX_CPU || "0.5";

    // Command to execute checker inside the sandbox container
    const command = `python3 /code/checker.py /code/input.txt /code/expected.txt /code/actual.txt`;

    // Create the container
    const createCmd = `docker create --memory=${maxMemory} --cpus=${maxCpu} --network=none oj-executor ${command}`;
    const { stdout: createStdout } = await execPromise(createCmd);
    containerId = createStdout.trim();

    if (!containerId) {
      throw new Error("Failed to create docker container for checker: No container ID returned");
    }

    // Copy the files into the container
    await execPromise(`docker cp "${checkerFile}" "${containerId}:/code/checker.py"`);
    await execPromise(`docker cp "${inputFile}" "${containerId}:/code/input.txt"`);
    await execPromise(`docker cp "${expectedFile}" "${containerId}:/code/expected.txt"`);
    await execPromise(`docker cp "${actualFile}" "${containerId}:/code/actual.txt"`);

    // Start the container
    let stdout = "";
    let stderr = "";
    let timeout = false;

    try {
      // Checker should run very quickly, 5s timeout is plenty
      const { stdout: execStdout, stderr: execStderr } = await execPromise(`docker start -a ${containerId}`, {
        timeout: 5000,
      });
      stdout = execStdout;
      stderr = execStderr;
    } catch (error) {
      stdout = error.stdout || "";
      stderr = error.stderr || "";
      if (error.signal === "SIGTERM" || error.code === "ETIMEDOUT") {
        timeout = true;
      }
    }

    // Inspect the container state
    let exitCode = 0;
    try {
      const { stdout: inspectStdout } = await execPromise(`docker inspect --format='{{json .State}}' ${containerId}`);
      const state = JSON.parse(inspectStdout.trim());
      exitCode = state.ExitCode;
    } catch (inspectError) {
      console.error(`Failed to inspect checker container ${containerId}:`, inspectError);
    }

    if (timeout || exitCode !== 0) {
      throw new Error(`Checker execution failed. Exit code: ${exitCode}, Stderr: ${stderr}`);
    }

    const trimmedStdout = stdout.toString().trim();
    if (trimmedStdout === "1") {
      return { passed: true };
    } else if (trimmedStdout === "0") {
      return { passed: false };
    } else {
      throw new Error(`Invalid checker output: expected '1' or '0', got '${trimmedStdout}'`);
    }
  } catch (error) {
    console.error("Error in runChecker:", error);
    throw error; // Rethrow to be treated as internal error
  } finally {
    // Remove the container
    if (containerId) {
      try {
        await execPromise(`docker rm -f ${containerId}`);
      } catch (rmError) {
        console.error(`Failed to remove checker container ${containerId}:`, rmError);
      }
    }

    // Clean up local temp files
    try {
      if (fs.existsSync(checkerFile)) fs.unlinkSync(checkerFile);
      if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
      if (fs.existsSync(expectedFile)) fs.unlinkSync(expectedFile);
      if (fs.existsSync(actualFile)) fs.unlinkSync(actualFile);
    } catch (cleanupError) {
      console.error(`Failed to clean up checker files for job ${jobId}:`, cleanupError);
    }
  }
}
