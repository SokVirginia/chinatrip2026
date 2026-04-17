import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

// 1) Build with Eleventy into dist/
execSync('npx @11ty/eleventy', { stdio: 'inherit' });

// 2) Copy generated index.html to repo root
const root = process.cwd();
const from = path.join(root, 'dist', 'index.html');
const to = path.join(root, 'index.html');
mkdirSync(path.dirname(to), { recursive: true });
copyFileSync(from, to);

console.log('Built dist/index.html -> index.html');

