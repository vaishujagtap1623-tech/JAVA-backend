const express = require("express");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const app = express();

app.use(express.json({ limit: "2mb" }));

function run(cmd, args, opts) {
  opts = opts || {};

  return new Promise(function (resolve) {
    const p = spawn(cmd, args, opts);

    let stdout = "";
    let stderr = "";

    // stdout
    if (p.stdout) {
      p.stdout.on("data", function (d) {
        stdout += d.toString();
      });
    }

    // stderr
    if (p.stderr) {
      p.stderr.on("data", function (d) {
        stderr += d.toString();
      });
    }

    const timer = setTimeout(function () {
      try {
        p.kill("SIGKILL");
      } catch (e) {}

      resolve({
        code: -1,
        stdout: stdout,
        stderr: "Execution timed out."
      });
    }, opts.timeout || 15000);

    p.on("close", function (code) {
      clearTimeout(timer);

      resolve({
        code: code,
        stdout: stdout,
        stderr: stderr
      });
    });

    p.on("error", function (e) {
      clearTimeout(timer);

      resolve({
        code: -1,
        stdout: stdout,
        stderr: e.message
      });
    });
  });
}

// Health check
app.get("/api/health", function (req, res) {
  res.json({
    ok: true,
    service: "java-studio-java-runner",
    java: "17",
    jspServlet: true
  });
});

// Java code execution
app.post("/api/execute", async function (req, res) {
  const body = req.body || {};

  const sourceCode = body.sourceCode || "";
  const stdin = body.stdin || "";
  const fileName = body.fileName || "Main.java";
  const projectType = body.projectType || "core-java";

  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "javastudio-")
  );

  try {
    const safeName = path.basename(fileName);

    // JSP / Servlet projects
    if (
      projectType === "web-jsp" ||
      safeName.endsWith(".jsp")
    ) {
      return res.json({
        status: "error",
        stdout: "",
        stderr: "",
        compileErrors:
          "JSP/Servlet projects must be run as a web project. Use /api/web-project.",
        executionTime: 0,
        exitCode: 1
      });
    }

    // Save Java source
    const src = path.join(dir, safeName);

    await fs.writeFile(
      src,
      sourceCode,
      "utf8"
    );

    // Compile Java
    const compileResult = await run(
      "javac",
      [src],
      {
        cwd: dir,
        timeout: 10000
      }
    );

    if (compileResult.code !== 0) {
      return res.json({
        status: "error",
        stdout: "",
        stderr: compileResult.stderr,
        compileErrors: compileResult.stderr,
        executionTime: 0,
        exitCode: compileResult.code
      });
    }

    // Main class name
    const main = safeName.replace(
      /\.java$/,
      ""
    );

    // Run Java
    const runResult = await run(
      "java",
      ["-cp", dir, main],
      {
        cwd: dir,
        timeout: 10000,
        env: Object.assign({}, process.env)
      }
    );

    res.json({
      status:
        runResult.code === 0
          ? "success"
          : "error",

      stdout: runResult.stdout,
      stderr: runResult.stderr,
      compileErrors: "",
      executionTime: 0,
      exitCode: runResult.code
    });

  } catch (error) {

    res.status(500).json({
      status: "error",
      stdout: "",
      stderr: error.message,
      compileErrors: error.message,
      executionTime: 0,
      exitCode: 1
    });

  } finally {

    await fs.rm(
      dir,
      {
        recursive: true,
        force: true
      }
    ).catch(function () {});
  }
});

// Render PORT support
const PORT = process.env.PORT || 8080;

app.listen(
  PORT,
  "0.0.0.0",
  function () {
    console.log(
      "Java Studio runner listening on port " + PORT
    );
  }
);