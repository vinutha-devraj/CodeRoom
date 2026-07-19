const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

router.post("/", async (req, res) => {
  let tempDir = "";
  try {
    const { files = [], activeFileName, language, input = "", code } = req.body;
    const fileId = Date.now() + Math.random().toString(36).substring(2, 7);
    tempDir = path.join(os.tmpdir(), `coderoom-${fileId}`);
    
    // Create temp directory
    fs.mkdirSync(tempDir, { recursive: true });

    // Write all files to tempDir
    let activeFilePath = "";
    if (files && files.length > 0) {
      files.forEach(file => {
        const filePath = path.join(tempDir, file.name);
        // Ensure parent directories exist (in case of nested files)
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, file.code || "");
        
        if (file.name === activeFileName) {
          activeFilePath = filePath;
        }
      });
    }

    // Fallback if no files array, or activeFilePath wasn't found
    if (!activeFilePath) {
      const ext = language === "javascript" ? "js" : "py";
      const fallbackName = `main.${ext}`;
      activeFilePath = path.join(tempDir, fallbackName);
      fs.writeFileSync(activeFilePath, code || "");
    }

    let command, args;

    if (language === "javascript") {
      command = "node";
      args = [activeFilePath];
    } 
    else if (language === "python") {
      command = "python";
      args = [activeFilePath];
    } 
    else {
      // Clean up and return unsupported
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (err) {}
      return res.json({ error: `Language '${language}' is not supported for execution.` });
    }

    const child = spawn(command, args, { cwd: tempDir });

    let output = "";
    let errorOutput = "";

    // Send input to stdin
    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    // Timeout protection: 8 seconds max
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (err) {}
      return res.json({ error: "Execution timed out (8 seconds limit)" });
    }, 8000);

    child.on("close", () => {
      clearTimeout(timeout);

      // Clean up temp directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (err) {}

      if (errorOutput) {
        return res.json({ error: errorOutput });
      }

      res.json({ output });
    });

  } catch (err) {
    console.error(err);
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {}
    }
    res.status(500).json({ error: "Execution failed on server" });
  }
});

module.exports = router;