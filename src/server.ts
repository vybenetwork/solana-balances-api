/**
 * Solana wallet balances API server.
 */

import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadEnv,
  getDataApiKey,
  getSolanaRpcProviderLabel,
  PUBLIC_DIR,
  VYBE_DATA_API_BASE,
} from './config.js';
import { createDataHttpClient, toHumanReadableError } from './api/client.js';
import {
  listWalletTokenBalances,
  streamWalletTokenBalances,
  WALLET_TOKEN_BALANCE_LIMIT,
} from './api/wallet-balance.js';
import { resolveTokenMeta } from './api/resolve-token-meta.js';
import { repairTokenIcon } from './api/repair-token-icon.js';
import { cachedMetaToApiResponse } from './api/token-meta-api.js';
import { warmupHttpProxyPool } from './api/http-proxy-fetch.js';
import { getRuntimeIconDir } from './token-icon-cache.js';

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataApiKey = getDataApiKey();
const dataHttp = createDataHttpClient(dataApiKey);
const port = Number(process.env.PORT ?? 3001);

const app = express();
app.disable('x-powered-by');

app.use(
  express.static(PUBLIC_DIR, {
    setHeaders(res) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
    },
  }),
);

function q(req: Request, key: string): string {
  const v = req.query[key];
  if (Array.isArray(v)) return String(v[0] ?? '');
  return String(v ?? '');
}

function qNum(req: Request, key: string): number | null {
  const raw = q(req, key).trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function qBool(req: Request, key: string, defaultValue = false): boolean {
  const raw = q(req, key).trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    vybeDataApiBase: VYBE_DATA_API_BASE,
    solanaRpc: getSolanaRpcProviderLabel(),
  });
});

/** GET /api/wallets/:ownerAddress/token-balances */
app.get('/api/wallets/:ownerAddress/token-balances', async (req: Request, res: Response) => {
  try {
    const rawOwner = req.params.ownerAddress;
    const ownerAddress = (Array.isArray(rawOwner) ? rawOwner[0] : rawOwner ?? '').trim();
    if (!ownerAddress) return res.status(400).json({ error: 'Wallet address required' });

    const limitRaw = qNum(req, 'limit');
    const limit =
      limitRaw != null && limitRaw > 0
        ? Math.min(limitRaw, WALLET_TOKEN_BALANCE_LIMIT)
        : WALLET_TOKEN_BALANCE_LIMIT;
    const useStream = qBool(req, 'stream');
    const enrich = qBool(req, 'enrich', !useStream);

    if (useStream) {
      const enrichStream = qBool(req, 'enrich', true);
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.flushHeaders();
      let closed = false;
      req.on('close', () => {
        closed = true;
      });
      await streamWalletTokenBalances(
        dataHttp,
        ownerAddress,
        limit,
        (event) => {
          if (closed) return;
          res.write(`${JSON.stringify(event)}\n`);
        },
        () => closed,
        { enrich: enrichStream },
      );
      if (!closed) res.end();
      return;
    }

    const tokens = await listWalletTokenBalances(dataHttp, ownerAddress, limit, { enrich });
    res.json({ tokens });
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status ?? 500;
    res.status(status).json({ error: toHumanReadableError(err) });
  }
});

/** GET /api/token/:mint/logo — Jupiter (non-pump) or pump.fun metadata; caches locally. */
app.get('/api/token/:mint/logo', async (req: Request, res: Response) => {
  try {
    const rawMint = req.params.mint;
    const mint = (Array.isArray(rawMint) ? rawMint[0] : rawMint ?? '').trim();
    if (!mint) return res.status(400).json({ error: 'Mint address required' });

    const force = qBool(req, 'force', false);
    const logoUrl = await repairTokenIcon(mint, { force });
    if (!logoUrl) return res.status(404).json({ error: `No logo found for mint ${mint}` });
    res.json({ logoUrl });
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status ?? 500;
    res.status(status).json({ error: toHumanReadableError(err) });
  }
});

/** GET /api/token/:mint — resolve metadata and USD price (Jupiter → pump.fun → Vybe). */
app.get('/api/token/:mint', async (req: Request, res: Response) => {
  try {
    const rawMint = req.params.mint;
    const mint = (Array.isArray(rawMint) ? rawMint[0] : rawMint ?? '').trim();
    if (!mint) return res.status(400).json({ error: 'Mint address required' });

    const skipVybe = qBool(req, 'skipVybe');
    const resolved = await resolveTokenMeta(dataHttp, mint, { skipVybe });
    if (!resolved) {
      return res.status(404).json({ error: `No metadata found for mint ${mint}` });
    }
    res.json(cachedMetaToApiResponse(resolved.meta, resolved.source));
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status ?? 500;
    res.status(status).json({ error: toHumanReadableError(err) });
  }
});

app.use('/cached/token-icons', express.static(getRuntimeIconDir(), { maxAge: '7d' }));

async function main(): Promise<void> {
  await warmupHttpProxyPool();
  app.listen(port, () => {
    console.log(
      `[wallet-balances-api] listening on http://localhost:${port} (Vybe data: ${VYBE_DATA_API_BASE}, RPC: ${getSolanaRpcProviderLabel()})`,
    );
  });
}

main().catch((err) => {
  console.error('[wallet-balances-api] startup failed:', err);
  process.exit(1);
});
