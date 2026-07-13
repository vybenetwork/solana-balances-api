# Solana Wallet Balances API

<p align="center">

[![Demo](https://img.shields.io/badge/Demo-Solana%20Wallet%20Balances%20API%20live%20app-c2410c?style=for-the-badge&logo=googlechrome&logoColor=white)](https://solana-wallet-balances-api.vybenetwork.com)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-5b21b6?style=for-the-badge&logo=github&logoColor=white)](https://github.com/vybenetwork/solana-wallet-balances-api)
[![Wallet balances guide](https://img.shields.io/badge/Guides-Wallet%20balances-3b82f6?style=for-the-badge&logo=gitbook&logoColor=white)](https://docs.vybenetwork.com/docs/token-balances)
[![Wallet token balance API](https://img.shields.io/badge/Endpoint-Wallet%20token%20balance-6366f1?style=for-the-badge&logo=swagger&logoColor=white)](https://docs.vybenetwork.com/reference/get_wallet_tokens_v4)
[![Token details API](https://img.shields.io/badge/Endpoint-Token%20details-8b5cf6?style=for-the-badge&logo=swagger&logoColor=white)](https://docs.vybenetwork.com/reference/get_token_details_v4)
[![X](https://img.shields.io/badge/X-Vybe__Network-000000?style=for-the-badge&logo=x)](https://x.com/Vybe_Network)
</p>

**Solana Wallet Balances API:** Solana wallet balances API: fetch SPL & Token-2022 holdings with on-chain RPC amounts, Vybe metadata, and live USD portfolio values for any Solana wallet. Use this project as a reference implementation or starter kit for portfolio UIs, wallet dashboards, and balance enrichment pipelines.

It includes a production-ready Node.js backend and a modern frontend that integrate Vybe’s wallet token-balance, token details, wallet PnL, and top-traders endpoints—explore holdings tables, USD allocation charts, streaming enrichment, and related wallet PnL context.

Try the live demo: https://solana-wallet-balances-api.vybenetwork.com

![Solana Wallet Balances API app](screenshots/solana-wallet-balances-api-app-demo.jpg)

---

- **[Try the LIVE demo →](https://solana-wallet-balances-api.vybenetwork.com)**
- **[Get your free Vybe API key →](https://vybe.fyi/api-pricing)**
- **[Realtime wallet balances guide →](https://docs.vybenetwork.com/docs/token-balances)**
- **[Wallet token balance endpoint →](https://docs.vybenetwork.com/reference/get_wallet_tokens_v4)**
- **[Token details endpoint →](https://docs.vybenetwork.com/reference/get_token_details_v4)**
- **[GitHub repo →](https://github.com/vybenetwork/solana-wallet-balances-api)**
- **[Telegram →](https://t.me/VybeNetwork_Official)**
- **[X →](https://x.com/Vybe_Network)**

---

## Prerequisites

- **Node.js** ≥ 20 (LTS recommended)
- **npm** ≥ 10 (or equivalent)

## Quick Start

Get from clone to running app in a few commands:

```bash
git clone https://github.com/vybenetwork/solana-wallet-balances-api.git
cd solana-wallet-balances-api
npm install
cp .env.example .env
# Edit .env: set VYBE_DATA_API_KEY (required)
npm start
```

Then open **http://localhost:3001**, paste a Solana wallet address, and load balances. The UI streams holdings when enrichment is enabled and fills missing logos/prices via Jupiter → pump.fun → Vybe token details.

## Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VYBE_DATA_API_KEY` | Yes | Key for wallets/tokens (`VYBE_DATA_API_BASE`) | `your_api_key_here` |
| `VYBE_DATA_API_BASE` | No | Vybe data API base | `https://api.vybenetwork.xyz` |
| `HELIUS_API_KEY` | No | Helius RPC key (used when `SOLANA_RPC_URL` unset) | `your_helius_key` |
| `SOLANA_RPC_URL` | No | Full RPC URL override (wins over `HELIUS_API_KEY`) | `https://api.mainnet-beta.solana.com` |
| `PORT` | No | HTTP server port (default `3001`) | `3001` |
| `PROXY_HOST` + `PROXY_AUTH` | No | HTTP proxy for Jupiter / pump.fun | `geo.iproyal.com:12321` |
| `PUMPFUN_AUTH_TOKEN` | No | Optional pump.fun JWT | `your_jwt` |
| `HTTP_PROXY_POOL_SIZE` | No | Rotating proxy slot count | `10` |
| `HTTP_PROXY_WARMUP` | No | Warm Jupiter/pump.fun at startup | `true` |

Get your API keys at `https://vybe.fyi/api-pricing`.

---

## What This Repo Provides

- **Wallet balances proxy**
  - Express server that proxies / enriches Vybe:
    - `GET /v4/wallets/{ownerAddress}/token-balance` (SPL + Token-2022 + staked SOL)
    - `GET /v4/tokens/{mintAddress}` (token metadata + price fields)
    - `GET /v4/wallets/{ownerAddress}/pnl` and `GET /v4/wallets/top-traders` (related PnL context in the UI)
- **On-chain amount truth**
  - Solana RPC (SPL + Token-2022 + native SOL) as the source of truth for amounts; Vybe for metadata and priced holdings when available.
- **Enrichment pipeline**
  - Discovers mints Vybe missed; resolves logos/prices via Jupiter → pump.fun → Vybe with optional HTTP proxy pool.
- **Streaming UI**
  - NDJSON stream with `initial`, per-token `update`, and `done` events for progressive portfolio loading.
- **Wallet balances web UI**
  - Single-page GUI (no frameworks) in `public/` — holdings table, USD charts, wallet PnL section, and related-demo links.

---

### Solana API docs for these endpoints

- **Realtime wallet balances (guides)**:
  - [https://docs.vybenetwork.com/docs/token-balances](https://docs.vybenetwork.com/docs/token-balances)
- **Wallet token balance (`GET /v4/wallets/{ownerAddress}/token-balance`)**:
  - [https://docs.vybenetwork.com/reference/get_wallet_tokens_v4](https://docs.vybenetwork.com/reference/get_wallet_tokens_v4)
- **Token details (`GET /v4/tokens/{mintAddress}`)**:
  - [https://docs.vybenetwork.com/reference/get_token_details_v4](https://docs.vybenetwork.com/reference/get_token_details_v4)
- **Wallet PnL (`GET /v4/wallets/{ownerAddress}/pnl`)**:
  - [https://docs.vybenetwork.com/reference/get_wallet_pnl_v4](https://docs.vybenetwork.com/reference/get_wallet_pnl_v4)
- **Top traders (`GET /v4/wallets/top-traders`)**:
  - [https://docs.vybenetwork.com/reference/get_top_traders_v4](https://docs.vybenetwork.com/reference/get_top_traders_v4)
- **DeFi positions (`GET /v4/wallets/{ownerAddress}/defi-positions`)**:
  - [https://docs.vybenetwork.com/reference/get_defi_accounts_v4_proxy](https://docs.vybenetwork.com/reference/get_defi_accounts_v4_proxy)

---

## Why Wallet Balance APIs Matter

Wallet token-balance APIs are critical for:

- **Portfolio UIs**: show holdings, USD value, and 24h/7d changes before a user trades.
- **Dust / enrichment**: fill missing logos and prices for long-tail mints.
- **Wallet analytics**: pair balances with PnL and top-trader context.
- **Production safety**: prefer on-chain amounts while using Vybe for priced metadata.

This repo shows how to build a **practical wallet balances explorer** on top of Vybe’s wallet and token endpoints.

---

## Server Proxy Routes

The Express server in `src/server.ts` exposes:

- **`GET /api/wallets/:ownerAddress/token-balances`**
  - Query: `limit`, `stream`, `enrich`, `enrichLimit` — wallet SPL holdings with optional NDJSON stream.
- **`GET /api/token/:mint`**
  - Resolve token metadata and USD price for a single mint.
- **`GET /api/wallets/:ownerAddress/pnl`**
  - Proxies Vybe wallet PnL for the UI PnL section.
- **`GET /api/wallets/top-traders`**
  - Proxies Vybe top traders / related wallets.
- **`GET /health`**
  - Service status and configured backends.
- **`GET /cached/token-icons/*`**
  - Cached token icon assets.

All Vybe requests use a shared client (`src/api/client.ts`) with timeouts, retries, and human-readable errors (`toHumanReadableError`).

---

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm start` / `npm run dev` | Run Express server (`tsx src/server.ts`) |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run typecheck` | Typecheck without emit |
| `npm run dump:vybe-wallet` | Dump raw Vybe wallet token-balance for a wallet |
| `npm run deploy:vm` / `npm run redeploy:vm` | Production VM deploy helpers |

---

## How to Run

### 1. Clone the repository

```bash
git clone https://github.com/vybenetwork/solana-wallet-balances-api.git
cd solana-wallet-balances-api
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set your API key

```bash
cp .env.example .env
# Set VYBE_DATA_API_KEY
```

### 4. Run the server + web app

```bash
npm start
```

Then open **http://localhost:3001**. Paste a wallet address and load balances to inspect holdings, USD allocation, and enrichment updates.

---

## Project Structure

```text
solana-wallet-balances-api/
├── .env.example           # Copy to .env — VYBE_DATA_API_KEY, optional HELIUS / RPC / proxy
├── package.json
├── README.md
├── screenshots/           # Screenshots referenced in this README
├── public/                # Web GUI (HTML, CSS, JS)
│   ├── index.html
│   ├── app.css
│   ├── app.js
│   ├── solana-wallet-balances-api.jpg
│   └── …
├── tools/                 # Dump / benchmark helpers
└── src/
    ├── server.ts          # Express server; proxies Vybe API and serves public/
    ├── config.ts
    ├── token-icon-cache.ts
    ├── types/
    └── api/
        ├── client.ts
        ├── wallet-balance.ts
        ├── wallet-pnl.ts
        ├── tokens.ts
        ├── resolve-token-meta.ts
        ├── jupiter-token-fallback.ts
        ├── pumpfun-price-fallback.ts
        └── …
```

---

## Direct API Usage Example

```typescript
const base = 'http://localhost:3001';
const owner = 'YOUR_WALLET_PUBKEY';

const res = await fetch(
  `${base}/api/wallets/${owner}/token-balances?limit=100&enrich=1`,
);
const { tokens } = await res.json();
console.log(tokens.slice(0, 3));
```

Or call Vybe directly:

```typescript
import axios from 'axios';

const API = 'https://api.vybenetwork.xyz';
const headers = { 'X-API-KEY': process.env.VYBE_DATA_API_KEY!, Accept: 'application/json' };

async function fetchWalletBalances(ownerAddress: string) {
  const { data } = await axios.get(`${API}/v4/wallets/${ownerAddress}/token-balance`, {
    params: { limit: 100, sortByDesc: 'valueUsd' },
    headers,
  });
  return data;
}
```

---

## Troubleshooting

| Issue | What to do |
|-------|------------|
| **403 Forbidden** | Verify `VYBE_DATA_API_KEY` in `.env` is correct and has wallet/token access. |
| **Empty / partial holdings** | Enable `enrich=1` (or stream) so RPC-only mints get Jupiter/pump.fun/Vybe metadata. |
| **Missing logos / prices** | Check proxy env (`PROXY_HOST` / `PROXY_AUTH`) if outbound Jupiter/pump.fun calls are blocked. |
| **Slow responses / timeouts** | Lower `limit` / `enrichLimit`, or disable enrichment for a fast JSON snapshot. |
| **Missing env vars** | Ensure you copied `.env.example` to `.env` and set `VYBE_DATA_API_KEY`. |

---

## Support

- **Telegram:** [VybeNetwork Official](https://t.me/VybeNetwork_Official)
- **X:** [@Vybe_Network](https://x.com/Vybe_Network)
- **GitHub:** [solana-wallet-balances-api](https://github.com/vybenetwork/solana-wallet-balances-api)
- **Support ticket:** [Submit a ticket via vybenetwork.com](https://vybenetwork.com)
