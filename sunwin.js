const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = "https://apivip-anhkhoi-dzaivcl.onrender.com/data";

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
            xuc_xac_1: d1, xuc_xac_2: d2, xuc_xac_3: d3,
            tong: tong,
            ket_qua: ketQua,
            result: ketQua === "tài" ? "Tài" : "Xỉu",
            dice: [d1, d2, d3]
        };
    }).filter(item => item.phien > 0 && item.tong >= 3 && item.tong <= 18);
}

// ======================================================
// 1. CAU ANALYZER - HỌC TOÀN BỘ CẦU
// ======================================================
class CauAnalyzer {
    constructor() {
        this.cauStats = {
            c11: { count: 0, tiep: 0, gay: 0, maxLen: 0 },
            c22: { count: 0, tiep: 0, gay: 0 },
            c33: { count: 0, tiep: 0, gay: 0 },
            betTai: { streaks: {}, total: 0, avgLen: 0 },
            betXiu: { streaks: {}, total: 0, avgLen: 0 },
            zigzag: { count: 0, lengths: [] },
            c123: { count: 0, success: 0 },
            tamGiac: { count: 0, success: 0 },
            doiXung: { count: 0, success: 0 },
            patterns: new Map(),
            scorePatterns: {},
            dicePatterns: {}
        };
        this.learningHistory = [];
        this.accuracy = { total: 0, correct: 0 };
        this.lastPrediction = null;
    }

    learnFromData(data) {
        if (!data || data.length < 20) return;
        const results = data.map(d => d.ket_qua === 'Tài' ? 'T' : 'X');
        const scores = data.map(d => d.tong);
        const dices = data.map(d => [d.xuc_xac_1, d.xuc_xac_2, d.xuc_xac_3]);

        this._learnC11(results);
        this._learnC22(results);
        this._learnC33(results);
        this._learnBet(results, 'T');
        this._learnBet(results, 'X');
        this._learnZigzag(results);
        this._learnC123(results);
        this._learnTamGiac(results);
        this._learnDoiXung(results);
        this._learnPatterns(results);
        this._learnScores(scores, results);
        this._learnDices(dices, results);
    }

    _learnC11(results) {
        let count = 0, currentLen = 0, maxLen = 0, inC11 = false;
        for (let i = 1; i < results.length; i++) {
            if (results[i] !== results[i - 1]) { currentLen++; inC11 = true; if (currentLen > maxLen) maxLen = currentLen; }
            else {
                if (inC11 && currentLen >= 3) {
                    count++;
                    const tiep = (i + 1 < results.length && results[i + 1] !== results[i]);
                    if (tiep) this.cauStats.c11.tiep++; else this.cauStats.c11.gay++;
                }
                currentLen = 0; inC11 = false;
            }
        }
        this.cauStats.c11.count = count; this.cauStats.c11.maxLen = maxLen;
    }

    _learnC22(results) {
        let count = 0;
        for (let i = 0; i < results.length - 4; i++) {
            if (results[i] === results[i + 1] && results[i + 2] === results[i + 3] && results[i] !== results[i + 2]) {
                count++;
                const tiep = (i + 4 < results.length && results[i + 4] === results[i + 2]);
                if (tiep) this.cauStats.c22.tiep++; else this.cauStats.c22.gay++;
            }
        }
        this.cauStats.c22.count = count;
    }

    _learnC33(results) {
        let count = 0;
        for (let i = 0; i < results.length - 6; i++) {
            if (results[i] === results[i + 1] && results[i + 1] === results[i + 2] && results[i + 3] === results[i + 4] && results[i + 4] === results[i + 5] && results[i] !== results[i + 3]) {
                count++;
                const tiep = (i + 6 < results.length && results[i + 6] === results[i]);
                if (tiep) this.cauStats.c33.tiep++; else this.cauStats.c33.gay++;
            }
        }
        this.cauStats.c33.count = count;
    }

    _learnBet(results, type) {
        const target = this.cauStats[type === 'T' ? 'betTai' : 'betXiu'];
        let streak = 0;
        for (let i = 0; i < results.length; i++) {
            if (results[i] === type) streak++;
            else { if (streak >= 2) { target.streaks[streak] = (target.streaks[streak] || 0) + 1; target.total++; } streak = 0; }
        }
        let totalLen = 0;
        for (const [len, cnt] of Object.entries(target.streaks)) totalLen += parseInt(len) * cnt;
        target.avgLen = target.total > 0 ? totalLen / target.total : 0;
    }

