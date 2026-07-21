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
 * Runs code in a sandboxed Docker container using create, cp, start, inspect, and rm.
 *
 * @param {Object} params
 * @param {string} params.code The source code to run
 * @param {string} params.input The input data for stdin
 * @param {string} params.ext The file extension (e.g. 'cpp', 'py', 'java')
 * @param {string} params.command The command to execute in the container
 * @returns {Promise<Object>} Structured execution facts
 */
export async function runInDocker({ code, input, ext, command }) {
  const jobId = uuidv4();
  const codeFile = path.join(TEMP_DIR, `Main_${jobId}.${ext}`);
  const inputFile = path.join(TEMP_DIR, `input_${jobId}.txt`);

  // Write temporary files inside the backend container
  fs.writeFileSync(codeFile, code);
  fs.writeFileSync(inputFile, input);

  let containerId = null;

  try {
    const maxMemory = process.env.MAX_MEMORY || "256m";
    const maxCpu = process.env.MAX_CPU || "0.5";

    // Create the container
    const createCmd = `docker create --memory=${maxMemory} --cpus=${maxCpu} --network=none oj-executor ${command}`;
    const { stdout: createStdout } = await execPromise(createCmd);
    containerId = createStdout.trim();

    if (!containerId) {
      throw new Error(
        "Failed to create docker container: No container ID returned",
      );
    }

    // Copy the files into the container
    await execPromise(
      `docker cp "${codeFile}" "${containerId}:/code/Main.${ext}"`,
    );
    await execPromise(
      `docker cp "${inputFile}" "${containerId}:/code/input.txt"`,
    );

    // Start the container
    let stdout = "";
    let stderr = "";
    let timeout = false;

    try {
      const { stdout: execStdout, stderr: execStderr } = await execPromise(`docker start -a ${containerId}`, {
        timeout: 10000,
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
    let oomKilled = false;

    try {
      const { stdout: inspectStdout } = await execPromise(`docker inspect --format='{{json .State}}' ${containerId}`);
      const state = JSON.parse(inspectStdout.trim());
      exitCode = state.ExitCode;
      oomKilled = state.OOMKilled;
    } catch (inspectError) {
      console.error(`Failed to inspect container ${containerId}:`, inspectError);
    }

    const isTimeout = timeout || exitCode === 124;

    // Try to retrieve /code/metrics.txt from the container
    let executionTime = null;
    let memoryUsage = null;
    const metricsFile = path.join(TEMP_DIR, `metrics_${jobId}.txt`);
    try {
      await execPromise(`docker cp "${containerId}:/code/metrics.txt" "${metricsFile}"`);
      if (fs.existsSync(metricsFile)) {
        const content = fs.readFileSync(metricsFile, "utf8");
        const timeMatch = content.match(/time:([0-9.]+)/);
        const memoryMatch = content.match(/memory:([0-9]+)/);
        if (timeMatch) {
          executionTime = Math.round(parseFloat(timeMatch[1]) * 1000); // to ms
        }
        if (memoryMatch) {
          memoryUsage = parseInt(memoryMatch[1], 10) * 1024; // to bytes
        }
      }
    } catch (cpError) {
      // Normal for compile/syntax errors where program execution is never reached
    } finally {
      if (fs.existsSync(metricsFile)) {
        try { fs.unlinkSync(metricsFile); } catch (e) {}
      }
    }

    return {
      stdout: stdout.toString(),
      stderr: stderr.toString(),
      exitCode,
      oomKilled,
      timeout: isTimeout,
      executionTime,
      memoryUsage,
    };
  } catch (error) {
    // Unexpected infrastructure error during docker create/cp
    console.error("Infrastructure error during runInDocker:", error);
    throw error;
  } finally {
    // Remove the container
    if (containerId) {
      try {
        await execPromise(`docker rm -f ${containerId}`);
      } catch (rmError) {
        console.error(`Failed to remove container ${containerId}:`, rmError);
      }
    }

    // Clean up local files
    try {
      if (fs.existsSync(codeFile)) fs.unlinkSync(codeFile);
      if (fs.existsSync(inputFile)) fs.unlinkSync(inputFile);
    } catch (cleanupError) {
      console.error(`Failed to clean up files for job ${jobId}:`, cleanupError);
    }
  }
}
