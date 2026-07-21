import { runInDocker } from "./dockerExecutor.js";

export default async function executePython(code, input) {
  const timeoutSec = process.env.EXECUTION_TIMEOUT || "5";
  const command = `bash -c "python3 -m py_compile /code/Main.py 2> /code/compile_output.txt; if [ \\$? -ne 0 ]; then echo '___COMPILE_ERROR___'; cat /code/compile_output.txt; exit 111; fi; /usr/bin/time -f \\"time:%e\\\\nmemory:%M\\" -o /code/metrics.txt timeout ${timeoutSec}s python3 /code/Main.py < /code/input.txt"`;

  const dockerResult = await runInDocker({
    code,
    input,
    ext: "py",
    command,
  });

  const isCompileError = dockerResult.exitCode === 111;
  let compileOutput = "";
  let stdout = dockerResult.stdout;
  let stderr = dockerResult.stderr;

  if (isCompileError) {
    compileOutput = (stdout + "\n" + stderr).replace("___COMPILE_ERROR___", "").trim();
    stdout = "";
    stderr = "";
  }

  return {
    stdout,
    stderr,
    exitCode: dockerResult.exitCode,
    oomKilled: dockerResult.oomKilled,
    timeout: dockerResult.timeout,
    isCompileError,
    compileOutput,
    executionTime: dockerResult.executionTime,
    memoryUsage: dockerResult.memoryUsage,
  };
}
