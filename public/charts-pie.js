function applyMinVisibleSlices(realSlices, minVisiblePct = 1.5) {
    const adjusted = realSlices.map((v) => Math.max(0, v));
    const tinyEntries = adjusted
        .map((v, i) => ({ v, i }))
        .filter(({ v }) => v > 0 && v < minVisiblePct);
    const tinyIdx = tinyEntries.map(({ i }) => i);
    if (tinyIdx.length === 0)
        return adjusted;
    const targetTotal = adjusted.reduce((sum, v) => sum + v, 0);
    const tinyValues = tinyEntries.map(({ v }) => v);
    const minTiny = Math.min(...tinyValues);
    const maxTiny = Math.max(...tinyValues);
    tinyEntries.forEach(({ v, i }) => {
        if (maxTiny === minTiny) {
            adjusted[i] = minVisiblePct;
            return;
        }
        const normalized = (v - minTiny) / (maxTiny - minTiny);
        adjusted[i] = minVisiblePct * (1 + normalized * 0.5);
    });
    let overflow = adjusted.reduce((sum, v) => sum + v, 0) - targetTotal;
    if (overflow <= 0)
        return adjusted;
    const donorIndices = adjusted
        .map((v, i) => ({ v, i }))
        .filter(({ i, v }) => !tinyIdx.includes(i) && v > 0)
        .sort((a, b) => b.v - a.v)
        .map(({ i }) => i);
    for (const i of donorIndices) {
        if (overflow <= 0)
            break;
        const reducible = Math.max(0, adjusted[i]);
        const cut = Math.min(reducible, overflow);
        adjusted[i] -= cut;
        overflow -= cut;
    }
    if (overflow > 0) {
        const total = adjusted.reduce((sum, v) => sum + v, 0);
        if (total > 0) {
            return adjusted.map((v) => (v / total) * targetTotal);
        }
    }
    return adjusted;
}
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
/** Gap wedges between slices; must stay in sync with {@link tradeTierPieSliceMidAnglesDeg}. */
const PIE_CONIC_GAP_DEG = 1.2;
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
function buildPieGradientWithGaps(slices, colors, gapColor = '#0a0a0d', gapDeg = PIE_CONIC_GAP_DEG) {
    const entries = slices
        .map((value, i) => ({ value: Math.max(0, value), fill: colors[i] ?? '#27272a' }))
        .filter((entry) => entry.value > 0);
    if (entries.length === 0) {
        return `conic-gradient(${gapColor} 0deg 360deg)`;
    }
    if (entries.length === 1) {
        const spec = entries[0].fill;
        if (typeof spec === 'string') {
            return `conic-gradient(${spec} 0deg 360deg)`;
        }
        return `conic-gradient(${spec.dark} 0deg, ${spec.light} 360deg)`;
    }
    const total = entries.reduce((sum, entry) => sum + entry.value, 0);
    const totalGap = Math.min(359, gapDeg * entries.length);
    const usableDeg = Math.max(1, 360 - totalGap);
    const stops = [];
    let cursor = 0;
    entries.forEach((entry) => {
        const gapStart = cursor;
        const gapEnd = gapStart + gapDeg;
        stops.push(`${gapColor} ${gapStart.toFixed(3)}deg ${gapEnd.toFixed(3)}deg`);
        cursor = gapEnd;
        const sliceDeg = usableDeg * (entry.value / total);
        const sliceStart = cursor;
        const sliceEnd = sliceStart + sliceDeg;
        const spec = entry.fill;
        if (typeof spec === 'string') {
            stops.push(`${spec} ${sliceStart.toFixed(3)}deg ${sliceEnd.toFixed(3)}deg`);
        }
        else {
            stops.push(`${spec.dark} ${sliceStart.toFixed(3)}deg, ${spec.light} ${sliceEnd.toFixed(3)}deg`);
        }
        cursor = sliceEnd;
    });
    if (cursor < 360) {
        stops.push(`${gapColor} ${cursor.toFixed(3)}deg 360deg`);
    }
    return `conic-gradient(${stops.join(', ')})`;
}
/** Mid-angle (degrees, CSS conic: 0° = top, clockwise) per slice index; null if slice weight is 0. */
function tradeTierPieSliceMidAnglesDeg(slices, gapDeg) {
    const out = slices.map(() => null);
    const entries = slices
        .map((value, i) => ({ value: Math.max(0, value), i }))
        .filter((e) => e.value > 0);
    if (entries.length === 0)
        return out;
    if (entries.length === 1) {
        out[entries[0].i] = 0;
        return out;
    }
    const total = entries.reduce((sum, e) => sum + e.value, 0);
    const totalGap = Math.min(359, gapDeg * entries.length);
    const usableDeg = Math.max(1, 360 - totalGap);
    let cursor = 0;
    for (const entry of entries) {
        cursor += gapDeg;
        const sliceDeg = usableDeg * (entry.value / total);
        out[entry.i] = cursor + sliceDeg / 2;
        cursor += sliceDeg;
    }
    return out;
}
/** Angular width (degrees) of each slice; null if weight is 0. Mirrors {@link buildPieGradientWithGaps}. */
function tradeTierPieSliceSpanDeg(slices, gapDeg) {
    const out = slices.map(() => null);
    const entries = slices
        .map((value, i) => ({ value: Math.max(0, value), i }))
        .filter((e) => e.value > 0);
    if (entries.length === 0)
        return out;
    if (entries.length === 1) {
        out[entries[0].i] = 360;
        return out;
    }
    const total = entries.reduce((sum, e) => sum + e.value, 0);
    const totalGap = Math.min(359, gapDeg * entries.length);
    const usableDeg = Math.max(1, 360 - totalGap);
    let cursor = 0;
    for (const entry of entries) {
        cursor += gapDeg;
        const sliceDeg = usableDeg * (entry.value / total);
        out[entry.i] = sliceDeg;
        cursor += sliceDeg;
    }
    return out;
}
function clearDonutPieOverlays(pieEl) {
    pieEl.querySelector('.token-supply-pie__label-svg')?.remove();
    pieEl.querySelector('.token-supply-pie__hub')?.remove();
}
function mountDonutPieCenterHub(pieEl, options) {
    if (!options) return;
    pieEl.querySelector('.token-supply-pie__hub')?.remove();
    const hub = document.createElement('div');
    hub.className = 'token-supply-pie__hub';
    hub.setAttribute('aria-hidden', 'true');
    const pctEl = document.createElement('div');
    pctEl.className = 'token-supply-pie__hub-pct';
    pctEl.textContent = options.mock ? '—' : '100%';
    const subEl = document.createElement('div');
    subEl.className = 'token-supply-pie__hub-sub';
    subEl.textContent = options.hubSubline;
    hub.appendChild(pctEl);
    hub.appendChild(subEl);
    pieEl.appendChild(hub);
}
const TIER_PIE_OUTSIDE_LABEL_MIN_ANGULAR_SEP_DEG = 28;
const TIER_PIE_LABEL_MIN_SEP_DEG = TIER_PIE_OUTSIDE_LABEL_MIN_ANGULAR_SEP_DEG;
const TIER_PIE_LABEL_TIGHT_PAIR_MIN_DEG = TIER_PIE_OUTSIDE_LABEL_MIN_ANGULAR_SEP_DEG;
const TIER_PIE_LABEL_MAX_ANGLE_OFF = 15;
const TIER_PIE_LABEL_MAX_TANGENT_DEG = 44;
const TIER_PIE_LABEL_R_STACK = 7.25;
const TIER_PIE_R_INNER = 23;
const TIER_PIE_R_OUTER = 49.25;
const TIER_PIE_R_LABEL_INSIDE = (TIER_PIE_R_INNER + TIER_PIE_R_OUTER) / 2;
const TIER_PIE_INSIDE_FONT_UNITS = 4.35;
const TIER_PIE_INSIDE_MIN_SLICE_DEG = 10;
const TIER_PIE_INSIDE_MIN_PCT = 5;
const TIER_PIE_INSIDE_ARC_PAD = 0.84;
function tradeTierEstimatePctLabelWidth(pct, fontUnits) {
    const len = `${pct.toFixed(2)}%`.length;
    return len * fontUnits * 0.52;
}
function tradeTierPieLabelFitsInside(spanDeg, pct) {
    if (spanDeg == null || spanDeg < TIER_PIE_INSIDE_MIN_SLICE_DEG)
        return false;
    if (pct < TIER_PIE_INSIDE_MIN_PCT)
        return false;
    const arcLen = TIER_PIE_R_LABEL_INSIDE * ((spanDeg * Math.PI) / 180);
    const w = tradeTierEstimatePctLabelWidth(pct, TIER_PIE_INSIDE_FONT_UNITS);
    return arcLen >= w * TIER_PIE_INSIDE_ARC_PAD;
}
function tradeTierPieLabelFillForSlice(hex) {
    const { r, g, b } = hexToRgb(hex);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.52 ? { fill: '#0f172a', onDarkSlice: false } : { fill: '#f8fafc', onDarkSlice: true };
}
function clampNum(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
}
function computeTradeTierPieLabelLayout(cands) {
    const angleOff = new Map();
    const tangentialDeg = new Map();
    for (const c of cands) {
        angleOff.set(c.i, 0);
        tangentialDeg.set(c.i, 0);
    }
    const eff = (c) => c.mid + (angleOff.get(c.i) ?? 0);
    const lab = (c) => c.mid + (angleOff.get(c.i) ?? 0) + (tangentialDeg.get(c.i) ?? 0);
    const n = cands.length;
    const radialBoost = new Map();
    if (n <= 1)
        return { angleOff, tangentialDeg, radialBoost };
    for (let pass = 0; pass < 32; pass++) {
        const ord = [...cands].sort((a, b) => eff(a) - eff(b));
        let changed = false;
        for (let k = 0; k < n; k++) {
            const a = ord[k];
            const b = ord[(k + 1) % n];
            const ea = eff(a);
            const eb = eff(b) + (k === n - 1 ? 360 : 0);
            const gap = eb - ea;
            if (gap >= TIER_PIE_LABEL_MIN_SEP_DEG)
                continue;
            const deficit = TIER_PIE_LABEL_MIN_SEP_DEG - gap;
            const step = Math.min(deficit * 0.52, 5.5);
            angleOff.set(a.i, clampNum((angleOff.get(a.i) ?? 0) - step, -TIER_PIE_LABEL_MAX_ANGLE_OFF, TIER_PIE_LABEL_MAX_ANGLE_OFF));
            angleOff.set(b.i, clampNum((angleOff.get(b.i) ?? 0) + step, -TIER_PIE_LABEL_MAX_ANGLE_OFF, TIER_PIE_LABEL_MAX_ANGLE_OFF));
            changed = true;
        }
        if (!changed)
            break;
    }
    for (let pass = 0; pass < 36; pass++) {
        const ord = [...cands].sort((a, b) => lab(a) - lab(b));
        let changed = false;
        for (let k = 0; k < n; k++) {
            const a = ord[k];
            const b = ord[(k + 1) % n];
            const la = lab(a);
            const lb = lab(b) + (k === n - 1 ? 360 : 0);
            const gap = lb - la;
            if (gap >= TIER_PIE_LABEL_MIN_SEP_DEG)
                continue;
            const deficit = TIER_PIE_LABEL_MIN_SEP_DEG - gap;
            const half = Math.min(deficit * 0.55, 9);
            tangentialDeg.set(a.i, clampNum((tangentialDeg.get(a.i) ?? 0) - half, -TIER_PIE_LABEL_MAX_TANGENT_DEG, TIER_PIE_LABEL_MAX_TANGENT_DEG));
            tangentialDeg.set(b.i, clampNum((tangentialDeg.get(b.i) ?? 0) + half, -TIER_PIE_LABEL_MAX_TANGENT_DEG, TIER_PIE_LABEL_MAX_TANGENT_DEG));
            changed = true;
        }
        if (!changed)
            break;
    }
    {
        const ord = [...cands].sort((a, b) => lab(a) - lab(b));
        let tightK = 0;
        let tightGap = Infinity;
        for (let k = 0; k < n; k++) {
            const la = lab(ord[k]);
            const lb = lab(ord[(k + 1) % n]) + (k === n - 1 ? 360 : 0);
            const g = lb - la;
            if (g < tightGap) {
                tightGap = g;
                tightK = k;
            }
        }
        if (tightGap < TIER_PIE_LABEL_TIGHT_PAIR_MIN_DEG) {
            const a = ord[tightK];
            const b = ord[(tightK + 1) % n];
            const push = (TIER_PIE_LABEL_TIGHT_PAIR_MIN_DEG - tightGap) * 0.45 + 12;
            tangentialDeg.set(a.i, clampNum((tangentialDeg.get(a.i) ?? 0) - push, -TIER_PIE_LABEL_MAX_TANGENT_DEG, TIER_PIE_LABEL_MAX_TANGENT_DEG));
            tangentialDeg.set(b.i, clampNum((tangentialDeg.get(b.i) ?? 0) + push, -TIER_PIE_LABEL_MAX_TANGENT_DEG, TIER_PIE_LABEL_MAX_TANGENT_DEG));
        }
    }
    const ord = [...cands].sort((a, b) => lab(a) - lab(b));
    let prev = -Infinity;
    let stack = 0;
    for (const item of ord) {
        const e = lab(item);
        if (e - prev < TIER_PIE_LABEL_MIN_SEP_DEG * 0.55)
            stack += 1;
        else
            stack = 0;
        prev = e;
        let boost = stack * TIER_PIE_LABEL_R_STACK;
        if (item.pct < 8)
            boost += TIER_PIE_LABEL_R_STACK * 0.55;
        radialBoost.set(item.i, boost);
    }
    if (n >= 2) {
        const wrapGap = lab(ord[0]) + 360 - lab(ord[n - 1]);
        if (wrapGap < TIER_PIE_LABEL_MIN_SEP_DEG * 0.55) {
            const victim = ord[0].i;
            radialBoost.set(victim, (radialBoost.get(victim) ?? 0) + TIER_PIE_LABEL_R_STACK);
            const victim2 = ord[n - 1].i;
            radialBoost.set(victim2, (radialBoost.get(victim2) ?? 0) + TIER_PIE_LABEL_R_STACK * 0.85);
        }
    }
    return { angleOff, tangentialDeg, radialBoost };
}
function mountDonutPieSliceLabelOverlay(pieEl, slicePcts, sliceSpecs) {
    clearDonutPieOverlays(pieEl);
    const mids = tradeTierPieSliceMidAnglesDeg(slicePcts, PIE_CONIC_GAP_DEG);
    const spans = tradeTierPieSliceSpanDeg(slicePcts, PIE_CONIC_GAP_DEG);
    const cx = 50;
    const cy = 50;
    const rEdge = TIER_PIE_R_OUTER;
    const rTextBase = 61;
    const lineEndInset = 5.2;
    const candidates = [];
    for (let i = 0; i < slicePcts.length; i++) {
        const pct = slicePcts[i];
        const mid = mids[i];
        if (pct <= 0 || mid == null || !Number.isFinite(mid))
            continue;
        candidates.push({ mid, pct, i });
    }
    const inside = new Set();
    for (const c of candidates) {
        if (tradeTierPieLabelFitsInside(spans[c.i], c.pct))
            inside.add(c.i);
    }
    const outsideCands = candidates.filter((c) => !inside.has(c.i));
    const { angleOff, tangentialDeg, radialBoost } = computeTradeTierPieLabelLayout(outsideCands);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'token-supply-pie__label-svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('overflow', 'visible');
    svg.setAttribute('aria-hidden', 'true');
    for (const { mid, pct, i } of candidates) {
        const color = pieSliceSpecToLabelHex(sliceSpecs[i] ?? '#38bdf8');
        if (inside.has(i)) {
            const rad = (mid * Math.PI) / 180;
            const tx = cx + TIER_PIE_R_LABEL_INSIDE * Math.sin(rad);
            const ty = cy - TIER_PIE_R_LABEL_INSIDE * Math.cos(rad);
            const { fill, onDarkSlice } = tradeTierPieLabelFillForSlice(color);
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('class', `token-supply-pie__label-text token-supply-pie__label-text--inside${onDarkSlice ? ' token-supply-pie__label-text--inside-on-dark' : ' token-supply-pie__label-text--inside-on-light'}`);
            text.setAttribute('x', tx.toFixed(2));
            text.setAttribute('y', ty.toFixed(2));
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'middle');
            text.setAttribute('fill', fill);
            text.textContent = `${pct.toFixed(2)}%`;
            svg.appendChild(text);
            continue;
        }
        const showMid = mid + (angleOff.get(i) ?? 0) + (tangentialDeg.get(i) ?? 0);
        const rText = rTextBase + (radialBoost.get(i) ?? 0);
        const radRim = (mid * Math.PI) / 180;
        const radLbl = (showMid * Math.PI) / 180;
        const sx = cx + rEdge * Math.sin(radRim);
        const sy = cy - rEdge * Math.cos(radRim);
        const tx = cx + rText * Math.sin(radLbl);
        const ty = cy - rText * Math.cos(radLbl);
        const lx = cx + (rText - lineEndInset) * Math.sin(radLbl);
        const ly = cy - (rText - lineEndInset) * Math.cos(radLbl);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'token-supply-pie__label-line');
        line.setAttribute('x1', sx.toFixed(2));
        line.setAttribute('y1', sy.toFixed(2));
        line.setAttribute('x2', lx.toFixed(2));
        line.setAttribute('y2', ly.toFixed(2));
        svg.appendChild(line);
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('class', 'token-supply-pie__label-text');
        text.setAttribute('x', tx.toFixed(2));
        text.setAttribute('y', ty.toFixed(2));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.textContent = `${pct.toFixed(2)}%`;
        svg.appendChild(text);
    }
    if (svg.childNodes.length > 0)
        pieEl.appendChild(svg);
}
function mountDonutPieOverlays(pieEl, slicePcts, sliceSpecs, hub) {
    mountDonutPieSliceLabelOverlay(pieEl, slicePcts, sliceSpecs);
    if (hub) mountDonutPieCenterHub(pieEl, hub);
}
