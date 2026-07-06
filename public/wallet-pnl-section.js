'use strict';

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
  return `Realized and unrealized PnL plus key trade metrics for the <strong>${WALLET_PNL_RESOLUTION}</strong> window used when wallet PnL is fetched.`;
}

const VOLUME_PNL_PIE_NONPOSITIVE_FILL = { dark: '#dc2626', light: '#f87171' };
function tradeScaleHue(t) {
    const clamped = Math.min(1, Math.max(0, t));
    return 120 - clamped * 120;
}
/** Two stops matching `.token-pnl-bar-fill--trade-scale` (85%/42% → 92%/60%). */
function tradeScaleBarGradientPair(t) {
    const h = tradeScaleHue(t);
    return {
        dark: `hsl(${h} 85% 42%)`,
        light: `hsl(${h} 92% 60%)`,
    };
}

const TIER_LEGEND_SVG_STACK = '<svg class="token-tier-metric__svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 10h16v2H4v-2zm0-4h16v2H4V6zm0 8h16v2H4v-2z"/></svg>';
const TIER_LEGEND_SVG_VOLUME = '<svg class="token-tier-metric__svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 12h4v8H3v-8zm7-4h4v12h-4V8zm7 6h4v6h-4v-6z"/></svg>';

const FALLBACK_LOGO_URL = '/token-placeholder.png';
/** CoinMarketCap generic icon for pump.fun–style tokens when the API supplies no logo. */
const PUMP_MINT_FALLBACK_LOGO_URL = 'https://s2.coinmarketcap.com/static/img/coins/64x64/36507.png';
const WALLET_PNL_TREND_LEDE = 'Each row is a snapshot of cumulative realized PnL through that moment. See whether the wallet was building gains, giving them back, or chopping sideways across the last seven days.';
/** Shapes placeholder wallet PnL to match loaded layout (stable column heights). */
const WALLET_PNL_PLACEHOLDER_ASSET_ROW_COUNT = 12;
const TOKEN_TOP_PNL_PLACEHOLDER_ROW_COUNT = 12;
function buildTokenTopPnlPlaceholderRowsHtml() {
    const row = '<tr><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td class="token-top-pnl-24h-col">—</td><td>—</td><td class="token-top-pnl-24h-col">—</td></tr>';
    return Array.from({ length: TOKEN_TOP_PNL_PLACEHOLDER_ROW_COUNT }, () => row).join('');
}
function walletPnlTradingLedeInnerHtml() {
    const r = WALLET_PNL_RESOLUTION;
    return `Realized and unrealized PnL plus key trade metrics for the <strong>${r}</strong> window used when wallet PnL is fetched.`;
}
function resolveTokenLogoSrc(logoUrl, mintAddress) {
    const trimmed = (logoUrl || '').trim();
    if (trimmed)
        return trimmed;
    const mint = (mintAddress || '').trim();
    if (mint.endsWith('pump'))
        return PUMP_MINT_FALLBACK_LOGO_URL;
    return '';
}

function truncateAddress(addr) {
    if (!addr || addr.length <= 12)
        return addr ?? '';
    return `${addr.slice(0, 4)}....${addr.slice(-4)}`;
}
/** Mint in token stats: `AAAAA....BBBBB` for long addresses (full value in `title`). */
function truncateMintMiddle(mint, head = 5, tail = 5) {
    const m = (mint || '').trim();
    if (!m)
        return '';
    if (m.length <= head + tail + 4)
        return m;
    return `${m.slice(0, head)}....${m.slice(-tail)}`;
}
const TOKEN_HIGHLIGHT_NAME_MAX_LEN = 12;
function escapeHtmlAttr(value) {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
function escapeHtmlText(value) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function truncateTokenHighlightLinkText(text) {
    const t = text.trim();
    if (t.length <= TOKEN_HIGHLIGHT_NAME_MAX_LEN)
        return t;
    return `${t.slice(0, TOKEN_HIGHLIGHT_NAME_MAX_LEN)}...`;
}
function renderTruncatedTokenMintLink(token, pnlUsd) {
    const mint = (token.mintAddress || '').trim();
    if (!mint)
        return '—';
    const raw = token.tokenSymbol || token.tokenName || truncateAddress(mint);
    const titleAttr = escapeHtmlAttr(`${raw} · ${mint}`);
    const pnlPart = pnlUsd != null ? ` (${formatUsdFull(pnlUsd)})` : '';
    return `<a href="https://vybe.fyi/tokens/${encodeURIComponent(mint)}" target="_blank" class="mono" title="${titleAttr}">${truncateTokenHighlightLinkText(raw)}</a>${pnlPart}`;
}
function formatNum(n) {
    if (n == null)
        return '—';
    if (typeof n === 'number') {
        if (n >= 1e9)
            return (n / 1e9).toFixed(2) + 'B';
        if (n >= 1e6)
            return (n / 1e6).toFixed(2) + 'M';
        if (n >= 1e3)
            return (n / 1e3).toFixed(2) + 'K';
        return n.toFixed(4);
    }
    return String(n);
}
function formatInt(n) {
    if (n == null)
        return '—';
    const num = Number(n);
    if (Number.isNaN(num))
        return '—';
    if (num >= 1e9)
        return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6)
        return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3)
        return (num / 1e3).toFixed(2) + 'K';
    return Math.round(num).toLocaleString();
}
/**
 * Compact $ suffix for |value| > 9999 — whole-number K / M / B only (no fractional part).
 */
function formatUsdCompactCore(abs) {
    if (abs >= 1e9) {
        return `${Math.round(abs / 1e9)}B`;
    }
    if (abs >= 1e6) {
        return `${Math.round(abs / 1e6)}M`;
    }
    const k = Math.round(abs / 1e3);
    if (k >= 1000) {
        return `${Math.round(abs / 1e6)}M`;
    }
    return `${k}K`;
}
function formatUsdFull(n) {
    if (n == null)
        return '—';
    const num = Number(n);
    if (Number.isNaN(num))
        return '—';
    const roundedToCent = Math.round(num * 100) / 100;
    if (roundedToCent === 0) {
        if (num > 0 && num < 0.01)
            return '$0.01';
        return '$0';
    }
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    if (abs < 1)
        return `${sign}$${abs.toFixed(2)}`;
    if (abs > 9999) {
        return `${sign}$${formatUsdCompactCore(abs)}`;
    }
    return `${sign}$${Math.abs(Math.round(num)).toLocaleString()}`;
}
function usdToneClass(n) {
    const num = Number(n);
    if (!Number.isFinite(num))
        return 'usd-tone--neutral';
    if (num > 0)
        return 'usd-tone--positive';
    if (num < 0)
        return 'usd-tone--negative';
    return 'usd-tone--neutral';
}
function formatUsdCell(n) {
    return `<span class="usd-tone ${usdToneClass(n)}">${formatUsdFull(n)}</span>`;
}
/**
 * Top PnL traders table only: no K/M suffixes; `B` only for ≥ $1B. No fractional dollars unless amount is below $1.
 */
