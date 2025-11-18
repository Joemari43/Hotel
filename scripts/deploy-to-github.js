#!/usr/bin/env node

const { spawnSync } = require('child_process');

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

function main() {
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
