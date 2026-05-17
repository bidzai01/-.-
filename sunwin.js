const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = "https://apivip-anhkhoi-dzaivcl.onrender.com/data";

// ======================================================
// FILE LƯU TRỮ
// ======================================================
const STATS_FILE = path.join(__dirname, "supreme_stats.json");

function saveStats(stats) {
    try { fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2)); } catch (e) {}
}

function loadStats() {
    try {
        if (fs.existsSync(STATS_FILE)) {
            return JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));
        }
    } catch (e) {}
    return {
        totalPredictions: 0, totalCorrect: 0, totalWrong: 0,
        currentWinStreak: 0, currentLoseStreak: 0,
        maxWinStreak: 0, maxLoseStreak: 0,
        predictionLog: []
    };
}

let stats = loadStats();

// ======================================================
// FORMAT DATA
// ======================================================
function normalizeData(rawData) {
    let data = [];
    if (rawData && rawData.data && Array.isArray(rawData.data)) {
        data = rawData.data;
    } else if (Array.isArray(rawData)) {
        data = rawData;
    } else if (rawData && typeof rawData === 'object') {
        data = [rawData];
    }
    return data.map(item => {
        const d1 = item.xuc_xac_1 || 0;
        const d2 = item.xuc_xac_2 || 0;
        const d3 = item.xuc_xac_3 || 0;
        const tong = item.tong || (d1 + d2 + d3);
        let ketQua = (item.ket_qua || "").toLowerCase();
        if (!ketQua) ketQua = tong >= 11 ? "tài" : "xỉu";
        return {
            phien: item.phien || 0,
            x1: d1, x2: d2, x3: d3,
            tong: tong,
            ket_qua: ketQua,
            result: ketQua === "tài" ? "Tài" : "Xỉu",
            dice: [d1, d2, d3]
        };
    }).filter(item => item.phien > 0 && item.tong >= 3 && item.tong <= 18);
}

// ======================================================
// 🌟 SUPREME ALGORITHM V9
// ======================================================
class SupremeAlgorithm {
    constructor() {
        this.history = [];
        this.predictions = [];
        this.stats = { ok: 0, all: 0, win: 0, maxW: 0, lose: 0, fetch: 0 };

        // Bộ nhớ cầu
        this.cauDB = {
            biet: {}, c11: {}, c22: {}, c33: {}, c44: {}, c123: {}, c321: {},
            c1212: {}, c1122: {}, zigzag: {}, doiXung: {}, tamGiac: {},
            rong: {}, ho: {}, nem: {}, co: {}, vaiDauVai: {}, haiDinh: {}, haiDay: {}
        };

        // Bộ nhớ xúc xắc 3 viên
        this.diceDB = {
            d1: { freq: {}, trans: {}, streak: {}, hot: 3, cold: 3 },
            d2: { freq: {}, trans: {}, streak: {}, hot: 3, cold: 3 },
            d3: { freq: {}, trans: {}, streak: {}, hot: 3, cold: 3 },
            triples: {}, pairs: {}, sumAf: {}, sumMom: [],
            hl: {}, oe: {}, dev: {}
        };

        // Bộ nhớ pattern
        this.mem = { patterns: {}, success: {}, fail: {} };
    }

    norm(r) {
        if (!r) return null;
        r = r.charAt(0).toUpperCase() + r.slice(1).toLowerCase();
        return ['T', 'Tai', 'Tài'].includes(r) ? 'T' : ['X', 'Xiu', 'Xỉu'].includes(r) ? 'X' : null;
    }