function formatUsdTokenTopPnlTable(n) {
    if (n == null)
        return '—';
    const num = Number(n);
    if (Number.isNaN(num))
        return '—';
    if (num === 0)
        return '$0';
    const sign = num < 0 ? '-' : '';
    const abs = Math.abs(num);
    if (abs < 1) {
        return `${sign}$${abs.toFixed(2)}`;
    }
    if (abs >= 1e9) {
        return `${sign}$${Math.round(abs / 1e9)}B`;
    }
    return `${sign}$${Math.round(abs).toLocaleString()}`;
}
function formatUsdCellTokenTopPnl(n) {
    return `<span class="usd-tone ${usdToneClass(n)}">${formatUsdTokenTopPnlTable(n)}</span>`;
}
/** Realized PnL ÷ volume for the row (RoV %); used in top-PnL table, not the volume-by-PnL pie. */
function formatRovPctCell(row) {
    const pct = traderRoiPercentFromRow(row);
    if (pct == null)
        return '<span class="usd-tone usd-tone--neutral">—</span>';
    return `<span class="usd-tone ${usdToneClass(pct)}">${formatPctSmart(pct)}</span>`;
}
/** Sell USD volume ÷ buy USD volume. */
function computeWalletAssetGainRatio(buyVolUsd, sellVolUsd) {
    const buy = Number(buyVolUsd);
    const sell = Number(sellVolUsd);
    if (!Number.isFinite(buy) || buy <= 0 || !Number.isFinite(sell) || sell < 0)
        return null;
    const ratio = sell / buy;
    if (!Number.isFinite(ratio) || ratio <= 0)
        return null;
    return ratio;
}
/** Ratio under 5 → two decimals + "x", else floored integer + "x". */
function formatGainMultiplierLabel(ratio) {
    if (ratio < 5) {
        return `${ratio.toFixed(2)}x`;
    }
    return `${Math.floor(ratio)}x`;
}
/** Mean sell/buy gain for assets-table rows with ratio > 1 vs ≤ 1 (same ratio as Gain column). */
function avgGainMultFromTableByGainGroups(metrics) {
    const aboveOne = [];
    const atOrBelowOne = [];
    for (const m of metrics) {
        const ratio = computeWalletAssetGainRatio(m.buys?.volumeUsd, m.sells?.volumeUsd);
        if (ratio == null)
            continue;
        if (ratio > 1)
            aboveOne.push(ratio);
        else
            atOrBelowOne.push(ratio);
    }
    const sum = (xs) => xs.reduce((a, b) => a + b, 0);
    return {
        aboveOneAvg: aboveOne.length ? sum(aboveOne) / aboveOne.length : null,
        atOrBelowOneAvg: atOrBelowOne.length ? sum(atOrBelowOne) / atOrBelowOne.length : null,
    };
}
function formatWinLoseTradesChipValueHtml(count, avgMult, tone) {
    const countStr = formatIntFull(count);
    const posNegClass = tone === 'pos' ? 'usd-tone usd-tone--positive' : 'usd-tone usd-tone--negative';
    if (countStr === '—') {
        return `<span class="usd-tone usd-tone--neutral">${countStr}</span>`;
    }
    if (avgMult == null || !Number.isFinite(avgMult)) {
        return `<span class="${posNegClass}"><span class="wallet-pnl-trade-chip-count">${countStr}</span></span>`;
    }
    return `<span class="${posNegClass}"><span class="wallet-pnl-trade-chip-count">${countStr}</span><span class="wallet-pnl-trade-chip-avg"> (${formatGainMultiplierLabel(avgMult)} Avg)</span></span>`;
}
const GAIN_ONE_X_EPS = 0.0005;
/** Light end of the >1× range (weakest gain still above 1). */
const GAIN_GREEN_LIGHT = '#86efac';
/** Saturated green for the best (highest) gain in the response. */
const GAIN_GREEN_NORMAL = '#22c55e';
const GAIN_YELLOW = '#eab308';
/** Saturated red for the worst (lowest) gain below 1. */
const GAIN_RED_NORMAL = '#ef4444';
/** Light red closest to 1× among losers. */
const GAIN_RED_LIGHT = '#f87171';
function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
    };
}
function lerpChannel(a, b, t) {
    return Math.round(a + (b - a) * t);
}
function lerpHex(from, to, t) {
    const u = Math.max(0, Math.min(1, t));
    const A = hexToRgb(from);
    const B = hexToRgb(to);
    return `#${lerpChannel(A.r, B.r, u).toString(16).padStart(2, '0')}${lerpChannel(A.g, B.g, u)
        .toString(16)
        .padStart(2, '0')}${lerpChannel(A.b, B.b, u).toString(16).padStart(2, '0')}`;
}
/** `h`, `s`, `l` as in CSS: hue 0–360, saturation and lightness 0–100. */
function hslToHex(h, s, l) {
    const H = ((h % 360) + 360) % 360;
    const S = Math.max(0, Math.min(100, s)) / 100;
    const L = Math.max(0, Math.min(100, l)) / 100;
    const c = (1 - Math.abs(2 * L - 1)) * S;
    const x = c * (1 - Math.abs(((H / 60) % 2) - 1));
    const m = L - c / 2;
    let rp = 0;
    let gp = 0;
    let bp = 0;
    if (H < 60) {
        rp = c;
        gp = x;
    }
    else if (H < 120) {
        rp = x;
        gp = c;
    }
    else if (H < 180) {
        gp = c;
        bp = x;
    }
    else if (H < 240) {
        gp = x;
        bp = c;
    }
    else if (H < 300) {
        rp = x;
        bp = c;
    }
    else {
        rp = c;
        bp = x;
    }
    const r = Math.round((rp + m) * 255);
    const g = Math.round((gp + m) * 255);
    const b = Math.round((bp + m) * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
function parseHslCss(input) {
    const m = input.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/);
    if (!m)
        return null;
    return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}
function collectWalletGainColorBounds(metrics) {
    const aboveOne = [];
    const belowOneClosed = [];
    for (const m of metrics) {
        const r = computeWalletAssetGainRatio(m.buys?.volumeUsd, m.sells?.volumeUsd);
        if (r == null)
            continue;
        if (r > 1 + GAIN_ONE_X_EPS)
            aboveOne.push(r);
        else if (r < 1 - GAIN_ONE_X_EPS && isWalletPositionClosed(m.status))
            belowOneClosed.push(r);
    }
    return {
        minAbove1: aboveOne.length ? Math.min(...aboveOne) : null,
        maxAbove1: aboveOne.length ? Math.max(...aboveOne) : null,
        minBelow1: belowOneClosed.length ? Math.min(...belowOneClosed) : null,
        maxBelow1: belowOneClosed.length ? Math.max(...belowOneClosed) : null,
    };
}
function gainMultiplierDisplayColor(ratio, b, status) {
    if (Math.abs(ratio - 1) <= GAIN_ONE_X_EPS) {
        return GAIN_YELLOW;
    }
    if (ratio > 1) {
        if (b.minAbove1 == null || b.maxAbove1 == null)
            return GAIN_GREEN_NORMAL;
        const span = b.maxAbove1 - b.minAbove1;
        if (span <= 1e-9)
            return GAIN_GREEN_NORMAL;
        const t = (ratio - b.minAbove1) / span;
        return lerpHex(GAIN_GREEN_LIGHT, GAIN_GREEN_NORMAL, t);
    }
    if (!isWalletPositionClosed(status)) {
        return GAIN_YELLOW;
    }
    if (b.minBelow1 == null || b.maxBelow1 == null)
        return GAIN_RED_NORMAL;
    const span = b.maxBelow1 - b.minBelow1;
    if (span <= 1e-9)
        return GAIN_RED_NORMAL;
    const t = (ratio - b.minBelow1) / span;
    return lerpHex(GAIN_RED_NORMAL, GAIN_RED_LIGHT, t);
}
function renderWalletAssetGainCell(metric, bounds) {
    const ratio = computeWalletAssetGainRatio(metric.buys?.volumeUsd, metric.sells?.volumeUsd);
    if (ratio == null)
        return '—';
    const color = gainMultiplierDisplayColor(ratio, bounds, metric.status);
    const label = formatGainMultiplierLabel(ratio);
    return `<span class="wallet-asset-gain" style="color:${color}">${label}</span>`;
}
function formatIntFull(n) {
    if (n == null)
        return '—';
    const num = Number(n);
    if (!Number.isFinite(num))
        return '—';
    return Math.round(num).toLocaleString();
}
function formatTradesCountCell(n) {
    const text = formatIntFull(n);
    if (text === '—')
        return text;
    const num = Number(n);
    if (num === 0) {
        return `<span class="usd-tone usd-tone--neutral">${text}</span>`;
    }
    return text;
}
function calcTradeGradientT(n, min, max) {
    const value = Number(n);
    if (!Number.isFinite(value))
        return 0;
    if (!Number.isFinite(min) || !Number.isFinite(max))
        return 0;
    const safeMax = Math.max(min, max);
    const greenThreshold = 9;
    if (value <= greenThreshold || safeMax <= greenThreshold)
        return 0;
    const normalized = (value - greenThreshold) / (safeMax - greenThreshold);
    const clamped = Math.max(0, Math.min(1, normalized));
    // Any value above 9 should start shifting away from pure green.
    return 0.2 + (clamped * 0.8);
}
function formatTradesCountHeatCell(n, min, max) {
    const text = formatIntFull(n);
    if (text === '—')
        return text;
    const num = Number(n);
    if (num === 0) {
        return `<span class="usd-tone usd-tone--neutral">${text}</span>`;
    }
    const t = calcTradeGradientT(n, min, max);
    const hardT = num > 300 ? 1 : num > 100 ? 0.8 : t;
    return `<span class="trade-count-heat" style="--trade-grad-t:${hardT.toFixed(4)}">${text}</span>`;
}
function pickPreferredNumber(preferred, fallback) {
    const preferredNum = Number(preferred);
    if (Number.isFinite(preferredNum))
        return preferredNum;
    const fallbackNum = Number(fallback);
    if (Number.isFinite(fallbackNum))
        return fallbackNum;
    return undefined;
}
function pickPreferredString(preferred, fallback) {
    const preferredText = (preferred ?? '').trim();
    if (preferredText)
        return preferredText;
    const fallbackText = (fallback ?? '').trim();
    return fallbackText || undefined;
}
function pickPreferredList(preferred, fallback) {
    if (Array.isArray(preferred) && preferred.length > 0)
        return preferred;
    if (Array.isArray(fallback) && fallback.length > 0)
        return fallback;
    return undefined;
}
function mergeTokenRef(preferred, fallback) {
    if (!preferred && !fallback)
        return undefined;
    return {
        mintAddress: pickPreferredString(preferred?.mintAddress, fallback?.mintAddress),
        pnlUsd: pickPreferredNumber(preferred?.pnlUsd, fallback?.pnlUsd),
        tokenName: pickPreferredString(preferred?.tokenName, fallback?.tokenName),
        tokenSymbol: pickPreferredString(preferred?.tokenSymbol, fallback?.tokenSymbol),
        tokenLogoUrl: pickPreferredString(preferred?.tokenLogoUrl, fallback?.tokenLogoUrl),
    };
}
function mergeWalletSummary(walletSummary, topMetrics) {
    return {
        averageTradeUsd: pickPreferredNumber(walletSummary?.averageTradeUsd, undefined),
        bestPerformingToken: mergeTokenRef(walletSummary?.bestPerformingToken, topMetrics?.bestPerformingToken),
        losingTradesCount: pickPreferredNumber(walletSummary?.losingTradesCount, undefined),
        pnlTrendSevenDays: pickPreferredList(walletSummary?.pnlTrendSevenDays, topMetrics?.sevenDayPnl),
        realizedPnlUsd: pickPreferredNumber(walletSummary?.realizedPnlUsd, topMetrics?.realizedPnlUsd),
        tradesCount: pickPreferredNumber(walletSummary?.tradesCount, topMetrics?.tradesCount),
        tradesVolumeUsd: pickPreferredNumber(walletSummary?.tradesVolumeUsd, topMetrics?.tradesVolumeUsd),
        uniqueTokensTraded: pickPreferredNumber(walletSummary?.uniqueTokensTraded, topMetrics?.uniqueTokensTraded),
        unrealizedPnlUsd: pickPreferredNumber(walletSummary?.unrealizedPnlUsd, topMetrics?.unrealizedPnlUsd),
        winRate: pickPreferredNumber(walletSummary?.winRate, topMetrics?.winRate),
        winningTradesCount: pickPreferredNumber(walletSummary?.winningTradesCount, undefined),
        worstPerformingToken: mergeTokenRef(walletSummary?.worstPerformingToken, topMetrics?.worstPerformingToken),
    };
}
function renderLogoImage(url, alt, tokenMint) {
    const src = tokenMint !== undefined
        ? resolveTokenLogoSrc(url, tokenMint) || FALLBACK_LOGO_URL
        : (url || '').trim() || FALLBACK_LOGO_URL;
    return `<img src="${src}" alt="${alt}" class="wallet-logo-avatar" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_LOGO_URL}'" />`;
}
function renderWalletProfileAvatar(url, alt) {
    const src = (url || '').trim() || FALLBACK_LOGO_URL;
    return `<img src="${src}" alt="${alt}" class="wallet-pnl-profile-avatar" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_LOGO_URL}'" />`;
}
function formatBlocktime(blocktime) {
    const num = Number(blocktime);
    if (!Number.isFinite(num) || num <= 0)
        return '—';
    const d = new Date(num * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const dd = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const yy = pad(d.getFullYear() % 100);
    return `${hh}:${mm} ${dd}/${month}/${yy}`;
}
/** e.g. "Saturday April 24 17:00" (local), for 7d PnL trend table */
function formatPnlTrendPointTime(tsMs) {
    const d = new Date(tsMs);
    if (Number.isNaN(d.getTime()))
        return '—';
    const weekday = d.toLocaleString('en-US', { weekday: 'long' });
    const month = d.toLocaleString('en-US', { month: 'long' });
    const day = d.getDate();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${weekday} ${month} ${day} ${hh}:${mm}`;
}
function renderSignaturePopupLink(signature, label = 'Open TX') {
    const sig = (signature || '').trim();
    if (!sig)
        return '—';
    const href = `https://solscan.io/tx/${encodeURIComponent(sig)}`;
    const lowerLabel = label.toLowerCase();
    const toneClass = lowerLabel.includes('buy')
        ? 'wallet-tx-tone--buy'
        : lowerLabel.includes('sell')
            ? 'wallet-tx-tone--sell'
            : '';
    return `<a href="${href}" target="_blank" class="wallet-tx-link ${toneClass}" title="${sig}" onclick="window.open(this.href,'solscanTx','popup=yes,width=1100,height=780'); return false;">${label}<span class="wallet-tx-popup-icon" aria-hidden="true">↗</span></a>`;
}
function renderLatestTradeCell(blocktime, signature, label = 'Open TX') {
    return `<div class="wallet-tx-datetime">${formatBlocktime(blocktime)}</div>${renderSignaturePopupLink(signature, label)}`;
}
function pickLatestTradeSide(metric) {
    const buyBlock = Number(metric.buys?.latestTradeBlocktime);
    const sellBlock = Number(metric.sells?.latestTradeBlocktime);
    const hasBuy = Number.isFinite(buyBlock) && buyBlock > 0;
    const hasSell = Number.isFinite(sellBlock) && sellBlock > 0;
    if (hasBuy && (!hasSell || buyBlock >= sellBlock)) {
        return {
            blocktime: buyBlock,
            signature: (metric.buys?.latestTradeSignature || '').trim() || undefined,
            label: 'Open Buy TX',
        };
    }
    if (hasSell) {
        return {
            blocktime: sellBlock,
            signature: (metric.sells?.latestTradeSignature || '').trim() || undefined,
            label: 'Open Sell TX',
        };
    }
    return {
        blocktime: Number(metric.latestTradeBlocktime) || undefined,
        signature: undefined,
        label: 'Open TX',
    };
}

function walletPieLegendUsesAvgRow(pieTitle) {
    const t = pieTitle.toLowerCase();
    return t.includes('winning') && t.includes('losing');
}
function walletPieCountUnitWord(pieTitle) {
    const t = pieTitle.toLowerCase();
    return t.includes('position') ? 'positions' : 'trades';
}
/** Same normalization as {@link renderWalletPieCard} conic gradient slices. */
function normalizedWalletPieSlices(slices) {
    const normalized = slices
        .map((slice) => ({ ...slice, value: Math.max(0, Number(slice.value) || 0) }))
        .filter((slice) => slice.value > 0);
    const total = normalized.reduce((sum, slice) => sum + slice.value, 0);
    if (total <= 0)
        return null;
    return {
        pctSlices: normalized.map((slice) => (slice.value / total) * 100),
        fills: normalized.map((slice) => slice.color),
        total,
    };
}
/**
 * Wallet donut charts share token-mode SVG slice labels ({@link mountDonutPieOverlays}); center hub is omitted.
 */
function mountWalletPieDonutOverlays(root, configs) {
    const pies = root.querySelectorAll('.wallet-pnl-card--pie .wallet-pnl-pie-chart.token-supply-pie');
    pies.forEach((pie, i) => {
        const cfg = configs[i];
        clearDonutPieOverlays(pie);
        if (!cfg) {
            pie.style.background = buildPieGradientWithGaps([1], ['#27272a']);
            return;
        }
        const norm = normalizedWalletPieSlices(cfg.slices);
        if (!norm) {
            pie.style.background = buildPieGradientWithGaps([1], ['#27272a']);
            return;
        }
        pie.style.background = buildPieGradientWithGaps(norm.pctSlices, norm.fills);
        mountDonutPieOverlays(pie, norm.pctSlices, norm.fills, null, { showSliceLabels: false });
    });
}
/** >1× green/up, ~1× yellow/O, <1× red/down (same ε as gain-ratio grouping). */
function walletPieAvgGainTone(mult) {
    if (mult > 1 + GAIN_ONE_X_EPS)
        return 'up';
    if (mult < 1 - GAIN_ONE_X_EPS)
        return 'down';
    return 'flat';
}
function buildWalletPieAvgGainRow(mult) {
    if (mult == null || !Number.isFinite(mult)) {
        return {
            bodyHtml: `<span class="token-tier-metric__muted">${escapeHtmlText('—')}</span>`,
            iconTone: 'neutral',
            iconChar: '',
        };
    }
    const t = walletPieAvgGainTone(mult);
    const iconChar = t === 'up' ? '↑' : t === 'down' ? '↓' : 'O';
    const multClass = t === 'up'
        ? 'token-tier-wallet-avg-mult token-tier-wallet-avg-mult--up'
        : t === 'down'
            ? 'token-tier-wallet-avg-mult token-tier-wallet-avg-mult--down'
            : 'token-tier-wallet-avg-mult token-tier-wallet-avg-mult--flat';
    return {
        bodyHtml: `<span class="${multClass}">${escapeHtmlText(formatGainMultiplierLabel(mult))}</span><span class="token-tier-metric__muted"> Avg</span>`,
        iconTone: t,
        iconChar,
    };
}
/** One slice card: title + share row + count row + optional avg row (token-tier-card pattern). */
function walletPieLegendTierCardHtml(opts) {
    const ph = opts.placeholder ? ' token-tier-card--placeholder' : '';
    const avgLi = opts.avgRow != null
        ? `<li class="token-tier-metric">
          <span class="token-tier-metric__ico token-tier-metric__ico--pnl token-tier-metric__ico--wallet-avg token-tier-metric__ico--wallet-avg--${opts.avgRow.iconTone}" aria-hidden="true">${opts.avgRow.iconChar}</span>
          <div class="token-tier-metric__body">${opts.avgRow.bodyHtml}</div>
        </li>`
        : '';
    return `<div class="token-supply-legend-item token-supply-legend-item--tier-dashboard">
    <article class="token-tier-card token-tier-card--wallet-pie-legend${ph}" style="--tier-accent:${opts.accent}">
      <h4 class="token-tier-card__title token-tier-card__title--wallet-pie">${opts.titleEscaped}</h4>
      <ul class="token-tier-card__metrics token-tier-card__metrics--wallet-pie-expanded">
        <li class="token-tier-metric">
          <span class="token-tier-metric__ico token-tier-metric__ico--share-swatch" style="--tier-swatch:${opts.swatchBg}" aria-hidden="true"></span>
          <div class="token-tier-metric__body">${opts.pctBodyHtml}</div>
        </li>
        <li class="token-tier-metric">
          <span class="token-tier-metric__ico token-tier-metric__ico--layers" aria-hidden="true">${TIER_LEGEND_SVG_STACK}</span>
          <div class="token-tier-metric__body">${opts.countBodyHtml}</div>
        </li>
        ${avgLi}
      </ul>
    </article>
  </div>`;
}
function walletPieDefaultSlices(title) {
    const t = title.toLowerCase();
    if (t.includes('winning') && t.includes('losing')) {
        return [
            { label: 'Winning Trades', value: 0, color: tradeScaleBarGradientPair(0) },
            { label: 'Losing Trades', value: 0, color: VOLUME_PNL_PIE_NONPOSITIVE_FILL },
        ];
    }
    if (t.includes('open') && t.includes('closed') && t.includes('position')) {
        return [
            { label: 'Open Positions', value: 0, color: { dark: '#475569', light: '#94a3b8' } },
            { label: 'Closed Positions', value: 0, color: { dark: '#1d4ed8', light: '#93c5fd' } },
        ];
    }
    return [];
}
function walletPieLegendCardHtml(title, slice, total) {
    const unitWord = walletPieCountUnitWord(title);
    const showAvg = walletPieLegendUsesAvgRow(title);
    const pct = total > 0 ? (slice.value / total) * 100 : 0;
    const accent = pieSliceAccentSolid(slice.color);
    const swatchBg = pieSliceLegendBackground(slice.color);
    const pctBodyHtml = `<span class="token-tier-metric__slice-pct">${formatPctSmart(pct)}</span><span class="token-tier-metric__muted"> share</span>`;
    const countBodyHtml = `<span class="token-tier-metric__emph">${formatIntFull(slice.value)}</span><span class="token-tier-metric__muted"> ${unitWord}</span>`;
    const avgRow = showAvg ? buildWalletPieAvgGainRow(slice.avgGainMult) : null;
    return walletPieLegendTierCardHtml({
        accent,
        swatchBg,
        titleEscaped: escapeHtmlText(slice.label),
        pctBodyHtml,
        countBodyHtml,
        avgRow,
    });
}
function renderWalletPieCard(title, slices) {
    const sourceSlices = (slices?.length ? slices : walletPieDefaultSlices(title));
    const allSlices = sourceSlices.map((slice) => ({ ...slice, value: Math.max(0, Number(slice.value) || 0) }));
    const positiveSlices = allSlices.filter((slice) => slice.value > 0);
    const total = positiveSlices.reduce((sum, slice) => sum + slice.value, 0);
    const neutralRing = '#27272a';
    const emptyBg = buildPieGradientWithGaps([1], [neutralRing]);
    const pieGradient = total > 0
        ? buildPieGradientWithGaps(
            positiveSlices.map((slice) => (slice.value / total) * 100),
            positiveSlices.map((slice) => slice.color),
        )
        : emptyBg;
    const legendHtml = allSlices.map((slice) => walletPieLegendCardHtml(title, slice, total)).join('');
    return `<section class="token-stats-group wallet-pnl-card wallet-pnl-card--pie">
    <h3 class="token-stats-group-title"><span>${title}</span></h3>
    <div class="wallet-pnl-pie-wrap">
      <div class="wallet-pnl-pie-chart token-supply-pie token-supply-pie--donut-labels" role="img" aria-label="${title}" style="background:${pieGradient}"></div>
      <div class="wallet-pnl-pie-legend token-supply-legend token-supply-legend--tier-dashboard wallet-pnl-pie-legend--tier-match">${legendHtml}</div>
    </div>
  </section>`;
}
function syncWalletPieStackHeights() {
    const trendCard = walletPnlDetailsEl.querySelector('.wallet-pnl-card--trend');
    const pieStack = walletPnlDetailsEl.querySelector('.wallet-pnl-pie-stack');
    if (!trendCard || !pieStack)
        return;
    if (window.innerWidth <= 1100) {
        pieStack.style.height = '';
        return;
    }
    const h = trendCard.getBoundingClientRect().height;
    // Section hidden (e.g. token mode) yields 0 — do not persist 0px or pie stack collapses after mode switch.
    if (h <= 1) {
        pieStack.style.height = '';
        return;
    }
    pieStack.style.height = `${Math.max(0, Math.round(h))}px`;
}

function renderStatusBadge(status) {
    const value = (status || '').trim().toLowerCase();
    if (!value)
        return '—';
    if (value === 'open') {
        return '<span class="wallet-status-badge wallet-status-badge--open">open</span>';
    }
    if (value === 'closed') {
        return '<span class="wallet-status-badge wallet-status-badge--closed">closed</span>';
    }
    return `<span class="wallet-status-badge">${value}</span>`;
}
function isWalletPositionClosed(status) {
    return (status || '').trim().toLowerCase() === 'closed';
}
function renderWalletAssetBuySellAmtCell(metric) {
    const buyText = formatNum(metric.buys?.tokenAmount);
    const sellText = formatNum(metric.sells?.tokenAmount);
    return `<div class="wallet-asset-buysell-amt">
    <div class="wallet-amt-stack-row"><span class="wallet-amt-stack-value wallet-amt-stack-value--buy">${buyText}</span><span class="wallet-amt-side-icon wallet-amt-side-icon--buy" aria-hidden="true">▲</span></div>
    <div class="wallet-amt-stack-row"><span class="wallet-amt-stack-value wallet-amt-stack-value--sell">${sellText}</span><span class="wallet-amt-side-icon wallet-amt-side-icon--sell" aria-hidden="true">▼</span></div>
  </div>`;
}

function renderXProfileLink(url) {
    const href = (url || '').trim();
    if (!href)
        return '—';
    const match = href.match(/x\.com\/([^/?#]+)/i) || href.match(/twitter\.com\/([^/?#]+)/i);
    const handle = match?.[1] ? `@${match[1]}` : href;
    return `<a href="${href}" target="_blank">${handle}</a>`;
}

function toNum(value) {
    if (value == null)
        return 0;
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}

function formatPctSmart(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num === 0)
        return '0%';
    const abs = Math.abs(num);
    if (abs >= 0.01)
        return `${num.toFixed(2)}%`;
    const decimalsToFirstNonZero = Math.ceil(-Math.log10(abs));
    const decimals = Math.max(3, Math.min(8, decimalsToFirstNonZero));
    return `${num.toFixed(decimals)}%`;
}
/**
 * % vs current USD price with **spot as denominator**: `(spot − historical) / spot × 100`.
 * Appended after historical price rows when spot is valid; arrow + period label after the %.
 */
function formatHistoricalPricePctVsSpotHtml(spot, historical, period) {
    if (spot == null || historical == null || !Number.isFinite(spot) || !Number.isFinite(historical) || spot === 0) {
        return '';
    }
    const pct = ((spot - historical) / spot) * 100;
    const toneClass = pct > 0 ? 'usd-tone usd-tone--positive' : pct < 0 ? 'usd-tone usd-tone--negative' : 'usd-tone usd-tone--neutral';
    const sign = pct > 0 ? '+' : '';
    const arrow = pct > 0 ? '↑' : pct < 0 ? '↓' : '';
    const pctSpan = `<span class="token-stat-price-pct ${toneClass}">${sign}${formatPctSmart(pct)}</span>`;
    const arrowSpan = arrow
        ? `<span class="token-stat-price-pct-arrow ${toneClass}" aria-hidden="true">${arrow}</span>`
        : '';
    const periodSpan = `<span class="token-stat-price-pct-period">${escapeHtmlText(period)}</span>`;
    const meta = `<span class="token-stat-price-pct-meta">${arrowSpan}${periodSpan}</span>`;
    return ` ${pctSpan}${meta}`;
}
function getTraderPnl(row) {
    return toNum(row.realizedPnlUsd);
}
function formatUsdBucketValue(value) {
    if (!Number.isFinite(value))
        return '$0';
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(value);
    if (abs === 0)
        return '$0';
    if (abs >= 0.01 && abs < 1) {
        return `${sign}$${abs.toFixed(2)}`;
    }
    if (abs >= 1) {
        const core = Number.isInteger(abs)
            ? abs.toLocaleString()
            : abs.toFixed(2).replace(/\.?0+$/, '');
        return `${sign}$${core}`;
    }
    const fixed = abs.toFixed(6).replace(/\.?0+$/, '');
    const core = fixed.length > 0 && Number(fixed) > 0 ? fixed : abs.toExponential(2);
    return `${sign}$${core}`;
}
function buildCountTierEdges(maxVal) {
    // 9 edges => 8 visible groups by default.
    const edges = [0, 1, 5, 10, 25, 50, 100, 500, 1000];
    while (edges[edges.length - 1] < maxVal) {
        edges.push(edges[edges.length - 1] * 10);
    }
    return edges;
}
/** Gap wedges between slices; must stay in sync with {@link tradeTierPieSliceMidAnglesDeg}. */
const PIE_CONIC_GAP_DEG = 1.2;
function pieSliceLegendBackground(spec) {
    if (typeof spec === 'string')
        return spec;
    return `linear-gradient(90deg, ${spec.dark}, ${spec.light})`;
}
/** Solid stop for `border-left` / `--tier-accent` (gradients are invalid there). */
function pieSliceAccentSolid(spec) {
    if (typeof spec === 'string')
        return spec;
    return spec.dark;
}
function pieSliceSpecToLabelHex(spec) {
    if (typeof spec === 'string') {
        return spec.startsWith('#') ? spec : hslToHex(0, 0, 55);
    }
    const a = parseHslCss(spec.dark);
    const b = parseHslCss(spec.light);
    if (a && b) {
        return hslToHex(a.h, (a.s + b.s) / 2, (a.l + b.l) / 2);
    }
    if (spec.dark.startsWith('#') && spec.light.startsWith('#')) {
        return lerpHex(spec.dark, spec.light, 0.5);
    }
    return '#64748b';
}
function buildWalletPnlPlaceholder() {
    const dash = '—';
        const phHighlightFilled = (kind) => {
        const isBest = kind === 'best';
        const roleClass = isBest ? 'wallet-pnl-highlight-card--best' : 'wallet-pnl-highlight-card--worst';
        const ribbon = isBest ? 'Best performer' : 'Worst Performer';
        return `<article class="wallet-pnl-highlight-card ${roleClass}" aria-label="${ribbon}">
        <span class="wallet-pnl-highlight-ribbon">${ribbon}</span>
        <div class="wallet-pnl-highlight-body">
          <div class="wallet-pnl-highlight-token"><span class="wallet-token-ref">${renderLogoImage(undefined, dash)}</span><span class="mono">${dash}</span></div>
          <div class="wallet-pnl-highlight-mint mono">${dash}</div>
          <div class="wallet-pnl-highlight-metrics">
            <span class="wallet-pnl-highlight-metric-label">Period PnL</span>
            <span class="wallet-pnl-highlight-metric-value usd-tone usd-tone--neutral">${dash}</span>
          </div>
        </div>
      </article>`;
    };
    const phTrendRowCount = 7;
    const phTrendBody = Array.from({ length: phTrendRowCount }, () => {
        return `<tr><td>${dash}</td><td style="text-align:right">${dash}</td></tr>`;
    }).join('');
    const pieStackPlaceholderHtml = `<div class="wallet-pnl-pie-stack">
      ${renderWalletPieCard('Open VS Closed Positions', [])}
      ${renderWalletPieCard('Winning vs Losing Trades', [])}
    </div>`;
    return `<div class="wallet-pnl-layout">
    <div class="wallet-pnl-sections">
      <section class="token-stats-group wallet-pnl-card wallet-pnl-card--profile">
        <h3 class="token-stats-group-title"><span>Wallet profile</span></h3>
        <div class="wallet-pnl-profile-header">
          <div class="wallet-pnl-profile-avatar-wrap" aria-hidden="true">
            ${renderWalletProfileAvatar(undefined, dash)}
          </div>
          <dl class="token-stats wallet-pnl-kv wallet-pnl-profile-kv">
            <dt>Name:</dt><dd class="wallet-pnl-profile-value-emphasis">${dash}</dd>
            <dt>X ACC:</dt><dd class="wallet-pnl-profile-value-emphasis">${dash}</dd>
          </dl>
        </div>
      </section>
      <section class="token-stats-group wallet-pnl-card wallet-pnl-card--highlights">
        <h3 class="token-stats-group-title"><span>Token highlights</span></h3>
        <div class="wallet-pnl-highlight-grid">${phHighlightFilled('best')}${phHighlightFilled('worst')}</div>
      </section>
      ${pieStackPlaceholderHtml}
    </div>
    <div class="wallet-pnl-trend-col">
      <section class="token-stats-group wallet-pnl-card wallet-pnl-card--pnl-trading">
        <h3 class="token-stats-group-title"><span>PnL & trading</span></h3>
        <p class="wallet-pnl-pnl-trading-lede">${walletPnlTradingLedeInnerHtml()}</p>
        <div class="wallet-pnl-pnl-trading-stack">
          <div class="wallet-pnl-metric-hero">
            <div class="wallet-pnl-metric-hero-item wallet-pnl-metric-hero-item--realized">
              <span class="wallet-pnl-metric-hero-label">Realized PnL</span>
              <span class="wallet-pnl-metric-hero-value">${formatUsdCell(undefined)}</span>
            </div>
            <div class="wallet-pnl-metric-hero-item wallet-pnl-metric-hero-item--unrealized">
              <span class="wallet-pnl-metric-hero-label">Unrealized PnL</span>
              <span class="wallet-pnl-metric-hero-value">${formatUsdCell(undefined)}</span>
            </div>
          </div>
          <div class="wallet-pnl-metric-row">
            <div class="wallet-pnl-metric-chip wallet-pnl-metric-chip--pos"><span class="wallet-pnl-metric-chip-label">Winning Trades</span><span class="wallet-pnl-metric-chip-value">${formatWinLoseTradesChipValueHtml(undefined, null, 'pos')}</span></div>
            <div class="wallet-pnl-metric-chip wallet-pnl-metric-chip--neg"><span class="wallet-pnl-metric-chip-label">Losing Trades</span><span class="wallet-pnl-metric-chip-value">${formatWinLoseTradesChipValueHtml(undefined, null, 'neg')}</span></div>
          </div>
          <div class="wallet-pnl-metric-row">
            <div class="wallet-pnl-metric-chip"><span class="wallet-pnl-metric-chip-label">Unique Tokens</span><span class="wallet-pnl-metric-chip-value">${formatIntFull(undefined)}</span></div>
            <div class="wallet-pnl-metric-chip"><span class="wallet-pnl-metric-chip-label">Total Volume</span><span class="wallet-pnl-metric-chip-value">${formatUsdCell(undefined)}</span></div>
          </div>
          <div class="wallet-pnl-metric-row">
            <div class="wallet-pnl-metric-chip"><span class="wallet-pnl-metric-chip-label">Total Trade Count</span><span class="wallet-pnl-metric-chip-value">${formatTradesCountCell(undefined)}</span></div>
            <div class="wallet-pnl-metric-chip"><span class="wallet-pnl-metric-chip-label">Average Trade Amount</span><span class="wallet-pnl-metric-chip-value">${formatUsdCell(undefined)}</span></div>
          </div>
        </div>
      </section>
      <section class="token-stats-group wallet-pnl-card wallet-pnl-card--trend">
        <h3 class="token-stats-group-title"><span>7d PnL trend points</span></h3>
        <p class="wallet-pnl-trend-lede">${WALLET_PNL_TREND_LEDE}</p>
        <div class="table-wrap wallet-pnl-trend-table-wrap">
          <table class="wallet-trend-table">
            <thead>
              <tr>
                <th>Time</th>
                <th style="text-align:right">PnL</th>
              </tr>
            </thead>
            <tbody>${phTrendBody}</tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
`;
}

function renderWalletPnl(ownerAddress, data, queryParams, topTraderRow) {
    const summary = data.summary;
    const topMetrics = topTraderRow?.metrics;
    const tokenMetrics = data.tokenMetrics ?? [];
        const mergedSummary = mergeWalletSummary(summary, topMetrics);
    const metricsByMint = new Map(tokenMetrics
        .map((metric) => [(metric.mintAddress || '').trim(), metric])
        .filter(([mint]) => mint.length > 0));
    const buysTxValues = tokenMetrics
        .map((metric) => toNum(metric.buys?.transactionCount))
        .filter((value) => Number.isFinite(value));
    const buysTxMin = buysTxValues.length ? Math.min(...buysTxValues) : 0;
    const buysTxMax = buysTxValues.length ? Math.max(...buysTxValues) : 0;
    const sellsTxValues = tokenMetrics
        .map((metric) => toNum(metric.sells?.transactionCount))
        .filter((value) => Number.isFinite(value));
    const sellsTxMin = sellsTxValues.length ? Math.min(...sellsTxValues) : 0;
    const sellsTxMax = sellsTxValues.length ? Math.max(...sellsTxValues) : 0;
    const { aboveOneAvg: winAvgGainMult, atOrBelowOneAvg: loseAvgGainMult } = avgGainMultFromTableByGainGroups(tokenMetrics);
    const tokenLabel = (token) => {
        if (!token)
            return '—';
        const mint = (token.mintAddress || '').trim();
        if (!mint)
            return '—';
        const matchedMetric = metricsByMint.get(mint);
        const fullLabel = matchedMetric?.tokenSymbol ||
            matchedMetric?.tokenName ||
            token.tokenSymbol ||
            token.tokenName ||
            truncateAddress(mint);
        const linkText = truncateTokenHighlightLinkText(fullLabel);
        const logoUrl = matchedMetric?.tokenLogoUrl || token.tokenLogoUrl;
        const titleAttr = escapeHtmlAttr(`${fullLabel} · ${mint}`);
        return `<span class="wallet-token-ref">${renderLogoImage(logoUrl, fullLabel, mint)}<a href="https://vybe.fyi/tokens/${encodeURIComponent(mint)}" target="_blank" class="mono" title="${titleAttr}">${linkText}</a></span>`;
    };
    const renderWalletPnlHighlightCard = (kind, token) => {
        const isBest = kind === 'best';
        const roleClass = isBest ? 'wallet-pnl-highlight-card--best' : 'wallet-pnl-highlight-card--worst';
        const ribbon = isBest ? 'Best performer' : 'Worst Performer';
        const mint = (token?.mintAddress || '').trim();
        if (!mint) {
            return `<article class="wallet-pnl-highlight-card ${roleClass} wallet-pnl-highlight-card--empty" aria-label="${ribbon}">
        <span class="wallet-pnl-highlight-ribbon">${ribbon}</span>
        <div class="wallet-pnl-highlight-body">
          <p class="wallet-pnl-highlight-empty">No ${isBest ? 'top' : 'bottom'} token in the summary for this window.</p>
        </div>
      </article>`;
        }
        const pnl = token?.pnlUsd;
        const pnlToneClass = pnl != null && pnl < 0 ? 'wallet-pnl-highlight-pnl--negative' : 'wallet-pnl-highlight-pnl--positive';
        return `<article class="wallet-pnl-highlight-card ${roleClass}" aria-label="${ribbon}">
      <span class="wallet-pnl-highlight-ribbon">${ribbon}</span>
      <div class="wallet-pnl-highlight-body">
        <div class="wallet-pnl-highlight-token">${tokenLabel(token)}</div>
        <div class="wallet-pnl-highlight-mint mono" title="${mint}">${truncateAddress(mint)}</div>
        <div class="wallet-pnl-highlight-metrics">
          <span class="wallet-pnl-highlight-metric-label">Period PnL</span>
          <span class="wallet-pnl-highlight-metric-value ${pnlToneClass}">${pnl != null ? formatUsdFull(pnl) : '—'}</span>
      </div>
        </div>
    </article>`;
    };
    const profileLabels = (topTraderRow?.accountLabels ?? []).filter((label) => (label || '').trim() !== '');
    const baseName = topTraderRow?.accountName || truncateAddress(ownerAddress);
    const labelSuffix = profileLabels.length ? ` (${profileLabels.join(', ')})` : '';
    const nameDisplay = `${baseName}${labelSuffix}`;
    const walletProfileHtml = `<section class="token-stats-group wallet-pnl-card wallet-pnl-card--profile">
      <h3 class="token-stats-group-title"><span>Wallet profile</span></h3>
      <div class="wallet-pnl-profile-header">
        <div class="wallet-pnl-profile-avatar-wrap" aria-hidden="true">
          ${renderWalletProfileAvatar(topTraderRow?.accountLogoUrl, topTraderRow?.accountName || ownerAddress)}
      </div>
        <dl class="token-stats wallet-pnl-kv wallet-pnl-profile-kv">
          <dt>Name:</dt><dd class="wallet-pnl-profile-value-emphasis"><a href="https://vybe.fyi/wallets/${encodeURIComponent(ownerAddress)}" target="_blank" class="mono" title="${ownerAddress}">${nameDisplay}</a></dd>
          <dt>X ACC:</dt><dd class="wallet-pnl-profile-value-emphasis">${renderXProfileLink(topTraderRow?.accountTwitterUrl)}</dd>
        </dl>
        </div>
    </section>`;
    const pnlTradingHtml = `<section class="token-stats-group wallet-pnl-card wallet-pnl-card--pnl-trading">
      <h3 class="token-stats-group-title"><span>PnL & trading</span></h3>
      <p class="wallet-pnl-pnl-trading-lede">${walletPnlTradingLedeInnerHtml()}</p>
      <div class="wallet-pnl-pnl-trading-stack">
        <div class="wallet-pnl-metric-hero">
          <div class="wallet-pnl-metric-hero-item wallet-pnl-metric-hero-item--realized">
            <span class="wallet-pnl-metric-hero-label">Realized PnL</span>
            <span class="wallet-pnl-metric-hero-value">${formatUsdCell(mergedSummary.realizedPnlUsd)}</span>
      </div>
          <div class="wallet-pnl-metric-hero-item wallet-pnl-metric-hero-item--unrealized">
            <span class="wallet-pnl-metric-hero-label">Unrealized PnL</span>
            <span class="wallet-pnl-metric-hero-value">${formatUsdCell(mergedSummary.unrealizedPnlUsd)}</span>
          </div>
        </div>
        <div class="wallet-pnl-metric-row">
          <div class="wallet-pnl-metric-chip wallet-pnl-metric-chip--pos"><span class="wallet-pnl-metric-chip-label">Winning Trades</span><span class="wallet-pnl-metric-chip-value">${formatWinLoseTradesChipValueHtml(mergedSummary.winningTradesCount, winAvgGainMult, 'pos')}</span></div>
          <div class="wallet-pnl-metric-chip wallet-pnl-metric-chip--neg"><span class="wallet-pnl-metric-chip-label">Losing Trades</span><span class="wallet-pnl-metric-chip-value">${formatWinLoseTradesChipValueHtml(mergedSummary.losingTradesCount, loseAvgGainMult, 'neg')}</span></div>
        </div>
        <div class="wallet-pnl-metric-row">
          <div class="wallet-pnl-metric-chip"><span class="wallet-pnl-metric-chip-label">Unique Tokens</span><span class="wallet-pnl-metric-chip-value">${formatIntFull(mergedSummary.uniqueTokensTraded)}</span></div>
          <div class="wallet-pnl-metric-chip"><span class="wallet-pnl-metric-chip-label">Total Volume</span><span class="wallet-pnl-metric-chip-value">${formatUsdCell(mergedSummary.tradesVolumeUsd)}</span></div>
        </div>
        <div class="wallet-pnl-metric-row">
          <div class="wallet-pnl-metric-chip"><span class="wallet-pnl-metric-chip-label">Total Trade Count</span><span class="wallet-pnl-metric-chip-value">${formatTradesCountCell(mergedSummary.tradesCount)}</span></div>
          <div class="wallet-pnl-metric-chip"><span class="wallet-pnl-metric-chip-label">Average Trade Amount</span><span class="wallet-pnl-metric-chip-value">${formatUsdCell(mergedSummary.averageTradeUsd)}</span></div>
        </div>
      </div>
    </section>`;
    const tokenHighlightsHtml = `<section class="token-stats-group wallet-pnl-card wallet-pnl-card--highlights">
      <h3 class="token-stats-group-title"><span>Token highlights</span></h3>
      <div class="wallet-pnl-highlight-grid">
        ${renderWalletPnlHighlightCard('best', mergedSummary.bestPerformingToken)}
        ${renderWalletPnlHighlightCard('worst', mergedSummary.worstPerformingToken)}
      </div>
    </section>`;
    const statusSlices = (() => {
        const openCount = tokenMetrics.filter((metric) => (metric.status || '').toLowerCase() === 'open').length;
        const closedCount = tokenMetrics.filter((metric) => (metric.status || '').toLowerCase() === 'closed').length;
        return [
            { label: 'Open Positions', value: openCount, color: { dark: '#475569', light: '#94a3b8' } },
            { label: 'Closed Positions', value: closedCount, color: { dark: '#1d4ed8', light: '#93c5fd' } },
        ];
    })();
    const winningLosingTradeSlices = (() => {
        const win = Math.max(0, Math.round(Number(mergedSummary.winningTradesCount) || 0));
        const lose = Math.max(0, Math.round(Number(mergedSummary.losingTradesCount) || 0));
        return [
            { label: 'Winning Trades', value: win, color: tradeScaleBarGradientPair(0), avgGainMult: winAvgGainMult },
            { label: 'Losing Trades', value: lose, color: VOLUME_PNL_PIE_NONPOSITIVE_FILL, avgGainMult: loseAvgGainMult },
        ];
    })();
    const pieStackHtml = `<div class="wallet-pnl-pie-stack">
      ${renderWalletPieCard('Open VS Closed Positions', statusSlices)}
      ${renderWalletPieCard('Winning vs Losing Trades', winningLosingTradeSlices)}
    </div>`;
    const trendRowsRaw = mergedSummary.pnlTrendSevenDays ?? [];
    const trendRows = [...trendRowsRaw].sort((a, b) => {
        const ta = Number(a?.[0]);
        const tb = Number(b?.[0]);
        if (!Number.isFinite(ta) && !Number.isFinite(tb))
            return 0;
        if (!Number.isFinite(ta))
            return 1;
        if (!Number.isFinite(tb))
            return -1;
        return tb - ta;
    });
    const pnlTrendHtml = trendRows.length
        ? `<section class="token-stats-group wallet-pnl-card wallet-pnl-card--trend">
      <h3 class="token-stats-group-title"><span>7d PnL trend points</span></h3>
      <p class="wallet-pnl-trend-lede">${WALLET_PNL_TREND_LEDE}</p>
      <div class="table-wrap wallet-pnl-trend-table-wrap">
        <table class="wallet-trend-table">
          <thead>
            <tr>
              <th>Time</th>
              <th style="text-align:right">PnL</th>
            </tr>
          </thead>
          <tbody>${trendRows.map((point) => {
            const ts = Number(point?.[0]);
            const pnl = Number(point?.[1]);
            const timeLabel = Number.isFinite(ts) ? formatPnlTrendPointTime(ts) : '—';
            return `<tr>
              <td>${timeLabel}</td>
              <td style="text-align:right">${formatUsdCell(Number.isFinite(pnl) ? pnl : undefined)}</td>
            </tr>`;
        }).join('')}</tbody>
        </table>
      </div>
    </section>`
        : `<section class="token-stats-group wallet-pnl-card wallet-pnl-card--trend wallet-pnl-empty">
      <h3 class="token-stats-group-title"><span>7d PnL trend points</span></h3>
      <p class="wallet-pnl-trend-lede">${WALLET_PNL_TREND_LEDE}</p>
      <p class="wallet-pnl-trend-empty-msg">No seven-day trend samples returned for this wallet.</p>
    </section>`;
    walletPnlDetailsEl.innerHTML = `<div class="wallet-pnl-layout">
    <div class="wallet-pnl-sections">${walletProfileHtml}${tokenHighlightsHtml}${pieStackHtml}</div>
    <div class="wallet-pnl-trend-col">${pnlTradingHtml}${pnlTrendHtml}</div>
  </div>`;
    mountWalletPieDonutOverlays(walletPnlDetailsEl, [{ slices: statusSlices }, { slices: winningLosingTradeSlices }]);
    requestAnimationFrame(() => syncWalletPieStackHeights());
    lastTokenMetrics = tokenMetrics;
    if (window.WalletPnlTable) window.WalletPnlTable.onMetricsUpdated(tokenMetrics);
}

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
      fetch(`/api/wallets/top-traders?resolution=${encodeURIComponent(WALLET_PNL_RESOLUTION)}&ilikeFilter=${encodeURIComponent(ownerAddress)}&limit=1&sortByDesc=realizedPnlUsd`, { cache: 'no-store' }),
      fetch(`/api/wallets/${encodeURIComponent(ownerAddress)}/pnl?${pnlParams.toString()}`, { cache: 'no-store' }),
    ]);
    if (!pnlRes.ok) {
      const errBody = await pnlRes.json().catch(() => ({}));
      throw new Error(errBody.error || `Wallet PnL request failed (${pnlRes.status})`);
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
      walletPnlMetaEl.textContent = `Wallet PnL: ${(walletPnlData.tokenMetrics ?? []).length} per-token row(s) for the 7d window.`;
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
})();