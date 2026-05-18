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
// 1. MARKOV ENGINE
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
            if (conf > bestConf) {
                bestConf = conf;
                best = probTai > 0.5 ? "T" : "X";
            }
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

    static markov2(history) {
        if (history.length < 3) return null;
        const last2 = history.slice(-2);
        const trans = new Map();
        for (let i = 0; i < history.length - 2; i++) {
            const key = history[i] + ',' + history[i + 1];
            const next = history[i + 2];
            if (!trans.has(key)) trans.set(key, { T: 0, X: 0 });
            trans.get(key)[next]++;
        }
        const possible = trans.get(last2.join(','));
        if (!possible) return null;
        return possible.T > possible.X ? 'T' : (possible.X > possible.T ? 'X' : null);
    }

    static markov3(history) {
        if (history.length < 4) return null;
        const last3 = history.slice(-3);
        const trans = new Map();
        for (let i = 0; i < history.length - 3; i++) {
            const key = history.slice(i, i + 3).join(',');
            const next = history[i + 3];
            if (!trans.has(key)) trans.set(key, { T: 0, X: 0 });
            trans.get(key)[next]++;
        }
        const possible = trans.get(last3.join(','));
        if (!possible) return null;
        return possible.T > possible.X ? 'T' : (possible.X > possible.T ? 'X' : null);
    }
}

// ======================================================
// 2. MARKOV XÚC XẮC
// ======================================================
class MarkovXucXac {
    constructor(bac = 3) {
        this.bac = Math.min(4, Math.max(1, bac));
        this.transitions = new Map();
        this.history = [];
    }

    static chuyenLoai(diem) {
        if (diem === 1 || diem === 2) return 1;
        if (diem === 3 || diem === 4) return 2;
        return 3;
    }

    themDuLieu(d1, d2, d3) {
        const filtered = [d1, d2, d3].map(x => MarkovXucXac.chuyenLoai(x));
        this.history.push(...filtered);
        if (this.history.length > 60) this.history = this.history.slice(-60);
        this._xayDungMaTran();
    }

    _xayDungMaTran() {
        this.transitions.clear();
        const len = this.history.length;
        if (len < this.bac + 1) return;
        for (let i = this.bac; i < len; i++) {
            for (let b = 1; b <= this.bac; b++) {
                const state = [];
                for (let j = b - 1; j >= 0; j--) state.push(this.history[i - j]);
                const stateKey = state.join(',');
                const nextVal = this.history[i];
                if (!this.transitions.has(stateKey)) this.transitions.set(stateKey, new Map());
                const nextMap = this.transitions.get(stateKey);
                nextMap.set(nextVal, (nextMap.get(nextVal) || 0) + 1);
            }
        }
    }

    duDoan() {
        if (this.history.length < 2) return 2;
        const dem = { 1: 0, 2: 0, 3: 0 };
        this.history.forEach(v => dem[v]++);
        return dem[1] > dem[3] ? 1 : 3;
    }

    phanTich() {
        const duDoanSo = this.duDoan();
        return { p: duDoanSo === 1 ? "X" : "T", c: 60 };
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
        if (len >= 4 && h.slice(-4) === "TTXX") patterns.push({ p: 'T', c: 74 });
        if (len >= 4 && h.slice(-4) === "XXTT") patterns.push({ p: 'X', c: 74 });
        if (len >= 6 && h.slice(-6) === "TTTXXX") patterns.push({ p: 'T', c: 72 });
        if (len >= 6 && h.slice(-6) === "XXXTTT") patterns.push({ p: 'X', c: 72 });
        if (len >= 6 && h.slice(-6) === "TXXTTT") patterns.push({ p: 'X', c: 70 });
        if (len >= 6 && h.slice(-6) === "XTTXXX") patterns.push({ p: 'T', c: 70 });
        if (len >= 5 && h.slice(-5) === "TXTXT") patterns.push({ p: 'X', c: 74 });
        if (len >= 5 && h.slice(-5) === "XTXTX") patterns.push({ p: 'T', c: 74 });

        let tRun = 0;
        for (let i = len - 1; i >= 0; i--) { if (history[i] === 'T') tRun++; else break; }
        if (tRun >= 6) patterns.push({ p: 'X', c: 76 });
        else if (tRun >= 4) patterns.push({ p: 'T', c: 66 });

        let xRun = 0;
        for (let i = len - 1; i >= 0; i--) { if (history[i] === 'X') xRun++; else break; }
        if (xRun >= 6) patterns.push({ p: 'T', c: 76 });
        else if (xRun >= 4) patterns.push({ p: 'X', c: 66 });

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
        for (let i = 1; i < nums.length; i++) {
            const diff = nums[i] - nums[i - 1];
            if (diff > 0) gains += diff; else losses -= diff;
        }
        if (losses === 0) return 100;
        return 100 - (100 / (1 + gains / losses));
    }