    updateDice(d1, d2, d3) {
        const arr = [d1, d2, d3];
        const keys = ['d1', 'd2', 'd3'];

        for (let i = 0; i < 3; i++) {
            const o = this.diceDB[keys[i]];
            const f = arr[i];
            o.freq[f] = (o.freq[f] || 0) + 1;

            if (this.history.length > 0) {
                const prev = this.history[this.history.length - 1];
                if (prev.dice) {
                    const pf = prev.dice[i];
                    const k = `${pf}->${f}`;
                    o.trans[k] = (o.trans[k] || 0) + 1;
                    o.streak[f] = pf === f ? (o.streak[f] || 0) + 1 : 0;
                }
            }
        }

        for (const k of keys) {
            const o = this.diceDB[k];
            const e = Object.entries(o.freq).filter(([x]) => x !== '0');
            if (e.length > 0) {
                e.sort((a, b) => b[1] - a[1]);
                o.hot = +e[0][0];
                o.cold = +e[e.length - 1][0];
            }
        }

        const triple = `${d1},${d2},${d3}`;
        this.diceDB.triples[triple] = (this.diceDB.triples[triple] || 0) + 1;

        const sum = d1 + d2 + d3;
        this.diceDB.sumMom.push(sum);
        if (this.diceDB.sumMom.length > 50) this.diceDB.sumMom.shift();

        if (this.history.length > 0) {
            const prev = this.history[this.history.length - 1];
            if (prev.dice) {
                const ps = prev.dice.reduce((a, b) => a + b, 0);
                const k = `${ps}->${sum}`;
                this.diceDB.sumAf[k] = (this.diceDB.sumAf[k] || 0) + 1;
            }
        }

        const pairs = [`${d1},${d2}`, `${d2},${d3}`, `${d1},${d3}`];
        for (const p of pairs) this.diceDB.pairs[p] = (this.diceDB.pairs[p] || 0) + 1;

        const hl = arr.map(d => d >= 4 ? 'H' : 'L').join('');
        this.diceDB.hl[hl] = (this.diceDB.hl[hl] || 0) + 1;

        const oe = arr.map(d => d % 2 === 0 ? 'C' : 'L').join('');
        this.diceDB.oe[oe] = (this.diceDB.oe[oe] || 0) + 1;

        const dev = Math.max(...arr) - Math.min(...arr);
        this.diceDB.dev[dev] = (this.diceDB.dev[dev] || 0) + 1;
    }

    updateCau() {
        const R = this.history.map(h => h.result === 'Tài' ? 'T' : 'X');
        const n = R.length;
        if (n < 3) return;
        const last = R[n - 1];

        let s = 1;
        for (let i = n - 2; i >= 0; i--) { if (R[i] === last) s++; else break; }
        if (s >= 3) this.cauDB.biet[`${last}_${s}`] = (this.cauDB.biet[`${last}_${s}`] || 0) + 1;

        let a = 0;
        for (let i = n - 1; i >= 1; i--) { if (R[i] !== R[i - 1]) a++; else break; }
        if (a >= 3) this.cauDB.c11[a + 1] = (this.cauDB.c11[a + 1] || 0) + 1;

        let tR = 0, xR = 0;
        for (let i = n - 1; i >= 0 && R[i] === 'T'; i--) tR++;
        for (let i = n - 1; i >= 0 && R[i] === 'X'; i--) xR++;
        if (tR >= 4) this.cauDB.rong[tR] = (this.cauDB.rong[tR] || 0) + 1;
        if (xR >= 4) this.cauDB.ho[xR] = (this.cauDB.ho[xR] || 0) + 1;
    }

    updateMemory() {
        const R = this.history.map(h => h.result === 'Tài' ? 'T' : 'X');
        const n = R.length;
        if (n < 4) return;

        for (const len of [3, 4, 5, 6, 7, 8]) {
            if (n <= len) continue;
            const pat = R.slice(-len).join('');
            const key = `p${len}_${pat}`;
            this.mem.patterns[key] = (this.mem.patterns[key] || 0) + 1;
        }

        if (this.predictions.length > 0) {
            const lp = this.predictions[this.predictions.length - 1];
            if (lp.actual) {
                const pat = R.slice(-4).join('');
                if (lp.correct) this.mem.success[pat] = (this.mem.success[pat] || 0) + 1;
                else this.mem.fail[pat] = (this.mem.fail[pat] || 0) + 1;
            }
        }
    }

