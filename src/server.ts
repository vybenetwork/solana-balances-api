/**
 * Solana balances API server (debug: assets API only for holdings).
 */

import express, { type Request, type Response } from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import {
  loadEnv,
  getSolanaRpcProviderLabel,
  PUBLIC_DIR,
  ASSETS_API_BASE,
} from './config.js';
import { toHumanReadableError } from './api/client.js';
import {
  listWalletTokenBalances,
  streamWalletTokenBalances,
  WALLET_TOKEN_BALANCE_LIMIT,
} from './api/wallet-balance.js';
import { fetchProxiedLogo } from './api/proxy-logo.js';
import { getRuntimeIconDir } from './token-icon-cache.js';

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3001);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

function setStaticCacheHeaders(res: Response, filePath: string): void {
  if (/\.(png|jpe?g|gif|webp|svg|ico)$/i.test(filePath)) {
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    return;
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
}

app.use(
  express.static(PUBLIC_DIR, {
    setHeaders: setStaticCacheHeaders,
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
    mode: 'debug-assets',
    assetsApiBase: ASSETS_API_BASE || null,
    assetsEndpoint: '/api/assets/:wallet',
    enrich: false,
    solanaRpc: getSolanaRpcProviderLabel(),
  });
});

/** GET /api/wallets/:ownerAddress/token-balances — assets API only, no local enrich. */
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

    if (useStream) {
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      let closed = false;
      req.on('close', () => {
        closed = true;
      });
      await streamWalletTokenBalances(
        undefined,
        ownerAddress,
        limit,
        (event) => {
          if (closed) return;
          res.write(`${JSON.stringify(event)}\n`);
          const flushable = res as unknown as { flush?: () => void };
          flushable.flush?.();
        },
        () => closed,
      );
      if (!closed) res.end();
      return;
    }

    const tokens = await listWalletTokenBalances(undefined, ownerAddress, limit);
    res.json({ tokens });
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status ?? 500;
    res.status(status).json({ error: toHumanReadableError(err) });
  }
});

/** GET /api/proxy-logo?url= — fetch remote token logos (bypasses ipfs.io 403 in browser). */
app.get('/api/proxy-logo', async (req: Request, res: Response) => {
  try {
    const url = q(req, 'url').trim();
    if (!url) return res.status(400).json({ error: 'url required' });
    const got = await fetchProxiedLogo(url);
    if (!got) return res.status(404).json({ error: 'logo not found' });
    res.setHeader('Content-Type', got.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(got.body);
  } catch (err) {
    res.status(502).json({ error: toHumanReadableError(err) });
  }
});

app.use(
  '/cached/token-icons',
  express.static(getRuntimeIconDir(), {
    maxAge: '7d',
    immutable: true,
    setHeaders(res) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    },
  }),
);

async function main(): Promise<void> {
  if (!ASSETS_API_BASE) {
    throw new Error('ASSETS_API_BASE is required (set it in .env).');
  }
  app.listen(port, () => {
    console.log(
      `[wallet-balances-api] debug listening on http://localhost:${port} ` +
        `(assets: ${ASSETS_API_BASE}/api/assets/:wallet, enrich=off)`,
    );
  });
}

main().catch((err) => {
  console.error('[wallet-balances-api] startup failed:', err);
  process.exit(1);
});
