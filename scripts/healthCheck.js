/**
 * API Health Check Script
 * ========================
 * Tests every movie and one episode of every TV show in database.json
 * against the vaplayer.ru embed API and reports any 404s.
 *
 * Usage: node scripts/healthCheck.js
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../src/constants/database.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

const BASE = 'vaplayer.ru';

function fetchStatus(url) {
  return new Promise((resolve) => {
    const options = {
      hostname: BASE,
      path: url,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    };
    const req = https.request(options, (res) => {
      res.resume(); // drain response
      resolve(res.statusCode);
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function run() {
  const allItems = Object.values(db).flat();
  const unique = {};
  for (const item of allItems) {
    if (item.id && !unique[item.id]) unique[item.id] = item;
  }

  const items = Object.values(unique);
  const dead = [];
  const timeout = [];

  console.log(`\n🔍 Checking ${items.length} unique titles against vaplayer.ru...\n`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let url;
    if (item.type === 'tv') {
      url = `/embed/tv/${item.id}/1/1`;
    } else {
      url = `/embed/movie/${item.id}`;
    }

    const status = await fetchStatus(url);
    const label = `[${i + 1}/${items.length}] ${item.type.toUpperCase()} ${item.id} "${item.title}"`;

    if (status === null) {
      console.log(`  ⏱  TIMEOUT  ${label}`);
      timeout.push(item);
    } else if (status === 404) {
      console.log(`  ❌  404      ${label}`);
      dead.push(item);
    } else {
      process.stdout.write(`  ✅  ${status}  ${label}\n`);
    }

    // Small delay to be polite to the server
    await new Promise(r => setTimeout(r, 80));
  }

  console.log('\n══════════════════════════════════════\n');
  console.log(`✅  OK:      ${items.length - dead.length - timeout.length}`);
  console.log(`❌  404:     ${dead.length}`);
  console.log(`⏱  Timeout: ${timeout.length}`);
  console.log('\n══════════════════════════════════════\n');

  if (dead.length > 0) {
    console.log('🚨 Dead titles (returning 404):\n');
    dead.forEach(item => {
      console.log(`  - [${item.type}] ${item.id}  "${item.title}"`);
    });
  }

  if (timeout.length > 0) {
    console.log('\n⚠️  Timed out titles (may be intermittent):\n');
    timeout.forEach(item => {
      console.log(`  - [${item.type}] ${item.id}  "${item.title}"`);
    });
  }

  // Write report to file
  const report = {
    checkedAt: new Date().toISOString(),
    total: items.length,
    ok: items.length - dead.length - timeout.length,
    dead404: dead.map(i => ({ id: i.id, title: i.title, type: i.type })),
    timedOut: timeout.map(i => ({ id: i.id, title: i.title, type: i.type })),
  };
  const reportPath = path.join(__dirname, '../health-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Full report saved to: health-report.json\n`);
}

run().catch(console.error);
