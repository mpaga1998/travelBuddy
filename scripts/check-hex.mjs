#!/usr/bin/env node
/**
 * B1: raw-hex ratchet.
 *
 * Design tokens live in tailwind.config.cjs — components must use them
 * (bg-brand, text-ink, …) instead of raw hex literals. This script walks
 * src/ and compares per-file hex counts against scripts/hex-baseline.json:
 *
 *   - a file exceeding its baseline count → FAIL (new raw hex introduced)
 *   - a new file containing hex           → FAIL
 *   - a file below its baseline           → note (run --update to ratchet down)
 *
 * Legitimate hex (e.g. Mapbox GL expressions in PinLayer.tsx, which cannot
 * consume Tailwind classes) simply lives in the baseline; raising a baseline
 * number is a deliberate, reviewable act via --update.
 *
 * Usage:
 *   node scripts/check-hex.mjs            check (CI + pre-commit)
 *   node scripts/check-hex.mjs --update   rewrite the baseline
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const BASELINE_PATH = join(ROOT, 'scripts', 'hex-baseline.json');

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const EXTS = new Set(['.ts', '.tsx', '.css']);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (EXTS.has(full.slice(full.lastIndexOf('.')))) yield full;
  }
}

const counts = {};
for (const file of walk(SRC)) {
  const n = (readFileSync(file, 'utf8').match(HEX_RE) ?? []).length;
  if (n > 0) counts[relative(ROOT, file).replaceAll('\\', '/')] = n;
}

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 2) + '\n');
  console.log(`hex-baseline.json updated — ${Object.keys(counts).length} files, ${Object.values(counts).reduce((a, b) => a + b, 0)} total hex literals.`);
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  console.error('No baseline found. Run: node scripts/check-hex.mjs --update');
  process.exit(1);
}

const failures = [];
const improvements = [];

for (const [file, n] of Object.entries(counts)) {
  const base = baseline[file] ?? 0;
  if (n > base) failures.push(`  ${file}: ${n} hex literals (baseline ${base})`);
  else if (n < base) improvements.push(`  ${file}: ${n} (baseline ${base} — can ratchet down)`);
}
for (const file of Object.keys(baseline)) {
  if (!(file in counts)) improvements.push(`  ${file}: 0 (baseline ${baseline[file]} — can ratchet down)`);
}

if (failures.length) {
  console.error('✗ Raw hex introduced — use tokens from tailwind.config.cjs instead:');
  console.error(failures.join('\n'));
  console.error('\nIf the hex is genuinely required (e.g. Mapbox GL expressions),');
  console.error('update the baseline deliberately: node scripts/check-hex.mjs --update');
  process.exit(1);
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`✓ hex check passed — ${total} legacy literals across ${Object.keys(counts).length} files (goal: 0 outside GL code).`);
if (improvements.length) {
  console.log('Progress since baseline (lock it in with --update):');
  console.log(improvements.join('\n'));
}
