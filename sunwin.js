const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = "https://apivip-anhkhoi-dzaivcl.onrender.com/data";

// ======================================================
// FILE LƯU TRỮ THỐNG KÊ
// ======================================================
const STATS_FILE = path.join(__dirname, "cosmic_stats.json");

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
        totalPredictions: 0,
        totalCorrect: 0,
        totalWrong: 0,
        currentWinStreak: 0,
        currentLoseStreak: 0,
        maxWinStreak: 0,
        maxLoseStreak: 0,
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
// 🌌 COSMIC PREDICTOR - VŨ TRỤ DỰ ĐOÁN
// ======================================================
class CosmicPredictor {
    constructor() {
        this.history = [];
        this.predictions = [];
        this.accuracy = { correct: 0, total: 0 };
        this.winStreak = 0;
        this.maxWinStreak = 0;
        this.loseStreak = 0;

        // Dice Engine
        this.diceEngine = {
            triples: new Map(),
            pairs: { '12': new Map(), '23': new Map(), '13': new Map() },
            transitions: { d1: {}, d2: {}, d3: {} },
            momentum: [],
            hotFaces: { d1: 1, d2: 1, d3: 1 },
            coldFaces: { d1: 1, d2: 1, d3: 1 },
            sumAfter: new Map()
        };

        // Cau Engine
        this.cauEngine = {
            biet: new Map(),
            weights: new Map()
        };

        // Genetic Pool
        this.geneticPool = [];
        this.generation = 0;
        this.initGenetic();
    }

    initGenetic() {
        for (let i = 0; i < 50; i++) {
            this.geneticPool.push({
                bietWeight: Math.random() * 2,
                cauWeight: Math.random() * 2,
                diceWeight: Math.random() * 2,
                trendWeight: Math.random() * 2,
                patternWeight: Math.random() * 2,
                specialWeight: Math.random() * 2,
                fitness: 0
            });
        }
    }

