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
const STATS_FILE = path.join(__dirname, "master_stats.json");

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
// 🎯 MASTER ALGORITHM - CỰC CHUẨN
// ======================================================
class MasterAlgorithm {
    constructor() {
        this.history = [];
        this.predictions = [];
        this.stats = { correct: 0, total: 0, win: 0, maxWin: 0, lose: 0 };
        
        // DICE DATABASE
        this.diceDB = {
            d1: { freq: {}, trans: {}, hot: 3, cold: 3, streak: {} },
            d2: { freq: {}, trans: {}, hot: 3, cold: 3, streak: {} },
            d3: { freq: {}, trans: {}, hot: 3, cold: 3, streak: {} },
            triples: {},
            pairs: {},
            sumAfter: {},
            sumMomentum: []
        };
        
        // PATTERN MEMORY
        this.patternMemory = {};
        this.successPatterns = {};
        this.failPatterns = {};
    }

    normResult(r) {
        if (!r) return null;
        r = r.charAt(0).toUpperCase() + r.slice(1).toLowerCase();
        if (['T', 'Tai', 'Tài'].includes(r)) return 'T';
        if (['X', 'Xiu', 'Xỉu'].includes(r)) return 'X';
        return null;
    }

    updateDice(d1, d2, d3) {
        const dice = [d1, d2, d3];
        const names = ['d1', 'd2', 'd3'];

        for (let i = 0; i < 3; i++) {
            const obj = this.diceDB[names[i]];
            const f = dice[i];
            obj.freq[f] = (obj.freq[f] || 0) + 1;

            if (this.history.length > 0) {
                const prev = this.history[this.history.length - 1];
                if (prev.dice) {
                    const pf = prev.dice[i];
                    const key = `${pf}->${f}`;
                    obj.trans[key] = (obj.trans[key] || 0) + 1;
                    if (pf === f) obj.streak[f] = (obj.streak[f] || 0) + 1;
                    else obj.streak[f] = 0;
                }
            }
        }

        for (const n of names) {
            const obj = this.diceDB[n];
            const entries = Object.entries(obj.freq);
            if (entries.length > 0) {
                entries.sort((a, b) => b[1] - a[1]);
                obj.hot = parseInt(entries[0][0]);
                obj.cold = parseInt(entries[entries.length - 1][0]);
            }
        }

        const triple = `${d1},${d2},${d3}`;
        this.diceDB.triples[triple] = (this.diceDB.triples[triple] || 0) + 1;

        const sum = d1 + d2 + d3;
        this.diceDB.sumMomentum.push(sum);
        if (this.diceDB.sumMomentum.length > 50) this.diceDB.sumMomentum.shift();

        if (this.history.length > 0) {
            const prev = this.history[this.history.length - 1];
            if (prev.dice) {
                const ps = prev.dice.reduce((a, b) => a + b, 0);
                const key = `${ps}->${sum}`;
                this.diceDB.sumAfter[key] = (this.diceDB.sumAfter[key] || 0) + 1;
            }
        }

        const pairs = [`${d1},${d2}`, `${d2},${d3}`, `${d1},${d3}`];
        for (const p of pairs) this.diceDB.pairs[p] = (this.diceDB.pairs[p] || 0) + 1;
    }

    updatePatternMemory() {
        const results = this.history.map(h => h.result === 'Tài' ? 'T' : 'X');
        const n = results.length;
        if (n < 4) return;

        for (const len of [3, 4, 5]) {
            if (n <= len) continue;
            const pattern = results.slice(-len).join('');
            const key = `p${len}_${pattern}`;
            this.patternMemory[key] = (this.patternMemory[key] || 0) + 1;
        }

        if (this.predictions.length > 0) {
            const lastPred = this.predictions[this.predictions.length - 1];
            if (lastPred.actual) {
                const pattern = results.slice(-4).join('');
                if (lastPred.correct) {
                    this.successPatterns[pattern] = (this.successPatterns[pattern] || 0) + 1;
                } else {
                    this.failPatterns[pattern] = (this.failPatterns[pattern] || 0) + 1;
                }
            }
        }
    }

    extractStreaks(results) {
        const streaks = [];
        let cur = 1, ct = results[0];
        for (let i = 1; i < results.length; i++) {
            if (results[i] === ct) cur++;
            else { if (cur >= 3) streaks.push({ type: ct, len: cur }); ct = results[i]; cur = 1; }
        }
        if (cur >= 3) streaks.push({ type: ct, len: cur });
        return streaks;
    }

