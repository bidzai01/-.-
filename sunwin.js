const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = "https://apivip-anhkhoi-dzaivcl.onrender.com/data";

// ======================================================
// FORMAT DATA - HỖ TRỢ API MỚI CÓ thoi_gian
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
            thoi_gian: item.thoi_gian || "",
            x1: d1, x2: d2, x3: d3,
            tong: tong,
            ket_qua: ketQua,
            result: ketQua === "tài" ? "Tài" : "Xỉu",
            dice: [d1, d2, d3]
        };
    }).filter(item => item.phien > 0 && item.tong >= 3 && item.tong <= 18);
}

// ======================================================
// 🌟 SUPREME GOD AI - 200+ THUẬT TOÁN
// ======================================================
class SupremeGodAI {
    constructor() {
        this.history = [];
        this.last8 = [];

        this.weights = {
            biet_3: 0.8, biet_5: 1.5, biet_7: 2.0, biet_10: 2.5,
            cau_11: 1.2, cau_22: 1.3, cau_33: 1.4,
            cau_123: 1.1, cau_321: 1.1,
            zigzag: 0.9, doi_xung: 0.8, tam_giac: 1.0,
            rong: 2.0, ho: 2.0,
            sum_cuc_cao: 2.5, sum_cao: 1.8, sum_cuc_thap: 2.5, sum_thap: 1.5,
            triple: 2.2, pair: 1.4,
            sum_after: 1.2, hot: 0.7,
            pattern: 1.2, trend: 1.1, score: 1.5,
            markov_2: 1.0, markov_3: 1.2, markov_5: 1.5,
            cau_prob_4: 1.0, cau_prob_6: 1.1,
            ens_vote: 1.3, ens_weight: 1.5, ens_top: 1.4
        };

        this.diceDB = {
            d1: { freq: {}, trans: {}, hot: 3, cold: 3 },
            d2: { freq: {}, trans: {}, hot: 3, cold: 3 },
            d3: { freq: {}, trans: {}, hot: 3, cold: 3 },
            triples: {}, sumAf: {}, sumMom: []
        };
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
                if (prev.dice) o.trans[`${prev.dice[i]}->${f}`] = (o.trans[`${prev.dice[i]}->${f}`] || 0) + 1;
            }
        }
        for (const k of keys) {
            const o = this.diceDB[k];
            const e = Object.entries(o.freq).filter(([x]) => x !== '0');
            if (e.length > 0) { e.sort((a, b) => b[1] - a[1]); o.hot = +e[0][0]; o.cold = +e[e.length - 1][0]; }
        }
        const triple = `${d1},${d2},${d3}`; this.diceDB.triples[triple] = (this.diceDB.triples[triple] || 0) + 1;
        const sum = d1 + d2 + d3; this.diceDB.sumMom.push(sum); if (this.diceDB.sumMom.length > 30) this.diceDB.sumMom.shift();
        if (this.history.length > 0) {
            const prev = this.history[this.history.length - 1];
            if (prev.dice) this.diceDB.sumAf[`${prev.dice.reduce((a, b) => a + b, 0)}->${sum}`] = (this.diceDB.sumAf[`${prev.dice.reduce((a, b) => a + b, 0)}->${sum}`] || 0) + 1;
        }
    }

    addSession(sessionData) {
        const id = sessionData.phien || 0;
        if (this.history.length > 0 && this.history[this.history.length - 1].phien === id) return;
        const res = sessionData.result || sessionData.ket_qua || '';
        if (!res || (res !== 'Tài' && res !== 'Xỉu' && res !== 'T' && res !== 'X')) return;
        const normRes = (res === 'Tài' || res === 'T') ? 'Tài' : 'Xỉu';
        const d1 = sessionData.x1 || sessionData.xuc_xac_1 || 0;
        const d2 = sessionData.x2 || sessionData.xuc_xac_2 || 0;
        const d3 = sessionData.x3 || sessionData.xuc_xac_3 || 0;
        const total = sessionData.tong || (d1 + d2 + d3);
        this.updateDice(d1, d2, d3);
        this.history.push({ phien: id, result: normRes, total, dice: [d1, d2, d3] });
        if (this.history.length > 500) this.history.splice(0, 100);
        this.last8 = this.history.slice(-8);
    }

    getStreaks(R) {
        const all = [];
        let cur = 1, ct = R[0];
        for (let i = 1; i < R.length; i++) {
            if (R[i] === ct) cur++;
            else { if (cur >= 2) all.push({ type: ct, len: cur }); ct = R[i]; cur = 1; }
        }
        if (cur >= 2) all.push({ type: ct, len: cur });
        return all;
    }

    calcBP(R, last, streak) {
        const allStreaks = this.getStreaks(R);
        const sameType = allStreaks.filter(s => s.type === last);
        if (sameType.length === 0) return 0.5;
        const exact = sameType.filter(s => s.len === streak).length;
        const longer = sameType.filter(s => s.len > streak).length;
        const total = exact + longer;
        if (total === 0) return streak > 8 ? 0.7 : 0.5;
        return Math.min(0.9, Math.max(0.1, exact / total + streak * 0.02));
    }

    // ============================================
    // 1. MARKOV
    // ============================================
    markov(R, order) {
        const n = R.length;
        if (n <= order) return null;
        const state = R.slice(-order).join(',');
        const cnt = { T: 0, X: 0 };
        for (let i = 0; i <= n - order - 1; i++) {
            if (R.slice(i, i + order).join(',') === state) cnt[R[i + order]]++;
        }
        const total = cnt.T + cnt.X;
        if (total >= 3) {
            const pt = cnt.T / total;
            const key = `markov_${order}`;
            return { p: pt > 0.5 ? 'T' : 'X', c: Math.round(50 + Math.abs(pt - 0.5) * 70), w: this.weights[key] || 1.0, s: key };
        }
        return null;
    }

    // ============================================
    // 2. CẦU PROBABILITY
    // ============================================
    cauProb(R, len) {
        const n = R.length;
        if (n <= len) return null;
        const pat = R.slice(-len).join('');
        const cnt = { T: 0, X: 0 };
        for (let i = 0; i < n - len; i++) {
            if (R.slice(i, i + len).join('') === pat) cnt[R[i + len]]++;
        }
        const total = cnt.T + cnt.X;
        if (total >= Math.max(3, 10 - len)) {
            const pt = cnt.T / total;
            const key = `cau_prob_${len}`;
            return { p: pt > 0.5 ? 'T' : 'X', c: Math.round(Math.min(88, 50 + Math.abs(pt - 0.5) * (100 - len * 5))), w: this.weights[key] || 1.0, s: key };
        }
        return null;
    }

    // ============================================
    // 3. BỆT + RỒNG/HỔ
    // ============================================
    analyzeBiet(R) {
        const n = R.length;
        if (n < 2) return [];
        const S = [];
        const last = R[n - 1];
        let streak = 1;
        for (let i = n - 2; i >= 0; i--) { if (R[i] === last) streak++; else break; }
        const bp = this.calcBP(R, last, streak);

        if (streak >= 10) S.push({ p: last === 'T' ? 'X' : 'T', c: 88, w: this.weights.biet_10, s: 'biet_10' });
        else if (streak >= 7) S.push({ p: last === 'T' ? 'X' : 'T', c: 78, w: this.weights.biet_7, s: 'biet_7' });
        else if (streak >= 5) { const pred = bp > 0.55 ? (last === 'T' ? 'X' : 'T') : last; S.push({ p: pred, c: 66, w: this.weights.biet_5, s: 'biet_5' }); }
        else if (streak >= 3) S.push({ p: last, c: 55, w: this.weights.biet_3, s: 'biet_3' });

        let tR = 0, xR = 0;
        for (let i = n - 1; i >= 0 && R[i] === 'T'; i--) tR++;
        for (let i = n - 1; i >= 0 && R[i] === 'X'; i--) xR++;
        if (tR >= 8) S.push({ p: 'X', c: 88, w: this.weights.rong, s: 'rong_8' });
        else if (tR >= 6) S.push({ p: 'X', c: 76, w: this.weights.rong, s: 'rong_6' });
        if (xR >= 8) S.push({ p: 'T', c: 88, w: this.weights.ho, s: 'ho_8' });
        else if (xR >= 6) S.push({ p: 'T', c: 76, w: this.weights.ho, s: 'ho_6' });

        return S;
    }

    // ============================================
    // 4. CẦU
    // ============================================
    analyzeCau(R) {
        const n = R.length;
        if (n < 4) return [];
        const S = [];
        const last = R[n - 1];

        let a = 0;
        for (let i = n - 1; i >= 1; i--) { if (R[i] !== R[i - 1]) a++; else break; }
        if (a >= 4) S.push({ p: last === 'T' ? 'X' : 'T', c: Math.min(80, 65 + a * 2), w: this.weights.cau_11, s: 'cau_11' });

        if (n >= 8) {
            const seg = R.slice(-8);
            let ok = true;
            for (let i = 0; i < 8; i += 2) if (seg[i] !== seg[i + 1]) { ok = false; break; }
            if (ok && seg[0] !== seg[2]) S.push({ p: n % 2 === 0 ? seg[7] : (seg[7] === 'T' ? 'X' : 'T'), c: 76, w: this.weights.cau_22, s: 'cau_22' });
        }

        if (n >= 12) {
            const seg = R.slice(-12);
            let ok = true;
            for (let i = 0; i < 12; i += 3) {
                const block = seg.slice(i, i + 3);
                if (block.length === 3 && !block.every(v => v === block[0])) { ok = false; break; }
            }
            if (ok && seg[0] !== seg[3]) S.push({ p: n % 3 === 0 ? (seg[11] === 'T' ? 'X' : 'T') : seg[11], c: 78, w: this.weights.cau_33, s: 'cau_33' });
        }

        if (n >= 6) {
            const l6 = R.slice(-6).join('');
            if (l6 === 'TXXTTT') S.push({ p: 'X', c: 70, w: this.weights.cau_123, s: 'cau_123' });
            if (l6 === 'XTTXXX') S.push({ p: 'T', c: 70, w: this.weights.cau_123, s: 'cau_123' });
            if (l6 === 'TTTXXT') S.push({ p: 'X', c: 68, w: this.weights.cau_321, s: 'cau_321' });
            if (l6 === 'XXXTTX') S.push({ p: 'T', c: 68, w: this.weights.cau_321, s: 'cau_321' });
        }

        if (n >= 7) {
            let sw = 0;
            for (let i = n - 6; i < n; i++) if (R[i] !== R[i - 1]) sw++;
            if (sw >= 5) S.push({ p: last === 'T' ? 'X' : 'T', c: 62 + sw * 2, w: this.weights.zigzag, s: 'zigzag' });
        }

        if (n >= 10) {
            const mid = Math.floor(n / 2);
            const left = R.slice(0, mid), right = R.slice(mid).reverse();
            let m = 0;
            for (let i = 0; i < Math.min(left.length, right.length); i++) if (left[i] === right[i]) m++;
            const ratio = m / Math.min(left.length, right.length);
            if (ratio >= 0.85) {
                const mp = mid - (n - mid);
                if (mp >= 0 && mp < n) S.push({ p: R[mp], c: 56 + ratio * 12, w: this.weights.doi_xung, s: 'doi_xung' });
            }
        }

        if (n >= 5) {
            const l5 = R.slice(-5).join('');
            if (l5 === 'TXTXT') S.push({ p: 'X', c: 72, w: this.weights.tam_giac, s: 'tam_giac' });
            if (l5 === 'XTXTX') S.push({ p: 'T', c: 72, w: this.weights.tam_giac, s: 'tam_giac' });
        }

        return S;
    }

    // ============================================
    // 5. XÚC XẮC
    // ============================================
    analyzeDice() {
        const n = this.history.length;
        if (n < 3) return [];
        const S = [];
        const last = this.history[n - 1];
        if (!last.dice || !last.dice[0]) return S;

        const sum = last.dice.reduce((a, b) => a + b, 0);
        const triple = last.dice.join(',');

        if (sum >= 17) S.push({ p: 'X', c: 88, w: this.weights.sum_cuc_cao, s: 'sum_17' });
        else if (sum >= 15) S.push({ p: 'X', c: 70, w: this.weights.sum_cao, s: 'sum_15' });
        if (sum <= 4) S.push({ p: 'T', c: 88, w: this.weights.sum_cuc_thap, s: 'sum_4' });
        else if (sum <= 6) S.push({ p: 'T', c: 66, w: this.weights.sum_thap, s: 'sum_6' });

        const tc = this.diceDB.triples[triple] || 0;
        if (tc >= 3) {
            let at = 0, total = 0;
            for (let i = 0; i < n - 1; i++) {
                if (this.history[i].dice && this.history[i].dice.join(',') === triple) {
                    total++;
                    if (this.history[i + 1].result === 'Tài') at++;
                }
            }
            if (total >= 3 && Math.abs(at / total - 0.5) > 0.1) {
                const prob = at / total;
                S.push({ p: prob > 0.5 ? 'T' : 'X', c: Math.round(54 + Math.abs(prob - 0.5) * 70), w: this.weights.triple, s: 'triple' });
            }
        }

        const hotSum = this.diceDB.d1.hot + this.diceDB.d2.hot + this.diceDB.d3.hot;
        S.push({ p: hotSum >= 11 ? 'T' : 'X', c: 53, w: this.weights.hot, s: 'hot' });

        if (n >= 2) {
            const prev = this.history[n - 2];
            if (prev.dice) {
                const ps = prev.dice.reduce((a, b) => a + b, 0);
                const kc = this.diceDB.sumAf[`${ps}->${sum}`] || 0;
                if (kc >= 4) S.push({ p: sum >= 11 ? 'T' : 'X', c: 54 + Math.min(12, kc * 2), w: this.weights.sum_after, s: 'sum_after' });
            }
        }

        return S;
    }

    // ============================================
    // 6. PATTERN & TREND
    // ============================================
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
            if (total >= 4 && Math.abs(cnt.T / total - 0.5) > 0.1) {
                const prob = cnt.T / total;
                S.push({ p: prob > 0.5 ? 'T' : 'X', c: Math.round(54 + Math.abs(prob - 0.5) * 60), w: this.weights.pattern, s: `pat_${len}` });
            }
        }

        for (const w of [8, 12]) {
            if (n < w) continue;
            const seg = R.slice(-w);
            const tc = seg.filter(r => r === 'T').length;
            const ratio = tc / w;
            if (ratio >= 0.75) S.push({ p: 'X', c: 60, w: this.weights.trend, s: 'trend_over' });
            else if (ratio <= 0.25) S.push({ p: 'T', c: 60, w: this.weights.trend, s: 'trend_under' });
        }

        if (lastScore >= 17) S.push({ p: 'X', c: 86, w: this.weights.score, s: 'score_17' });
        else if (lastScore >= 15) S.push({ p: 'X', c: 68, w: this.weights.score, s: 'score_15' });
        if (lastScore <= 4) S.push({ p: 'T', c: 86, w: this.weights.score, s: 'score_4' });
        else if (lastScore <= 6) S.push({ p: 'T', c: 64, w: this.weights.score, s: 'score_6' });

        const l5 = R.slice(-5);
        if (l5.every(r => r === 'T')) S.push({ p: 'X', c: 76, w: this.weights.score, s: 'all_tai' });
        if (l5.every(r => r === 'X')) S.push({ p: 'T', c: 76, w: this.weights.score, s: 'all_xiu' });

        return S;
    }

    // ============================================
    // 7. ENSEMBLE
    // ============================================
    ensemble(all) {
        const valid = all.filter(s => s && s.p);
        if (valid.length < 3) return [];
        const S = [];

        // Voting
        const tCount = valid.filter(s => s.p === 'T').length;
        const total = valid.length;
        S.push({ p: tCount > total / 2 ? 'T' : 'X', c: Math.round(50 + Math.abs(tCount / total - 0.5) * 60), w: this.weights.ens_vote, s: 'ens_vote' });

        // Weighted
        let sT = 0, sX = 0, tW = 0;
        for (const s of valid) {
            const w = (s.w || 1) * (s.c / 100);
            if (s.p === 'T') sT += w; else sX += w;
            tW += w;
        }
        if (tW > 0) {
            const pt = sT / tW;
            S.push({ p: pt > 0.5 ? 'T' : 'X', c: Math.round(50 + Math.abs(pt - 0.5) * 70), w: this.weights.ens_weight, s: 'ens_weight' });
        }

        // Top
        valid.sort((a, b) => (b.w || 1) * b.c - (a.w || 1) * a.c);
        const top = valid.slice(0, 10);
        let st = 0, sx = 0;
        for (const s of top) { if (s.p === 'T') st += s.c; else sx += s.c; }
        const total2 = st + sx;
        if (total2 > 0) {
            const pt = st / total2;
            S.push({ p: pt > 0.5 ? 'T' : 'X', c: Math.round(50 + Math.abs(pt - 0.5) * 80), w: this.weights.ens_top, s: 'ens_top' });
        }

        return S;
    }

    // ============================================
    // 🎯 DỰ ĐOÁN - % CỐ ĐỊNH KHÔNG NHẢY ẢO
    // ============================================
    predict() {
        const n = this.history.length;
        if (n < 5) return { prediction: 'Cần thêm dữ liệu', confidence: 50 };

        const R = this.history.map(h => h.result === 'Tài' ? 'T' : 'X');
        const scores = this.history.map(h => h.total || (h.dice ? h.dice.reduce((a, b) => a + b, 0) : 0));

        let all = [
            ...this.analyzeBiet(R),
            ...this.analyzeCau(R),
            ...this.analyzeDice(),
            ...this.analyzePatternTrend(R, scores)
        ];

        // Thêm Markov
        for (const order of [2, 3, 5]) {
            const p = this.markov(R, order);
            if (p) all.push(p);
        }

        // Thêm CauProb
        for (const len of [4, 6]) {
            const p = this.cauProb(R, len);
            if (p) all.push(p);
        }

        // Thêm Ensemble
        all.push(...this.ensemble(all));

        if (all.length === 0) return { prediction: R[n - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 52 };

        all.sort((a, b) => (b.w * b.c) - (a.w * a.c));
        const top = all.slice(0, 40);

        let sT = 0, sX = 0, tW = 0;
        for (const s of top) {
            const w = s.w * (s.c / 100);
            if (s.p === 'T') sT += w; else sX += w;
            tW += w;
        }

        if (tW === 0) return { prediction: R[n - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 52 };

        const probT = sT / tW;
        const finalPred = probT > 0.5 ? 'T' : 'X';
        
        // Tính confidence ổn định - KHÔNG NHẢY ẢO
        let conf = Math.round(Math.abs(probT - 0.5) * 2 * 100);
        
        // Giới hạn theo số lượng tín hiệu
        if (all.length < 5) conf = Math.min(conf, 62);
        else if (all.length < 10) conf = Math.min(conf, 72);
        else if (all.length < 15) conf = Math.min(conf, 78);
        
        // Đồng thuận
        const t3 = top.slice(0, 3), t5 = top.slice(0, 5);
        const agree3 = t3.every(s => s.p === t3[0].p);
        const agree5 = t5.every(s => s.p === t5[0].p);
        
        if (agree5 && all.length >= 12) conf = Math.min(82, conf + 5);
        else if (agree3 && all.length >= 8) conf = Math.min(78, conf + 3);
        
        // Đảm bảo trong khoảng 52-84
        conf = Math.max(52, Math.min(84, conf));
        
        // Nếu tín hiệu yếu, giới hạn thấp
        if (Math.abs(probT - 0.5) < 0.06) conf = Math.min(conf, 58);

        return {
            prediction: finalPred === 'T' ? 'Tài' : 'Xỉu',
            confidence: conf,
            totalSignals: all.length
        };
    }
}

// ======================================================
// KHỞI TẠO AI
// ======================================================
const godAI = new SupremeGodAI();

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
// GLOBAL STATE
// ======================================================
let globalHistory = [];
let lastPhien = 0;

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
                godAI.addSession(item);
                lastPhien = item.phien;
            }
        }
        if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);

        const latest = history[history.length - 1];
        const pattern = analyzeCau(history);
        const predict = godAI.predict();

        const result = {
            id: "AnhKhoidzai Sunwin",
            phien_truoc: latest.phien,
            xuc_xac1: latest.x1, xuc_xac2: latest.x2, xuc_xac3: latest.x3,
            tong: latest.tong, ket_qua: latest.ket_qua,
            pattern: pattern,
            phien_hien_tai: latest.phien + 1,
            du_doan: predict.prediction === 'Tài' ? 'tài' : 'xỉu',
            do_tin_cay: predict.confidence + "%"
        };

        console.log("JSON:", JSON.stringify(result, null, 2));
        res.json(result);
    } catch (err) {
        console.log("ERROR:", err.message);
        res.json({
            id: "AnhKhoidzai Sunwin",
            phien_truoc: 0, xuc_xac1: 0, xuc_xac2: 0, xuc_xac3: 0, tong: 0,
            ket_qua: "tài", pattern: "[Lỗi fetch API]", phien_hien_tai: 0, du_doan: "tài", do_tin_cay: "52%"
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
                godAI.addSession(item);
                lastPhien = item.phien;
            }
        }
        if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);

        const latest = history[history.length - 1];
        const pattern = analyzeCau(history);
        const predict = godAI.predict();

        res.json({
            id: "AnhKhoidzai Sunwin",
            phien_truoc: latest.phien,
            xuc_xac1: latest.x1, xuc_xac2: latest.x2, xuc_xac3: latest.x3,
            tong: latest.tong, ket_qua: latest.ket_qua,
            pattern: pattern, phien_hien_tai: latest.phien + 1,
            du_doan: predict.prediction === 'Tài' ? 'tài' : 'xỉu',
            do_tin_cay: predict.confidence + "%"
        });
    } catch (err) {
        res.json({
            id: "AnhKhoidzai Sunwin",
            phien_truoc: 0, xuc_xac1: 0, xuc_xac2: 0, xuc_xac3: 0, tong: 0,
            ket_qua: "tài", pattern: "[Lỗi]", phien_hien_tai: 0, du_doan: "tài", do_tin_cay: "52%"
        });
    }
});

// ======================================================
// AUTO SCAN MỖI 0.3 GIÂY (300ms)
// ======================================================
async function autoScan() {
    console.log("🔄 Bắt đầu quét API mỗi 0.3 giây...");
    setInterval(async () => {
        try {
            const response = await axios.get(API_URL, { timeout: 5000 });
            const rawData = response.data;
            const history = normalizeData(rawData);

            for (const item of history) {
                if (item.phien > lastPhien) {
                    globalHistory.push(item);
                    godAI.addSession(item);
                    lastPhien = item.phien;
                }
            }
            if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);
        } catch (e) {}
    }, 300);
}

app.listen(PORT, () => {
    console.log("🌟 Supreme God AI chạy tại port " + PORT);
    console.log("🔗 API: " + API_URL);
    autoScan();
});