    // ============================================
    // SUPER DICE ANALYSIS
    // ============================================
    superDiceAnalysis() {
        const signals = [];
        const n = this.history.length;
        if (n < 3) return signals;

        const last = this.history[n - 1];
        if (!last.dice || !last.dice[0]) return signals;

        const d1 = last.dice[0], d2 = last.dice[1], d3 = last.dice[2];
        const sum = d1 + d2 + d3;
        const triple = `${d1},${d2},${d3}`;

        // Tổng cực đoan
        if (sum >= 17) signals.push({ p: 'X', c: 96, w: 3.0, s: 'dice_sum_cực_cao', r: `Tổng ${sum} - Cực cao` });
        else if (sum >= 15) signals.push({ p: 'X', c: 80, w: 2.0, s: 'dice_sum_cao', r: `Tổng ${sum} - Cao` });
        if (sum <= 4) signals.push({ p: 'T', c: 96, w: 3.0, s: 'dice_sum_cực_thấp', r: `Tổng ${sum} - Cực thấp` });
        else if (sum <= 6) signals.push({ p: 'T', c: 75, w: 1.8, s: 'dice_sum_thấp', r: `Tổng ${sum} - Thấp` });

        // Bộ ba lặp
        this.diceEngine.triples.set(triple, (this.diceEngine.triples.get(triple) || 0) + 1);
        const tripleCount = this.diceEngine.triples.get(triple);

        if (tripleCount >= 3) {
            let afterTai = 0, afterTotal = 0;
            for (let i = 0; i < n - 1; i++) {
                if (this.history[i].dice && this.history[i].dice.join(',') === triple) {
                    afterTotal++;
                    if (this.history[i + 1].result === 'Tài') afterTai++;
                }
            }
            if (afterTotal >= 3) {
                const prob = afterTai / afterTotal;
                const pred = prob > 0.5 ? 'T' : 'X';
                const conf = 50 + Math.abs(prob - 0.5) * 90;
                signals.push({
                    p: pred,
                    c: Math.round(Math.min(98, conf)),
                    w: 2.2,
                    s: 'dice_triple_repeat',
                    r: `Bộ ba ${triple} lặp ${tripleCount} lần (Tài: ${(prob*100).toFixed(0)}%)`
                });
            }
        }

        // Cặp xúc xắc
        const pairs = { '12': `${d1},${d2}`, '23': `${d2},${d3}`, '13': `${d1},${d3}` };
        for (const [key, pairStr] of Object.entries(pairs)) {
            this.diceEngine.pairs[key].set(pairStr, (this.diceEngine.pairs[key].get(pairStr) || 0) + 1);
            const pairCount = this.diceEngine.pairs[key].get(pairStr);

            if (pairCount >= 5) {
                let afterTai = 0, afterTotal = 0;
                for (let i = 0; i < n - 1; i++) {
                    if (!this.history[i].dice) continue;
                    let currentPair;
                    if (key === '12') currentPair = `${this.history[i].dice[0]},${this.history[i].dice[1]}`;
                    else if (key === '23') currentPair = `${this.history[i].dice[1]},${this.history[i].dice[2]}`;
                    else currentPair = `${this.history[i].dice[0]},${this.history[i].dice[2]}`;

                    if (currentPair === pairStr) {
                        afterTotal++;
                        if (this.history[i + 1].result === 'Tài') afterTai++;
                    }
                }
                if (afterTotal >= 3) {
                    const prob = afterTai / afterTotal;
                    signals.push({
                        p: prob > 0.5 ? 'T' : 'X',
                        c: Math.round(50 + Math.abs(prob - 0.5) * 70),
                        w: 1.4,
                        s: `dice_pair_${key}`,
                        r: `Cặp ${key}: ${pairStr} (${pairCount} lần, Tài: ${(prob*100).toFixed(0)}%)`
                    });
                }
            }
        }

        // Hot/Cold faces
        this.updateHotColdFaces();
        const hotSum = this.diceEngine.hotFaces.d1 + this.diceEngine.hotFaces.d2 + this.diceEngine.hotFaces.d3;
        signals.push({ p: hotSum >= 11 ? 'T' : 'X', c: 58, w: 0.9, s: 'dice_hot', r: `Hot faces: ${this.diceEngine.hotFaces.d1}-${this.diceEngine.hotFaces.d2}-${this.diceEngine.hotFaces.d3}` });

        // Tổng sau tổng
        if (n >= 2) {
            const prev = this.history[n - 2];
            if (prev.dice) {
                const prevSum = prev.dice.reduce((a, b) => a + b, 0);
                const prevSumKey = `${prevSum}`;
                if (!this.diceEngine.sumAfter.has(prevSumKey)) {
                    this.diceEngine.sumAfter.set(prevSumKey, new Map());
                }
                const afterMap = this.diceEngine.sumAfter.get(prevSumKey);
                afterMap.set(sum, (afterMap.get(sum) || 0) + 1);

                if (n >= 5) {
                    const totalAfter = Array.from(afterMap.values()).reduce((a, b) => a + b, 0);
                    if (totalAfter >= 5) {
                        let bestSum = 3, bestCount = 0;
                        for (const [s, count] of afterMap.entries()) {
                            if (count > bestCount) { bestCount = count; bestSum = parseInt(s); }
                        }
                        signals.push({
                            p: bestSum >= 11 ? 'T' : 'X',
                            c: Math.round(50 + (bestCount / totalAfter) * 45),
                            w: 1.2,
                            s: 'dice_sum_after',
                            r: `Sau ${prevSum} -> ${bestSum} (${bestCount}/${totalAfter})`
                        });
                    }
                }
            }
        }

        // Momentum
        this.diceEngine.momentum.push(sum);
        if (this.diceEngine.momentum.length > 20) this.diceEngine.momentum.shift();
        if (this.diceEngine.momentum.length >= 5) {
            const recentMomentum = this.diceEngine.momentum.slice(-5);
            const trend = recentMomentum[recentMomentum.length - 1] - recentMomentum[0];
            if (Math.abs(trend) >= 5) {
                signals.push({
                    p: trend > 0 ? 'T' : 'X',
                    c: 55 + Math.abs(trend) * 2,
                    w: 1.1,
                    s: 'dice_momentum',
                    r: `Momentum ${trend > 0 ? 'tăng' : 'giảm'} ${Math.abs(trend)}`
                });
            }
        }

        return signals;
    }