    calcBreakProb(results, result, streak) {
        const allStreaks = this.extractStreaks(results);
        const sameType = allStreaks.filter(s => s.type === result);
        if (sameType.length === 0) return streak > 8 ? 0.7 : 0.5;
        const exactMatch = sameType.filter(s => s.len === streak).length;
        const longerMatch = sameType.filter(s => s.len > streak).length;
        const total = exactMatch + longerMatch;
        if (total === 0) return streak > 8 ? 0.7 : 0.5;
        return Math.min(0.9, Math.max(0.1, exactMatch / total + streak * 0.02));
    }

    analyzeBiet(results) {
        const n = results.length;
        if (n < 2) return [];
        const S = [];
        const last = results[n - 1];

        let streak = 1;
        for (let i = n - 2; i >= 0; i--) { if (results[i] === last) streak++; else break; }

        const bp = this.calcBreakProb(results, last, streak);

        if (streak >= 10) S.push({ p: last === 'T' ? 'X' : 'T', c: 97, w: 3.0, s: 'biet_10', r: `Bệt siêu dài ${streak}` });
        else if (streak >= 8) S.push({ p: last === 'T' ? 'X' : 'T', c: 92, w: 2.8, s: 'biet_8', r: `Bệt rất dài ${streak}` });
        else if (streak >= 6) S.push({ p: last === 'T' ? 'X' : 'T', c: 84, w: 2.3, s: 'biet_6', r: `Bệt dài ${streak}` });
        else if (streak >= 4) {
            const pred = bp > 0.55 ? (last === 'T' ? 'X' : 'T') : last;
            S.push({ p: pred, c: 65 + streak * 3, w: 1.8, s: 'biet_4', r: `Bệt ${streak}` });
        } else if (streak >= 3) S.push({ p: last, c: 58 + streak * 2, w: 1.3, s: 'biet_3', r: `Bệt ngắn ${streak}` });

        let tRun = 0, xRun = 0;
        for (let i = n - 1; i >= 0 && results[i] === 'T'; i--) tRun++;
        for (let i = n - 1; i >= 0 && results[i] === 'X'; i--) xRun++;

        if (tRun >= 8) S.push({ p: 'X', c: 96, w: 3.0, s: 'rong_8', r: `Rồng ${tRun}` });
        else if (tRun >= 6) S.push({ p: 'X', c: 86, w: 2.5, s: 'rong_6', r: `Rồng ${tRun}` });
        else if (tRun >= 4) S.push({ p: 'T', c: 68, w: 1.3, s: 'rong_4', r: `Rồng ngắn ${tRun}` });

        if (xRun >= 8) S.push({ p: 'T', c: 96, w: 3.0, s: 'ho_8', r: `Hổ ${xRun}` });
        else if (xRun >= 6) S.push({ p: 'T', c: 86, w: 2.5, s: 'ho_6', r: `Hổ ${xRun}` });
        else if (xRun >= 4) S.push({ p: 'X', c: 68, w: 1.3, s: 'ho_4', r: `Hổ ngắn ${xRun}` });

        return S;
    }

