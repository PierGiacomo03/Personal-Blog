/**
 * screenshot.mjs — take a Puppeteer screenshot of localhost
 *
 * Usage:
 *   node screenshot.mjs http://localhost:3000
 *   node screenshot.mjs http://localhost:3000 label
 *
 * Saves to: ./temporary screenshots/screenshot-N.png
 *           ./temporary screenshots/screenshot-N-label.png
 */
import puppeteer from 'puppeteer';
import { existsSync, mkdirSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

const SCREENSHOT_DIR = fileURLToPath(new URL('./temporary screenshots', import.meta.url));
if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });

const url   = process.argv[2] ?? 'http://localhost:3000';
const label = process.argv[3] ?? '';

async function nextIndex() {
  const files = await readdir(SCREENSHOT_DIR).catch(() => []);
  const nums  = files
    .map(f => parseInt(f.match(/^screenshot-(\d+)/)?.[1]))
    .filter(n => Number.isFinite(n));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  protocolTimeout: 60_000,
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

console.log(`  → navigating to ${url} …`);
await page.goto(url, { waitUntil: 'networkidle2', timeout: 20_000 });

// Give canvas animations a moment to settle, then pause rAF for screenshot
await new Promise(r => setTimeout(r, 1800));

// Freeze canvas loop so Puppeteer can capture cleanly
await page.evaluate(() => {
  const orig = window.requestAnimationFrame;
  window._rafPaused = true;
  window.requestAnimationFrame = cb => window._rafPaused ? 0 : orig(cb);
});
await new Promise(r => setTimeout(r, 100));

const n    = await nextIndex();
const name = label ? `screenshot-${n}-${label}.png` : `screenshot-${n}.png`;
const path = join(SCREENSHOT_DIR, name);

await page.screenshot({ path, fullPage: false, timeout: 30_000 });
await browser.close();

console.log(`  ✓ saved: ${path}`);