    updateHotColdFaces() {
        const freqMaps = [{}, {}, {}];
        for (const h of this.history.slice(-50)) {
            if (!h.dice) continue;
            for (let i = 0; i < 3; i++) freqMaps[i][h.dice[i]] = (freqMaps[i][h.dice[i]] || 0) + 1;
        }
        const diceNames = ['d1', 'd2', 'd3'];
        for (let i = 0; i < 3; i++) {
            const entries = Object.entries(freqMaps[i]);
            if (entries.length > 0) {
                entries.sort((a, b) => b[1] - a[1]);
                this.diceEngine.hotFaces[diceNames[i]] = parseInt(entries[0][0]);
                this.diceEngine.coldFaces[diceNames[i]] = parseInt(entries[entries.length - 1][0]);
            }
        }
    }

    // ============================================
    // SUPER CAU ANALYSIS
    // ============================================
    superCauAnalysis(results, scores) {
        const n = results.length;
        const signals = [];
        if (n < 3) return signals;
        const last = results[n - 1];

        // Bệt
        let streak = 1;
        for (let i = n - 2; i >= 0; i--) { if (results[i] === last) streak++; else break; }

        if (streak >= 10) signals.push({ p: last === 'T' ? 'X' : 'T', c: 97, w: 3.0, s: 'biet_cực_đại', r: `Bệt siêu dài ${streak}` });
        else if (streak >= 8) signals.push({ p: last === 'T' ? 'X' : 'T', c: 92, w: 2.5, s: 'biet_rất_dài', r: `Bệt rất dài ${streak}` });
        else if (streak >= 6) signals.push({ p: last === 'T' ? 'X' : 'T', c: 82, w: 2.0, s: 'biet_dài', r: `Bệt dài ${streak}` });
        else if (streak >= 4) signals.push({ p: last === 'T' ? 'X' : 'T', c: 68 + streak * 3, w: 1.5, s: 'biet_vừa', r: `Bệt ${streak}` });
        else if (streak >= 3) signals.push({ p: last, c: 55 + streak * 3, w: 1.2, s: 'biet_ngắn', r: `Bệt ngắn ${streak}` });

        // Rồng/Hổ
        let tRun = 0, xRun = 0;
        for (let i = n - 1; i >= 0 && results[i] === 'T'; i--) tRun++;
        for (let i = n - 1; i >= 0 && results[i] === 'X'; i--) xRun++;

        if (tRun >= 8) signals.push({ p: 'X', c: 96, w: 3.0, s: 'rong_đại', r: `Rồng đại ${tRun}` });
        else if (tRun >= 6) signals.push({ p: 'X', c: 86, w: 2.5, s: 'rong', r: `Rồng ${tRun}` });
        else if (tRun >= 4) signals.push({ p: 'T', c: 70, w: 1.3, s: 'rong_nhỏ', r: `Rồng nhỏ ${tRun}` });

        if (xRun >= 8) signals.push({ p: 'T', c: 96, w: 3.0, s: 'hổ_đại', r: `Hổ đại ${xRun}` });
        else if (xRun >= 6) signals.push({ p: 'T', c: 86, w: 2.5, s: 'hổ', r: `Hổ ${xRun}` });
        else if (xRun >= 4) signals.push({ p: 'X', c: 70, w: 1.3, s: 'hổ_nhỏ', r: `Hổ nhỏ ${xRun}` });

        // Cầu 1-1
        let altCount = 0;
        for (let i = n - 1; i >= 1; i--) { if (results[i] !== results[i - 1]) altCount++; else break; }
        if (altCount >= 4) signals.push({ p: last === 'T' ? 'X' : 'T', c: Math.min(92, 68 + altCount * 2), w: 1.0 + altCount * 0.15, s: `cau_11_${altCount}`, r: `Cầu 1-1 (${altCount + 1} phiên)` });

        // Cầu 2-2
        if (n >= 8) {
            let seg = results.slice(-8);
            let is22 = true;
            for (let i = 0; i < 8; i += 2) if (seg[i] !== seg[i + 1]) { is22 = false; break; }
            if (is22 && seg[0] !== seg[2]) {
                signals.push({ p: n % 2 === 0 ? seg[7] : (seg[7] === 'T' ? 'X' : 'T'), c: 84, w: 1.6, s: 'cau_22', r: 'Cầu 2-2' });
            }
        }

        // Cầu 3-3
        if (n >= 12) {
            let seg = results.slice(-12);
            let is33 = true;
            for (let i = 0; i < 12; i += 3) {
                let block = seg.slice(i, i + 3);
                if (block.length === 3 && !block.every(v => v === block[0])) { is33 = false; break; }
            }
            if (is33 && seg[0] !== seg[3]) {
                signals.push({ p: n % 3 === 0 ? (seg[11] === 'T' ? 'X' : 'T') : seg[11], c: 86, w: 1.5, s: 'cau_33', r: 'Cầu 3-3' });
            }
        }

        // 1-2-3 & 3-2-1
        if (n >= 6) {
            let l6 = results.slice(-6).join('');
            if (l6 === 'TXXTTT') signals.push({ p: 'X', c: 77, w: 1.3, s: 'cau_123', r: 'Cầu 1-2-3' });
            if (l6 === 'XTTXXX') signals.push({ p: 'T', c: 77, w: 1.3, s: 'cau_123', r: 'Cầu 1-2-3' });
            if (l6 === 'TTTXXT') signals.push({ p: 'X', c: 76, w: 1.3, s: 'cau_321', r: 'Cầu 3-2-1' });
            if (l6 === 'XXXTTX') signals.push({ p: 'T', c: 76, w: 1.3, s: 'cau_321', r: 'Cầu 3-2-1' });
        }

        // Zigzag
        if (n >= 7) {
            let sw = 0;
            for (let i = n - 6; i < n; i++) if (results[i] !== results[i - 1]) sw++;
            if (sw >= 5) signals.push({ p: last === 'T' ? 'X' : 'T', c: 68 + sw * 2, w: 1.0 + sw * 0.1, s: 'zigzag', r: `Zigzag ${sw}` });
        }

        // Tam giác
        if (n >= 5) {
            let l5 = results.slice(-5).join('');
            if (l5 === 'TXTXT') signals.push({ p: 'X', c: 80, w: 1.2, s: 'tam_giac', r: 'Tam giác' });
            if (l5 === 'XTXTX') signals.push({ p: 'T', c: 80, w: 1.2, s: 'tam_giac', r: 'Tam giác' });
        }

        // Đối xứng
        if (n >= 10) {
            let mid = Math.floor(n / 2);
            let left = results.slice(0, mid), right = results.slice(mid).reverse();
            let matches = 0;
            for (let i = 0; i < Math.min(left.length, right.length); i++) if (left[i] === right[i]) matches++;
            let ratio = matches / Math.min(left.length, right.length);
            if (ratio >= 0.85) {
                let mirrorPos = mid - (n - mid);
                if (mirrorPos >= 0 && mirrorPos < n) signals.push({ p: results[mirrorPos], c: 62 + ratio * 15, w: 1.0, s: 'doi_xung', r: `Đối xứng ${(ratio*100).toFixed(0)}%` });
            }
        }

        // Vai đầu vai
        if (scores.length >= 15) {
            let recentScores = scores.slice(-15);
            let peaks = [];
            for (let i = 2; i < recentScores.length - 2; i++) {
                if (recentScores[i] > recentScores[i - 1] && recentScores[i] > recentScores[i - 2] &&
                    recentScores[i] > recentScores[i + 1] && recentScores[i] > recentScores[i + 2]) peaks.push({ val: recentScores[i] });
            }
            if (peaks.length >= 3) {
                let l3 = peaks.slice(-3);
                if (l3[0].val < l3[1].val && l3[2].val < l3[1].val && Math.abs(l3[0].val - l3[2].val) <= 2) {
                    signals.push({ p: 'X', c: 75, w: 1.4, s: 'vai_dau_vai', r: 'Vai đầu vai' });
                }
            }
        }

        return signals;
    }