    static entropy(history, window = 12) {
        if (history.length < window) return null;
        const recent = history.slice(-window);
        const p_t = recent.filter(r => r === 'T').length / window;
        if (p_t === 0 || p_t === 1) return recent[recent.length - 1];
        const entropy = -p_t * Math.log2(p_t) - (1 - p_t) * Math.log2(1 - p_t);
        if (entropy > 0.95) return recent[recent.length - 1] === 'T' ? 'X' : 'T';
        return recent[recent.length - 1];
    }
}

// ======================================================
// 5. MACHINE LEARNING
// ======================================================
class MachineLearning {
    static knn(history, k = 5, lookback = 10) {
        if (history.length < lookback + k) return null;
        const query = history.slice(-lookback);
        const distances = [];
        for (let i = 0; i < history.length - lookback - 1; i++) {
            let distance = 0;
            for (let j = 0; j < lookback; j++) {
                if (history[i + j] !== query[j]) distance++;
            }
            distances.push({ distance, next: history[i + lookback] });
        }
        distances.sort((a, b) => a.distance - b.distance);
        const neighbors = distances.slice(0, k).map(d => d.next);
        const tCount = neighbors.filter(n => n === 'T').length;
        return tCount > k - tCount ? 'T' : 'X';
    }

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
// 🌟 VIP SUPREME MASTER - TẤT CẢ THUẬT TOÁN
// ======================================================
class VIPSupremeMaster {
    constructor() {
        this.history = [];
        this.markovDice = new MarkovXucXac(3);
        this.betStats = {};
        this.patternMemory = new Map();
        this._initBetStats();
    }

