/**
 * AI Eval Runner
 *
 * Runs each case in EVAL_CASES through the real OpenAI API using the same
 * system + user prompts as production, then scores the output against the rubric.
 *
 * Usage:
 *   npm run eval                  # run all cases
 *   npm run eval -- --id eu-rome  # run a single case by id prefix
 *   npm run eval -- --fast        # skip cases, just print the case list
 *
 * Requires:
 *   OPENAI_API_KEY and OPENAI_FALLBACK_MODEL set in .env
 */

import 'dotenv/config';
import OpenAI from 'openai';
import { EVAL_CASES, type EvalCase } from './cases.js';
import { scoreOutput, type CheckResult } from './rubric.js';
import { buildSystemPrompt, buildUserPrompt } from '../../api/lib/prompts.js';
import { buildTravelContext } from '../../api/lib/travelContext.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MODEL       = process.env.OPENAI_FALLBACK_MODEL ?? 'gpt-4o-mini';
const MAX_TOKENS  = 3000; // enough for a 3–5 day itinerary; keep costs low
const CONCURRENCY = 3;    // parallel API calls
const TIMEOUT_MS  = 60_000;

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args        = process.argv.slice(2);
const idFilter    = args.includes('--id') ? args[args.indexOf('--id') + 1] : undefined;
const fastMode    = args.includes('--fast');

// ---------------------------------------------------------------------------
// Colours (no deps)
// ---------------------------------------------------------------------------

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  grey:   '\x1b[90m',
  dim:    '\x1b[2m',
};