    // ============================================
    // TREND & PATTERN
    // ============================================
    analyzeTrendPattern(results, scores) {
        const n = results.length;
        const signals = [];
        if (n < 5) return signals;
        const last = results[n - 1];
        const lastScore = scores[n - 1];

        // Xu hướng đa khung
        for (const window of [5, 10, 15, 20]) {
            if (n < window) continue;
            let seg = results.slice(-window);
            let tCount = seg.filter(r => r === 'T').length;
            let ratio = tCount / window;
            if (ratio >= 0.7) signals.push({ p: 'X', c: 60 + ratio * 25, w: 1.0 + ratio * 0.5, s: `trend_over_${window}`, r: `Quá mua ${window} phiên` });
            else if (ratio <= 0.3) signals.push({ p: 'T', c: 60 + (1 - ratio) * 25, w: 1.0 + (1 - ratio) * 0.5, s: `trend_under_${window}`, r: `Quá bán ${window} phiên` });
        }

        // Pattern matching
        for (const len of [3, 4, 5, 6, 7]) {
            if (n <= len) continue;
            let pattern = results.slice(-len).join('');
            let counts = { T: 0, X: 0 };
            for (let i = 0; i < n - len; i++) {
                if (results.slice(i, i + len).join('') === pattern) counts[results[i + len]]++;
            }
            let total = counts.T + counts.X;
            if (total >= Math.max(3, 10 - len)) {
                let prob = counts.T / total;
                signals.push({
                    p: prob > 0.5 ? 'T' : 'X',
                    c: Math.round(Math.min(90, 50 + Math.abs(prob - 0.5) * (110 - len * 8))),
                    w: Math.max(0.5, 1.8 - len * 0.15),
                    s: `pattern_${len}`,
                    r: `Pattern ${len} (${total} lần)`
                });
            }
        }

        // Đảo liên tục
        if (n >= 10) {
            let sw = 0;
            for (let i = n - 9; i < n; i++) if (results[i] !== results[i - 1]) sw++;
            if (sw >= 8) signals.push({ p: last === 'T' ? 'X' : 'T', c: 72, w: 1.4, s: 'đảo_liên_tục', r: `Đảo rất nhiều ${sw}/9` });
            else if (sw >= 6) signals.push({ p: last === 'T' ? 'X' : 'T', c: 65, w: 1.1, s: 'đảo_nhiều', r: `Đảo nhiều ${sw}/9` });
        }

        // 5 phiên giống nhau
        let last5 = results.slice(-5);
        if (last5.every(r => r === 'T')) signals.push({ p: 'X', c: 84, w: 1.8, s: 'all_tai_5', r: '5 phiên toàn Tài' });
        else if (last5.every(r => r === 'X')) signals.push({ p: 'T', c: 84, w: 1.8, s: 'all_xiu_5', r: '5 phiên toàn Xỉu' });

        // Điểm cực đoan
        if (lastScore >= 17) signals.push({ p: 'X', c: 94, w: 2.5, s: 'score_17', r: 'Điểm >= 17' });
        else if (lastScore >= 15) signals.push({ p: 'X', c: 76, w: 1.5, s: 'score_15', r: 'Điểm >= 15' });
        if (lastScore <= 4) signals.push({ p: 'T', c: 94, w: 2.5, s: 'score_4', r: 'Điểm <= 4' });
        else if (lastScore <= 6) signals.push({ p: 'T', c: 72, w: 1.4, s: 'score_6', r: 'Điểm <= 6' });

        return signals;
    }