    analyzeCau(results) {
        const n = results.length;
        if (n < 4) return [];
        const S = [];
        const last = results[n - 1];

        let alt = 0;
        for (let i = n - 1; i >= 1; i--) { if (results[i] !== results[i - 1]) alt++; else break; }
        if (alt >= 3) S.push({ p: last === 'T' ? 'X' : 'T', c: Math.min(92, 65 + (alt + 1) * 2), w: 1.0 + alt * 0.12, s: 'cau_11', r: `1-1 (${alt + 1})` });

        if (n >= 8) {
            const seg = results.slice(-8);
            let ok = true;
            for (let i = 0; i < 8; i += 2) if (seg[i] !== seg[i + 1]) { ok = false; break; }
            if (ok && seg[0] !== seg[2]) S.push({ p: n % 2 === 0 ? seg[7] : (seg[7] === 'T' ? 'X' : 'T'), c: 84, w: 1.6, s: 'cau_22', r: 'Cầu 2-2' });
        }

        if (n >= 12) {
            const seg = results.slice(-12);
            let ok = true;
            for (let i = 0; i < 12; i += 3) {
                const block = seg.slice(i, i + 3);
                if (block.length === 3 && !block.every(v => v === block[0])) { ok = false; break; }
            }
            if (ok && seg[0] !== seg[3]) S.push({ p: n % 3 === 0 ? (seg[11] === 'T' ? 'X' : 'T') : seg[11], c: 86, w: 1.5, s: 'cau_33', r: 'Cầu 3-3' });
        }

        if (n >= 6) {
            const l6 = results.slice(-6).join('');
            if (l6 === 'TXXTTT') S.push({ p: 'X', c: 77, w: 1.3, s: 'cau_123', r: '1-2-3' });
            if (l6 === 'XTTXXX') S.push({ p: 'T', c: 77, w: 1.3, s: 'cau_123', r: '1-2-3' });
            if (l6 === 'TTTXXT') S.push({ p: 'X', c: 76, w: 1.3, s: 'cau_321', r: '3-2-1' });
            if (l6 === 'XXXTTX') S.push({ p: 'T', c: 76, w: 1.3, s: 'cau_321', r: '3-2-1' });
        }

        if (n >= 7) {
            let sw = 0;
            for (let i = n - 6; i < n; i++) if (results[i] !== results[i - 1]) sw++;
            if (sw >= 5) S.push({ p: last === 'T' ? 'X' : 'T', c: 68 + sw * 2, w: 1.0, s: 'zigzag', r: `Zigzag ${sw}` });
        }

        if (n >= 10) {
            const mid = Math.floor(n / 2);
            const left = results.slice(0, mid), right = results.slice(mid).reverse();
            let m = 0;
            for (let i = 0; i < Math.min(left.length, right.length); i++) if (left[i] === right[i]) m++;
            const ratio = m / Math.min(left.length, right.length);
            if (ratio >= 0.85) {
                const mp = mid - (n - mid);
                if (mp >= 0 && mp < n) S.push({ p: results[mp], c: 62 + ratio * 15, w: 1.0, s: 'doi_xung', r: `Đối xứng ${(ratio*100).toFixed(0)}%` });
            }
        }

        if (n >= 5) {
            const l5 = results.slice(-5).join('');
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
                const pred = prob > 0.5 ? 'T' : 'X';
                S.push({ p: pred, c: Math.round(50 + Math.abs(prob - 0.5) * 85), w: 2.2, s: 'triple', r: `Bộ ba ${triple} (${tc} lần)` });
            }
        }

        const names = ['d1', 'd2', 'd3'];
        const faces = [d1, d2, d3];
        for (let i = 0; i < 3; i++) {
            const obj = this.diceDB[names[i]];
            const cf = faces[i];
            let bf = cf, bc = 0;
            for (let f = 1; f <= 6; f++) {
                const key = `${cf}->${f}`;
                const c = obj.trans[key] || 0;
                if (c > bc) { bc = c; bf = f; }
            }
            if (bc >= 3 && bf !== cf) {
                const ps = (i === 0 ? bf : d1) + (i === 1 ? bf : d2) + (i === 2 ? bf : d3);
                S.push({ p: ps >= 11 ? 'T' : 'X', c: 50 + Math.min(25, bc * 5), w: 1.1, s: `dice_d${i + 1}`, r: `Viên ${i + 1}: ${cf}->${bf} (${bc})` });
            }
        }

        const hs = this.diceDB.d1.hot + this.diceDB.d2.hot + this.diceDB.d3.hot;
        const cs = this.diceDB.d1.cold + this.diceDB.d2.cold + this.diceDB.d3.cold;
        S.push({ p: hs >= 11 ? 'T' : 'X', c: 56, w: 0.8, s: 'hot', r: `Hot: ${this.diceDB.d1.hot}-${this.diceDB.d2.hot}-${this.diceDB.d3.hot}` });

        if (n >= 2) {
            const prev = this.history[n - 2];
            if (prev.dice) {
                const ps = prev.dice.reduce((a, b) => a + b, 0);
                const key = `${ps}->${sum}`;
                const kc = this.diceDB.sumAfter[key] || 0;
                if (kc >= 3) S.push({ p: sum >= 11 ? 'T' : 'X', c: 55 + Math.min(20, kc * 3), w: 1.0, s: 'sum_after', r: `${ps}->${sum} (${kc})` });
            }
        }

