import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "src");
const VENDOR_SEGMENT = `${path.sep}vendor${path.sep}`;

async function collectRuntimeJsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "vendor") {
        continue;
      }
      const nested = await collectRuntimeJsFiles(fullPath);
      files.push(...nested);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!entry.name.endsWith(".js")) {
      continue;
    }
    if (fullPath.includes(VENDOR_SEGMENT)) {
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

function runSyntaxCheck(filePath) {
  return spawnSync(process.execPath, ["--check", filePath], {
    cwd: ROOT,
    encoding: "utf8"
  });
}

const runtimeFiles = (await collectRuntimeJsFiles(SRC_DIR)).sort();
if (!runtimeFiles.length) {
  console.error("No runtime JavaScript files found under src/.");
  process.exit(1);
}

for (const filePath of runtimeFiles) {
  const result = runSyntaxCheck(filePath);
  if (result.status !== 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    console.error(`Syntax check failed for ${path.relative(ROOT, filePath)}`);
    process.exit(result.status || 1);
  }
}

console.log(`Syntax checked ${runtimeFiles.length} runtime modules.`);