    _learnZigzag(results) {
        let flips = 0, zigzagStart = -1;
        for (let i = 1; i < results.length; i++) {
            if (results[i] !== results[i - 1]) { if (zigzagStart === -1) zigzagStart = i - 1; flips++; }
            else { if (flips >= 4) { this.cauStats.zigzag.count++; this.cauStats.zigzag.lengths.push(flips); } flips = 0; zigzagStart = -1; }
        }
    }

    _learnC123(results) {
        const patterns = ['TXXTTT', 'XTTXXX'];
        for (const pat of patterns) {
            for (let i = 0; i < results.length - 6; i++) {
                if (results.slice(i, i + 6).join('') === pat) {
                    this.cauStats.c123.count++;
                    const expected = pat === 'TXXTTT' ? 'X' : 'T';
                    if (i + 6 < results.length && results[i + 6] === expected) this.cauStats.c123.success++;
                }
            }
        }
    }

    _learnTamGiac(results) {
        const patterns = ['TXTXT', 'XTXTX'];
        for (const pat of patterns) {
            for (let i = 0; i < results.length - 5; i++) {
                if (results.slice(i, i + 5).join('') === pat) {
                    this.cauStats.tamGiac.count++;
                    const expected = pat === 'TXTXT' ? 'X' : 'T';
                    if (i + 5 < results.length && results[i + 5] === expected) this.cauStats.tamGiac.success++;
                }
            }
        }
    }

    _learnDoiXung(results) {
        for (let len = 3; len <= 6; len++) {
            for (let i = 0; i < results.length - len * 2; i++) {
                const left = results.slice(i, i + len);
                const right = results.slice(i + len, i + len * 2).reverse();
                let match = true;
                for (let j = 0; j < len; j++) { if (left[j] !== right[j]) { match = false; break; } }
                if (match) { this.cauStats.doiXung.count++; if (i + len * 2 < results.length && results[i + len * 2] === results[i]) this.cauStats.doiXung.success++; }
            }
        }
    }

    _learnPatterns(results) {
        for (let len = 3; len <= 7; len++) {
            for (let i = 0; i < results.length - len; i++) {
                const pattern = results.slice(i, i + len).join('');
                const next = results[i + len];
                if (!this.cauStats.patterns.has(pattern)) this.cauStats.patterns.set(pattern, { T: 0, X: 0 });
                this.cauStats.patterns.get(pattern)[next]++;
            }
        }
    }

    _learnScores(scores, results) {
        for (let i = 0; i < scores.length - 1; i++) {
            const score = scores[i];
            const next = results[i + 1];
            if (!this.cauStats.scorePatterns[score]) this.cauStats.scorePatterns[score] = { T: 0, X: 0 };
            this.cauStats.scorePatterns[score][next]++;
        }
    }

    _learnDices(dices, results) {
        for (let i = 0; i < dices.length - 1; i++) {
            const diceKey = dices[i].join('-');
            const next = results[i + 1];
            if (!this.cauStats.dicePatterns[diceKey]) this.cauStats.dicePatterns[diceKey] = { T: 0, X: 0 };
            this.cauStats.dicePatterns[diceKey][next]++;
        }
    }

