import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");

const TARGETS = new Set(["chrome", "firefox", "all"]);
const COPY_ITEMS = ["src", "README.md", "package.json", "package-lock.json"];

function parseTarget(argv) {
  const targetArg = argv.find((arg) => arg.startsWith("--target="));
  const target = targetArg ? targetArg.split("=")[1] : "all";
  if (!TARGETS.has(target)) {
    throw new Error(`Unsupported target "${target}". Use chrome, firefox, or all.`);
  }
  return target;
}

async function runCommand(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: "inherit",
      shell: false
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function copyProjectFiles(targetDir) {
  for (const item of COPY_ITEMS) {
    await cp(path.join(ROOT_DIR, item), path.join(targetDir, item), { recursive: true });
  }
}

function buildFirefoxManifest(baseManifest) {
  const manifest = JSON.parse(JSON.stringify(baseManifest));
  if (Array.isArray(manifest.permissions)) {
    manifest.permissions = manifest.permissions.filter((permission) => permission !== "offscreen");
  }
  return manifest;
}

async function writeManifestForTarget(targetDir, baseManifest, target) {
  const manifest =
    target === "firefox" ? buildFirefoxManifest(baseManifest) : JSON.parse(JSON.stringify(baseManifest));
  const output = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(path.join(targetDir, "manifest.json"), output, "utf8");
}

async function zipTargetDirectory(targetDir, outputZipPath) {
  await rm(outputZipPath, { force: true });
  await runCommand("zip", ["-r", outputZipPath, ".", "-x", "*.DS_Store"], { cwd: targetDir });
}

async function buildTarget(baseManifest, target) {
  const targetDir = path.join(DIST_DIR, target);
  await mkdir(targetDir, { recursive: true });
  await copyProjectFiles(targetDir);
  await writeManifestForTarget(targetDir, baseManifest, target);

  const zipName = `context-capture-saver-${target}.zip`;
  await zipTargetDirectory(targetDir, path.join(DIST_DIR, zipName));

  if (target === "chrome") {
    await cp(path.join(DIST_DIR, zipName), path.join(DIST_DIR, "context-capture-saver.zip"));
  }
}

async function main() {
  const target = parseTarget(process.argv.slice(2));
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });

  const baseManifest = JSON.parse(await readFile(path.join(ROOT_DIR, "manifest.json"), "utf8"));

  if (target === "all") {
    await buildTarget(baseManifest, "chrome");
    await buildTarget(baseManifest, "firefox");
    return;
  }

  await buildTarget(baseManifest, target);
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exitCode = 1;
});
