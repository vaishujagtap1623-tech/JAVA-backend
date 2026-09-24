const express = require("express");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const app = express();
app.use(express.json({ limit: "2mb" }));

function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { ...opts });
    let stdout = "", stderr = "";
    p.stdout?.on("data", d => stdout += d.toString());
    p.stderr?.on("data", d => stderr += d.toString());
    const timer = setTimeout(() => { p.kill("SIGKILL"); resolve({ code: -1, stdout, stderr: "Execution timed out." }); }, opts.timeout || 15000);
    p.on("close", code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
    p.on("error", e => { clearTimeout(timer); resolve({ code: -1, stdout, stderr: e.message }); });
  });
}

app.get("/api/health", (_, res) => res.json({ ok: true, service: "java-studio-java-runner", java: "17", jspServlet: true }));

app.post("/api/execute", async (req, res) => {
  const { sourceCode = "", stdin = "", fileName = "Main.java", projectType = "core-java" } = req.body || {};
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "javastudio-"));
  try {
    const safeName = path.basename(fileName);
    if (projectType === "web-jsp" || safeName.endsWith(".jsp")) {
      // A full JSP/Servlet project should be submitted through /api/web-project.
      return res.json({
        status: "error", stdout: "", stderr: "",
        compileErrors: "JSP/Servlet projects must be run as a web project. The Java Studio frontend sends those projects to /api/web-project.",
        executionTime: 0, exitCode: 1
      });
    }

    const src = path.join(dir, safeName);
    await fs.writeFile(src, sourceCode, "utf8");
    const result = await run("javac", [src], { cwd: dir, timeout: 10000 });
    if (result.code !== 0) return res.json({ status:"error", stdout:"", stderr:result.stderr, compileErrors:result.stderr, executionTime:0, exitCode:result.code });
    const main = safeName.replace(/\.java$/, "");
    const out = await run("java", ["-cp", dir, main], { cwd: dir, timeout: 10000, env: { ...process.env } });
    res.json({ status: out.code === 0 ? "success":"error", stdout:out.stdout, stderr:out.stderr, compileErrors:"", executionTime:0, exitCode:out.code });
  } finally {
    await fs.rm(dir, { recursive:true, force:true }).catch(()=>{});
  }
});

app.listen(8080, "0.0.0.0", () => console.log("Java Studio runner listening on :8080"));