    // ============================================
    // DỰ ĐOÁN
    // ============================================
    predict(R, scores, lastDice) {
        if (!R || R.length < 5) return [];
        const allPredictions = [];
        const last = R[R.length - 1];
        const lastTotal = scores[scores.length - 1];
        const dice = lastDice || [0, 0, 0];

        // 1. BỆT
        let streak = 1;
        for (let i = R.length - 2; i >= 0; i--) { if (R[i] === last) streak++; else break; }
        const betStats = last === 'T' ? this.cauStats.betTai : this.cauStats.betXiu;
        const betCount = betStats.streaks[streak] || 0;
        const longerCount = Object.entries(betStats.streaks).filter(([len]) => parseInt(len) > streak).reduce((sum, [_, cnt]) => sum + cnt, 0);
        const totalBet = betCount + longerCount;
        const tiepRate = totalBet > 0 ? betCount / totalBet : 0.5;

        if (streak >= 2 && streak <= 3) allPredictions.push({ p: last, c: Math.round(55 + tiepRate * 30), w: 2.0, s: 'bet_tiep' });
        else if (streak >= 4 && streak <= 5) { const gayRate = 1 - tiepRate; allPredictions.push({ p: last === 'T' ? 'X' : 'T', c: Math.round(60 + gayRate * 25), w: 2.5, s: 'bet_gay' }); }
        else if (streak >= 6) allPredictions.push({ p: last === 'T' ? 'X' : 'T', c: 76, w: 3.0, s: 'bet_gay_dai' });

        // 2. CẦU 1-1
        let c11Count = 1;
        for (let i = R.length - 2; i >= 0; i--) { if (R[i] !== R[i + 1]) c11Count++; else break; }
        if (c11Count >= 3) {
            const c11Ratio = this.cauStats.c11.tiep / Math.max(1, this.cauStats.c11.tiep + this.cauStats.c11.gay);
            allPredictions.push({ p: last === 'T' ? 'X' : 'T', c: Math.round(60 + c11Ratio * 30), w: 1.8, s: 'cau_11' });
        }

        // 3. CẦU 2-2
        if (R.length >= 4) {
            const last4 = R.slice(-4);
            if (last4[0] === last4[1] && last4[2] === last4[3] && last4[0] !== last4[2]) {
                const c22Ratio = this.cauStats.c22.tiep / Math.max(1, this.cauStats.c22.tiep + this.cauStats.c22.gay);
                allPredictions.push({ p: last4[2], c: Math.round(65 + c22Ratio * 20), w: 2.0, s: 'cau_22' });
            }
        }

        // 4. ZIGZAG
        let flips = 0;
        for (let i = R.length - 9; i < R.length; i++) { if (i > 0 && R[i] !== R[i - 1]) flips++; }
        if (flips >= 7) allPredictions.push({ p: last === 'T' ? 'X' : 'T', c: 68, w: 1.8, s: 'zigzag' });
        if (flips <= 2 && R.length >= 10) allPredictions.push({ p: last, c: 58, w: 1.3, s: 'it_doi' });

        // 5. ĐIỂM SỐ
        if (lastTotal <= 4) { const sd = this.cauStats.scorePatterns[lastTotal]; const probT = sd ? sd.T / (sd.T + sd.X) : 0.79; allPredictions.push({ p: 'T', c: Math.round(70 + probT * 20), w: 2.5, s: 'score_thap' }); }
        if (lastTotal >= 17) { const sd = this.cauStats.scorePatterns[lastTotal]; const probX = sd ? sd.X / (sd.T + sd.X) : 0.73; allPredictions.push({ p: 'X', c: Math.round(70 + probX * 20), w: 2.5, s: 'score_cao' }); }

        // 6. XÚC XẮC
        const diceKey = dice.join('-');
        const diceData = this.cauStats.dicePatterns[diceKey];
        if (diceData && (diceData.T + diceData.X) >= 3) {
            const probT = diceData.T / (diceData.T + diceData.X);
            if (Math.abs(probT - 0.5) > 0.1) allPredictions.push({ p: probT > 0.5 ? 'T' : 'X', c: Math.round(55 + Math.abs(probT - 0.5) * 40), w: 1.8, s: 'dice_pattern' });
        }
        const oneCount = dice.filter(x => x === 1).length;
        if (oneCount >= 2) allPredictions.push({ p: 'T', c: 68, w: 2.0, s: 'dice_cap1' });
        const sixCount = dice.filter(x => x === 6).length;
        if (sixCount >= 2) allPredictions.push({ p: 'X', c: 66, w: 2.0, s: 'dice_cap6' });

        // 7. PATTERN
        for (let len = 5; len >= 3; len--) {
            if (R.length >= len) {
                const pattern = R.slice(-len).join('');
                const patData = this.cauStats.patterns.get(pattern);
                if (patData && (patData.T + patData.X) >= 3) {
                    const probT = patData.T / (patData.T + patData.X);
                    if (Math.abs(probT - 0.5) > 0.15) {
                        allPredictions.push({ p: probT > 0.5 ? 'T' : 'X', c: Math.round(55 + Math.abs(probT - 0.5) * 40), w: 1.6, s: `pattern_${len}` });
                        break;
                    }
                }
            }
        }

        return allPredictions;
    }

    learn(actualResult) {
        if (this.lastPrediction) {
            const actual = actualResult === 'Tài' ? 'T' : 'X';
            this.accuracy.total++;
            if (this.lastPrediction === actual) this.accuracy.correct++;
            this.learningHistory.push({ time: new Date().toISOString(), predicted: this.lastPrediction, actual, correct: this.lastPrediction === actual });
            this.lastPrediction = null;
        }
    }
}