    _initBetStats() {
        for (let len = 2; len <= 15; len++) {
            this.betStats[len] = { T: { tiep: 0, gay: 0 }, X: { tiep: 0, gay: 0 } };
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
        this.markovDice.themDuLieu(d1, d2, d3);
        this.history.push({ phien: id, result: normRes, total, dice: [d1, d2, d3] });
        if (this.history.length > 500) this.history.splice(0, 100);
        
        // Cập nhật thống kê bệt
        this._updateBetStats();
        // Cập nhật pattern memory
        this._updatePatternMemory();
    }

    _updateBetStats() {
        const R = this.getResults();
        const n = R.length;
        if (n < 3) return;
        
        for (let i = 0; i < n; i++) {
            let streak = 1;
            const current = R[i];
            for (let j = i - 1; j >= 0; j--) {
                if (R[j] === current) streak++;
                else break;
            }
            if (streak >= 2 && i + 1 < n) {
                const next = R[i + 1];
                const len = Math.min(streak, 15);
                if (next === current) {
                    this.betStats[len][current].tiep++;
                } else {
                    this.betStats[len][current].gay++;
                }
            }
        }
    }

    _updatePatternMemory() {
        const R = this.getResults();
        const n = R.length;
        if (n < 6) return;
        const key = R.slice(-6, -1).join('');
        const next = R[n - 1];
        if (!this.patternMemory.has(key)) {
            this.patternMemory.set(key, { T: 0, X: 0 });
        }
        this.patternMemory.get(key)[next]++;
    }

    getResults() { return this.history.map(h => h.result === 'Tài' ? 'T' : 'X'); }
    getScores() { return this.history.map(h => h.total || (h.dice ? h.dice.reduce((a, b) => a + b, 0) : 0)); }

    // ============================================
    // PHÂN TÍCH BỆT CHUYÊN SÂU
    // ============================================
    _analyzeBet(R) {
        const n = R.length;
        if (n < 2) return [];
        const S = [];
        const last = R[n - 1];
        let streak = 1;
        for (let i = n - 2; i >= 0; i--) { if (R[i] === last) streak++; else break; }

        const stat = this.betStats[Math.min(streak, 15)]?.[last];
        
        if (streak >= 7) {
            if (stat) {
                const total = stat.tiep + stat.gay;
                const gayRate = total > 0 ? stat.gay / total : 0.75;
                S.push({ p: last === 'T' ? 'X' : 'T', c: Math.round(70 + gayRate * 15), w: 2.5, s: 'bet_gay_dai' });
            } else {
                S.push({ p: last === 'T' ? 'X' : 'T', c: 76, w: 2.5, s: 'bet_gay_dai' });
            }
        } else if (streak >= 5) {
            if (stat) {
                const total = stat.tiep + stat.gay;
                const gayRate = total > 0 ? stat.gay / total : 0.65;
                S.push({ p: last === 'T' ? 'X' : 'T', c: Math.round(60 + gayRate * 20), w: 2.0, s: 'bet_gay_vua' });
            } else {
                S.push({ p: last === 'T' ? 'X' : 'T', c: 66, w: 2.0, s: 'bet_gay_vua' });
            }
        } else if (streak >= 3) {
            if (stat) {
                const total = stat.tiep + stat.gay;
                const tiepRate = total > 0 ? stat.tiep / total : 0.6;
                S.push({ p: last, c: Math.round(55 + tiepRate * 25), w: 1.5, s: 'bet_tiep' });
            } else {
                S.push({ p: last, c: 58, w: 1.5, s: 'bet_tiep' });
            }
        }

        return S;
    }

    // ============================================
    // PHÂN TÍCH ĐIỂM BẺ CẦU
    // ============================================
    _analyzeScoreBreak(scores, R) {
        const S = [];
        const lastScore = scores[scores.length - 1];
        const prevScore = scores.length >= 2 ? scores[scores.length - 2] : lastScore;
        const lastResult = R[R.length - 1];
        const delta = lastScore - prevScore;

        if (delta <= -5 && lastResult === 'T') S.push({ p: 'X', c: 68, w: 1.8, s: 'score_giam_manh' });
        if (delta >= 5 && lastResult === 'X') S.push({ p: 'T', c: 68, w: 1.8, s: 'score_tang_manh' });
        if (lastScore <= 4) S.push({ p: 'T', c: 78, w: 2.2, s: 'score_cuc_thap' });
        if (lastScore >= 17) S.push({ p: 'X', c: 74, w: 2.2, s: 'score_cuc_cao' });

        const last3 = scores.slice(-3);
        if (last3.every(s => s <= 7)) S.push({ p: 'T', c: 64, w: 1.5, s: 'score_3thap' });
        if (last3.every(s => s >= 14)) S.push({ p: 'X', c: 64, w: 1.5, s: 'score_3cao' });

        return S;
    }

    // ============================================
    // PHÂN TÍCH XÚC XẮC BẺ CẦU
    // ============================================
    _analyzeDiceBreak(lastDice) {
        if (!lastDice) return [];
        const S = [];
        const [d1, d2, d3] = lastDice;
        const total = d1 + d2 + d3;

        if (d1 === d2 && d2 === d3) {
            S.push({ p: d1 >= 4 ? 'X' : 'T', c: 68, w: 1.6, s: 'dice_3giong' });
        }
        const oneCount = [d1, d2, d3].filter(x => x === 1).length;
        if (oneCount >= 2) S.push({ p: 'T', c: 62, w: 1.3, s: 'dice_cap1' });
        const sixCount = [d1, d2, d3].filter(x => x === 6).length;
        if (sixCount >= 2 && total >= 15) S.push({ p: 'X', c: 62, w: 1.3, s: 'dice_cap6' });

        return S;
    }

    // ============================================
    // PHÂN TÍCH NHỊP CẦU
    // ============================================
    _analyzeRhythm(R) {
        const n = R.length;
        if (n < 10) return [];
        const S = [];
        let flips = 0;
        for (let i = n - 9; i < n; i++) { if (R[i] !== R[i - 1]) flips++; }

        if (flips >= 7) S.push({ p: R[n - 1] === 'T' ? 'X' : 'T', c: 64, w: 1.5, s: 'rhythm_zigzag' });
        if (flips <= 2) S.push({ p: R[n - 1], c: 58, w: 1.2, s: 'rhythm_bet' });

        return S;
    }

    // ============================================
    // PHÂN TÍCH CẦU NÂNG CAO
    // ============================================
    _analyzeAdvancedCau(R) {
        const n = R.length;
        if (n < 12) return [];
        const S = [];
        const last12 = R.slice(-12);
        const first6 = last12.slice(0, 6).join('');
        const last6 = last12.slice(6, 12).join('');
        
        if (first6 === last6) {
            S.push({ p: last6[0] === 'T' ? 'X' : 'T', c: 62, w: 1.3, s: 'cau_doi_xung' });
        }

        return S;
    }

    // ============================================
    // PATTERN MEMORY 5 PHIÊN
    // ============================================
    _analyzeMemory5(R) {
        if (R.length < 6) return [];
        const S = [];
        const key = R.slice(-6, -1).join('');
        const mem = this.patternMemory.get(key);
        
        if (mem && (mem.T + mem.X) >= 3) {
            const total = mem.T + mem.X;
            const probT = mem.T / total;
            if (Math.abs(probT - 0.5) >= 0.15) {
                S.push({ p: probT > 0.5 ? 'T' : 'X', c: Math.round(55 + Math.abs(probT - 0.5) * 45), w: 1.6, s: 'pattern_5' });
            }
        }
        
        return S;
    }

    // ============================================
    // 🎯 DỰ ĐOÁN TỔNG HỢP
    // ============================================
    predict() {
        const n = this.history.length;
        if (n < 5) return { prediction: 'Cần thêm dữ liệu', confidence: 50 };

        const R = this.getResults();
        const scores = this.getScores();
        const lastDice = this.history[n - 1]?.dice;

        let all = [];

        // === THUẬT TOÁN CƠ BẢN ===
        const mm = MarkovEngine.predictMultiOrder(R);
        if (mm) all.push({ ...mm, w: 1.2, s: 'markov_multi' });
        const m1 = MarkovEngine.markov1(R);
        if (m1) all.push({ p: m1, c: 55, w: 0.7, s: 'markov1' });
        const m2 = MarkovEngine.markov2(R);
        if (m2) all.push({ p: m2, c: 58, w: 0.7, s: 'markov2' });
        const m3 = MarkovEngine.markov3(R);
        if (m3) all.push({ p: m3, c: 60, w: 0.7, s: 'markov3' });

        const cauPatterns = CauDetector.detectAll(R);
        cauPatterns.forEach(p => all.push({ ...p, w: 1.0, s: 'cau_pattern' }));

        const rsiVal = TechnicalIndicators.rsi(R);
        if (rsiVal > 70) all.push({ p: 'X', c: 64, w: 0.9, s: 'rsi' });
        else if (rsiVal < 30) all.push({ p: 'T', c: 64, w: 0.9, s: 'rsi' });

        const ent = TechnicalIndicators.entropy(R);
        if (ent) all.push({ p: ent, c: 55, w: 0.7, s: 'entropy' });

        const knn = MachineLearning.knn(R);
        if (knn) all.push({ p: knn, c: 60, w: 0.9, s: 'knn' });
        const dt = MachineLearning.decisionTree(R);
        if (dt) all.push({ p: dt, c: 62, w: 0.9, s: 'decision_tree' });

        const diceMarkov = this.markovDice.phanTich();
        all.push({ p: diceMarkov.p, c: diceMarkov.c, w: 0.8, s: 'dice_markov' });

        // === THUẬT TOÁN VIP MỚI ===
        all.push(...this._analyzeBet(R));
        all.push(...this._analyzeScoreBreak(scores, R));
        all.push(...this._analyzeDiceBreak(lastDice));
        all.push(...this._analyzeRhythm(R));
        all.push(...this._analyzeAdvancedCau(R));
        all.push(...this._analyzeMemory5(R));

        if (all.length === 0) return { prediction: R[n - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 52 };

        all.sort((a, b) => (b.w * b.c) - (a.w * a.c));
        const top = all.slice(0, 35);

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
const master = new VIPSupremeMaster();

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
    console.log("🌟 VIP Supreme Master chạy tại port " + PORT);
    console.log("🔗 API: " + API_URL);
    autoScan();
});
