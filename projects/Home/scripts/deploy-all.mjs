#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';

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

async function waitForServer(url) {
  console.log(`Waiting for ${url} to be ready...`);
  for (let i = 0; i < 30; i++) {
    try {
      await fetch(url);
      return true;
    } catch {
      await setTimeout(1000);
    }
  }
  return false;
}

async function runE2ETestsWithoutServer() {
  // Legacy mode or if server is implicitly anticipated
  return runScriptIfExists(HOME_DIR, ['test:e2e']);
}

async function main() {
  console.log('Unified pipeline start');

  // 1) 单元测试: Home
  await runScriptIfExists(HOME_DIR, ['test']);

  // 2) 单元测试: Games 子项目
  const games = await listSubprojects(GAMES_DIR);
  for (const proj of games) {
    await runScriptIfExists(proj, ['test:unit', 'test']);
  }

  // 3) 单元测试: Tools 子项目
  const tools = await listSubprojects(TOOLS_DIR);
  for (const proj of tools) {
    await runScriptIfExists(proj, ['test:unit', 'test']);
  }

  // 4) 优先部署依赖项: Games 和 Tools
  for (const proj of games) {
    await runScriptIfExists(proj, ['deploy']);
  }
  for (const proj of tools) {
    await runScriptIfExists(proj, ['deploy']);
  }

  // 5) 最后部署 Home (因为它依赖 Service Bindings 指向 Games/Tools)
  await runScriptIfExists(HOME_DIR, ['deploy']);

  // 6) 部署后: E2E 验证 (直接访问线上站点)
  console.log('\n=== Running E2E Verification (Live Site) ===');
  await runScriptIfExists(HOME_DIR, ['test:e2e']);

  console.log('\nUnified pipeline completed');
}

main().catch((err) => {
  console.error('\nUnified pipeline failed:', err.message);
  process.exit(1);
});