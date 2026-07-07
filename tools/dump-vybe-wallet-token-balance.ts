/**
 * Fetch raw Vybe wallet token-balance JSON (no RPC merge) and write to public/data/.
 *
 * Usage:
 *   npx tsx tools/dump-vybe-wallet-token-balance.ts [wallet] [limit]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnv, getDataApiKey } from '../src/config.js';
import { createDataHttpClient } from '../src/api/client.js';
import {
  countVybeVerifiedZero7dHighValueMarks,
  getWalletTokenBalance,
  isVybeSuspiciousHighValueMark,
  VYBE_SUSPICIOUS_VALUE_USD_MIN,
  VYBE_WALLET_TOKEN_BALANCE_MAX_LIMIT,
  VYBE_WALLET_TOKEN_BALANCE_SORT_BY_DESC,
} from '../src/api/wallet-balance.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

loadEnv();

const wallet = (process.argv[2] ?? '7Tar8QZTrRPwoGY5Ke9Vfwf6CmpBfekrNofERxgReza').trim();
const limitRaw = Number(process.argv[3] ?? VYBE_WALLET_TOKEN_BALANCE_MAX_LIMIT);
const limit =
  Number.isFinite(limitRaw) && limitRaw >= 0
    ? Math.min(limitRaw, VYBE_WALLET_TOKEN_BALANCE_MAX_LIMIT)
    : VYBE_WALLET_TOKEN_BALANCE_MAX_LIMIT;

if (!wallet) {
  console.error('Wallet address required');
  process.exit(1);
}

const http = createDataHttpClient(getDataApiKey());
const data = await getWalletTokenBalance(http, {
  ownerAddress: wallet,
  includeNoPriceBalance: true,
  sortByDesc: VYBE_WALLET_TOKEN_BALANCE_SORT_BY_DESC,
  limit,
});

const outDir = path.join(projectRoot, 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `vybe-token-balance-${wallet}.json`);
fs.writeFileSync(outPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

const rows = data.data ?? [];
const verifiedZero7dCount = countVybeVerifiedZero7dHighValueMarks(rows);
const suspicious = rows
  .filter((row) => isVybeSuspiciousHighValueMark(row, Number(row.valueUsd)))
  .sort((a, b) => Number(b.valueUsd) - Number(a.valueUsd));

const suspiciousPath = path.join(outDir, `vybe-token-balance-${wallet}-over-10k-usd.json`);
fs.writeFileSync(suspiciousPath, `${JSON.stringify(suspicious, null, 2)}\n`, 'utf8');

console.log(
  `[dump-vybe-wallet] wallet=${wallet} sortByDesc=${VYBE_WALLET_TOKEN_BALANCE_SORT_BY_DESC} limit=${limit}`,
);
console.log(`[dump-vybe-wallet] rows=${rows.length} totalTokenCount=${data.totalTokenCount ?? '?'}`);
console.log(`[dump-vybe-wallet] totalTokenValueUsd=${data.totalTokenValueUsd ?? '?'}`);
console.log(`[dump-vybe-wallet] wrote ${outPath}`);
console.log(
  `[dump-vybe-wallet] suspicious unverified (valueUsd > $${VYBE_SUSPICIOUS_VALUE_USD_MIN.toLocaleString()} & zero 7d): ${suspicious.length} row(s) → ${suspiciousPath}`,
);
console.log(
  `[dump-vybe-wallet] verified with zero 7d above $${VYBE_SUSPICIOUS_VALUE_USD_MIN.toLocaleString()} (excluded from suspicious file): ${verifiedZero7dCount}`,
);

if (suspicious.length === 0) {
  console.log('[dump-vybe-wallet] no unverified holdings matching suspicious filter');
} else {
  console.log(
    `\n[dump-vybe-wallet] unverified valueUsd > $${VYBE_SUSPICIOUS_VALUE_USD_MIN.toLocaleString()} with all-zero priceUsd7dTrend:`,
  );
  for (const row of suspicious) {
    const label = String(row.symbol ?? row.name ?? '').trim() || row.mintAddress.slice(0, 8);
    const valueUsd = Number(row.valueUsd);
    const value = valueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 });
    const price = row.priceUsd != null ? Number(row.priceUsd).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '?';
    const amount = row.amount ?? '?';
    console.log(
      `  ${label.padEnd(12)}  valueUsd=$${value.padStart(20)}  priceUsd=$${price}  amount=${amount}  mint=${row.mintAddress}`,
    );
  }
}
