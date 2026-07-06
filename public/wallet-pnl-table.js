'use strict';

(function () {
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
    const r = '7d';
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

function toNum(value) {
    if (value == null)
        return 0;
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}

function buildWalletPnlAssetsPlaceholderRows(count) {
  const dash = '—';
  return Array.from({ length: count }, () => `<tr>
    <td class="wallet-asset-icon-cell">${dash}</td>
    <td>${dash}</td>
    <td class="wallet-asset-buysell-amt-cell"><div class="wallet-asset-buysell-amt"><div class="wallet-amt-stack-row"><span class="wallet-amt-stack-value wallet-amt-stack-value--buy">${dash}</span><span class="wallet-amt-side-icon wallet-amt-side-icon--buy" aria-hidden="true">▲</span></div><div class="wallet-amt-stack-row"><span class="wallet-amt-stack-value wallet-amt-stack-value--sell">${dash}</span><span class="wallet-amt-side-icon wallet-amt-side-icon--sell" aria-hidden="true">▼</span></div></div></td>
    <td>${dash}</td><td>${dash}</td><td>${dash}</td><td>${dash}</td><td>${dash}</td><td>${dash}</td><td>${dash}</td><td>${dash}</td>
    <td class="wallet-asset-tx-cell">${dash}</td>
  </tr>`).join('');
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
      ? `<a href="https://vybe.fyi/tokens/${encodeURIComponent(mint)}" target="_blank" class="mono" title="${mint}">${symbol}</a>`
      : symbol;
    const iconCell = renderLogoImage(metric.tokenLogoUrl, symbol, mint);
    const assetCell = mint
      ? `${tokenLink}<div class="wallet-asset-mint mono">${truncateAddress(mint)}</div>`
      : tokenLink;
    const latestTrade = pickLatestTradeSide(metric);
    return `<tr>
      <td class="wallet-asset-icon-cell">${iconCell}</td>
      <td>${assetCell}</td>
      <td class="wallet-asset-buysell-amt-cell">${renderWalletAssetBuySellAmtCell(metric)}</td>
      <td>${renderStatusBadge(metric.status)}</td>
      <td>${formatUsdCell(metric.realizedPnlUsd)}</td>
      <td>${formatUsdCell(metric.unrealizedPnlUsd)}</td>
      <td>${formatTradesCountHeatCell(metric.buys?.transactionCount, buysTxMin, buysTxMax)}</td>
      <td>${formatTradesCountHeatCell(metric.sells?.transactionCount, sellsTxMin, sellsTxMax)}</td>
      <td><span class="wallet-amt-vol-usd">${formatUsdFull(metric.buys?.volumeUsd)}</span></td>
      <td><span class="wallet-amt-vol-usd">${formatUsdFull(metric.sells?.volumeUsd)}</span></td>
      <td style="text-align:center">${renderWalletAssetGainCell(metric, gainColorBounds)}</td>
      <td class="wallet-asset-tx-cell">${renderLatestTradeCell(latestTrade.blocktime, latestTrade.signature, latestTrade.label)}</td>
    </tr>`;
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

})();
