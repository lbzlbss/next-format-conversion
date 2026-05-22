import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../../..");
export const AGENT_ROOT = path.join(REPO_ROOT, "docs/agent");
export const RUNS_DIR = path.join(AGENT_ROOT, "runs");
export const TEMPLATES_DIR = path.join(AGENT_ROOT, "templates");

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "feature";
}

export function makeRunId() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, "").slice(0, 15);
  return stamp;
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function getRunDir(runId) {
  return path.join(RUNS_DIR, runId);
}

export function loadRun(runId) {
  const statePath = path.join(getRunDir(runId), "state.json");
  if (!fs.existsSync(statePath)) {
    throw new Error(`Run 不存在: ${runId} (${statePath})`);
  }
  return readJson(statePath);
}

export function saveRun(state) {
  const runDir = getRunDir(state.runId);
  ensureDir(runDir);
  writeJson(path.join(runDir, "state.json"), state);
  return runDir;
}

export function initRun({ requirement, figmaUrl = null }) {
  const runId = makeRunId();
  const slug = slugify(requirement);
  const state = {
    runId,
    slug,
    requirement,
    figmaUrl,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    phase: "intake",
    phases: {
      intake: { status: "completed" },
      analyze: { status: "pending" },
      implement: { status: "pending" },
      git: { status: "pending" },
      deploy: { status: "pending" },
    },
    branch: `feat/${runId}-${slug}`,
    tag: null,
    vercelDeploymentUrl: null,
  };
  const runDir = saveRun(state);
  copyTemplate("requirement.md", path.join(runDir, "01-requirement.md"), {
    RUN_ID: runId,
    REQUIREMENT: requirement,
    CREATED_AT: state.createdAt,
    SLUG: slug,
    FIGMA_URL: figmaUrl || "（未提供）",
  });
  return state;
}

export function updatePhase(runId, phase, patch = {}) {
  const state = loadRun(runId);
  state.phases[phase] = { ...state.phases[phase], ...patch };
  state.phase = phase;
  state.updatedAt = new Date().toISOString();
  saveRun(state);
  return state;
}

export function copyTemplate(name, dest, vars = {}) {
  const src = path.join(TEMPLATES_DIR, name);
  if (!fs.existsSync(src)) {
    throw new Error(`模板不存在: ${src}`);
  }
  let content = fs.readFileSync(src, "utf8");
  for (const [key, value] of Object.entries(vars)) {
    content = content.replaceAll(`{{${key}}}`, String(value));
  }
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, content, "utf8");
}

export function runCmd(cmd, options = {}) {
  const { cwd = REPO_ROOT, silent = false } = options;
  return execSync(cmd, {
    cwd,
    encoding: "utf8",
    stdio: silent ? "pipe" : "inherit",
  });
}

export function tryRunCmd(cmd, options = {}) {
  try {
    return { ok: true, output: runCmd(cmd, { ...options, silent: true }) };
  } catch (error) {
    const stderr = error.stderr?.toString?.() || "";
    const stdout = error.stdout?.toString?.() || "";
    return { ok: false, error: `${error.message}\n${stderr}\n${stdout}`.trim() };
  }
}

export function gitCurrentBranch() {
  return runCmd("git rev-parse --abbrev-ref HEAD", { silent: true }).trim();
}

/** pnpm run 会把 `--` 传给脚本，需过滤 */
export function cliArgs(argv) {
  const args = [...argv];
  while (args[0] === "--") args.shift();
  return args;
}

export function gitDefaultBranch() {
  const main = tryRunCmd("git show-ref --verify --quiet refs/heads/main");
  if (main.ok) return "main";
  const master = tryRunCmd("git show-ref --verify --quiet refs/heads/master");
  if (master.ok) return "master";
  return "main";
}
