/**
 * Fetch debug owner portfolio JSON and write to public/data/.
 *
 * Usage:
 *   npx tsx tools/dump-owner-portfolio.ts [wallet]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv, PORTFOLIO_API_BASE } from '../src/config.js';
import { getOwnerPortfolio } from '../src/api/owner-portfolio.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

loadEnv();

const wallet = (process.argv[2] ?? '4Be9CvxqHW6BYiRAxW9Q3xu1ycTMWaL5z8NX4HR3ha7t').trim();
if (!wallet) {
  console.error('Wallet address required');
  process.exit(1);
}

if (!PORTFOLIO_API_BASE) {
  console.error('PORTFOLIO_API_BASE is required (set it in .env)');
  process.exit(1);
}

console.log(`[dump-owner-portfolio] base=${PORTFOLIO_API_BASE} wallet=${wallet}`);
const started = Date.now();
const data = await getOwnerPortfolio(wallet);
console.log(
  `[dump-owner-portfolio] ok in ${Date.now() - started}ms — holdings=${data.holdings.length} ` +
    `token_count=${data.token_count} query_time_us=${data.query_time_us}`,
);
console.log('[dump-owner-portfolio] sol_summary', data.sol_summary);

const outDir = path.join(projectRoot, 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `owner-portfolio-${wallet}.json`);
fs.writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`[dump-owner-portfolio] wrote ${outPath}`);
