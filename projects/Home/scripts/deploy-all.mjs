#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const HOME_DIR = root;
const GAMES_DIR = path.resolve(root, '../Games');
const TOOLS_DIR = path.resolve(root, '../Tools');

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, stdio: 'inherit' });
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} failed with code ${code} in ${cwd}`));
    });
  });
}

async function readPackageJson(dir) {
  try {
    const content = await fs.readFile(path.join(dir, 'package.json'), 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function listSubprojects(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => path.join(dir, e.name));
  } catch {
    return [];
  }
}

async function runScriptIfExists(dir, scriptNames) {
  const pkg = await readPackageJson(dir);
  if (!pkg || !pkg.scripts) return false;
  for (const name of scriptNames) {
    if (pkg.scripts[name]) {
      console.log(`\n=== Running '${name}' in ${dir} ===`);
      await run('npm', ['run', name], dir);
      return true;
    }
  }
  return false;
}

async function main() {
  console.log('Unified pipeline start');

  // 1) Unit tests: Home
  await runScriptIfExists(HOME_DIR, ['test']);

  // 2) Unit tests: Games
  const games = await listSubprojects(GAMES_DIR);
  for (const proj of games) {
    await runScriptIfExists(proj, ['test:unit', 'test']);
  }

  // 3) Unit tests: Tools
  const tools = await listSubprojects(TOOLS_DIR);
  for (const proj of tools) {
    await runScriptIfExists(proj, ['test:unit', 'test']);
  }

  // 4) Deploy dependencies first: Games, Tools
  for (const proj of games) {
    await runScriptIfExists(proj, ['deploy']);
  }
  for (const proj of tools) {
    await runScriptIfExists(proj, ['deploy']);
  }

  // 5) Deploy Home last (depends on service bindings)
  await runScriptIfExists(HOME_DIR, ['deploy']);

  // 6) Post-deploy: E2E tests (centralized in Home)
  await runScriptIfExists(HOME_DIR, ['test:e2e']);

  console.log('\nUnified pipeline completed successfully');
}

main().catch((err) => {
  console.error('\nUnified pipeline failed:', err.message);
  process.exit(1);
});