    addSession(sessionData) {
        const id = sessionData.phien || sessionData.session || sessionData.id || Date.now();
        if (this.history.length > 0 && this.history[this.history.length - 1].phien === id) return;

        const res = this.norm(sessionData.ket_qua || sessionData.result || '');
        if (!res) return;

        const d1 = sessionData.x1 || sessionData.xuc_xac_1 || 0;
        const d2 = sessionData.x2 || sessionData.xuc_xac_2 || 0;
        const d3 = sessionData.x3 || sessionData.xuc_xac_3 || 0;
        const total = sessionData.tong || (d1 + d2 + d3);

        this.updateDice(d1, d2, d3);

        this.history.push({
            phien: id,
            result: res === 'T' ? 'Tài' : 'Xỉu',
            total,
            dice: [d1, d2, d3],
            ts: Date.now()
        });
        if (this.history.length > 3000) this.history.splice(0, 500);

        this.updateCau();
        this.updateMemory();
        this.stats.fetch++;
    }

    analyzeBiet(R) {
        const n = R.length;
        if (n < 2) return [];
        const S = [];
        const last = R[n - 1];

        let streak = 1;
        for (let i = n - 2; i >= 0; i--) { if (R[i] === last) streak++; else break; }

        if (streak >= 10) S.push({ p: last === 'T' ? 'X' : 'T', c: 97, w: 3.0, s: 'biet_10', r: `Bệt ${streak}` });
        else if (streak >= 8) S.push({ p: last === 'T' ? 'X' : 'T', c: 92, w: 2.8, s: 'biet_8', r: `Bệt ${streak}` });
        else if (streak >= 6) S.push({ p: last === 'T' ? 'X' : 'T', c: 84, w: 2.3, s: 'biet_6', r: `Bệt ${streak}` });
        else if (streak >= 4) S.push({ p: last === 'T' ? 'X' : 'T', c: 68 + streak * 2, w: 1.8, s: 'biet_4', r: `Bệt ${streak}` });
        else if (streak >= 3) S.push({ p: last, c: 58 + streak * 2, w: 1.3, s: 'biet_3', r: `Bệt ngắn ${streak}` });

        let tR = 0, xR = 0;
        for (let i = n - 1; i >= 0 && R[i] === 'T'; i--) tR++;
        for (let i = n - 1; i >= 0 && R[i] === 'X'; i--) xR++;
        if (tR >= 8) S.push({ p: 'X', c: 96, w: 3.0, s: 'rong_8', r: `Rồng ${tR}` });
        else if (tR >= 6) S.push({ p: 'X', c: 86, w: 2.5, s: 'rong_6', r: `Rồng ${tR}` });
        else if (tR >= 4) S.push({ p: 'T', c: 68, w: 1.3, s: 'rong_4', r: `Rồng ngắn ${tR}` });
        if (xR >= 8) S.push({ p: 'T', c: 96, w: 3.0, s: 'ho_8', r: `Hổ ${xR}` });
        else if (xR >= 6) S.push({ p: 'T', c: 86, w: 2.5, s: 'ho_6', r: `Hổ ${xR}` });
        else if (xR >= 4) S.push({ p: 'X', c: 68, w: 1.3, s: 'ho_4', r: `Hổ ngắn ${xR}` });

        return S;
    }

