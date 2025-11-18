#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runGit(args, { capture = false } = {}) {
  const result = spawnSync('git', args, {
    stdio: capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    if (capture && result.stderr) {
      process.stderr.write(result.stderr);
    }
    process.exit(result.status);
  }

  return result;
}

function hasChanges() {
  const result = runGit(['status', '--porcelain'], { capture: true });
  return Boolean(result.stdout && result.stdout.trim().length > 0);
}

function resolveCommitMessage() {
  const messageArg = process.argv.slice(2).join(' ').trim();
  if (messageArg) {
    return messageArg;
  }

  const timestamp = new Date().toISOString();
  return `chore: deploy ${timestamp}`;
}

function ensureOriginRemote() {
  const result = runGit(['remote', 'get-url', 'origin'], { capture: true });
  return result.stdout.trim();
}

function detectEmbeddedRepos(repoRoot) {
  const result = runGit(['status', '--short'], { capture: true });
  const embedded = [];

  if (!result.stdout) {
    return embedded;
  }

  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.startsWith('?? ')) {
      continue;
    }

    const relativePath = line.slice(3).trim();
    if (!relativePath) {
      continue;
    }

    const fullPath = path.join(repoRoot, relativePath);
    let stats;
    try {
      stats = fs.statSync(fullPath);
    } catch {
      continue;
    }

    if (!stats.isDirectory()) {
      continue;
    }

    if (fs.existsSync(path.join(fullPath, '.git'))) {
      embedded.push(relativePath);
    }
  }

  return embedded;
}

function ensureNoEmbeddedRepos(repoRoot) {
  const embedded = detectEmbeddedRepos(repoRoot);
  if (embedded.length === 0) {
    return;
  }

  console.error(
    'Cannot deploy because the following paths contain nested Git repositories:\n' +
      embedded.map((pathName) => `  - ${pathName}`).join('\n')
  );
  console.error(
    'Add these paths to .gitignore, move them elsewhere, or convert them into git submodules before running the deploy script.'
  );
  process.exit(1);
}

function getRepoRoot() {
  const result = runGit(['rev-parse', '--show-toplevel'], { capture: true });
  return result.stdout.trim();
}

function main() {
  const repoRoot = getRepoRoot();
  ensureNoEmbeddedRepos(repoRoot);

  if (!hasChanges()) {
    console.log('No working tree changes found. Nothing to deploy.');
    return;
  }

  const commitMessage = resolveCommitMessage();
  console.log(`Using commit message: "${commitMessage}"`);

  runGit(['add', '--all']);
  runGit(['commit', '-m', commitMessage]);

  const originUrl = ensureOriginRemote();
  console.log(`Pushing to ${originUrl}...`);
  runGit(['push', 'origin', 'HEAD']);
  console.log('Deployment to GitHub completed successfully.');
}

main();

