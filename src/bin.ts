#!/usr/bin/env node
import { main } from './cli.ts';

main(process.argv.slice(2)).then(
  (code) => {
    if (code) process.exitCode = code;
  },
  (err: unknown) => {
    console.error(`baton: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  },
);
