const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'public');
const destDir = path.join(rootDir, 'docs');

function ensureSourceExists(dir) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Source directory "${dir}" does not exist. Make sure public/ is present.`);
  }
}

function emptyDirectory(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function main() {
  ensureSourceExists(srcDir);
  emptyDirectory(destDir);
  copyRecursive(srcDir, destDir);
  console.log(`Copied static site from ${srcDir} -> ${destDir}`);
  console.log('Commit docs/ and enable GitHub Pages (Settings → Pages → main branch /docs).');
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