// ======================================================
// 2. MARKOV ENGINE
// ======================================================
class MarkovEngine {
    static predictMultiOrder(seq) {
        if (seq.length < 4) return null;
        let best = null, bestConf = 0;
        for (let order = 3; order <= Math.min(5, seq.length - 1); order++) {
            const last = seq.slice(-order);
            const trans = {};
            for (let i = 0; i <= seq.length - order - 1; i++) {
                const pat = seq.slice(i, i + order);
                const next = seq[i + order];
                if (!trans[pat]) trans[pat] = { T: 0, X: 0 };
                trans[pat][next]++;
            }
            const possible = trans[last];
            if (!possible) continue;
            const total = possible.T + possible.X;
            const probTai = possible.T / total;
            const conf = (Math.max(possible.T, possible.X) / total) * 100;
            if (conf > bestConf) { bestConf = conf; best = probTai > 0.5 ? "T" : "X"; }
        }
        return best ? { p: best, c: Math.round(bestConf) } : null;
    }

    static markov1(history) {
        if (history.length < 2) return null;
        const last = history[history.length - 1];
        const trans = { T: { T: 0, X: 0 }, X: { T: 0, X: 0 } };
        for (let i = 0; i < history.length - 1; i++) trans[history[i]][history[i + 1]]++;
        if (trans[last].T > trans[last].X) return 'T';
        if (trans[last].X > trans[last].T) return 'X';
        return null;
    }
}

// ======================================================
// 3. PATTERN CẦU
// ======================================================
class CauDetector {
    static detectAll(history) {
        const patterns = [];
        const h = history.join('');
        const len = history.length;
        if (len >= 4 && h.slice(-4) === "TXTX") patterns.push({ p: 'X', c: 78 });
        if (len >= 4 && h.slice(-4) === "XTXT") patterns.push({ p: 'T', c: 78 });
        if (len >= 6 && h.slice(-6) === "TXXTTT") patterns.push({ p: 'X', c: 70 });
        if (len >= 6 && h.slice(-6) === "XTTXXX") patterns.push({ p: 'T', c: 70 });
        if (len >= 5 && h.slice(-5) === "TXTXT") patterns.push({ p: 'X', c: 74 });
        if (len >= 5 && h.slice(-5) === "XTXTX") patterns.push({ p: 'T', c: 74 });
        return patterns;
    }
}

// ======================================================
// 4. CHỈ BÁO KỸ THUẬT
// ======================================================
class TechnicalIndicators {
    static rsi(history, period = 7) {
        if (history.length < period) return null;
        const nums = history.slice(-period).map(c => c === 'T' ? 1 : 0);
        let gains = 0, losses = 0;
        for (let i = 1; i < nums.length; i++) { const diff = nums[i] - nums[i - 1]; if (diff > 0) gains += diff; else losses -= diff; }
        if (losses === 0) return 100;
        return 100 - (100 / (1 + gains / losses));
    }
}

// ======================================================
// 5. MACHINE LEARNING
// ======================================================
class MachineLearning {
    static decisionTree(history) {
        if (history.length < 10) return null;
        const last1 = history[history.length - 1];
        const last2 = history.length > 1 ? history[history.length - 2] : null;
        const last3 = history.length > 2 ? history[history.length - 3] : null;
        const t5 = history.slice(-5).filter(c => c === 'T').length;
        if (last1 === 'T' && last2 === 'T' && last3 === 'T') return 'X';
        if (last1 === 'X' && last2 === 'X' && last3 === 'X') return 'T';
        if (t5 >= 4) return 'X';
        if (t5 <= 1) return 'T';
        return last1;
    }
}

// ======================================================
// 🌟 SUPREME AI MASTER - TỔNG HỢP TẤT CẢ
// ======================================================
class SupremeAIMaster {
    constructor() {
        this.history = [];
        this.cauAnalyzer = new CauAnalyzer();
        this._initialized = false;
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
        this.history.push({ phien: id, result: normRes, total, dice: [d1, d2, d3] });
        if (this.history.length > 500) this.history.splice(0, 100);

        // Học từ dữ liệu mỗi 50 phiên
        if (this.history.length >= 20 && this.history.length % 20 === 0) {
            this.cauAnalyzer.learnFromData(this.history);
        }
    }

    getResults() { return this.history.map(h => h.result === 'Tài' ? 'T' : 'X'); }
    getScores() { return this.history.map(h => h.total || (h.dice ? h.dice.reduce((a, b) => a + b, 0) : 0)); }

