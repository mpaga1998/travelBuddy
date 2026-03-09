#!/usr/bin/env node
/**
 * Build script for Vercel: Bundles API functions with all dependencies.
 * Compiles TypeScript and bundles into a single .js file.
 */

import * as esbuild from 'esbuild';

async function buildApiFunction() {
  try {
    console.log('🔨 [Build] Bundling API function with dependencies...');

    const result = await esbuild.build({
      entryPoints: ['api/itinerary.ts'],
      outfile: 'api/itinerary.js',
      bundle: true,
      platform: 'node',
      target: 'es2022',
      format: 'esm',
      external: [], // Bundle EVERYTHING - no external dependencies
      sourcemap: false,
      minify: false,
      logLevel: 'verbose', // Show all warnings
      splitting: false, // Single output file
    });

    console.log('✅ [Build] API bundle created successfully');
    console.log('📦 [Build] Output: api/itinerary.js');
    
    if (result.warnings && result.warnings.length > 0) {
      console.log('⚠️  [Build] Warnings:');
      result.warnings.forEach(w => console.log('  ', w));
    }
  } catch (error) {
    console.error('❌ [Build] Bundling failed:', error.message);
    process.exit(1);
  }
}

buildApiFunction();
