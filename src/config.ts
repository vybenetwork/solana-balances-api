/**
 * Application configuration: env loading, API base URL, and constants.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

/** Path to public static assets (web demo). */
export const PUBLIC_DIR = path.join(projectRoot, 'public');

dotenv.config({ path: path.join(projectRoot, '.env') });

export function loadEnv(): void {
  dotenv.config({ path: path.join(projectRoot, '.env') });
}

export function getDataApiKey(): string {
  const key = (process.env.VYBE_DATA_API_KEY ?? process.env.VYBE_API_KEY ?? '').trim();
  if (!key) {
    throw new Error(
      'VYBE_DATA_API_KEY is required. Get a key at https://vybe.fyi/api-pricing',
    );
  }
  return key;
}

export const VYBE_DATA_API_BASE = (
  process.env.VYBE_DATA_API_BASE ?? 'https://api.vybenetwork.xyz'
)
  .trim()
  .replace(/\/$/, '');

/** Assets API base for GET /api/assets/:wallet — set ASSETS_API_BASE in .env. */
export const ASSETS_API_BASE = (process.env.ASSETS_API_BASE ?? '').trim().replace(/\/$/, '');

/** Optional portfolio dump API base — set PORTFOLIO_API_BASE in .env when needed. */
export const PORTFOLIO_API_BASE = (process.env.PORTFOLIO_API_BASE ?? '')
  .trim()
  .replace(/\/$/, '');

export const VYBE_TIMEOUT_MS = 60_000;
export const VYBE_MAX_RETRIES = 3;
export const VYBE_RETRY_DELAY_MS = 2000;

const PUBLIC_SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';

export function resolveSolanaRpcUrl(): string {
  const explicit = (process.env.SOLANA_RPC_URL ?? '').trim();
  if (explicit) return explicit;
  const heliusKey = (process.env.HELIUS_API_KEY ?? '').trim();
  if (heliusKey) return `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
  return PUBLIC_SOLANA_RPC_URL;
}

export const SOLANA_RPC_URL = resolveSolanaRpcUrl();

export function getSolanaRpcProviderLabel(): string {
  if ((process.env.SOLANA_RPC_URL ?? '').trim()) return 'custom (SOLANA_RPC_URL)';
  if ((process.env.HELIUS_API_KEY ?? '').trim()) return 'Helius';
  return 'public mainnet';
}

export function getPumpfunAuthToken(): string | undefined {
  const token = (process.env.PUMPFUN_AUTH_TOKEN ?? '').trim();
  return token || undefined;
}

export function getPumpfunHeadersPath(): string | undefined {
  const raw = (process.env.PUMPFUN_HEADERS_PATH ?? '').trim();
  return raw || undefined;
}