    // ============================================
    // 🎯 DỰ ĐOÁN VŨ TRỤ
    // ============================================
    predict() {
        const n = this.history.length;
        if (n < 5) return { prediction: 'Đang thu thập dữ liệu...', confidence: 0, wait: true };

        const results = this.history.map(h => h.result === 'Tài' ? 'T' : 'X');
        const scores = this.history.map(h => h.tong || (h.dice ? h.dice.reduce((a, b) => a + b, 0) : 0));

        const allSignals = [
            ...this.superDiceAnalysis(),
            ...this.superCauAnalysis(results, scores),
            ...this.analyzeTrendPattern(results, scores)
        ];

        if (allSignals.length === 0) {
            return { prediction: results[n - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 50 };
        }

        allSignals.sort((a, b) => (b.w * b.c) - (a.w * a.c));
        const topSignals = allSignals.slice(0, 50);

        const bestDNA = this.geneticPool.reduce((best, dna) => dna.fitness > best.fitness ? dna : best, this.geneticPool[0]);

        let scoreT = 0, scoreX = 0, totalW = 0;
        for (const signal of topSignals) {
            let catWeight = 1.0;
            const cat = signal.s.split('_')[0];
            if (cat === 'biet' || cat === 'rong' || cat === 'hổ') catWeight = bestDNA.bietWeight;
            else if (cat === 'cau' || cat === 'zigzag' || cat === 'doi' || cat === 'tam') catWeight = bestDNA.cauWeight;
            else if (cat === 'dice') catWeight = bestDNA.diceWeight;
            else if (cat === 'trend' || cat === 'pattern' || cat === 'score') catWeight = bestDNA.trendWeight;
            else if (cat === 'all' || cat === 'đảo') catWeight = bestDNA.specialWeight;

            const w = signal.w * (signal.c / 100) * catWeight;
            if (signal.p === 'T') scoreT += w; else scoreX += w;
            totalW += w;
        }

        if (totalW === 0) return { prediction: results[n - 1] === 'T' ? 'Xỉu' : 'Tài', confidence: 50 };

        const probT = scoreT / totalW;
        const finalPred = probT > 0.5 ? 'T' : 'X';
        let confidence = Math.round(Math.abs(probT - 0.5) * 2 * 100);
        confidence = Math.max(52, Math.min(98, confidence));

        const top5 = topSignals.slice(0, 5), top10 = topSignals.slice(0, 10);
        if (top10.every(s => s.p === top10[0].p)) confidence = Math.min(98, confidence + 15);
        else if (top5.every(s => s.p === top5[0].p)) confidence = Math.min(98, confidence + 8);

        if (this.loseStreak >= 3) confidence = Math.max(52, confidence - 5);
        if (this.winStreak >= 5) confidence = Math.min(98, confidence + 5);

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
            hotFaces: `${this.diceEngine.hotFaces.d1}-${this.diceEngine.hotFaces.d2}-${this.diceEngine.hotFaces.d3}`,
            generation: this.generation
        };
    }