    predict() {
        const n = this.history.length;
        if (n < 5) return { prediction: 'Cần thêm dữ liệu', confidence: 50 };

        // Học nếu chưa có
        if (!this._initialized && n >= 20) {
            this.cauAnalyzer.learnFromData(this.history);
            this._initialized = true;
        }

        const R = this.getResults();
        const scores = this.getScores();
        const lastDice = this.history[n - 1]?.dice;

        let all = [];

        // === THUẬT TOÁN CƠ BẢN ===
        const mm = MarkovEngine.predictMultiOrder(R);
        if (mm) all.push({ ...mm, w: 1.0, s: 'markov_multi' });
        const m1 = MarkovEngine.markov1(R);
        if (m1) all.push({ p: m1, c: 55, w: 0.6, s: 'markov1' });

        const cauPatterns = CauDetector.detectAll(R);
        cauPatterns.forEach(p => all.push({ ...p, w: 0.9, s: 'cau_pattern' }));

        const rsiVal = TechnicalIndicators.rsi(R);
        if (rsiVal > 70) all.push({ p: 'X', c: 64, w: 0.8, s: 'rsi' });
        else if (rsiVal < 30) all.push({ p: 'T', c: 64, w: 0.8, s: 'rsi' });

        const dt = MachineLearning.decisionTree(R);
        if (dt) all.push({ p: dt, c: 62, w: 0.8, s: 'decision_tree' });

        // === THUẬT TOÁN AI MASTER (CauAnalyzer) ===
        const aiPreds = this.cauAnalyzer.predict(R, scores, lastDice);
        all.push(...aiPreds.map(p => ({ ...p, w: p.w || 1.5 })));

        if (all.length === 0) return { prediction: R[n - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 52 };

        all.sort((a, b) => (b.w * b.c) - (a.w * a.c));
        const top = all.slice(0, 30);

        let sT = 0, sX = 0, tW = 0;
        for (const s of top) {
            const w = s.w * (s.c / 100);
            if (s.p === 'T') sT += w; else sX += w;
            tW += w;
        }

        if (tW === 0) return { prediction: R[n - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 52 };

        const probT = sT / tW;
        const finalPred = probT > 0.5 ? 'T' : 'X';
        let conf = Math.round(Math.abs(probT - 0.5) * 2 * 100);

        if (all.length < 5) conf = Math.min(conf, 62);
        else if (all.length < 10) conf = Math.min(conf, 72);
        else if (all.length < 15) conf = Math.min(conf, 78);

        const t3 = top.slice(0, 3), t5 = top.slice(0, 5);
        if (t5.every(s => s.p === t5[0].p) && all.length >= 12) conf = Math.min(82, conf + 5);
        else if (t3.every(s => s.p === t3[0].p) && all.length >= 8) conf = Math.min(78, conf + 3);

        conf = Math.max(52, Math.min(84, conf));
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
const master = new SupremeAIMaster();

// ======================================================
// ANALYZE CAU - 10 PHIÊN
// ======================================================
function analyzeCau(history) {
    if (history.length < 10) return "[Đang thu thập...]";
    const results = history.map(h => h.result === 'Tài' ? 'T' : 'X');
    const last10 = results.slice(-10);
    const patternStr = last10.join('');
    let parts = [];

    let streak = 1;
    const last = last10[last10.length - 1];
    for (let i = last10.length - 2; i >= 0; i--) { if (last10[i] === last) streak++; else break; }
    if (streak >= 3) parts.push(`Bệt ${streak} ${last === 'T' ? 'Tài' : 'Xỉu'}`);

    let is11 = true;
    for (let i = 1; i < last10.length; i++) { if (last10[i] === last10[i - 1]) { is11 = false; break; } }
    if (is11) parts.push("Cầu 1-1");

    const tCount = last10.filter(r => r === 'T').length;
    if (parts.length === 0) {
        if (tCount >= 9) parts.push("Tài áp đảo");
        else if (tCount <= 1) parts.push("Xỉu áp đảo");
        else if (tCount >= 7) parts.push("Nghiêng Tài");
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
                master.addSession(item);
                lastPhien = item.phien;
            }
        }
        if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);

        const latest = history[history.length - 1];
        const pattern = analyzeCau(history);
        const predict = master.predict();

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
        res.json({
            id: "AnhKhoidzai Sunwin",
            phien_truoc: 0, xuc_xac1: 0, xuc_xac2: 0, xuc_xac3: 0, tong: 0,
            ket_qua: "tài", pattern: "[Lỗi]", phien_hien_tai: 0, du_doan: "tài", do_tin_cay: "52%"
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
                master.addSession(item);
                lastPhien = item.phien;
            }
        }
        if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);

        const latest = history[history.length - 1];
        const pattern = analyzeCau(history);
        const predict = master.predict();

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
// AUTO SCAN MỖI 0.3 GIÂY
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
                    master.addSession(item);
                    lastPhien = item.phien;
                }
            }
            if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);
        } catch (e) {}
    }, 300);
}

app.listen(PORT, () => {
    console.log("🌟 Supreme AI Master chạy tại port " + PORT);
    console.log("🔗 API: " + API_URL);
    autoScan();
});