    analyzeCau(R) {
        const n = R.length;
        if (n < 4) return [];
        const S = [];
        const last = R[n - 1];

        let a = 0;
        for (let i = n - 1; i >= 1; i--) { if (R[i] !== R[i - 1]) a++; else break; }
        if (a >= 3) S.push({ p: last === 'T' ? 'X' : 'T', c: Math.min(92, 65 + (a + 1) * 2), w: 1.0 + a * 0.12, s: 'cau_11', r: `1-1 (${a + 1})` });

        if (n >= 8) {
            const seg = R.slice(-8);
            let ok = true;
            for (let i = 0; i < 8; i += 2) if (seg[i] !== seg[i + 1]) { ok = false; break; }
            if (ok && seg[0] !== seg[2]) S.push({ p: n % 2 === 0 ? seg[7] : (seg[7] === 'T' ? 'X' : 'T'), c: 84, w: 1.6, s: 'cau_22', r: 'Cầu 2-2' });
        }

        if (n >= 12) {
            const seg = R.slice(-12);
            let ok = true;
            for (let i = 0; i < 12; i += 3) {
                const block = seg.slice(i, i + 3);
                if (block.length === 3 && !block.every(v => v === block[0])) { ok = false; break; }
            }
            if (ok && seg[0] !== seg[3]) S.push({ p: n % 3 === 0 ? (seg[11] === 'T' ? 'X' : 'T') : seg[11], c: 86, w: 1.5, s: 'cau_33', r: 'Cầu 3-3' });
        }

        if (n >= 6) {
            const l6 = R.slice(-6).join('');
            if (l6 === 'TXXTTT') S.push({ p: 'X', c: 77, w: 1.3, s: 'cau_123', r: '1-2-3' });
            if (l6 === 'XTTXXX') S.push({ p: 'T', c: 77, w: 1.3, s: 'cau_123', r: '1-2-3' });
            if (l6 === 'TTTXXT') S.push({ p: 'X', c: 76, w: 1.3, s: 'cau_321', r: '3-2-1' });
            if (l6 === 'XXXTTX') S.push({ p: 'T', c: 76, w: 1.3, s: 'cau_321', r: '3-2-1' });
        }

        if (n >= 7) {
            let sw = 0;
            for (let i = n - 6; i < n; i++) if (R[i] !== R[i - 1]) sw++;
            if (sw >= 5) S.push({ p: last === 'T' ? 'X' : 'T', c: 68 + sw * 2, w: 1.0, s: 'zigzag', r: `Zigzag ${sw}` });
        }

        if (n >= 10) {
            const mid = Math.floor(n / 2);
            const left = R.slice(0, mid), right = R.slice(mid).reverse();
            let m = 0;
            for (let i = 0; i < Math.min(left.length, right.length); i++) if (left[i] === right[i]) m++;
            const ratio = m / Math.min(left.length, right.length);
            if (ratio >= 0.85) {
                const mp = mid - (n - mid);
                if (mp >= 0 && mp < n) S.push({ p: R[mp], c: 62 + ratio * 15, w: 1.0, s: 'doi_xung', r: `Đối xứng ${(ratio*100).toFixed(0)}%` });
            }
        }

        if (n >= 5) {
            const l5 = R.slice(-5).join('');
            if (l5 === 'TXTXT') S.push({ p: 'X', c: 80, w: 1.2, s: 'tam_giac', r: 'Tam giác' });
            if (l5 === 'XTXTX') S.push({ p: 'T', c: 80, w: 1.2, s: 'tam_giac', r: 'Tam giác' });
        }

        return S;
    }

    analyzeDice() {
        const n = this.history.length;
        if (n < 3) return [];
        const S = [];
        const last = this.history[n - 1];
        if (!last.dice || !last.dice[0]) return S;

        const d1 = last.dice[0], d2 = last.dice[1], d3 = last.dice[2];
        const sum = d1 + d2 + d3;
        const triple = `${d1},${d2},${d3}`;

        if (sum >= 17) S.push({ p: 'X', c: 96, w: 3.0, s: 'sum_17', r: `Tổng ${sum}` });
        else if (sum >= 15) S.push({ p: 'X', c: 78, w: 2.0, s: 'sum_15', r: `Tổng ${sum}` });
        if (sum <= 4) S.push({ p: 'T', c: 96, w: 3.0, s: 'sum_4', r: `Tổng ${sum}` });
        else if (sum <= 6) S.push({ p: 'T', c: 72, w: 1.5, s: 'sum_6', r: `Tổng ${sum}` });

        const tc = this.diceDB.triples[triple] || 0;
        if (tc >= 3) {
            let at = 0, total = 0;
            for (let i = 0; i < n - 1; i++) {
                if (this.history[i].dice && this.history[i].dice.join(',') === triple) {
                    total++;
                    if (this.history[i + 1].result === 'Tài') at++;
                }
            }
            if (total >= 3) {
                const prob = at / total;
                S.push({ p: prob > 0.5 ? 'T' : 'X', c: Math.round(50 + Math.abs(prob - 0.5) * 85), w: 2.2, s: 'triple', r: `Bộ ba ${triple} (${tc} lần)` });
            }
        }

        const hs = this.diceDB.d1.hot + this.diceDB.d2.hot + this.diceDB.d3.hot;
        S.push({ p: hs >= 11 ? 'T' : 'X', c: 56, w: 0.8, s: 'hot', r: `Hot: ${this.diceDB.d1.hot}-${this.diceDB.d2.hot}-${this.diceDB.d3.hot}` });

        return S;
    }