    addSession(sessionData) {
        let result = sessionData.result || sessionData.ket_qua || '';
        if (result === 'Tài' || result === 'T') result = 'Tài';
        else if (result === 'Xỉu' || result === 'X') result = 'Xỉu';
        else return;

        const d1 = sessionData.x1 || sessionData.xuc_xac_1 || 0;
        const d2 = sessionData.x2 || sessionData.xuc_xac_2 || 0;
        const d3 = sessionData.x3 || sessionData.xuc_xac_3 || 0;

        this.history.push({
            result: result,
            tong: sessionData.tong || (d1 + d2 + d3),
            dice: [d1, d2, d3],
            timestamp: Date.now()
        });
        if (this.history.length > 3000) this.history = this.history.slice(-2500);
    }

    feedback(actualResult) {
        if (this.predictions.length === 0) return;
        let lastPred = this.predictions[this.predictions.length - 1];
        lastPred.actual = actualResult;
        let isCorrect = lastPred.prediction === actualResult;
        this.accuracy.total++;
        if (isCorrect) {
            this.accuracy.correct++;
            this.winStreak++;
            this.loseStreak = 0;
            if (this.winStreak > this.maxWinStreak) this.maxWinStreak = this.winStreak;
            if (this.geneticPool.length > 0) this.geneticPool[0].fitness += 1;
        } else {
            this.loseStreak++;
            this.winStreak = 0;
            if (this.geneticPool.length > 0) this.geneticPool[0].fitness -= 0.5;
        }
        if (this.accuracy.total % 20 === 0) this.evolve();
    }

