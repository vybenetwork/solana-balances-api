#!/usr/bin/env node
/**
 * Extract wallet PnL UI from solana-wallet-pnl-profit-and-loss-api/public/app.js
 * into wallet-pnl-section.js and wallet-pnl-table.js for the balances demo.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PNL_APP = path.resolve(__dirname, '../../solana-wallet-pnl-profit-and-loss-api/public/app.js');
const OUT_DIR = path.resolve(__dirname, '../public');

function sliceLines(lines, start, end) {
  return lines.slice(start - 1, end).join('\n');
}

function patchCommon(src) {
  return src
    .replaceAll('walletPnlDetails', 'walletPnlDetailsEl')
    .replaceAll('walletPnlMeta', 'walletPnlMetaEl')
    .replaceAll("const FALLBACK_LOGO_URL = '/solana-token-placeholder.png';", "const FALLBACK_LOGO_URL = '/token-placeholder.png';")
    .replaceAll('getWalletResolution()', 'WALLET_PNL_RESOLUTION');
}

const lines = fs.readFileSync(PNL_APP, 'utf8').split('\n');

const sharedHeader = `'use strict';

(function () {
const WALLET_PNL_RESOLUTION = '7d';
let walletPnlDetailsEl = null;
let walletPnlMetaEl = null;
let walletPnlLoadingEl = null;
let walletPnlErrorEl = null;
let walletPnl7dEnabledInput = null;
let lastTokenMetrics = [];

function isWalletPnlFetchEnabled() {
  return Boolean(walletPnl7dEnabledInput?.checked);
}

function showWalletPnlError(msg) {
  if (!walletPnlErrorEl) return;
  walletPnlErrorEl.hidden = false;
  walletPnlErrorEl.textContent = msg;
}

function hideWalletPnlError() {
  if (!walletPnlErrorEl) return;
  walletPnlErrorEl.hidden = true;
  walletPnlErrorEl.textContent = '';
}

function setWalletPnlLoading(on) {
  if (!walletPnlLoadingEl) return;
  walletPnlLoadingEl.hidden = !on;
}

function walletPnlTradingLedeInnerHtml() {
  return \`Realized and unrealized PnL plus key trade metrics for the <strong>\${WALLET_PNL_RESOLUTION}</strong> window used when wallet PnL is fetched.\`;
}

`;

const sharedHelpers = patchCommon(
  [
    sliceLines(lines, 27, 39),
    sliceLines(lines, 71, 72),
    sliceLines(lines, 174, 197).replace(/getWalletResolution\(\)/g, 'WALLET_PNL_RESOLUTION'),
    sliceLines(lines, 494, 980),
    sliceLines(lines, 981, 1164),
    sliceLines(lines, 1165, 1187),
    sliceLines(lines, 1321, 1328),
    sliceLines(lines, 2223, 2228),
    sliceLines(lines, 2548, 2636),
  ].join('\n\n'),
);

let buildPlaceholder = patchCommon(sliceLines(lines, 1188, 1295));
buildPlaceholder = buildPlaceholder.replace(
  /const dummyAssetRows[\s\S]*?\.join\(''\);\n/,
  '',
);
buildPlaceholder += "\n`;\n}\n";

let renderWalletPnl = patchCommon(sliceLines(lines, 1823, 2000));
renderWalletPnl = renderWalletPnl.replace(
  /walletPnlMetaEl\.textContent = `Wallet PnL:[^`]+`;\n/,
  '',
);
renderWalletPnl += `
    walletPnlDetailsEl.innerHTML = \`<div class="wallet-pnl-layout">
    <div class="wallet-pnl-sections">\${walletProfileHtml}\${tokenHighlightsHtml}\${pieStackHtml}</div>
    <div class="wallet-pnl-trend-col">\${pnlTradingHtml}\${pnlTrendHtml}</div>
  </div>\`;
    mountWalletPieDonutOverlays(walletPnlDetailsEl, [{ slices: statusSlices }, { slices: winningLosingTradeSlices }]);
    requestAnimationFrame(() => syncWalletPieStackHeights());
    lastTokenMetrics = tokenMetrics;
    if (window.WalletPnlTable) window.WalletPnlTable.onMetricsUpdated(tokenMetrics);
}
`;

const sectionFooter = `
function resetWalletPnlPlaceholder() {
  if (!walletPnlDetailsEl) return;
  if (walletPnlMetaEl) walletPnlMetaEl.textContent = '—';
  walletPnlDetailsEl.innerHTML = buildWalletPnlPlaceholder();
  mountWalletPieDonutOverlays(walletPnlDetailsEl, [{ slices: [] }, { slices: [] }]);
  requestAnimationFrame(() => syncWalletPieStackHeights());
  lastTokenMetrics = [];
  if (window.WalletPnlTable) window.WalletPnlTable.onMetricsUpdated([]);
}

async function fetchWalletPnlForWallet(wallet) {
  if (!walletPnlDetailsEl) return;
  hideWalletPnlError();
  if (!isWalletPnlFetchEnabled()) {
    resetWalletPnlPlaceholder();
    if (walletPnlMetaEl) walletPnlMetaEl.textContent = '7d wallet PnL fetch is disabled.';
    return;
  }
  const ownerAddress = (wallet || '').trim();
  if (!ownerAddress) {
    resetWalletPnlPlaceholder();
    return;
  }
  setWalletPnlLoading(true);
  try {
    const pnlParams = new URLSearchParams({
      resolution: WALLET_PNL_RESOLUTION,
      limit: '1000',
      page: '0',
      sortByDesc: 'realizedPnlUsd',
    });
    const [topRes, pnlRes] = await Promise.all([
      fetch(\`/api/wallets/top-traders?resolution=\${encodeURIComponent(WALLET_PNL_RESOLUTION)}&ilikeFilter=\${encodeURIComponent(ownerAddress)}&limit=1&sortByDesc=realizedPnlUsd\`, { cache: 'no-store' }),
      fetch(\`/api/wallets/\${encodeURIComponent(ownerAddress)}/pnl?\${pnlParams.toString()}\`, { cache: 'no-store' }),
    ]);
    if (!pnlRes.ok) {
      const errBody = await pnlRes.json().catch(() => ({}));
      throw new Error(errBody.error || \`Wallet PnL request failed (\${pnlRes.status})\`);
    }
    const walletPnlData = await pnlRes.json();
    let topTraderRow = null;
    if (topRes.ok) {
      const topData = await topRes.json();
      const list = topData.data ?? [];
      topTraderRow = list.find((row) => (row.accountAddress || '').trim() === ownerAddress) ?? list[0] ?? null;
    }
    renderWalletPnl(ownerAddress, walletPnlData, pnlParams, topTraderRow);
    if (walletPnlMetaEl) {
      walletPnlMetaEl.textContent = \`Wallet PnL: \${(walletPnlData.tokenMetrics ?? []).length} per-token row(s) for the 7d window.\`;
    }
  } catch (err) {
    showWalletPnlError(err instanceof Error ? err.message : String(err));
    if (walletPnlMetaEl) walletPnlMetaEl.textContent = 'Wallet PnL request failed.';
    if (walletPnlDetailsEl) {
      walletPnlDetailsEl.innerHTML = '<div class="token-stats-group wallet-pnl-empty">Wallet PnL unavailable for this wallet.</div>';
    }
    lastTokenMetrics = [];
    if (window.WalletPnlTable) window.WalletPnlTable.onMetricsUpdated([]);
  } finally {
    setWalletPnlLoading(false);
  }
}

window.WalletPnlSection = {
  init(refs) {
    walletPnlDetailsEl = refs.walletPnlDetails;
    walletPnlMetaEl = refs.walletPnlMeta;
    walletPnlLoadingEl = refs.walletPnlLoading;
    walletPnlErrorEl = refs.walletPnlError;
    walletPnl7dEnabledInput = refs.walletPnl7dEnabled;
    resetWalletPnlPlaceholder();
    walletPnl7dEnabledInput?.addEventListener('change', () => {
      const wallet = document.getElementById('wallet')?.value?.trim();
      if (wallet && isWalletPnlFetchEnabled()) fetchWalletPnlForWallet(wallet);
      else resetWalletPnlPlaceholder();
    });
    window.addEventListener('resize', () => syncWalletPieStackHeights());
  },
  fetchForWallet: fetchWalletPnlForWallet,
  resetPlaceholder: resetWalletPnlPlaceholder,
  isEnabled: isWalletPnlFetchEnabled,
  getLastTokenMetrics: () => lastTokenMetrics,
};
})();`;

const sectionJs = sharedHeader + sharedHelpers + '\n' + buildPlaceholder + '\n' + renderWalletPnl + sectionFooter;

// Table module reuses helpers from global scope inside section IIFE — expose render via WalletPnlSection instead.
// Build table as separate IIFE that duplicates only table-specific render.
const tableHelpers = patchCommon(
  [
    sliceLines(lines, 27, 39),
    sliceLines(lines, 174, 197).replace(/getWalletResolution\(\)/g, "'7d'"),
    sliceLines(lines, 494, 625),
    sliceLines(lines, 637, 854),
    sliceLines(lines, 855, 980),
    sliceLines(lines, 1165, 1187),
    sliceLines(lines, 2223, 2228),
  ].join('\n\n'),
);

const assetsTableRender = patchCommon(`
function buildWalletPnlAssetsPlaceholderRows(count) {
  const dash = '—';
  return Array.from({ length: count }, () => \`<tr>
    <td class="wallet-asset-icon-cell">\${dash}</td>
    <td>\${dash}</td>
    <td class="wallet-asset-buysell-amt-cell"><div class="wallet-asset-buysell-amt"><div class="wallet-amt-stack-row"><span class="wallet-amt-stack-value wallet-amt-stack-value--buy">\${dash}</span><span class="wallet-amt-side-icon wallet-amt-side-icon--buy" aria-hidden="true">▲</span></div><div class="wallet-amt-stack-row"><span class="wallet-amt-stack-value wallet-amt-stack-value--sell">\${dash}</span><span class="wallet-amt-side-icon wallet-amt-side-icon--sell" aria-hidden="true">▼</span></div></div></td>
    <td>\${dash}</td><td>\${dash}</td><td>\${dash}</td><td>\${dash}</td><td>\${dash}</td><td>\${dash}</td><td>\${dash}</td><td>\${dash}</td>
    <td class="wallet-asset-tx-cell">\${dash}</td>
  </tr>\`).join('');
}

function renderWalletPnlAssetsTable(tokenMetrics) {
  const metrics = tokenMetrics ?? [];
  const buysTxValues = metrics.map((m) => toNum(m.buys?.transactionCount)).filter((v) => Number.isFinite(v));
  const buysTxMin = buysTxValues.length ? Math.min(...buysTxValues) : 0;
  const buysTxMax = buysTxValues.length ? Math.max(...buysTxValues) : 0;
  const sellsTxValues = metrics.map((m) => toNum(m.sells?.transactionCount)).filter((v) => Number.isFinite(v));
  const sellsTxMin = sellsTxValues.length ? Math.min(...sellsTxValues) : 0;
  const sellsTxMax = sellsTxValues.length ? Math.max(...sellsTxValues) : 0;
  const gainColorBounds = collectWalletGainColorBounds(metrics);
  if (!metrics.length) {
    return buildWalletPnlAssetsPlaceholderRows(8);
  }
  return metrics.map((metric) => {
    const mint = metric.mintAddress || '';
    const symbol = metric.tokenSymbol || metric.tokenName || (mint ? truncateAddress(mint) : '—');
    const tokenLink = mint
      ? \`<a href="https://vybe.fyi/tokens/\${encodeURIComponent(mint)}" target="_blank" class="mono" title="\${mint}">\${symbol}</a>\`
      : symbol;
    const iconCell = renderLogoImage(metric.tokenLogoUrl, symbol, mint);
    const assetCell = mint
      ? \`\${tokenLink}<div class="wallet-asset-mint mono">\${truncateAddress(mint)}</div>\`
      : tokenLink;
    const latestTrade = pickLatestTradeSide(metric);
    return \`<tr>
      <td class="wallet-asset-icon-cell">\${iconCell}</td>
      <td>\${assetCell}</td>
      <td class="wallet-asset-buysell-amt-cell">\${renderWalletAssetBuySellAmtCell(metric)}</td>
      <td>\${renderStatusBadge(metric.status)}</td>
      <td>\${formatUsdCell(metric.realizedPnlUsd)}</td>
      <td>\${formatUsdCell(metric.unrealizedPnlUsd)}</td>
      <td>\${formatTradesCountHeatCell(metric.buys?.transactionCount, buysTxMin, buysTxMax)}</td>
      <td>\${formatTradesCountHeatCell(metric.sells?.transactionCount, sellsTxMin, sellsTxMax)}</td>
      <td><span class="wallet-amt-vol-usd">\${formatUsdFull(metric.buys?.volumeUsd)}</span></td>
      <td><span class="wallet-amt-vol-usd">\${formatUsdFull(metric.sells?.volumeUsd)}</span></td>
      <td style="text-align:center">\${renderWalletAssetGainCell(metric, gainColorBounds)}</td>
      <td class="wallet-asset-tx-cell">\${renderLatestTradeCell(latestTrade.blocktime, latestTrade.signature, latestTrade.label)}</td>
    </tr>\`;
  }).join('');
}

let walletPnlAssetsBodyEl = null;

function refreshWalletPnlAssetsBody() {
  if (!walletPnlAssetsBodyEl) return;
  const metrics = window.WalletPnlSection?.getLastTokenMetrics?.() ?? [];
  walletPnlAssetsBodyEl.innerHTML = renderWalletPnlAssetsTable(metrics);
}

window.WalletPnlTable = {
  init(refs) {
    walletPnlAssetsBodyEl = refs.walletPnlAssetsBody;
    refreshWalletPnlAssetsBody();
  },
  onMetricsUpdated() {
    refreshWalletPnlAssetsBody();
  },
  resetPlaceholder() {
    if (walletPnlAssetsBodyEl) {
      walletPnlAssetsBodyEl.innerHTML = buildWalletPnlAssetsPlaceholderRows(8);
    }
  },
};
`);

const tableJs = `'use strict';\n\n(function () {\n${tableHelpers}\n${assetsTableRender}\n})();\n`;

fs.writeFileSync(path.join(OUT_DIR, 'wallet-pnl-section.js'), sectionJs);
fs.writeFileSync(path.join(OUT_DIR, 'wallet-pnl-table.js'), tableJs);
console.log('Wrote wallet-pnl-section.js and wallet-pnl-table.js');
