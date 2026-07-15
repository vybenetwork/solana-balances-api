/**
 * Optional portfolio dump API: GET /api/v1/owners/:owner/portfolio
 * (raw mint amounts + SOL summary). Requires PORTFOLIO_API_BASE.
 */

import type {
  OwnerPortfolioHolding,
  OwnerPortfolioResponse,
  OwnerPortfolioSolSummary,
} from '../types/api.js';
import { PORTFOLIO_API_BASE, VYBE_TIMEOUT_MS } from '../config.js';
import { NATIVE_SOL_MINT } from './sol-mints.js';

/** Mint used by the portfolio API for native SOL balances. */
export const PORTFOLIO_NATIVE_SOL_MINT = 'NativeSOL1111111111111111111111111111111111';

export function normalizePortfolioMint(mint: string): string {
  const m = mint.trim();
  if (m === PORTFOLIO_NATIVE_SOL_MINT) return NATIVE_SOL_MINT;
  return m;
}

/**
 * Quote wide integer JSON fields as strings so JSON.parse does not lose precision
 * for amounts above Number.MAX_SAFE_INTEGER.
 */
export function parsePortfolioResponseText(text: string): OwnerPortfolioResponse {
  const quotedAmounts = text.replace(/("amount"\s*:\s*)(\d+)/g, '$1"$2"');
  const raw = JSON.parse(quotedAmounts) as {
    owner?: string;
    holdings?: Array<{ amount?: unknown; mint?: unknown; label?: unknown }>;
    sol_summary?: Partial<OwnerPortfolioSolSummary>;
    token_count?: unknown;
    query_time_us?: unknown;
  };

  const holdings: OwnerPortfolioHolding[] = Array.isArray(raw.holdings)
    ? raw.holdings
        .map((row) => {
          const mint = String(row?.mint ?? '').trim();
          if (!mint) return null;
          const amount = String(row?.amount ?? '').trim();
          if (!amount || !/^\d+$/.test(amount)) return null;
          const label =
            typeof row?.label === 'string' && row.label.trim() ? row.label.trim() : undefined;
          return { amount, mint, ...(label ? { label } : {}) };
        })
        .filter((row): row is OwnerPortfolioHolding => row !== null)
    : [];

  const sol = raw.sol_summary ?? {};
  return {
    owner: String(raw.owner ?? '').trim(),
    holdings,
    token_count: Number(raw.token_count) || holdings.length,
    query_time_us: Number(raw.query_time_us) || 0,
    sol_summary: {
      native_sol: Number(sol.native_sol) || 0,
      staked_sol: Number(sol.staked_sol) || 0,
      total_sol_lamports: Number(sol.total_sol_lamports) || 0,
      wrapped_sol: Number(sol.wrapped_sol) || 0,
    },
  };
}

export async function getOwnerPortfolio(ownerAddress: string): Promise<OwnerPortfolioResponse> {
  const owner = ownerAddress.trim();
  if (!owner) throw new Error('Wallet address required');

  if (!PORTFOLIO_API_BASE) {
    throw new Error('PORTFOLIO_API_BASE is required (set it in .env).');
  }
  const url = `${PORTFOLIO_API_BASE}/api/v1/owners/${encodeURIComponent(owner)}/portfolio`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VYBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Portfolio API returned ${res.status} for ${url}: ${text.slice(0, 200)}`);
    }
    return parsePortfolioResponseText(text);
  } finally {
    clearTimeout(timer);
  }
}