    evolve() {
        this.geneticPool.sort((a, b) => b.fitness - a.fitness);
        const survivors = this.geneticPool.slice(0, 10);
        const newPool = [...survivors];
        while (newPool.length < 50) {
            const p1 = survivors[Math.floor(Math.random() * survivors.length)];
            const p2 = survivors[Math.floor(Math.random() * survivors.length)];
            const child = {};
            for (const key of Object.keys(p1)) {
                if (key === 'fitness') { child[key] = 0; continue; }
                child[key] = Math.random() > 0.5 ? p1[key] : p2[key];
                if (Math.random() < 0.1) child[key] += (Math.random() - 0.5) * 0.2;
                if (typeof p1[key] === 'number' && key.includes('Weight')) {
                    child[key] = Math.max(0.1, Math.min(3.0, child[key]));
                }
            }
            newPool.push(child);
        }
        this.geneticPool = newPool;
        this.generation++;
    }
}

// ======================================================
// KHỞI TẠO AI
// ======================================================
const cosmicAI = new CosmicPredictor();

// ======================================================
// ANALYZE CAU
// ======================================================
function analyzeCau(history) {
    if (history.length < 10) return "[Đang thu thập...]";
    const results = history.map(h => h.result === 'Tài' ? 'T' : 'X');
    const last20 = results.slice(-20);
    const last10 = results.slice(-10);
    let parts = [];

    let streak = 1;
    const last = last20[last20.length - 1];
    for (let i = last20.length - 2; i >= 0; i--) { if (last20[i] === last) streak++; else break; }
    if (streak >= 3) parts.push(`Bệt ${streak} ${last === 'T' ? 'Tài' : 'Xỉu'}`);

    let is11 = true;
    for (let i = 1; i < last10.length; i++) { if (last10[i] === last10[i - 1]) { is11 = false; break; } }
    if (is11) parts.push("Cầu 1-1");

    const tCount = last20.filter(r => r === 'T').length;
    if (parts.length === 0) {
        if (tCount >= 14) parts.push("Tài áp đảo");
        else if (tCount <= 6) parts.push("Xỉu áp đảo");
        else if (tCount >= 12) parts.push("Nghiêng Tài");
        else if (tCount <= 8) parts.push("Nghiêng Xỉu");
        else parts.push("Cân bằng");
    }

    return `[${parts.join(', ')}] - ${last20.join('')}`;
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
        winStreak: stats.currentWinStreak,
        loseStreak: stats.currentLoseStreak
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
// ROUTE CHÍNH
// ======================================================
app.get("/", async (req, res) => {
    try {
        const response = await axios.get(API_URL, { timeout: 15000 });
        const rawData = response.data;
        const history = normalizeData(rawData);

        for (const item of history) {
            if (item.phien > lastPhien) {
                globalHistory.push(item);
                cosmicAI.addSession(item);
                lastPhien = item.phien;

                if (lastPrediction && globalHistory.length >= 2) {
                    const prevSession = globalHistory[globalHistory.length - 2];
                    updateStats(lastPrediction, prevSession.ket_qua);
                    cosmicAI.feedback(prevSession.ket_qua === 'tài' ? 'Tài' : 'Xỉu');
                    lastPrediction = null;
                }
            }
        }
        if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);

        const latest = history[history.length - 1];
        const pattern = analyzeCau(history);
        const predict = cosmicAI.predict();
        lastPrediction = predict.prediction === 'Tài' ? 'tài' : 'xỉu';

        const accuracy = stats.totalPredictions > 0
            ? ((stats.totalCorrect / stats.totalPredictions) * 100).toFixed(1)
            : '0.0';

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
                dung: stats.totalCorrect,
                sai: stats.totalWrong,
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
        console.log("ERROR:", err.message);
        const accuracy = stats.totalPredictions > 0
            ? ((stats.totalCorrect / stats.totalPredictions) * 100).toFixed(1)
            : '0.0';

        res.json({
            id: "AnhKhoidzai Sunwin",
            phien_truoc: 0, xuc_xac1: 0, xuc_xac2: 0, xuc_xac3: 0, tong: 0,
            ket_qua: "tài", pattern: "[Lỗi fetch API]",
            phien_hien_tai: 0, du_doan: "tài", do_tin_cay: "52%",
            thong_ke: {
                tong_du_doan: stats.totalPredictions,
                dung: stats.totalCorrect,
                sai: stats.totalWrong,
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
                cosmicAI.addSession(item);
                lastPhien = item.phien;
                if (lastPrediction && globalHistory.length >= 2) {
                    const prevSession = globalHistory[globalHistory.length - 2];
                    updateStats(lastPrediction, prevSession.ket_qua);
                    cosmicAI.feedback(prevSession.ket_qua === 'tài' ? 'Tài' : 'Xỉu');
                    lastPrediction = null;
                }
            }
        }
        if (globalHistory.length > 200) globalHistory = globalHistory.slice(-200);

        const latest = history[history.length - 1];
        const pattern = analyzeCau(history);
        const predict = cosmicAI.predict();
        lastPrediction = predict.prediction === 'Tài' ? 'tài' : 'xỉu';

        const accuracy = stats.totalPredictions > 0
            ? ((stats.totalCorrect / stats.totalPredictions) * 100).toFixed(1)
            : '0.0';

        res.json({
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
                dung: stats.totalCorrect,
                sai: stats.totalWrong,
                ti_le_dung: accuracy + "%",
                chuoi_thang_hien_tai: stats.currentWinStreak,
                chuoi_thua_hien_tai: stats.currentLoseStreak,
                chuoi_thang_max: stats.maxWinStreak,
                chuoi_thua_max: stats.maxLoseStreak
            }
        });
    } catch (err) {
        const accuracy = stats.totalPredictions > 0
            ? ((stats.totalCorrect / stats.totalPredictions) * 100).toFixed(1)
            : '0.0';
        res.json({
            id: "AnhKhoidzai Sunwin",
            phien_truoc: 0, xuc_xac1: 0, xuc_xac2: 0, xuc_xac3: 0, tong: 0,
            ket_qua: "tài", pattern: "[Lỗi]",
            phien_hien_tai: 0, du_doan: "tài", do_tin_cay: "52%",
            thong_ke: {
                tong_du_doan: stats.totalPredictions,
                dung: stats.totalCorrect,
                sai: stats.totalWrong,
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
    const accuracy = stats.totalPredictions > 0
        ? ((stats.totalCorrect / stats.totalPredictions) * 100).toFixed(1)
        : '0.0';
    res.json({
        tong_du_doan: stats.totalPredictions,
        dung: stats.totalCorrect,
        sai: stats.totalWrong,
        ti_le_dung: accuracy + "%",
        chuoi_thang_hien_tai: stats.currentWinStreak,
        chuoi_thua_hien_tai: stats.currentLoseStreak,
        chuoi_thang_max: stats.maxWinStreak,
        chuoi_thua_max: stats.maxLoseStreak,
        lich_su_gan_day: stats.predictionLog.slice(-10).reverse()
    });
});

app.listen(PORT, () => {
    console.log("🌌 Server Cosmic chạy tại port " + PORT);
    console.log("🔗 API: " + API_URL);
});