    analyzePatternTrend(R, scores) {
        const n = R.length;
        if (n < 5) return [];
        const S = [];
        const lastScore = scores[n - 1];

        for (const len of [3, 4, 5]) {
            if (n <= len) continue;
            const pat = R.slice(-len).join('');
            const cnt = { T: 0, X: 0 };
            for (let i = 0; i < n - len; i++) {
                if (R.slice(i, i + len).join('') === pat) cnt[R[i + len]]++;
            }
            const total = cnt.T + cnt.X;
            if (total >= Math.max(3, 8 - len)) {
                const prob = cnt.T / total;
                S.push({ p: prob > 0.5 ? 'T' : 'X', c: Math.round(Math.min(90, 50 + Math.abs(prob - 0.5) * (100 - len * 5))), w: Math.max(0.5, 1.8 - len * 0.15), s: `pat_${len}`, r: `Pattern ${len} (${total} lần)` });
            }
        }

        for (const w of [5, 10]) {
            if (n < w) continue;
            const seg = R.slice(-w);
            const tc = seg.filter(r => r === 'T').length;
            const ratio = tc / w;
            if (ratio >= 0.7) S.push({ p: 'X', c: 60 + ratio * 25, w: 1.0, s: `trend_over_${w}`, r: `Quá mua ${w}` });
            else if (ratio <= 0.3) S.push({ p: 'T', c: 60 + (1 - ratio) * 25, w: 1.0, s: `trend_under_${w}`, r: `Quá bán ${w}` });
        }

        if (lastScore >= 17) S.push({ p: 'X', c: 95, w: 2.5, s: 'score_17', r: 'Điểm >= 17' });
        else if (lastScore >= 15) S.push({ p: 'X', c: 76, w: 1.5, s: 'score_15', r: 'Điểm >= 15' });
        if (lastScore <= 4) S.push({ p: 'T', c: 95, w: 2.5, s: 'score_4', r: 'Điểm <= 4' });
        else if (lastScore <= 6) S.push({ p: 'T', c: 72, w: 1.4, s: 'score_6', r: 'Điểm <= 6' });

        const l5 = R.slice(-5);
        if (l5.every(r => r === 'T')) S.push({ p: 'X', c: 84, w: 1.8, s: 'all_tai', r: '5 phiên Tài' });
        if (l5.every(r => r === 'X')) S.push({ p: 'T', c: 84, w: 1.8, s: 'all_xiu', r: '5 phiên Xỉu' });

        return S;
    }