const green  = (s: string) => `${C.green}${s}${C.reset}`;
const red    = (s: string) => `${C.red}${s}${C.reset}`;
const yellow = (s: string) => `${C.yellow}${s}${C.reset}`;
const bold   = (s: string) => `${C.bold}${s}${C.reset}`;
const grey   = (s: string) => `${C.grey}${s}${C.reset}`;
const dim    = (s: string) => `${C.dim}${s}${C.reset}`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CaseResult {
  id: string;
  description: string;
  pass: boolean;
  checks: CheckResult[];
  durationMs: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Run a single case
// ---------------------------------------------------------------------------

async function runCase(evalCase: EvalCase, client: OpenAI): Promise<CaseResult> {
  const start = Date.now();

  try {
    const { input } = evalCase;

    // Build the same contexts as production (pure, no I/O)
    const travelContext = buildTravelContext(
      input.arrival.location,
      input.arrival.date,
      input.departure.date,
      [input.arrival.location, ...(input.stops ?? []), input.departure.location],
    );

    const systemPrompt = buildSystemPrompt();
    const userPrompt   = buildUserPrompt(input, undefined, travelContext);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let output = '';
    try {
      const stream = await client.chat.completions.create(
        {
          model: MODEL,
          stream: true,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt   },
          ],
          max_completion_tokens: MAX_TOKENS,
          temperature: 0.7,
        },
        { signal: controller.signal as AbortSignal },
      );

      for await (const chunk of stream) {
        output += chunk.choices[0]?.delta?.content ?? '';
      }
    } finally {
      clearTimeout(timer);
    }

    if (!output) throw new Error('Empty response from OpenAI');

    const checks = scoreOutput(output, evalCase);
    const pass   = checks.every((c) => c.pass);

    return { id: evalCase.id, description: evalCase.description, pass, checks, durationMs: Date.now() - start };
  } catch (err) {
    return {
      id: evalCase.id,
      description: evalCase.description,
      pass: false,
      checks: [],
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Concurrency pool
// ---------------------------------------------------------------------------

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  onDone: (result: T, index: number) => void,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;

  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await tasks[i]();
      onDone(results[i], i);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ---------------------------------------------------------------------------
// Print helpers
// ---------------------------------------------------------------------------

function printCaseResult(result: CaseResult, index: number, total: number) {
  const status = result.pass ? green('✓ PASS') : red('✗ FAIL');
  const dur    = grey(`${(result.durationMs / 1000).toFixed(1)}s`);
  const num    = dim(`[${String(index + 1).padStart(2, '0')}/${total}]`);

  console.log(`\n${num} ${status} ${bold(result.id)} ${dur}`);
  console.log(`       ${dim(result.description)}`);

  if (result.error) {
    console.log(`       ${red('ERROR:')} ${result.error}`);
    return;
  }

  for (const check of result.checks) {
    const icon   = check.pass ? green('✓') : red('✗');
    const name   = check.pass ? check.name : bold(check.name);
    const detail = check.detail ? grey(` — ${check.detail}`) : '';
    console.log(`         ${icon} ${name}${detail}`);
  }
}

function printSummary(results: CaseResult[]) {
  const passed  = results.filter((r) => r.pass).length;
  const failed  = results.length - passed;
  const totalMs = results.reduce((s, r) => s + r.durationMs, 0);

  console.log('\n' + '─'.repeat(60));
  console.log(bold('EVAL SUMMARY'));
  console.log('─'.repeat(60));
  console.log(`Cases:   ${bold(String(results.length))}`);
  console.log(`Passed:  ${green(String(passed))}`);
  console.log(`Failed:  ${failed > 0 ? red(String(failed)) : grey('0')}`);
  console.log(`Model:   ${yellow(MODEL)}`);
  console.log(`Time:    ${grey(`${(totalMs / 1000).toFixed(1)}s total (${(totalMs / results.length / 1000).toFixed(1)}s avg)`)}`);
  console.log('─'.repeat(60));

  if (failed > 0) {
    console.log(bold('\nFailed cases:'));
    results
      .filter((r) => !r.pass)
      .forEach((r) => {
        const failedChecks = r.checks.filter((c) => !c.pass).map((c) => c.name);
        const checks = failedChecks.length ? `[${failedChecks.join(', ')}]` : r.error ? '[error]' : '';
        console.log(`  ${red('✗')} ${r.id} ${grey(checks)}`);
      });
    console.log('');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(bold('\n🧪 nook AI Eval Harness'));
  console.log(dim(`Model: ${MODEL} | Max tokens: ${MAX_TOKENS} | Concurrency: ${CONCURRENCY}\n`));

  if (!process.env.OPENAI_API_KEY) {
    console.error(red('Error: OPENAI_API_KEY is not set. Add it to .env and retry.'));
    process.exit(1);
  }

  // Filter cases
  let cases = EVAL_CASES;
  if (idFilter) {
    cases = cases.filter((c) => c.id.startsWith(idFilter));
    if (cases.length === 0) {
      console.error(red(`No cases match id prefix: "${idFilter}"`));
      console.log(grey(`Available: ${EVAL_CASES.map((c) => c.id).join(', ')}`));
      process.exit(1);
    }
    console.log(yellow(`Filtering to ${cases.length} case(s) matching "${idFilter}"\n`));
  }

  if (fastMode) {
    console.log(bold('Fast mode — listing cases only:\n'));
    cases.forEach((c, i) => {
      console.log(`  ${dim(String(i + 1).padStart(2, '0'))}. ${c.id} — ${grey(c.description)}`);
    });
    console.log(`\n${cases.length} cases total.`);
    return;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const results: CaseResult[] = new Array(cases.length);
  const tasks = cases.map((c, i) => () => runCase(c, client));

  console.log(`Running ${cases.length} cases with concurrency=${CONCURRENCY}...\n`);

  let completed = 0;
  await runWithConcurrency(tasks, CONCURRENCY, (result, i) => {
    results[i] = result;
    completed++;
    printCaseResult(result, i, cases.length);
  });

  printSummary(results);

  const anyFailed = results.some((r) => !r.pass);
  process.exit(anyFailed ? 1 : 0);
}

main().catch((err) => {
  console.error(red(`\nFatal: ${err instanceof Error ? err.message : err}`));
  process.exit(1);
});
