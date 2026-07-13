/**
 * When Vybe + Jupiter have no metadata, label the mint from its on-chain owner program.
 */

import { PublicKey } from '@solana/web3.js';
import { createSolanaConnection } from './solana-connection.js';
import { cacheTokenMetaFromVybe, type CachedTokenMeta } from '../token-icon-cache.js';

export const SPL_TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

export type MintProgramLabel = 'SPL' | 'TOKEN2022';

export function isProgramFallbackLabel(symbol: string): boolean {
  const s = String(symbol ?? '').trim().toUpperCase();
  return s === 'SPL' || s === 'TOKEN2022';
}

/** Read mint account owner → SPL or TOKEN2022. */
export async function detectMintProgramLabel(mint: string): Promise<MintProgramLabel | null> {
  const m = mint.trim();
  if (!m) return null;
  try {
    const connection = createSolanaConnection('mint-program-label', 'processed');
    const info = await connection.getAccountInfo(new PublicKey(m), 'processed');
    if (!info) return null;
    const owner = info.owner.toBase58();
    if (owner === SPL_TOKEN_PROGRAM_ID) return 'SPL';
    if (owner === TOKEN_2022_PROGRAM_ID) return 'TOKEN2022';
    return null;
  } catch (err) {
    console.warn(
      `[mint-program-label] ${m.slice(0, 8)}… failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/** Cache SPL / TOKEN2022 placeholder symbol+name when upstream meta is missing. */
export async function cacheMintProgramLabelFallback(
  mint: string,
): Promise<CachedTokenMeta | null> {
  const label = await detectMintProgramLabel(mint);
  if (!label) return null;
  return cacheTokenMetaFromVybe(mint, {
    mintAddress: mint,
    symbol: label,
    name: label,
    tokenProgram: label === 'SPL' ? SPL_TOKEN_PROGRAM_ID : TOKEN_2022_PROGRAM_ID,
    priceFetchedAt: Date.now(),
    priceSource: 'RPC',
  });
}