    predict() {
        const n = this.history.length;
        if (n < 5) return { prediction: 'Cần thêm dữ liệu', confidence: 0, wait: true };

        const R = this.history.map(h => h.result === 'Tài' ? 'T' : 'X');
        const scores = this.history.map(h => h.tong || (h.dice ? h.dice.reduce((a, b) => a + b, 0) : 0));

        const all = [...this.analyzeBiet(R), ...this.analyzeCau(R), ...this.analyzeDice(), ...this.analyzePatternTrend(R, scores)];
        if (all.length === 0) return { prediction: R[n - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 50 };

        all.sort((a, b) => (b.w * b.c) - (a.w * a.c));
        const top = all.slice(0, 50);

        let sT = 0, sX = 0, tW = 0;
        for (const s of top) {
            const w = s.w * (s.c / 100);
            if (s.p === 'T') sT += w; else sX += w;
            tW += w;
        }

        if (tW === 0) return { prediction: R[n - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 50 };

        const probT = sT / tW;
        const finalPred = probT > 0.5 ? 'T' : 'X';
        let conf = Math.round(Math.abs(probT - 0.5) * 2 * 100);
        conf = Math.max(52, Math.min(98, conf));

        const t5 = top.slice(0, 5), t10 = top.slice(0, 10);
        if (t10.every(s => s.p === t10[0].p)) conf = Math.min(98, conf + 12);
        else if (t5.every(s => s.p === t5[0].p)) conf = Math.min(98, conf + 6);

        if (this.stats.lose >= 3) conf = Math.max(52, conf - 5);
        if (this.stats.win >= 5) conf = Math.min(98, conf + 5);

        this.predictions.push({
            prediction: finalPred === 'T' ? 'Tài' : 'Xỉu',
            confidence: conf,
            topSignals: top.slice(0, 5).map(s => s.s)
        });
        if (this.predictions.length > 500) this.predictions.shift();

        return {
            prediction: finalPred === 'T' ? 'Tài' : 'Xỉu',
            confidence: conf,
            totalSignals: all.length,
            dice: { hot: `${this.diceDB.d1.hot}-${this.diceDB.d2.hot}-${this.diceDB.d3.hot}`, cold: `${this.diceDB.d1.cold}-${this.diceDB.d2.cold}-${this.diceDB.d3.cold}` }
        };
    }

    feedback(actualResult) {
        if (this.predictions.length === 0) return;
        const lp = this.predictions[this.predictions.length - 1];
        lp.actual = actualResult;
        lp.correct = lp.prediction === actualResult;
        this.stats.all++;
        if (lp.correct) { this.stats.ok++; this.stats.win++; this.stats.lose = 0; if (this.stats.win > this.stats.maxW) this.stats.maxW = this.stats.win; }
        else { this.stats.lose++; this.stats.win = 0; }
    }
}

// ======================================================
// KHỞI TẠO AI
// ======================================================
const supremeAI = new SupremeAlgorithm();

// ======================================================
// ANALYZE CAU - 8 PHIÊN
// ======================================================
function analyzeCau(history) {
    if (history.length < 8) return "[Đang thu thập...]";
    const results = history.map(h => h.result === 'Tài' ? 'T' : 'X');
    const last8 = results.slice(-8);
    const patternStr = last8.join('');
    let parts = [];
    let streak = 1;
    const last = last8[last8.length - 1];
    for (let i = last8.length - 2; i >= 0; i--) { if (last8[i] === last) streak++; else break; }
    if (streak >= 3) parts.push(`Bệt ${streak} ${last === 'T' ? 'Tài' : 'Xỉu'}`);
    let is11 = true;
    for (let i = 1; i < last8.length; i++) { if (last8[i] === last8[i - 1]) { is11 = false; break; } }
    if (is11) parts.push("Cầu 1-1");
    const tCount = last8.filter(r => r === 'T').length;
    if (parts.length === 0) {
        if (tCount >= 7) parts.push("Tài áp đảo");
        else if (tCount <= 1) parts.push("Xỉu áp đảo");
        else if (tCount >= 5) parts.push("Nghiêng Tài");
        else if (tCount <= 3) parts.push("Nghiêng Xỉu");
        else parts.push("Cân bằng");
    }
    return `[${parts.join(', ')}] - ${patternStr}`;
}

// ======================================================
// CẬP NHẬT STATS
// ======================================================
function updateStats(prediction, actualResult) {
    stats.totalPredictions++;
    const isCorrect = prediction === actualResult;
    if (isCorrect) {
        stats.totalCorrect++;
        stats.currentWinStreak++;
        stats.currentLoseStreak = 0;
        if (stats.currentWinStreak > stats.maxWinStreak) stats.maxWinStreak = stats.currentWinStreak;
    } else {
        stats.totalWrong++;
        stats.currentLoseStreak++;
        stats.currentWinStreak = 0;
        if (stats.currentLoseStreak > stats.maxLoseStreak) stats.maxLoseStreak = stats.currentLoseStreak;
    }
    stats.predictionLog.push({
        timestamp: new Date().toISOString(),
        prediction, actual: actualResult, correct: isCorrect,
        winStreak: stats.currentWinStreak, loseStreak: stats.currentLoseStreak
    });
    if (stats.predictionLog.length > 200) stats.predictionLog = stats.predictionLog.slice(-200);
    saveStats(stats);
}

// ======================================================
// GLOBAL STATE
// ======================================================
let globalHistory = [];
let lastPhien = 0;
let lastPrediction = null;

// ======================================================
// ROUTES
// ======================================================
app.get("/", async (req, res) => {
    try {
        const response = await axios.get(API_URL, { timeout: 15000 });
        const rawData = response.data;
        const history = normalizeData(rawData);

        for (const item of history) {
            if (item.phien > lastPhien) {
                globalHistory.push(item);
                supremeAI.addSession(item);
                lastPhien = item.phien;
                if (lastPrediction && globalHistory.length >= 2) {
                    const prevSession = globalHistory[globalHistory.length - 2];
                    updateStats(lastPrediction, prevSession.ket_qua);
                    supremeAI.feedback(prevSession.ket_qua === 'tài' ? 'Tài' : 'Xỉu');
                    lastPrediction = null;
                }
            }
        }
        if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);

        const latest = history[history.length - 1];
        const pattern = analyzeCau(history);
        const predict = supremeAI.predict();
        lastPrediction = predict.prediction === 'Tài' ? 'tài' : 'xỉu';

        const accuracy = stats.totalPredictions > 0 ? ((stats.totalCorrect / stats.totalPredictions) * 100).toFixed(1) : '0.0';

        const result = {
            id: "AnhKhoidzai Sunwin",
            phien_truoc: latest.phien,
            xuc_xac1: latest.x1, xuc_xac2: latest.x2, xuc_xac3: latest.x3,
            tong: latest.tong, ket_qua: latest.ket_qua,
            pattern: pattern,
            phien_hien_tai: latest.phien + 1,
            du_doan: predict.prediction === 'Tài' ? 'tài' : 'xỉu',
            do_tin_cay: predict.confidence + "%",
            thong_ke: {
                tong_du_doan: stats.totalPredictions,
                dung: stats.totalCorrect, sai: stats.totalWrong,
                ti_le_dung: accuracy + "%",
                chuoi_thang_hien_tai: stats.currentWinStreak,
                chuoi_thua_hien_tai: stats.currentLoseStreak,
                chuoi_thang_max: stats.maxWinStreak,
                chuoi_thua_max: stats.maxLoseStreak
            }
        };
        console.log("JSON:", JSON.stringify(result, null, 2));
        res.json(result);
    } catch (err) {
        const accuracy = stats.totalPredictions > 0 ? ((stats.totalCorrect / stats.totalPredictions) * 100).toFixed(1) : '0.0';
        res.json({
            id: "AnhKhoidzai Sunwin",
            phien_truoc: 0, xuc_xac1: 0, xuc_xac2: 0, xuc_xac3: 0, tong: 0,
            ket_qua: "tài", pattern: "[Lỗi]", phien_hien_tai: 0, du_doan: "tài", do_tin_cay: "52%",
            thong_ke: {
                tong_du_doan: stats.totalPredictions,
                dung: stats.totalCorrect, sai: stats.totalWrong,
                ti_le_dung: accuracy + "%",
                chuoi_thang_hien_tai: stats.currentWinStreak,
                chuoi_thua_hien_tai: stats.currentLoseStreak,
                chuoi_thang_max: stats.maxWinStreak,
                chuoi_thua_max: stats.maxLoseStreak
            }
        });
    }
});

app.get("/taixiu", async (req, res) => {
    try {
        const response = await axios.get(API_URL, { timeout: 15000 });
        const rawData = response.data;
        const history = normalizeData(rawData);
        for (const item of history) {
            if (item.phien > lastPhien) {
                globalHistory.push(item);
                supremeAI.addSession(item);
                lastPhien = item.phien;
                if (lastPrediction && globalHistory.length >= 2) {
                    const prevSession = globalHistory[globalHistory.length - 2];
                    updateStats(lastPrediction, prevSession.ket_qua);
                    supremeAI.feedback(prevSession.ket_qua === 'tài' ? 'Tài' : 'Xỉu');
                    lastPrediction = null;
                }
            }
        }
        if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);
        const latest = history[history.length - 1];
        const pattern = analyzeCau(history);
        const predict = supremeAI.predict();
        lastPrediction = predict.prediction === 'Tài' ? 'tài' : 'xỉu';
        const accuracy = stats.totalPredictions > 0 ? ((stats.totalCorrect / stats.totalPredictions) * 100).toFixed(1) : '0.0';
        res.json({
            id: "AnhKhoidzai Sunwin",
            phien_truoc: latest.phien,
            xuc_xac1: latest.x1, xuc_xac2: latest.x2, xuc_xac3: latest.x3,
            tong: latest.tong, ket_qua: latest.ket_qua,
            pattern: pattern, phien_hien_tai: latest.phien + 1,
            du_doan: predict.prediction === 'Tài' ? 'tài' : 'xỉu',
            do_tin_cay: predict.confidence + "%",
            thong_ke: {
                tong_du_doan: stats.totalPredictions,
                dung: stats.totalCorrect, sai: stats.totalWrong,
                ti_le_dung: accuracy + "%",
                chuoi_thang_hien_tai: stats.currentWinStreak,
                chuoi_thua_hien_tai: stats.currentLoseStreak,
                chuoi_thang_max: stats.maxWinStreak,
                chuoi_thua_max: stats.maxLoseStreak
            }
        });
    } catch (err) {
        const accuracy = stats.totalPredictions > 0 ? ((stats.totalCorrect / stats.totalPredictions) * 100).toFixed(1) : '0.0';
        res.json({
            id: "AnhKhoidzai Sunwin",
            phien_truoc: 0, xuc_xac1: 0, xuc_xac2: 0, xuc_xac3: 0, tong: 0,
            ket_qua: "tài", pattern: "[Lỗi]", phien_hien_tai: 0, du_doan: "tài", do_tin_cay: "52%",
            thong_ke: {
                tong_du_doan: stats.totalPredictions,
                dung: stats.totalCorrect, sai: stats.totalWrong,
                ti_le_dung: accuracy + "%",
                chuoi_thang_hien_tai: stats.currentWinStreak,
                chuoi_thua_hien_tai: stats.currentLoseStreak,
                chuoi_thang_max: stats.maxWinStreak,
                chuoi_thua_max: stats.maxLoseStreak
            }
        });
    }
});

app.get("/stats", (req, res) => {
    const accuracy = stats.totalPredictions > 0 ? ((stats.totalCorrect / stats.totalPredictions) * 100).toFixed(1) : '0.0';
    res.json({
        tong_du_doan: stats.totalPredictions,
        dung: stats.totalCorrect, sai: stats.totalWrong,
        ti_le_dung: accuracy + "%",
        chuoi_thang_hien_tai: stats.currentWinStreak,
        chuoi_thua_hien_tai: stats.currentLoseStreak,
        chuoi_thang_max: stats.maxWinStreak,
        chuoi_thua_max: stats.maxLoseStreak,
        lich_su_gan_day: stats.predictionLog.slice(-10).reverse()
    });
});

app.listen(PORT, () => {
    console.log("🌟 Supreme V9 chạy tại port " + PORT);
    console.log("🔗 API: " + API_URL);
});
