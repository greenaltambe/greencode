import executeCpp from "./cppExecutor.js";
import executeJava from "./javaExecutor.js";
import executePython from "./pythonExecutor.js";

export async function executeCode({ code, language, input }) {
  let result = null;
  if (language === "cpp") {
    result = await executeCpp(code, input);
  } else if (language === "python") {
    result = await executePython(code, input);
  } else if (language === "java") {
    result = await executeJava(code, input);
  } else {
    throw new Error(`Invalid language: ${language}`);
  }

  // Classify low-level execution verdicts
  let status = "success";
  if (result.isCompileError) {
    status = "compile_error";
  } else if (result.timeout) {
    status = "time_limit_exceeded";
  } else if (result.oomKilled) {
    status = "memory_limit_exceeded";
  } else if (result.exitCode !== 0) {
    status = "runtime_error";
  }

  return {
    status,
    ...result,
  };
}
