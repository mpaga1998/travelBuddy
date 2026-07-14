#!/usr/bin/env node
/**
 * plan-status — dashboard for docs/DEVELOPMENT_PLAN.md
 *
 * Parses the workstream tables (single source of truth — no separate task file)
 * and prints per-workstream progress, M1 launch readiness, and the next
 * unblocked items. Zero dependencies, Node >= 18.
 *
 * Usage:
 *   npm run plan            human-readable dashboard
 *   npm run plan -- --json  machine-readable output
 *
 * Status cell convention (2nd column of every workstream table):
 *   ⬜ todo · 🟡 doing · ⛔ blocked · ✅ [YYYY-MM-DD] done
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PLAN_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'DEVELOPMENT_PLAN.md');

const ID_RE = /^[A-Z]+-?\d+$/;
const STATUS_MAP = { '✅': 'done', '🟡': 'doing', '⛔': 'blocked', '⬜': 'todo' };
const STATUS_ICON = { done: '✅', doing: '🟡', blocked: '⛔', todo: '⬜' };

// ── ANSI colors (disabled when piped or NO_COLOR) ───────────────────────────
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = paint('1');
const dim = paint('2');
const green = paint('32');
const yellow = paint('33');
const red = paint('31');
const cyan = paint('36');

// ── Parse ────────────────────────────────────────────────────────────────────
function parsePlan(markdown) {
  const tasks = [];
  let ws = null; // { id, name }

  for (const line of markdown.split('\n')) {
    const heading = line.match(/^### (WS-[A-Z]+) · ([^—*]+)/);
    if (heading) {
      ws = { id: heading[1], name: heading[2].trim() };
      continue;
    }
    if (line.startsWith('## ')) { ws = null; continue; } // left the workstreams section

    if (!ws || !line.startsWith('|')) continue;
    const cells = line.split('|').map((c) => c.trim()).slice(1, -1);
    if (cells.length < 6) continue;

    const idCell = cells[0];
    const id = idCell.replace(/\*\*/g, '').split(/\s+/)[0];
    if (!ID_RE.test(id)) continue; // header, separator, or WS-L style row

    const statusIcon = [...cells[1]][0] ? cells[1].slice(0, 2).trim() : '';
    const status = STATUS_MAP[statusIcon] ?? 'todo';
    const doneDate = (cells[1].match(/\d{4}-\d{2}-\d{2}/) ?? [null])[0];

    const depsText = cells[4];
    const deps = depsText === '—' ? [] : [...depsText.matchAll(/\b([A-Z]+-?\d+)\b(?!\d)/g)]
      .map((m) => m[1])
      .filter((d) => ID_RE.test(d) && d !== id);

    tasks.push({
      id,
      ws: ws.id,
      wsName: ws.name,
      m1: idCell.includes('M1'),
      status,
      doneDate,
      item: cells[2],
      effort: cells[3],
      depsText,
      deps,
      doneWhen: cells[5],
    });
  }
  return tasks;
}

// ── Render helpers ───────────────────────────────────────────────────────────
const barOf = (done, total, width = 24) => {
  const filled = total === 0 ? 0 : Math.round((done / total) * width);
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${done}/${total}`;
};

const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// ── Main ─────────────────────────────────────────────────────────────────────
const tasks = parsePlan(readFileSync(PLAN_PATH, 'utf8'));
if (tasks.length === 0) {
  console.error('No tasks parsed — has the Status column format in DEVELOPMENT_PLAN.md changed?');
  process.exit(1);
}

const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
const isUnblocked = (t) => t.status === 'todo' && t.deps.every((d) => byId[d]?.status === 'done');

if (process.argv.includes('--json')) {
  const payload = {
    generatedAt: new Date().toISOString(),
    total: tasks.length,
    done: tasks.filter((t) => t.status === 'done').length,
    m1: {
      total: tasks.filter((t) => t.m1).length,
      done: tasks.filter((t) => t.m1 && t.status === 'done').length,
    },
    nextUp: tasks.filter(isUnblocked).map((t) => t.id),
    tasks,
  };
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

const doneCount = tasks.filter((t) => t.status === 'done').length;
const m1Tasks = tasks.filter((t) => t.m1);
const m1Done = m1Tasks.filter((t) => t.status === 'done').length;

console.log('');
console.log(bold('  nook — development plan status'));
console.log(dim(`  source: docs/DEVELOPMENT_PLAN.md · ${new Date().toISOString().slice(0, 10)}`));
console.log('');
console.log(`  ${bold('Overall')}        ${barOf(doneCount, tasks.length)}`);
console.log(`  ${bold('M1 beta gate')}   ${barOf(m1Done, m1Tasks.length)}${m1Done === m1Tasks.length ? green('  → M1 READY 🏁') : ''}`);
console.log('');

// Per-workstream detail
for (const wsId of [...new Set(tasks.map((t) => t.ws))]) {
  const group = tasks.filter((t) => t.ws === wsId);
  const gDone = group.filter((t) => t.status === 'done').length;
  console.log(`  ${bold(cyan(`${wsId} · ${group[0].wsName}`))}  ${dim(barOf(gDone, group.length, 12))}`);
  for (const t of group) {
    const icon = STATUS_ICON[t.status];
    const tag = t.m1 ? cyan(' M1') : '   ';
    const date = t.doneDate ? dim(` (${t.doneDate})`) : '';
    const colorize = t.status === 'done' ? dim : t.status === 'doing' ? yellow : t.status === 'blocked' ? red : (s) => s;
    console.log(`    ${icon} ${bold(t.id.padEnd(4))}${tag} ${colorize(truncate(t.item, 76))}${date}`);
  }
  console.log('');
}

// Attention: doing + blocked
const active = tasks.filter((t) => t.status === 'doing');
const blocked = tasks.filter((t) => t.status === 'blocked');
if (active.length) {
  console.log(`  ${bold(yellow('In progress:'))} ${active.map((t) => t.id).join(', ')}`);
}
if (blocked.length) {
  for (const t of blocked) console.log(`  ${bold(red('Blocked:'))} ${t.id} ${dim(`— deps: ${t.depsText}`)}`);
}

// Next up: todo items whose task-ID dependencies are all done
const next = tasks.filter(isUnblocked);
console.log(`  ${bold(green('Next up (unblocked):'))}`);
if (next.length === 0) {
  console.log(dim('    nothing — everything is done, in progress, or waiting on dependencies'));
} else {
  for (const t of next) {
    console.log(`    ${bold(t.id.padEnd(4))} ${truncate(t.item, 68)} ${dim(`· ${t.effort}`)}`);
  }
}
console.log('');
console.log(dim('  Update: edit the Status cell in docs/DEVELOPMENT_PLAN.md (⬜ 🟡 ⛔ ✅ YYYY-MM-DD)'));
console.log('');
