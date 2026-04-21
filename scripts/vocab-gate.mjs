import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// Forbidden legacy tokens are stored obfuscated (base64) so the repository
// doesn't contain recognizable legacy strings in plaintext.
const B64 = [
  "TWVyaWRpYW4=",
  "TFBBZ2VudA==",
  "SGl2ZU1pbmQ=",
  "bWVyaWRpYW4=",
  "bHBhZ2VudA==",
  "aGl2ZW1pbmQ=",
  "YWdlbnRtZXJpZGlhbg==",
];

function decodeB64(s) {
  return Buffer.from(s, "base64").toString("utf8");
}

const FORBIDDEN = B64.map(decodeB64);
const LEGACY_RE = new RegExp(`\\b(${FORBIDDEN.join("|")})\\b`, "g");

const IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  ".next",
  "build",
  "coverage",
]);

const IGNORE_FILES = new Set([
  "bun.lock",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
]);

function shouldIgnoreDir(name) {
  return IGNORE_DIRS.has(name);
}

function shouldIgnoreFile(name) {
  return IGNORE_FILES.has(name);
}

function isProbablyText(buf) {
  // If we see many NUL bytes, treat as binary.
  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  let nul = 0;
  for (const b of sample) if (b === 0) nul++;
  return nul === 0;
}

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (shouldIgnoreDir(ent.name)) continue;
      yield* walk(full);
      continue;
    }
    if (!ent.isFile()) continue;
    if (shouldIgnoreFile(ent.name)) continue;
    yield full;
  }
}

function rel(p) {
  return path.relative(ROOT, p).replaceAll(path.sep, "/");
}

let matches = 0;

for (const file of walk(ROOT)) {
  let buf;
  try {
    buf = fs.readFileSync(file);
  } catch {
    continue;
  }
  if (!isProbablyText(buf)) continue;

  const text = buf.toString("utf8");
  LEGACY_RE.lastIndex = 0;

  let m;
  while ((m = LEGACY_RE.exec(text))) {
    // Ignore the gate matching itself.
    if (rel(file) === "scripts/vocab-gate.mjs") break;
    matches++;
    const idx = m.index;
    const before = text.lastIndexOf("\n", idx - 1);
    const after = text.indexOf("\n", idx);
    const lineStart = before === -1 ? 0 : before + 1;
    const lineEnd = after === -1 ? text.length : after;
    const line = text.slice(lineStart, lineEnd);
    const lineNo = text.slice(0, lineStart).split("\n").length;
    process.stderr.write(`${rel(file)}:${lineNo}: ${line}\n`);
  }
}

if (matches > 0) {
  process.stderr.write(`\nFound ${matches} forbidden legacy match(es). Please remove them.\n`);
  process.exit(1);
}

process.stdout.write("OK: no legacy branding terms found.\n");

