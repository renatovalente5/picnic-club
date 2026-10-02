#!/usr/bin/env node
// Full-page screenshots of the local preview, for review before publishing.
//
//   node scripts/screenshots.mjs [base-url] [out-dir] [path ...]
//
// Uses headless Chrome over the DevTools protocol, with reduced motion emulated so that
// every section is at rest (no reveals, poster instead of the film).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const base = process.argv[2] || 'http://localhost:4800';
const out = process.argv[3] || path.join(os.tmpdir(), 'picnic-club-shots');
const paths = process.argv.slice(4).length ? process.argv.slice(4) : ['/'];
const DEVICES = [
  { name: 'desktop', width: 1440, height: 900, scale: 1, mobile: false },
  { name: 'mobile', width: 390, height: 844, scale: 2, mobile: true },
];

fs.mkdirSync(out, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${profile}`, '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:9333/json')).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('Chrome did not start');
}

const ws = new WebSocket(await target());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const waiting = new Map();
const events = [];
ws.addEventListener('message', (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
  else if (msg.method) events.push(msg.method);
});
const send = (method, params = {}) => new Promise((resolve) => { const id = ++seq; waiting.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });

await send('Page.enable');
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
for (const device of DEVICES) {
  await send('Emulation.setDeviceMetricsOverride', { width: device.width, height: device.height, deviceScaleFactor: device.scale, mobile: device.mobile });
  for (const p of paths) {
    events.length = 0;
    await send('Page.navigate', { url: base + p });
    for (let i = 0; i < 60 && !events.includes('Page.loadEventFired'); i++) await sleep(100);
    // let lazy images in: scroll through once, then back to the top
    await send('Runtime.evaluate', { expression: `(async () => { await document.fonts.ready; for (let y = 0; y < document.body.scrollHeight; y += innerHeight) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } scrollTo(0, 0); await new Promise(r => setTimeout(r, 400)); document.documentElement.dataset.scrolled = document.documentElement.dataset.hero ? 'no' : document.documentElement.dataset.scrolled; })()`, awaitPromise: true });
    await sleep(800);
    const { result } = await send('Page.getLayoutMetrics');
    const h = Math.ceil(result.cssContentSize.height);
    // Past Chrome's largest texture (16 384 device pixels) a capture wraps round to the top of
    // the page and the footer never shows, so long pages are taken in parts.
    const step = Math.floor(16000 / device.scale);
    const parts = Math.ceil(h / step);
    const stem = `${(p === '/' ? 'home' : p.replace(/^\/|\/$/g, '').replace(/\//g, '-'))}-${device.name}`;
    for (let i = 0; i < parts; i++) {
      const y = i * step;
      const height = Math.min(step, h - y);
      const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82, captureBeyondViewport: true, clip: { x: 0, y, width: device.width, height, scale: 1 } });
      const name = parts > 1 ? `${stem}-${i + 1}.jpg` : `${stem}.jpg`;
      fs.writeFileSync(path.join(out, name), Buffer.from(shot.result.data, 'base64'));
      console.log(name, `${device.width}×${height}`);
    }
  }
}
// Close Chrome from the inside so its helper processes stop writing to the profile before it
// is removed; a profile left behind is only a stray temp folder, never a failed run.
const exited = new Promise((r) => chrome.once('exit', r));
send('Browser.close'); // Chrome may go before it answers
await Promise.race([exited, sleep(5000)]);
if (chrome.exitCode === null && chrome.signalCode === null) { chrome.kill(); await exited; }
ws.close();
for (let i = 0; i < 10; i++) {
  try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch { await sleep(300); }
}