        return S;
    }

    analyzePatternTrend(results, scores) {
        const n = results.length;
        if (n < 5) return [];
        const S = [];
        const lastScore = scores[n - 1];

        for (const len of [3, 4, 5]) {
            if (n <= len) continue;
            const pat = results.slice(-len).join('');
            const cnt = { T: 0, X: 0 };
            for (let i = 0; i < n - len; i++) {
                if (results.slice(i, i + len).join('') === pat) cnt[results[i + len]]++;
            }
            const total = cnt.T + cnt.X;
            if (total >= Math.max(3, 10 - len)) {
                const prob = cnt.T / total;
                S.push({ p: prob > 0.5 ? 'T' : 'X', c: Math.round(Math.min(90, 50 + Math.abs(prob - 0.5) * (100 - len * 5))), w: Math.max(0.5, 1.8 - len * 0.15), s: `pat_${len}`, r: `Pattern ${len} (${total} lần)` });
            }
        }

        for (const w of [5, 10, 15]) {
            if (n < w) continue;
            const seg = results.slice(-w);
            const tc = seg.filter(r => r === 'T').length;
            const ratio = tc / w;
            if (ratio >= 0.7) S.push({ p: 'X', c: 60 + ratio * 25, w: 1.0, s: `trend_over_${w}`, r: `Quá mua ${w}` });
            else if (ratio <= 0.3) S.push({ p: 'T', c: 60 + (1 - ratio) * 25, w: 1.0, s: `trend_under_${w}`, r: `Quá bán ${w}` });
        }

        if (lastScore >= 17) S.push({ p: 'X', c: 95, w: 2.5, s: 'score_17', r: 'Điểm >= 17' });
        else if (lastScore >= 15) S.push({ p: 'X', c: 76, w: 1.5, s: 'score_15', r: 'Điểm >= 15' });
        if (lastScore <= 4) S.push({ p: 'T', c: 95, w: 2.5, s: 'score_4', r: 'Điểm <= 4' });
        else if (lastScore <= 6) S.push({ p: 'T', c: 72, w: 1.4, s: 'score_6', r: 'Điểm <= 6' });

        const l5 = results.slice(-5);
        if (l5.every(r => r === 'T')) S.push({ p: 'X', c: 84, w: 1.8, s: 'all_tai', r: '5 phiên Tài' });
        if (l5.every(r => r === 'X')) S.push({ p: 'T', c: 84, w: 1.8, s: 'all_xiu', r: '5 phiên Xỉu' });

        // Pattern memory
        if (n >= 4) {
            const pat = results.slice(-4).join('');
            const sCount = this.successPatterns[pat] || 0;
            const fCount = this.failPatterns[pat] || 0;
            const total = sCount + fCount;
            if (total >= 3) {
                const ratio = sCount / total;
                if (ratio >= 0.7) S.push({ p: results[n - 1], c: 55 + ratio * 25, w: 1.1, s: 'memory_win', r: `Pattern thắng (${(ratio*100).toFixed(0)}%)` });
            }
        }

        return S;
    }

    predict() {
        const n = this.history.length;
        if (n < 5) return { prediction: 'Cần thêm dữ liệu', confidence: 0, wait: true };

        const results = this.history.map(h => h.result === 'Tài' ? 'T' : 'X');
        const scores = this.history.map(h => h.tong || (h.dice ? h.dice.reduce((a, b) => a + b, 0) : 0));

        const allSignals = [
            ...this.analyzeBiet(results),
            ...this.analyzeCau(results),
            ...this.analyzeDice(),
            ...this.analyzePatternTrend(results, scores)
        ];

        if (allSignals.length === 0) return { prediction: results[n - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 50 };

        allSignals.sort((a, b) => (b.w * b.c) - (a.w * a.c));
        const topSignals = allSignals.slice(0, 50);

        let sT = 0, sX = 0, tW = 0;
        for (const s of topSignals) {
            const w = s.w * (s.c / 100);
            if (s.p === 'T') sT += w; else sX += w;
            tW += w;
        }

        if (tW === 0) return { prediction: results[n - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 50 };

        const probT = sT / tW;
        const finalPred = probT > 0.5 ? 'T' : 'X';
        let confidence = Math.round(Math.abs(probT - 0.5) * 2 * 100);
        confidence = Math.max(52, Math.min(98, confidence));

        const top5 = topSignals.slice(0, 5), top10 = topSignals.slice(0, 10);
        if (top10.every(s => s.p === top10[0].p)) confidence = Math.min(98, confidence + 12);
        else if (top5.every(s => s.p === top5[0].p)) confidence = Math.min(98, confidence + 6);

        if (this.stats.lose >= 3) confidence = Math.max(52, confidence - 5);
        if (this.stats.win >= 5) confidence = Math.min(98, confidence + 5);

        this.predictions.push({
            prediction: finalPred === 'T' ? 'Tài' : 'Xỉu',
            confidence,
            topSignals: topSignals.slice(0, 5).map(s => s.s)
        });
        if (this.predictions.length > 500) this.predictions.shift();

        return {
            prediction: finalPred === 'T' ? 'Tài' : 'Xỉu',
            confidence,
            totalSignals: allSignals.length,
            dice: {
                hot: `${this.diceDB.d1.hot}-${this.diceDB.d2.hot}-${this.diceDB.d3.hot}`,
                cold: `${this.diceDB.d1.cold}-${this.diceDB.d2.cold}-${this.diceDB.d3.cold}`
            }
        };
    }

    addSession(sessionData) {
        const id = sessionData.phien || sessionData.session || sessionData.id || Date.now();
        if (this.history.length > 0 && this.history[this.history.length - 1].phien === id) return;

        const res = this.normResult(sessionData.ket_qua || sessionData.result || '');
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

        this.updatePatternMemory();
    }

    feedback(actualResult) {
        if (this.predictions.length === 0) return;
        const lp = this.predictions[this.predictions.length - 1];
        lp.actual = actualResult;
        lp.correct = lp.prediction === actualResult;
        this.stats.total++;
        if (lp.correct) { this.stats.correct++; this.stats.win++; this.stats.lose = 0; if (this.stats.win > this.stats.maxWin) this.stats.maxWin = this.stats.win; }
        else { this.stats.lose++; this.stats.win = 0; }
    }
}

// ======================================================
// KHỞI TẠO AI
// ======================================================
const masterAI = new MasterAlgorithm();

// ======================================================
// ANALYZE CAU - 7 PHIÊN
// ======================================================
function analyzeCau(history) {
    if (history.length < 7) return "[Đang thu thập...]";
    const results = history.map(h => h.result === 'Tài' ? 'T' : 'X');
    const last7 = results.slice(-7);
    const patternStr = last7.join('');
    let parts = [];
    let streak = 1;
    const last = last7[last7.length - 1];
    for (let i = last7.length - 2; i >= 0; i--) { if (last7[i] === last) streak++; else break; }
    if (streak >= 3) parts.push(`Bệt ${streak} ${last === 'T' ? 'Tài' : 'Xỉu'}`);
    let is11 = true;
    for (let i = 1; i < last7.length; i++) { if (last7[i] === last7[i - 1]) { is11 = false; break; } }
    if (is11) parts.push("Cầu 1-1");
    const tCount = last7.filter(r => r === 'T').length;
    if (parts.length === 0) {
        if (tCount >= 6) parts.push("Tài áp đảo");
        else if (tCount <= 1) parts.push("Xỉu áp đảo");
        else if (tCount >= 5) parts.push("Nghiêng Tài");
        else if (tCount <= 2) parts.push("Nghiêng Xỉu");
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
                masterAI.addSession(item);
                lastPhien = item.phien;
                if (lastPrediction && globalHistory.length >= 2) {
                    const prevSession = globalHistory[globalHistory.length - 2];
                    updateStats(lastPrediction, prevSession.ket_qua);
                    masterAI.feedback(prevSession.ket_qua === 'tài' ? 'Tài' : 'Xỉu');
                    lastPrediction = null;
                }
            }
        }
        if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);

        const latest = history[history.length - 1];
        const pattern = analyzeCau(history);
        const predict = masterAI.predict();
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
                masterAI.addSession(item);
                lastPhien = item.phien;
                if (lastPrediction && globalHistory.length >= 2) {
                    const prevSession = globalHistory[globalHistory.length - 2];
                    updateStats(lastPrediction, prevSession.ket_qua);
                    masterAI.feedback(prevSession.ket_qua === 'tài' ? 'Tài' : 'Xỉu');
                    lastPrediction = null;
                }
            }
        }
        if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);
        const latest = history[history.length - 1];
        const pattern = analyzeCau(history);
        const predict = masterAI.predict();
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
    console.log("🎯 Master Algorithm chạy tại port " + PORT);
    console.log("🔗 API: " + API_URL);
});
