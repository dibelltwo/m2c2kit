#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const emaScriptsDir = path.dirname(scriptPath);
const emaRoot = path.resolve(emaScriptsDir, "..");
const repoRoot = path.resolve(emaRoot, "..");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function lines(text) {
  return text.split(/\r?\n/);
}

function sectionLines(text, heading) {
  const all = lines(text);
  const startIndex = all.findIndex((line) => line.trim() === heading.trim());
  if (startIndex === -1) return [];

  const result = [];
  for (let i = startIndex + 1; i < all.length; i++) {
    const line = all[i];
    if (/^#{1,3}\s+/.test(line)) break;
    if (line.trim() === "") continue;
    if (
      /^\s*[-*]\s+/.test(line) ||
      /^\s*\d+\.\s+/.test(line) ||
      result.length < 2
    ) {
      result.push(line.trim());
    }
    if (result.length >= 4) break;
  }

  return result;
}

function shortSection(text, heading) {
  const body = sectionLines(text, heading);
  return body.length > 0 ? body : ["(section not found)"];
}

function latestMtime(filePaths) {
  let latest = 0;
  for (const filePath of filePaths) {
    if (!exists(filePath)) continue;
    const stat = fs.statSync(filePath);
    latest = Math.max(latest, stat.mtimeMs);
  }
  return latest;
}

function collectSourceFiles(dir) {
  if (!exists(dir)) return [];
  const results = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (/\.(ts|tsx|js|jsx|html|mjs|json)$/.test(entry.name)) {
        results.push(full);
      }
    }
  }
  return results;
}

function gitStatus() {
  try {
    return execFileSync("git", ["status", "--short", "--", "ema-app"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .trimEnd()
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    return ["(git status unavailable)"];
  }
}

function gitBranch() {
  try {
    return execFileSync("git", ["branch", "--show-current"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function summarizeBuild() {
  const srcFiles = collectSourceFiles(path.join(emaRoot, "app", "src"));
  const distFile = path.join(emaRoot, "app", "dist", "index.js");
  const buildFile = path.join(emaRoot, "app", "build", "index.js");
  const newestSource = latestMtime(srcFiles);
  const distMtime = exists(distFile) ? fs.statSync(distFile).mtimeMs : 0;
  const buildMtime = exists(buildFile) ? fs.statSync(buildFile).mtimeMs : 0;
  const newestArtifact = Math.max(distMtime, buildMtime);

  if (newestArtifact === 0) {
    return "missing: app build outputs are not present";
  }

  if (newestArtifact < newestSource) {
    return "stale: app build outputs are older than source";
  }

  return "fresh: app build outputs are newer than source";
}

function printBlock(title, items) {
  console.log(`\n${title}`);
  for (const item of items) {
    console.log(`  ${item}`);
  }
}

function compactList(items, limit = 14) {
  const visible = items.slice(0, limit);
  const remaining = Math.max(0, items.length - visible.length);
  if (remaining > 0) {
    visible.push(`... (+${remaining} more)`);
  }
  return visible;
}

const currentStatusPath = path.join(emaRoot, "CURRENT_STATUS.md");
const blueprintPath = path.join(emaRoot, "PRODUCT_BLUEPRINT.md");
const planPath = path.join(emaRoot, "TWO_WEEK_PLAN.md");

const currentStatus = exists(currentStatusPath) ? read(currentStatusPath) : "";
const blueprint = exists(blueprintPath) ? read(blueprintPath) : "";
const plan = exists(planPath) ? read(planPath) : "";

console.log("EMA project status");
console.log(`repo: ${repoRoot}`);
console.log(`branch: ${gitBranch() || "(detached or unavailable)"}`);
console.log(`build: ${summarizeBuild()}`);

printBlock("docs", [
  `CURRENT_STATUS: ${shortSection(currentStatus, "## What Is Already Implemented").join(" | ")}`,
  `CURRENT_STATUS: ${shortSection(currentStatus, "## Launch-Critical Work Still Remaining").join(" | ")}`,
  `PRODUCT_BLUEPRINT: ${shortSection(blueprint, "## 2. Core Product Model").join(" | ")}`,
  `TWO_WEEK_PLAN: ${shortSection(plan, "## Definition Of Done For This Sprint").join(" | ")}`,
]);

printBlock("modified files", compactList(gitStatus()));

console.log("\nrun: node ema-app/scripts/status.mjs");
