/**
 * Test Runner Utilities
 * Helper functions for running and reporting test results
 */

/**
 * Individual test result
 */
export interface TestResult {
  name: string;
  passed: boolean;
  assertions?: Record<string, boolean>;
  details?: Record<string, any>;
  error?: string;
}

/**
 * Test summary
 */
export interface TestSummary {
  name: string;
  total: number;
  passed: number;
  failed: number;
  tests: TestResult[];
  duration?: number;
}

/**
 * Format test result for console output
 */
export function formatTestResult(
  result: TestResult,
  verbose = false
): string {
  const icon = result.passed ? '✓' : '✗';
  const color = result.passed ? '\x1b[32m' : '\x1b[31m'; // green : red
  const reset = '\x1b[0m';

  let output = `${color}${icon}${reset} ${result.name}`;

  if (!result.passed && result.error) {
    output += ` - ${result.error}`;
  }

  if (verbose && result.assertions) {
    const assertions = Object.entries(result.assertions)
      .map(([key, value]) => `  ${value ? '✓' : '✗'} ${key}`)
      .join('\n');
    output += `\n${assertions}`;
  }

  return output;
}

/**
 * Format test summary for console output
 */
export function formatTestSummary(summary: TestSummary, verbose = false): string {
  const icon = summary.failed === 0 ? '✓' : '✗';
  const color = summary.failed === 0 ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';

  let output = `\n${color}${icon} ${summary.name}${reset}\n`;
  output += `├─ Total: ${summary.total}\n`;
  output += `├─ Passed: \x1b[32m${summary.passed}\x1b[0m\n`;
  output += `├─ Failed: \x1b[31m${summary.failed}\x1b[0m\n`;

  if (summary.duration) {
    output += `└─ Duration: ${summary.duration}ms\n`;
  }

  if (verbose) {
    output += '\n' + summary.tests.map((t) => formatTestResult(t, verbose)).join('\n');
  }

  return output;
}

/**
 * Convert assertion object to test result
 */
export function assertionsToResult(
  name: string,
  assertions: Record<string, boolean>
): TestResult {
  const allPassed = Object.values(assertions).every((v) => v === true);
  return {
    name,
    passed: allPassed,
    assertions,
  };
}

/**
 * Create test result with error
 */
export function createErrorResult(name: string, error: Error): TestResult {
  return {
    name,
    passed: false,
    error: error.message,
  };
}

/**
 * Merge multiple summaries into one comprehensive summary
 */
export function mergeSummaries(
  summaries: TestSummary[],
  name = 'Full Test Suite'
): TestSummary {
  return {
    name,
    total: summaries.reduce((sum, s) => sum + s.total, 0),
    passed: summaries.reduce((sum, s) => sum + s.passed, 0),
    failed: summaries.reduce((sum, s) => sum + s.failed, 0),
    tests: summaries.flatMap((s) => s.tests),
  };
}

/**
 * Assert equality helper
 */
export function assertEquals<T>(actual: T, expected: T, message = ''): boolean {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  if (!passed && message) {
    console.error(`Assertion failed: ${message}`);
    console.error(`Expected: ${JSON.stringify(expected)}`);
    console.error(`Actual: ${JSON.stringify(actual)}`);
  }
  return passed;
}

/**
 * Assert boolean helper
 */
export function assertTrue(
  condition: boolean,
  message = 'Assertion failed'
): boolean {
  if (!condition) {
    console.error(`Assertion failed: ${message}`);
  }
  return condition;
}

/**
 * Assert array includes value
 */
export function assertIncludes<T>(
  array: T[],
  value: T,
  message = ''
): boolean {
  const passed = array.includes(value);
  if (!passed && message) {
    console.error(`Assertion failed: ${message}`);
    console.error(`Array does not include: ${value}`);
  }
  return passed;
}

/**
 * Assert array length
 */
export function assertLength(
  array: any[],
  expectedLength: number,
  message = ''
): boolean {
  const passed = array.length === expectedLength;
  if (!passed) {
    const msg = message || `Expected length ${expectedLength}, got ${array.length}`;
    console.error(`Assertion failed: ${msg}`);
  }
  return passed;
}
